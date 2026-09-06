import { Env } from '../types';
import { ok, badRequest, notFound, forbidden, created, unauthorized, conflict } from '../utils/http';
import { requireAuth, isAdmin, isModerator } from '../auth/session';
import { safeBody, safeStringEnum, validateUrl } from '../validation';

const UPDATE_TYPES = ['ANNOUNCEMENT', 'RELEASE', 'FEATURE', 'IMPROVEMENT', 'FIX', 'MAINTENANCE'] as const;
const REACTIONS = ['❤️', '👍', '🔥', '🎉'];

function parseChangelog(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length <= 400).slice(0, 50);
}

export async function listUpdates(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 50);

  let sql = `SELECT u.*, p.slug AS project_slug, p.name AS project_name, p.status AS project_status,
    auth.display_name AS author_name, auth.username AS author_username, auth.avatar AS author_avatar,
    auth.role AS author_role,
    (SELECT COUNT(*) FROM update_comments c WHERE c.update_id = u.id AND c.is_deleted = 0) AS comment_count
    FROM project_updates u
    JOIN projects p ON p.id = u.project_id
    JOIN users auth ON auth.id = u.author_id`;
  const binds = [];

  if (projectId) {
    sql += ' WHERE u.project_id = ?';
    binds.push(Number(projectId));
  }
  sql += ' ORDER BY u.pinned DESC, u.published_at DESC LIMIT ?';
  binds.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const withReactions = await Promise.all(results.map(async (r) => {
    const { results: reactions } = await env.DB.prepare(
      'SELECT reaction, COUNT(*) AS count FROM update_reactions WHERE update_id = ? GROUP BY reaction'
    ).bind(r.id).all();
    return { ...r, reactions: reactions as unknown[] };
  }));
  return ok(withReactions);
}

export async function getUpdate(id: number, env: Env): Promise<Response> {
  const update = await env.DB.prepare(
    `SELECT u.*, p.slug AS project_slug, p.name AS project_name, p.cover AS project_cover,
      auth.display_name AS author_name, auth.username AS author_username, auth.avatar AS author_avatar,
      auth.role AS author_role,
      (SELECT COUNT(*) FROM update_comments c WHERE c.update_id = u.id AND c.is_deleted = 0) AS comment_count
     FROM project_updates u
     JOIN projects p ON p.id = u.project_id
     JOIN users auth ON auth.id = u.author_id
     WHERE u.id = ?`
  ).bind(id).first();
  if (!update) return notFound('Update not found');

  const { results: reactions } = await env.DB.prepare(
    'SELECT reaction, COUNT(*) AS count FROM update_reactions WHERE update_id = ? GROUP BY reaction'
  ).bind(id).all();

  const { results: comments } = await env.DB.prepare(
    `SELECT c.*, u.username, u.display_name, u.avatar, u.role
       FROM update_comments c JOIN users u ON u.id = c.author_id
      WHERE c.update_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at ASC`
  ).bind(id).all();

  return ok({
    ...update,
    reactions: reactions as unknown[],
    comments: comments as unknown[],
  });
}

