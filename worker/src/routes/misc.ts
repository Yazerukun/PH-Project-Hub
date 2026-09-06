import { Env } from '../types';
import { ok, badRequest, unauthorized } from '../utils/http';
import { requireAuth } from '../auth/session';

export async function listNotifications(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);
  const { results } = await env.DB.prepare(
    `SELECT n.*, u.username AS actor_username, u.display_name AS actor_name, u.avatar AS actor_avatar
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC LIMIT ?`
  ).bind(auth.user.id, limit).all();
  return ok(results);
}

export async function unreadCount(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).bind(auth.user.id).all();
  return ok({ count: Number((results[0] as { count: number }).count) });
}

export async function markNotificationRead(request: Request, env: Env, id: number | null): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (id) {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(id, auth.user.id).run();
  } else {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').bind(auth.user.id).run();
  }
  return ok({ success: true });
}

export async function searchSomething(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const tab = url.searchParams.get('tab') ?? 'all';
  if (!q) return badRequest('Query is required');

  const results: Record<string, unknown> = { query: q };
  if (tab === 'projects' || tab === 'all') {
    const { results: projects } = await env.DB.prepare(
      'SELECT id, slug, name, description, category, status, version FROM projects WHERE name LIKE ? OR description LIKE ? LIMIT 10'
    ).bind(`%${q}%`, `%${q}%`).all();
    results.projects = projects;
  }
  if (tab === 'updates' || tab === 'all') {
    const { results: updates } = await env.DB.prepare(
      `SELECT u.id, u.title, u.body, u.published_at, u.update_type, p.slug AS project_slug, p.name AS project_name
         FROM project_updates u JOIN projects p ON p.id = u.project_id
        WHERE u.title LIKE ? OR u.body LIKE ? ORDER BY u.published_at DESC LIMIT 10`
    ).bind(`%${q}%`, `%${q}%`).all();
    results.updates = updates;
  }
  if (tab === 'users' || tab === 'all') {
    const { results: users } = await env.DB.prepare(
      'SELECT id, username, display_name, avatar, role FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND is_banned = 0 LIMIT 10'
    ).bind(`%${q}%`, `%${q}%`).all();
    results.users = users;
  }
  if (tab === 'messages' || tab === 'all') {
    const { results: messages } = await env.DB.prepare(
      `SELECT m.id, m.body, m.created_at, m.channel_id, c.name AS channel_name, c.slug AS channel_slug,
              u.username AS author_username, u.display_name AS author_name
         FROM messages m
         JOIN channels c ON c.id = m.channel_id
         JOIN users u ON u.id = m.user_id
        WHERE m.body LIKE ? AND m.is_deleted = 0 ORDER BY m.id DESC LIMIT 10`
    ).bind(`%${q}%`).all();
    results.messages = messages;
  }
  return ok(results);
}

export async function unsupported(): Promise<Response> {
  return badRequest('Not implemented');
}