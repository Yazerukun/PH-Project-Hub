import { Env } from '../types';
import { json, unauthorized, badRequest, conflict, ok, error, forbidden, serverError } from '../utils/http';
import { hashPassword, verifyPassword, randomToken, isLegacyHash } from '../utils/crypto';
import { createSessionToken } from '../auth/session';
import { validateRequiredFields, isEmail, validPassword, USERNAME_RE, DISPLAY_NAME_RE, validateUrl, FieldError } from '../validation';
import { requireAuth } from '../auth/session';
import type { Role } from '../types';

const ROLE_RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };

function emailSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function privilegedRole(env: Env, email: string): 'OWNER' | 'ADMIN' | null {
  const e = email.trim().toLowerCase();
  if (emailSet(env.OWNER_EMAILS).has(e)) return 'OWNER';
  if (emailSet(env.ADMIN_EMAILS).has(e)) return 'ADMIN';
  return null;
}

interface RegisterBody {
  username?: unknown;
  email?: unknown;
  password?: unknown;
  display_name?: unknown;
}

export async function register(request: Request, env: Env): Promise<Response> {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const errors: FieldError[] = validateRequiredFields(body as Record<string, unknown>, [
    ['username', 24],
    ['email', 254],
    ['password', 128],
  ]);

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const display_name = typeof body.display_name === 'string' && body.display_name.trim()
    ? body.display_name.trim()
    : username;

  if (!USERNAME_RE.test(username)) {
    errors.push({ field: 'username', message: 'Username must be 3-24 chars (letters, numbers, underscore)' });
  }
  if (!isEmail(email)) {
    errors.push({ field: 'email', message: 'A valid email is required' });
  }
  if (!validPassword(body.password)) {
    errors.push({ field: 'password', message: 'Password must be 8-128 characters' });
  }
  if (!DISPLAY_NAME_RE.test(display_name)) {
    errors.push({ field: 'display_name', message: 'Display name must be at most 50 characters' });
  }

  if (errors.length) {
    return badRequest(errors.map((e) => e.message).join('; '));
  }

  const existingUser = await env.DB.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .bind(username, email)
    .first();
  if (existingUser) {
    return conflict('Username or email already in use');
  }

  const { hash, salt } = await hashPassword(body.password as string);

  const role = privilegedRole(env, email) ?? 'MEMBER';

  const result = await env.DB.prepare(
    'INSERT INTO users (username, email, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(username, email, display_name, `${salt}:${hash}`, role).run();

  const userId = Number(result.meta.last_row_id);
  const token = await createSession(request, env, userId);
  return ok(
    {
      token,
      user: {
        id: userId,
        username,
        display_name,
        email,
        role,
        avatar: null,
        created_at: Math.floor(Date.now() / 1000),
      },
    },
    201
  );
}

export async function login(request: Request, env: Env): Promise<Response> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return badRequest('Email and password are required');
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (!user) {
    return unauthorized('Invalid email or password');
  }

  const { password_hash } = user;
  const [salt, hash] = String(password_hash).split(':');
  if (!salt || !hash) {
    return serverError('Account is misconfigured');
  }
  const valid = await verifyPassword(password, hash, salt);
  if (!valid) {
    return unauthorized('Invalid email or password');
  }

  // Transparent upgrade: rehash accounts still stored with the pre-launch
  // salted SHA-256 scheme the first time they log in.
  if (isLegacyHash(hash)) {
    const { hash: newHash, salt: newSalt } = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(`${newSalt}:${newHash}`, user.id).run();
  }

  if (user.is_banned === 1) {
    return forbidden('This account has been banned');
  }

  let role = user.role as Role;
  const want = privilegedRole(env, email);
  if (want && ROLE_RANK[want] > ROLE_RANK[role]) {
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(want, user.id).run();
    role = want;
  }

  const token = await createSession(request, env, user.id as number);
  return ok({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      role,
      avatar: user.avatar,
      created_at: user.created_at,
    },
  });
}

async function createSession(request: Request, env: Env, userId: number): Promise<string> {
  const ttl = Number(env.SESSION_TTL_SECONDS ?? '604800');
  const token = await createSessionToken(userId, ttl, env);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ua = request.headers.get('User-Agent') ?? '';
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(token, userId, ip, ua, Math.floor(Date.now() / 1000) + ttl).run();
  return token;
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth) {
    const header = request.headers.get('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }
  }
  return ok({ success: true });
}

export async function me(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) {
    return unauthorized();
  }
  const { user } = auth;
  return ok({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    github_url: user.github_url,
    website: user.website,
    role: user.role,
    status: user.status,
    status_message: user.status_message,
    created_at: user.created_at,
  });
}

export async function updateProfile(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) {
    return unauthorized();
  }
  const { user } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  const errors: FieldError[] = [];

  const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : undefined;
  if (display_name !== undefined) {
    if (!display_name || !DISPLAY_NAME_RE.test(display_name)) {
      errors.push({ field: 'display_name', message: 'Display name must be 1-50 characters' });
    } else {
      sets.push('display_name = ?');
      values.push(display_name);
    }
  }

  for (const [field, max] of [
    ['bio', 200],
    ['status_message', 120],
  ] as const) {
    const value = typeof body[field] === 'string' ? body[field].trim() : undefined;
    if (value !== undefined) {
      if (value.length > max) {
        errors.push({ field, message: `${field.replace('_', ' ')} must be at most ${max} characters` });
      } else {
        sets.push(`${field} = ?`);
        values.push(value || null);
      }
    }
  }

  for (const field of ['avatar', 'github_url', 'website'] as const) {
    const value = typeof body[field] === 'string' ? body[field].trim() : undefined;
    if (value !== undefined) {
      const urlError = validateUrl(value, field);
      if (urlError) {
        errors.push(urlError);
      } else {
        sets.push(`${field} = ?`);
        values.push(value || null);
      }
    }
  }

  if (typeof body.new_password === 'string' && body.new_password) {
    const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
    if (!validPassword(body.new_password)) {
      errors.push({ field: 'new_password', message: 'Password must be 8-128 characters' });
    } else if (!currentPassword) {
      errors.push({ field: 'current_password', message: 'Current password is required to change password' });
    } else {
      const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
      if (!row) {
        return serverError('Account not found');
      }
      const [salt, hash] = String(row.password_hash).split(':');
      const valid = await verifyPassword(currentPassword, hash, salt);
      if (!valid) {
        errors.push({ field: 'current_password', message: 'Current password is incorrect' });
      } else {
        const { hash: newHash, salt: newSalt } = await hashPassword(body.new_password);
        sets.push('password_hash = ?');
        values.push(`${newSalt}:${newHash}`);
      }
    }
  }

  if (errors.length) {
    return badRequest(errors.map((e) => e.message).join('; '));
  }
  if (!sets.length) {
    return badRequest('No profile fields provided');
  }

  sets.push('updated_at = unixepoch()');
  values.push(user.id);

  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await env.DB.prepare(
    `SELECT id, username, display_name, email, avatar, bio, github_url, website, role, status, status_message, created_at FROM users WHERE id = ?`
  )
    .bind(user.id)
    .first();

  if (!updated) {
    return serverError('Account not found');
  }

  return ok({
    id: updated.id,
    username: updated.username,
    display_name: updated.display_name,
    email: updated.email,
    avatar: updated.avatar,
    bio: updated.bio,
    github_url: updated.github_url,
    website: updated.website,
    role: updated.role,
    status: updated.status,
    status_message: updated.status_message,
    created_at: updated.created_at,
  });
}
