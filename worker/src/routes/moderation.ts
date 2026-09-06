import { Env } from '../types';
import { ok, badRequest, notFound, forbidden, unauthorized } from '../utils/http';
import { requireAuth, isModerator, isAdmin, isOwner } from '../auth/session';
import { safeBody } from '../validation';

const REPORT_TARGETS = new Set(['message', 'comment', 'user', 'update']);
const REPORT_STATUSES = ['OPEN', 'IN PROGRESS', 'RESOLVED', 'DISMISSED'] as const;

export async function createReport(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const target_type = typeof body.target_type === 'string' ? body.target_type.toLowerCase() : '';
  if (!REPORT_TARGETS.has(target_type)) return badRequest('Invalid target_type');
  const target_id = Number(body.target_id);
  if (!target_id) return badRequest('target_id is required');
  const reason = safeBody(body.reason ?? '', 'reason', 200);
  if (!reason) return badRequest('Reason is required');
  const details = safeBody(body.details ?? '', 'details', 4000) ?? '';

  await env.DB.prepare(
    'INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(auth.user.id, target_type, target_id, reason, details).run();
  return ok({ success: true }, 201);
}

export async function listReports(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isModerator(auth.user)) return forbidden('Only moderators can view reports');

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  let sql = `SELECT r.*, u.username AS reporter_username FROM reports r JOIN users u ON u.id = r.reporter_id`;
  const binds: unknown[] = [];
  if (status) { sql += ' WHERE r.status = ?'; binds.push(status); }
  sql += ' ORDER BY r.created_at DESC';
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return ok(results);
}

export async function resolveReport(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isModerator(auth.user)) return forbidden('Only moderators can resolve reports');
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const status = typeof body.status === 'string' && REPORT_STATUSES.includes(body.status as (typeof REPORT_STATUSES)[number])
    ? body.status : 'RESOLVED';

  await env.DB.prepare(
    `UPDATE reports SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`
  ).bind(status, auth.user.id, Math.floor(Date.now() / 1000), id).run();
  return ok({ success: true });
}

export async function listUsers(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isModerator(auth.user)) return forbidden('Only moderators can list users');
  const { results } = await env.DB.prepare(
    `SELECT id, username, display_name, email, avatar, role, status, is_banned, is_muted, created_at FROM users ORDER BY id ASC`
  ).all();
  return ok(results);
}

export async function updateUser(request: Request, env: Env, userId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isModerator(auth.user)) return forbidden('Only moderators can moderate users');
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }

  const fields: string[] = [];
  const binds: unknown[] = [];
  if (body.is_banned !== undefined) { fields.push('is_banned = ?'); binds.push(body.is_banned ? 1 : 0); }
  if (body.is_muted !== undefined) { fields.push('is_muted = ?'); binds.push(body.is_muted ? 1 : 0); }
  if (body.muted_until !== undefined) { fields.push('muted_until = ?'); binds.push(Number(body.muted_until) || null); }
  if (body.status !== undefined && ['ONLINE', 'AWAY', 'OFFLINE'].includes(String(body.status))) { fields.push('status = ?'); binds.push(body.status); }
  if (!fields.length) return badRequest('Nothing to update');
  binds.push(userId);
  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  const user = await env.DB.prepare('SELECT id, username, display_name, avatar, role, status, is_banned, is_muted FROM users WHERE id = ?').bind(userId).first();
  return ok(user);
}

export async function changeRole(request: Request, env: Env, userId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isAdmin(auth.user)) return forbidden('Only admins can change roles');
  if (auth.user.id === userId) return badRequest('You cannot change your own role');
  let body: { role?: unknown };
  try { body = await request.json(); } catch { return badRequest('Invalid JSON'); }
  const role = String(body.role ?? '');
  if (!['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) return badRequest('Invalid role');
  if (role === 'OWNER' && !isOwner(auth.user)) return forbidden('Only the owner can grant the OWNER role');
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
  const user = await env.DB.prepare('SELECT id, username, display_name, avatar, role, status FROM users WHERE id = ?').bind(userId).first();
  return ok(user);
}

export async function listModerationActions(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isModerator(auth.user)) return forbidden('Only moderators can view moderation actions');
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);
  const { results } = await env.DB.prepare(
    `SELECT ma.*, u.username AS moderator_username FROM moderation_actions ma JOIN users u ON u.id = ma.moderator_id ORDER BY ma.created_at DESC LIMIT ?`
  ).bind(limit).all();
  return ok(results);
}