import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken, isModerator, isAdmin, isOwner, canPublishOfficialUpdates, toAuthUser } from '../src/auth/session';
import { makeEnv } from './helpers';

const env = makeEnv();
const secret = env.AUTH_SECRET;

describe('session tokens', () => {
  it('round-trips a valid token to the same user id', async () => {
    const token = await createSessionToken(5, 3600, env);
    expect(await verifySessionToken(token, env)).toBe(5);
  });

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken(5, 3600, env);
    const [payload, sig] = token.split('.');
    const shifted = Buffer.from(payload, 'base64').toString('utf8').replace('"sub":5', '"sub":9');
    const forged = Buffer.from(shifted).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(await verifySessionToken(`${forged}.${sig}`, env)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(5, 3600, env);
    const otherEnv = makeEnv();
    (otherEnv as { AUTH_SECRET: string }).AUTH_SECRET = 'another-secret';
    const tampered = { ...env, AUTH_SECRET: 'another-secret' };
    expect(await verifySessionToken(token, tampered)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await createSessionToken(5, -10, env);
    expect(await verifySessionToken(token, env)).toBeNull();
  });

  it('rejects malformed strings', async () => {
    expect(await verifySessionToken('', env)).toBeNull();
    expect(await verifySessionToken('not-a-token', env)).toBeNull();
    expect(await verifySessionToken(`${secret}.${secret}`, env)).toBeNull();
  });

  it('round-trips through base64url safely (no padding)', async () => {
    const token = await createSessionToken(123456789, 60, env);
    expect(token).not.toMatch(/[+/=]/);
  });

  it('never mints identical tokens in the same second (jti nonce)', async () => {
    const a = await createSessionToken(5, 3600, env);
    const b = await createSessionToken(5, 3600, env);
    const c = await createSessionToken(5, 3600, env);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });
});

describe('role helpers', () => {
  it('grants moderation powers to OWNER, ADMIN, MODERATOR', () => {
    for (const role of ['OWNER', 'ADMIN', 'MODERATOR']) {
      expect(isModerator({ role })).toBe(true);
    }
    expect(isModerator({ role: 'MEMBER' })).toBe(false);
  });

  it('reserves admin for OWNER and ADMIN', () => {
    expect(isAdmin({ role: 'OWNER' })).toBe(true);
    expect(isAdmin({ role: 'ADMIN' })).toBe(true);
    expect(isAdmin({ role: 'MODERATOR' })).toBe(false);
    expect(isAdmin({ role: 'MEMBER' })).toBe(false);
  });

  it('treats only OWNER as owner', () => {
    expect(isOwner({ role: 'OWNER' })).toBe(true);
    expect(isOwner({ role: 'ADMIN' })).toBe(false);
  });

  it('allows official update publishing only for admins', () => {
    expect(canPublishOfficialUpdates({ role: 'OWNER' })).toBe(true);
    expect(canPublishOfficialUpdates({ role: 'ADMIN' })).toBe(true);
    expect(canPublishOfficialUpdates({ role: 'MODERATOR' })).toBe(false);
    expect(canPublishOfficialUpdates({ role: 'MEMBER' })).toBe(false);
  });

  it('maps a User to an AuthUser', () => {
    const user = {
      id: 1,
      username: 'x',
      display_name: 'X',
      email: 'x@x.com',
      avatar: null,
      bio: null,
      github_url: null,
      website: null,
      role: 'MEMBER' as const,
      status: 'ONLINE' as const,
      status_message: null,
      is_banned: 0,
      is_muted: 0,
      muted_until: null,
      created_at: 0,
      updated_at: 0,
    };
    expect(toAuthUser(user)).toEqual({ id: 1, username: 'x', display_name: 'X', avatar: null, role: 'MEMBER' });
  });
});