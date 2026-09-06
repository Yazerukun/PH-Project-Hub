import { Env, User } from '../types';

export interface Pagination {
  offset: number;
  limit: number;
}

export function paginate(query: URLSearchParams, defaultLimit = 20, maxLimit = 50): Pagination {
  const limit = Math.min(Math.max(Number(query.get('limit') ?? defaultLimit) || defaultLimit, 1), maxLimit);
  const page = Math.max(Number(query.get('page') ?? '1') || 1, 1);
  const offset = (page - 1) * limit;
  return { offset, limit };
}

export interface ChannelRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: 'PROJECT' | 'COMMUNITY' | 'MODERATION';
  project_id: number | null;
  is_locked: number;
  position: number;
}

export async function getChannel(env: Env, channelId: number): Promise<ChannelRow | null> {
  return env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(channelId).first<ChannelRow>();
}

export async function getChannelBySlug(env: Env, slug: string): Promise<ChannelRow | null> {
  return env.DB.prepare('SELECT * FROM channels WHERE slug = ?').bind(slug).first<ChannelRow>();
}

export async function isUserMuted(env: Env, userId: number, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT is_muted, muted_until FROM users WHERE id = ?'
  ).bind(userId).first<{ is_muted: number; muted_until: number | null }>();
  if (!row) return false;
  if (row.is_muted === 1) {
    if (row.muted_until && row.muted_until > now) return true;
    if (!row.muted_until) return true;
  }
  return false;
}

export async function getUserPublic(env: Env, userId: number): Promise<Partial<User> | null> {
  return env.DB.prepare(
    'SELECT id, username, display_name, avatar, bio, github_url, website, role, status, status_message, created_at FROM users WHERE id = ?'
  ).bind(userId).first<Partial<User>>();
}

export async function touchSession(env: Env, token: string): Promise<void> {
  await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?')
    .bind(Math.floor(Date.now() / 1000), token)
    .run();
}
