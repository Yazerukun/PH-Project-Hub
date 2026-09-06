import { Env } from '../types';
import { ok, badRequest, notFound, forbidden, unauthorized, conflict } from '../utils/http';
import { requireAuth, isModerator } from '../auth/session';
import { safeMessage } from '../validation';

export async function listChannels(_request: Request, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM channels ORDER BY position ASC'
  ).all();
  return ok(results);
}

export async function getMessages(request: Request, env: Env, channelId: number): Promise<Response> {
  const channel = await env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(channelId).first();
  if (!channel) return notFound('Channel not found');

  const url = new URL(request.url);
  const before = url.searchParams.get('before');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);
  const offset = Number(url.searchParams.get('offset') ?? '0');

  let sql = `SELECT m.*, u.username, u.display_name, u.avatar, u.role,
    (SELECT COUNT(*) FROM message_reactions r WHERE r.message_id = m.id) AS reaction_count
    FROM messages m JOIN users u ON u.id = m.user_id WHERE m.channel_id = ?`;
  const binds: unknown[] = [channelId];

  if (before) {
    sql += ' AND m.id < ?';
    binds.push(Number(before));
  }
  sql += ' ORDER BY m.id DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const { results } = await env.DB.prepare(sql).bind(...binds).all();

  const messageIds = (results as { id: number }[]).map((r) => r.id);
  let reactions: Record<number, Record<string, number>> = {};
  if (messageIds.length) {
    const placeholders = messageIds.map(() => '?').join(',');
    const { results: reactionsRows } = await env.DB.prepare(
      `SELECT message_id, reaction, COUNT(*) AS count FROM message_reactions WHERE message_id IN (${placeholders}) GROUP BY message_id, reaction`
    ).bind(...messageIds).all();
    reactions = {};
    for (const row of reactionsRows as { message_id: number; reaction: string; count: number }[]) {
      reactions[row.message_id] = reactions[row.message_id] ?? {};
      reactions[row.message_id][row.reaction] = row.count;
    }
  }

  const messages = (results as Record<string, unknown>[]).map((m) => ({
    ...m,
    reactions: reactions[m.id as number] ?? {},
  })).reverse();

  return ok(messages);
}

export async function sendMessageRest(request: Request, env: Env, channelId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const channel = await env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(channelId).first<{ id: number; is_locked: number }>();
  if (!channel) return notFound('Channel not found');
  if (channel.is_locked === 1 && !isModerator(auth.user)) return forbidden('Channel is locked');

  let body: { body?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const text = safeMessage(body.body);
  if (!text) return badRequest('Message body is required (1-2000 chars)');

  const { meta } = await env.DB.prepare('INSERT INTO messages (channel_id, user_id, body) VALUES (?, ?, ?)')
    .bind(channelId, auth.user.id, text).run();

  const message = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.role FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
  ).bind(Number(meta.last_row_id)).first();
  return ok(message, 201);
}

export async function reactToMessage(request: Request, env: Env, messageId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  const message = await env.DB.prepare('SELECT id FROM messages WHERE id = ?').bind(messageId).first<{ id: number }>();
  if (!message) return notFound('Message not found');

  let body: { reaction?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const allowed = new Set(['❤️', '👍', '🔥', '🎉', '👀', '💯']);
  const reaction = typeof body.reaction === 'string' ? body.reaction : '';
  if (!allowed.has(reaction)) return badRequest('Invalid reaction');

  const existing = await env.DB.prepare(
    'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?'
  ).bind(messageId, auth.user.id, reaction).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM message_reactions WHERE id = ?').bind(existing.id).run();
  } else {
    await env.DB.prepare('INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)')
      .bind(messageId, auth.user.id, reaction).run();
  }
  return ok({ success: true });
}

export async function pinMessage(request: Request, env: Env, messageId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();
  if (!isModerator(auth.user)) return forbidden('Only moderators can pin messages');

  const message = await env.DB.prepare('SELECT id FROM messages WHERE id = ?').bind(messageId).first<{ id: number }>();
  if (!message) return notFound('Message not found');

  let body: { pinned?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const pinned = body.pinned === true ? 1 : 0;
  await env.DB.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').bind(pinned, messageId).run();
  return ok({ pinned: pinned === 1 });
}

export async function deleteMessage(request: Request, env: Env, messageId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();

  const message = await env.DB.prepare('SELECT * FROM messages WHERE id = ? AND is_deleted = 0')
    .bind(messageId).first<{ id: number; user_id: number }>();
  if (!message) return notFound('Message not found');
  if (message.user_id !== auth.user.id && !isModerator(auth.user)) {
    return forbidden('You can only delete your own messages');
  }
  await env.DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').bind(messageId).run();
  return ok({ success: true });
}

export async function editMessage(request: Request, env: Env, messageId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();

  const message = await env.DB.prepare('SELECT * FROM messages WHERE id = ? AND is_deleted = 0')
    .bind(messageId).first<{ id: number; user_id: number }>();
  if (!message) return notFound('Message not found');
  if (message.user_id !== auth.user.id) return forbidden('You can only edit your own messages');

  let body: { body?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  const text = safeMessage(body.body);
  if (!text) return badRequest('Message body is required (1-2000 chars)');

  await env.DB.prepare('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?')
    .bind(text, Math.floor(Date.now() / 1000), messageId).run();
  return ok({ success: true });
}