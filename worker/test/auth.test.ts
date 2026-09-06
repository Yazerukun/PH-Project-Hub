import { describe, expect, it } from 'vitest';
import { register, login, me, logout, updateProfile } from '../src/routes/auth';
import { createSessionToken } from '../src/auth/session';
import { FakeD1, makeEnv, authedRequest, jsonBody } from './helpers';

function regBody(overrides: Record<string, unknown> = {}) {
  return { username: 'newfibb', email: 'fib@example.ph', password: 'supersecret99', ...overrides };
}

describe('register', () => {
  it('rejects invalid JSON', async () => {
    const env = makeEnv();
    const res = await register(new Request('https://phhub.test/api/register', { method: 'POST' }), env);
    expect(res.status).toBe(400);
  });

  it('rejects a username that is too short or has bad characters', async () => {
    const env = makeEnv();
    for (const username of ['ab', 'has space', 'pipe|', 'x'.repeat(25)]) {
      const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody({ username }) }), env);
      expect(res.status).toBe(400);
      const body = await jsonBody(res);
      expect(String(body.error)).toContain('Username');
    }
  });

  it('rejects an invalid email', async () => {
    const env = makeEnv();
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody({ email: 'not-an-email' }) }), env);
    expect(res.status).toBe(400);
    expect(String((await jsonBody(res)).error)).toContain('email');
  });

  it('rejects a weak password', async () => {
    const env = makeEnv();
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody({ password: 'short' }) }), env);
    expect(res.status).toBe(400);
    expect(String((await jsonBody(res)).error)).toContain('Password');
  });

  it('rejects a duplicate username/email', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody({ username: 'member' }) }), env);
    expect(res.status).toBe(409);
    expect(String((await jsonBody(res)).error)).toContain('already');
  });

  it('registers a new member and returns a token + user', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody() }), env);
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect((body.data as { token: string }).token).toBeTruthy();
    const user = (body.data as { user: { id: number; role: string; username: string } }).user;
    expect(user.role).toBe('MEMBER');
    expect(user.username).toBe('newfibb');
    expect(db.sessions).toHaveLength(1);
  });

  it('assigns ADMIN to an ADMIN_EMAILS email', async () => {
    const env = makeEnv({ adminEmails: 'admin@example.ph' });
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody({ email: 'admin@example.ph' }) }), env);
    expect(res.status).toBe(201);
    const user = ((await jsonBody(res)).data as { user: { role: string } }).user;
    expect(user.role).toBe('ADMIN');
  });

  it('assigns OWNER to an OWNER_EMAILS email', async () => {
    const env = makeEnv({ ownerEmails: 'owner@example.ph' });
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody({ email: 'owner@example.ph', username: 'devfrancis' }) }), env);
    expect(res.status).toBe(201);
    const user = ((await jsonBody(res)).data as { user: { role: string } }).user;
    expect(user.role).toBe('OWNER');
  });
});

