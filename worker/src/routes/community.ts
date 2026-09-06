import { Env } from '../types';
import { ok, badRequest, notFound, forbidden, unauthorized, created, conflict } from '../utils/http';
import { requireAuth, isModerator, isAdmin } from '../auth/session';
import { safeBody, safeStringEnum } from '../validation';

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const BUG_STATUSES = ['OPEN', 'INVESTIGATING', 'FIXED', 'CLOSED'] as const;
const SUGGESTION_STATUSES = ['NEW', 'UNDER REVIEW', 'PLANNED', 'IN PROGRESS', 'COMPLETED', 'REJECTED'] as const;
const ROADMAP_STATUSES = ['PLANNED', 'IN PROGRESS', 'COMPLETED'] as const;
const ROADMAP_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export async function listBugs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const status = url.searchParams.get('status');
  let sql = `SELECT b.*, p.name AS project_name, p.slug AS project_slug, u.username AS reporter_username, u.display_name AS reporter_name
    FROM bug_reports b JOIN projects p ON p.id = b.project_id JOIN users u ON u.id = b.reporter_id`;
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (projectId) { clauses.push('b.project_id = ?'); binds.push(Number(projectId)); }
  if (status) { clauses.push('b.status = ?'); binds.push(status); }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY b.created_at DESC';
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return ok(results);
}

export async function createBug(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }

  const title = safeBody(body.title, 'title', 200);
  if (!title) return badRequest('Title is required (max 200 chars)');
  const description = safeBody(body.description, 'description', 10000);
  if (!description) return badRequest('Description is required');
  const projectId = Number(body.project_id);
  const project = projectId ? await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first() : null;
  if (!project) return badRequest('A valid project_id is required');
  const severity = safeStringEnum(body.severity, SEVERITIES, 'MEDIUM');

  const { meta } = await env.DB.prepare(
    `INSERT INTO bug_reports (project_id, reporter_id, title, description, steps_to_reproduce, expected_behavior, actual_behavior, browser, device, screenshot, severity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    projectId, auth.user.id, title, description,
    safeBody(body.steps_to_reproduce ?? '', 'steps', 10000) ?? '',
    safeBody(body.expected_behavior ?? '', 'expected', 10000) ?? '',
    safeBody(body.actual_behavior ?? '', 'actual', 10000) ?? '',
    safeBody(body.browser ?? '', 'browser', 200) ?? '',
    safeBody(body.device ?? '', 'device', 200) ?? '',
    typeof body.screenshot === 'string' ? body.screenshot : null,
    severity
  ).run();
  const bug = await env.DB.prepare('SELECT * FROM bug_reports WHERE id = ?').bind(Number(meta.last_row_id)).first();
  return created(bug);
}

export async function updateBug(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const bug = await env.DB.prepare('SELECT * FROM bug_reports WHERE id = ?').bind(id).first<{ id: number; reporter_id: number; status: string }>();
  if (!bug) return notFound('Bug report not found');

  const isAdminUser = isModerator(auth.user);
  const isReporter = bug.reporter_id === auth.user.id;
  if (!isAdminUser && !isReporter) return forbidden('You can only edit your own bug reports');

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }

  const status = safeStringEnum(body.status, BUG_STATUSES);
  if (status && !isAdminUser) return forbidden('Only moderators can change status');

  const fields: string[] = [];
  const binds: unknown[] = [];
  if (typeof body.title === 'string') { fields.push('title = ?'); binds.push(body.title); }
  if (typeof body.description === 'string') { fields.push('description = ?'); binds.push(body.description); }
  if (status) { fields.push('status = ?'); binds.push(status); }
  if (!fields.length) return badRequest('Nothing to update');
  fields.push('updated_at = unixepoch()');
  binds.push(id);
  await env.DB.prepare(`UPDATE bug_reports SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  const updated = await env.DB.prepare('SELECT * FROM bug_reports WHERE id = ?').bind(id).first();
  return ok(updated);
}

export async function listSuggestions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const status = url.searchParams.get('status');
  const auth = await requireAuth(request, env);
  const userId = auth?.user.id ?? 0;

  let sql = `SELECT s.*, p.name AS project_name, p.slug AS project_slug, u.username AS author_username, u.display_name AS author_name,
    (SELECT COUNT(*) FROM suggestion_votes v WHERE v.suggestion_id = s.id) AS votes,
    EXISTS(SELECT 1 FROM suggestion_votes v2 WHERE v2.suggestion_id = s.id AND v2.user_id = ?) AS has_voted
    FROM suggestions s JOIN projects p ON p.id = s.project_id JOIN users u ON u.id = s.author_id`;
  const binds: unknown[] = [userId];
  const clauses: string[] = [];
  if (projectId) { clauses.push('s.project_id = ?'); binds.push(Number(projectId)); }
  if (status) { clauses.push('s.status = ?'); binds.push(status); }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY votes DESC, s.created_at DESC';
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return ok(results);
}

export async function createSuggestion(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const title = safeBody(body.title, 'title', 200);
  if (!title) return badRequest('Title is required');
  const description = safeBody(body.description, 'description', 10000);
  if (!description) return badRequest('Description is required');
  const projectId = Number(body.project_id);
  const project = projectId ? await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first() : null;
  if (!project) return badRequest('A valid project_id is required');

  const { meta } = await env.DB.prepare(
    'INSERT INTO suggestions (project_id, author_id, title, description) VALUES (?, ?, ?, ?)'
  ).bind(projectId, auth.user.id, title, description).run();
  const suggestion = await env.DB.prepare('SELECT * FROM suggestions WHERE id = ?').bind(Number(meta.last_row_id)).first();
  return created({ ...suggestion, votes: 0, has_voted: false });
}