export async function createUpdate(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isAdmin(auth.user)) return forbidden('Only admins can publish official project updates');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const projectId = Number(body.project_id);
  if (!projectId) return badRequest('project_id is required');
  const project = await env.DB.prepare('SELECT id, slug, name FROM projects WHERE id = ?').bind(projectId).first();
  if (!project) return notFound('Project not found');

  const title = safeBody(body.title, 'title', 200);
  if (!title) return badRequest('title is required (max 200 chars)');
  const bodyText = safeBody(body.body, 'body', 20000) ?? '';
  const updateType = safeStringEnum(body.update_type, UPDATE_TYPES, 'RELEASE');
  const version = typeof body.version === 'string' ? body.version.slice(0, 30) : null;
  const image = typeof body.image === 'string' && body.image ? body.image : null;
  const changelog = JSON.stringify(parseChangelog(body.changelog));
  const pinned = body.pinned === true ? 1 : 0;
  const live_url = typeof body.live_url === 'string' && body.live_url ? body.live_url : null;
  const github_url = typeof body.github_url === 'string' && body.github_url ? body.github_url : null;

  if (validateUrl(live_url, 'live_url') || validateUrl(github_url, 'github_url')) {
    return badRequest('Invalid URL');
  }

  const { meta } = await env.DB.prepare(
    `INSERT INTO project_updates (project_id, author_id, version, title, body, image, update_type, changelog, published_at, pinned, live_url, github_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(projectId, auth.user.id, version, title, bodyText, image, updateType, changelog, Math.floor(Date.now() / 1000), pinned, live_url, github_url).run();

  // Notify followers
  const followers = await env.DB.prepare('SELECT user_id FROM followers WHERE project_id = ?').bind(projectId).all();
  const now = Math.floor(Date.now() / 1000);
  for (const f of (followers.results as { user_id: number }[])) {
    if (f.user_id === auth.user.id) continue;
    await env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, body, link, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      f.user_id,
      updateType === 'RELEASE' ? 'PROJECT_RELEASE' : 'PROJECT_UPDATE',
      updateType === 'RELEASE' ? `New release: ${project.name} ${version ?? ''}` : title,
      title,
      `/projects/${project.slug}/updates/${Number(meta.last_row_id)}`,
      auth.user.id,
      now
    ).run();
  }

  const update = await env.DB.prepare('SELECT * FROM project_updates WHERE id = ?').bind(Number(meta.last_row_id)).first();
  return created(update);
}

export async function reactToUpdate(request: Request, env: Env, updateId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const update = await env.DB.prepare('SELECT id FROM project_updates WHERE id = ?').bind(updateId).first();
  if (!update) return notFound('Update not found');

  let body: { reaction?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const reaction = typeof body.reaction === 'string' ? body.reaction : '';
  if (!REACTIONS.includes(reaction)) return badRequest('Invalid reaction');

  const existing = await env.DB.prepare('SELECT id FROM update_reactions WHERE update_id = ? AND user_id = ? AND reaction = ?')
    .bind(updateId, auth.user.id, reaction).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM update_reactions WHERE id = ?').bind(existing.id).run();
  } else {
    await env.DB.prepare('INSERT INTO update_reactions (update_id, user_id, reaction) VALUES (?, ?, ?)')
      .bind(updateId, auth.user.id, reaction).run();
  }

  const { results: reactions } = await env.DB.prepare(
    'SELECT reaction, COUNT(*) AS count FROM update_reactions WHERE update_id = ? GROUP BY reaction'
  ).bind(updateId).all();
  return ok(reactions as unknown[]);
}

export async function addComment(request: Request, env: Env, updateId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const update = await env.DB.prepare('SELECT id FROM project_updates WHERE id = ?').bind(updateId).first();
  if (!update) return notFound('Update not found');

  let body: { body?: unknown; parent_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const commentBody = safeBody(body.body, 'body', 4000);
  if (!commentBody) return badRequest('Comment body is required (max 4000 chars)');

  const parentId = body.parent_id ? Number(body.parent_id) : null;
  if (parentId) {
    const parent = await env.DB.prepare('SELECT id FROM update_comments WHERE id = ? AND update_id = ?').bind(parentId, updateId).first();
    if (!parent) return badRequest('Parent comment not found in this update');
  }

  const { meta } = await env.DB.prepare(
    'INSERT INTO update_comments (update_id, author_id, parent_id, body) VALUES (?, ?, ?, ?)'
  ).bind(updateId, auth.user.id, parentId, commentBody).run();

  const comment = await env.DB.prepare(
    `SELECT c.*, u.username, u.display_name, u.avatar, u.role
       FROM update_comments c JOIN users u ON u.id = c.author_id
      WHERE c.id = ?`
  ).bind(Number(meta.last_row_id)).first();
  return created(comment);
}

export async function editComment(request: Request, env: Env, commentId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const comment = await env.DB.prepare('SELECT * FROM update_comments WHERE id = ? AND is_deleted = 0').bind(commentId).first();
  if (!comment) return notFound('Comment not found');
  if (comment.author_id !== auth.user.id && !isModerator(auth.user)) {
    return forbidden('You can only edit your own comments');
  }

  let body: { body?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const commentBody = safeBody(body.body, 'body', 4000);
  if (!commentBody) return badRequest('Comment body is required');

  await env.DB.prepare('UPDATE update_comments SET body = ?, updated_at = unixepoch() WHERE id = ?')
    .bind(commentBody, commentId).run();
  return ok({ success: true });
}

export async function deleteComment(request: Request, env: Env, commentId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const comment = await env.DB.prepare('SELECT * FROM update_comments WHERE id = ? AND is_deleted = 0').bind(commentId).first();
  if (!comment) return notFound('Comment not found');
  if (comment.author_id !== auth.user.id && !isModerator(auth.user)) {
    return forbidden('You can only delete your own comments');
  }
  await env.DB.prepare('UPDATE update_comments SET is_deleted = 1 WHERE id = ?').bind(commentId).run();
  return ok({ success: true });
}