describe('login', () => {
  it('logs in with the registered credentials', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    await register(authedRequest('/api/register', { method: 'POST', body: regBody() }), env);

    const res = await login(authedRequest('/api/login', { method: 'POST', body: { email: 'fib@example.ph', password: 'supersecret99' } }), env);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect((body.data as { token: string }).token).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    await register(authedRequest('/api/register', { method: 'POST', body: regBody() }), env);
    const res = await login(authedRequest('/api/login', { method: 'POST', body: { email: 'fib@example.ph', password: 'wrong-pass99' } }), env);
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await login(authedRequest('/api/login', { method: 'POST', body: { email: 'nobody@x.ph', password: 'whatever123' } }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('auto-promotes a member whose email is an OWNER_EMAILS', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    await register(authedRequest('/api/register', { method: 'POST', body: regBody({ email: 'owner188@gmail.com' }) }), env);
    const envOwner = makeEnv({ db, ownerEmails: 'owner188@gmail.com' });
    const res = await login(authedRequest('/api/login', { method: 'POST', body: { email: 'owner188@gmail.com', password: 'supersecret99' } }), envOwner);
    expect(res.status).toBe(200);
    const body = (await jsonBody(res)).data as { user: { role: string } };
    expect(body.user.role).toBe('OWNER');
    const row = db.users.find((u) => u.email === 'owner188@gmail.com');
    expect(row?.role).toBe('OWNER');
  });

  it('blocks a banned account', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    await register(authedRequest('/api/register', { method: 'POST', body: regBody() }), env);
    const created = db.users.find((u) => u.username === 'newfibb');
    if (created) created.is_banned = 1;
    const res = await login(authedRequest('/api/login', { method: 'POST', body: { email: 'fib@example.ph', password: 'supersecret99' } }), env);
    expect(res.status).toBe(403);
    expect(String((await jsonBody(res)).error)).toContain('banned');
  });
});

describe('me / logout', () => {
  it('returns 401 without a token', async () => {
    const res = await me(authedRequest('/api/me'), makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await createSessionToken(3, 3600, env);
    db.sessions.push({ token, user_id: 3, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    const res = await me(authedRequest('/api/me', { token }), env);
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect((body.data as { username: string }).username).toBe('member');
    expect((body.data as { role: string }).role).toBe('MEMBER');
  });

  it('logout deletes the session', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await createSessionToken(3, 3600, env);
    db.sessions.push({ token, user_id: 3, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    const res = await logout(authedRequest('/api/logout', { method: 'POST', token }), env);
    expect(res.status).toBe(200);
    expect(db.sessions).toHaveLength(0);
    const meRes = await me(authedRequest('/api/me', { token }), env);
    expect(meRes.status).toBe(401);
  });
});

describe('updateProfile', () => {
  async function registered() {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const res = await register(authedRequest('/api/register', { method: 'POST', body: regBody() }), env);
    const body = (await jsonBody(res)).data as { token: string; user: { id: number } };
    return { db, env, token: body.token, userId: body.user.id };
  }

  it('returns 401 without a token', async () => {
    const res = await updateProfile(authedRequest('/api/me', { method: 'PATCH', body: { bio: 'x' } }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('updates profile fields', async () => {
    const { env, token } = await registered();
    const res = await updateProfile(
      authedRequest('/api/me', {
        method: 'PATCH',
        token,
        body: { display_name: 'New Name', bio: 'Builder from PH', website: 'https://example.ph', status_message: 'Ship it' },
      }),
      env
    );
    expect(res.status).toBe(200);
    const data = (await jsonBody(res)).data as Record<string, unknown>;
    expect(data.display_name).toBe('New Name');
    expect(data.bio).toBe('Builder from PH');
    expect(data.website).toBe('https://example.ph');
    expect(data.status_message).toBe('Ship it');
    expect(data.username).toBe('newfibb');
  });

  it('rejects an invalid URL', async () => {
    const { env, token } = await registered();
    const res = await updateProfile(
      authedRequest('/api/me', { method: 'PATCH', token, body: { website: 'not-a-url' } }),
      env
    );
    expect(res.status).toBe(400);
    expect(String((await jsonBody(res)).error)).toContain('website');
  });

  it('rejects a too-long display name', async () => {
    const { env, token } = await registered();
    const res = await updateProfile(
      authedRequest('/api/me', { method: 'PATCH', token, body: { display_name: 'x'.repeat(51) } }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('changes password with the correct current password', async () => {
    const { db, env, token } = await registered();
    const res = await updateProfile(
      authedRequest('/api/me', { method: 'PATCH', token, body: { current_password: 'supersecret99', new_password: 'brandnewpass88' } }),
      env
    );
    expect(res.status).toBe(200);
    const oldLogin = await login(
      authedRequest('/api/login', { method: 'POST', body: { email: 'fib@example.ph', password: 'supersecret99' } }),
      env
    );
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(
      authedRequest('/api/login', { method: 'POST', body: { email: 'fib@example.ph', password: 'brandnewpass88' } }),
      env
    );
    expect(newLogin.status).toBe(200);
    expect(db.sessions).toHaveLength(2);
  });

  it('rejects a wrong current password', async () => {
    const { env, token } = await registered();
    const res = await updateProfile(
      authedRequest('/api/me', { method: 'PATCH', token, body: { current_password: 'wrong-pass1', new_password: 'brandnewpass88' } }),
      env
    );
    expect(res.status).toBe(400);
    expect(String((await jsonBody(res)).error)).toContain('Current password');
  });

  it('rejects an empty update body', async () => {
    const { env, token } = await registered();
    const res = await updateProfile(authedRequest('/api/me', { method: 'PATCH', token, body: {} }), env);
    expect(res.status).toBe(400);
  });
});