export async function updateSuggestion(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const sug = await env.DB.prepare('SELECT * FROM suggestions WHERE id = ?').bind(id).first<{ status: string }>();
  if (!sug) return notFound('Suggestion not found');

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const status = body.status;
  if (status !== undefined) {
    if (!isModerator(auth.user)) return forbidden('Only moderators can change status');
    if (!SUGGESTION_STATUSES.includes(status as (typeof SUGGESTION_STATUSES)[number])) return badRequest('Invalid status');
    await env.DB.prepare('UPDATE suggestions SET status = ?, updated_at = unixepoch() WHERE id = ?').bind(status, id).run();
  }
  const updated = await env.DB.prepare('SELECT * FROM suggestions WHERE id = ?').bind(id).first();
  return ok(updated);
}

export async function voteSuggestion(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const sug = await env.DB.prepare('SELECT id FROM suggestions WHERE id = ?').bind(id).first();
  if (!sug) return notFound('Suggestion not found');

  const existing = await env.DB.prepare('SELECT id FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?')
    .bind(id, auth.user.id).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM suggestion_votes WHERE id = ?').bind(existing.id).run();
  } else {
    const { meta } = await env.DB.prepare('INSERT INTO suggestion_votes (suggestion_id, user_id) VALUES (?, ?)')
      .bind(id, auth.user.id).run();
    void meta;
  }
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS count FROM suggestion_votes WHERE suggestion_id = ?').bind(id).all();
  return ok({ votes: Number((results[0] as { count: number }).count), has_voted: !existing });
}

export async function listRoadmap(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  let sql = `SELECT r.*, p.name AS project_name, p.slug AS project_slug FROM roadmap_items r JOIN projects p ON p.id = r.project_id`;
  const binds: unknown[] = [];
  if (projectId) { sql += ' WHERE r.project_id = ?'; binds.push(Number(projectId)); }
  sql += ' ORDER BY r.status ASC, r.priority DESC, r.position ASC';
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return ok(results);
}

export async function createRoadmapItem(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isAdmin(auth.user)) return forbidden('Only admins can add roadmap items');
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const title = safeBody(body.title, 'title', 200);
  if (!title) return badRequest('Title is required');
  const projectId = Number(body.project_id);
  const project = projectId ? await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first() : null;
  if (!project) return badRequest('A valid project_id is required');
  const description = safeBody(body.description ?? '', 'description', 10000) ?? '';
  const priority = safeStringEnum(body.priority, ROADMAP_PRIORITIES, 'MEDIUM');
  const status = safeStringEnum(body.status, ROADMAP_STATUSES, 'PLANNED');
  const target_version = typeof body.target_version === 'string' ? body.target_version.slice(0, 30) : null;
  const position = Number(body.position) || 0;

  const { meta } = await env.DB.prepare(
    'INSERT INTO roadmap_items (project_id, title, description, priority, target_version, status, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(projectId, title, description, priority, target_version, status, position).run();
  const item = await env.DB.prepare('SELECT * FROM roadmap_items WHERE id = ?').bind(Number(meta.last_row_id)).first();
  return created(item);
}

export async function updateRoadmapItem(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isAdmin(auth.user)) return forbidden('Only admins can edit roadmap items');
  const item = await env.DB.prepare('SELECT id FROM roadmap_items WHERE id = ?').bind(id).first();
  if (!item) return notFound('Roadmap item not found');

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }

  const fields: string[] = [];
  const binds: unknown[] = [];
  if (typeof body.title === 'string') { fields.push('title = ?'); binds.push(body.title); }
  if (typeof body.description === 'string') { fields.push('description = ?'); binds.push(body.description); }
  const status = safeStringEnum(body.status, ROADMAP_STATUSES);
  if (status) { fields.push('status = ?'); binds.push(status); }
  const priority = safeStringEnum(body.priority, ROADMAP_PRIORITIES);
  if (priority) { fields.push('priority = ?'); binds.push(priority); }
  if (body.target_version !== undefined) { fields.push('target_version = ?'); binds.push(typeof body.target_version === 'string' ? body.target_version : null); }
  if (!fields.length) return badRequest('Nothing to update');
  fields.push('updated_at = unixepoch()');
  binds.push(id);
  await env.DB.prepare(`UPDATE roadmap_items SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  const updated = await env.DB.prepare('SELECT * FROM roadmap_items WHERE id = ?').bind(id).first();
  return ok(updated);
}

export async function followProject(request: Request, env: Env, slug: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const project = await env.DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (!project) return notFound('Project not found');

  const existing = await env.DB.prepare('SELECT id FROM followers WHERE project_id = ? AND user_id = ?')
    .bind(project.id, auth.user.id).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM followers WHERE id = ?').bind(existing.id).run();
  } else {
    try {
      await env.DB.prepare('INSERT INTO followers (project_id, user_id) VALUES (?, ?)')
        .bind(project.id, auth.user.id).run();
    } catch {
      return conflict('Already following');
    }
  }
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS count FROM followers WHERE project_id = ?').bind(project.id).all();
  return ok({ following: !existing, count: Number((results[0] as { count: number }).count) });
}

export async function getFollowerState(request: Request, env: Env, slug: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  const project = await env.DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (!project) return notFound('Project not found');
  const following = auth ? await env.DB.prepare('SELECT id FROM followers WHERE project_id = ? AND user_id = ?')
    .bind(project.id, auth.user.id).first() : null;
  return ok({ following: !!following });
}