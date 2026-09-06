import type { Env, User, AuthUser } from '../types';
import { randomToken } from '../utils/crypto';

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64Url(sig);
}

export async function createSessionToken(userId: number, ttlSeconds: number, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const jti = randomToken(18);
  const payload = JSON.stringify({ sub: userId, iat: now, exp, jti });
  const encoded = new TextEncoder().encode(payload);
  const buf = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  const payloadB64 = base64Url(buf);
  const sig = await sign(payloadB64, env.AUTH_SECRET);
  return `${payloadB64}.${sig}`;
}

export async function verifySessionToken(token: string, env: Env): Promise<number | null> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const expected = await sign(payloadB64, env.AUTH_SECRET);
    if (expected !== sig) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as { sub: number; exp: number };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function getUserById(env: Env, id: number): Promise<User | null> {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
  return row ?? null;
}

export async function requireAuth(request: Request, env: Env): Promise<{ user: User; token: string } | null> {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const userId = await verifySessionToken(token, env);
  if (userId === null) return null;

  const session = await env.DB.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .bind(token, Math.floor(Date.now() / 1000))
    .first();
  if (!session) return null;

  const user = await getUserById(env, userId);
  if (!user || user.is_banned === 1) return null;

  return { user, token };
}

export function isModerator(user: { role: string }): boolean {
  return user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MODERATOR';
}

export function isAdmin(user: { role: string }): boolean {
  return user.role === 'OWNER' || user.role === 'ADMIN';
}

export function isOwner(user: { role: string }): boolean {
  return user.role === 'OWNER';
}

export function canPublishOfficialUpdates(user: { role: string }): boolean {
  return isAdmin(user);
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar: user.avatar,
    role: user.role,
  };
}
