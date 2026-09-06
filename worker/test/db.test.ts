import { describe, expect, it } from 'vitest';
import { paginate, getChannel, getChannelBySlug, isUserMuted, getUserPublic } from '../src/db/helpers';
import { FakeD1, makeEnv } from './helpers';

describe('db helpers', () => {
  it('paginate clamps bounds and computes offset', () => {
    const params = new URLSearchParams();
    expect(paginate(params)).toEqual({ offset: 0, limit: 20 });
    expect(paginate(new URLSearchParams({ page: '3', limit: '10' }))).toEqual({ offset: 20, limit: 10 });
    expect(paginate(new URLSearchParams({ page: '0', limit: '999' }))).toEqual({ offset: 0, limit: 50 });
    expect(paginate(new URLSearchParams({ page: 'abc', limit: 'abc' }))).toEqual({ offset: 0, limit: 20 });
  });

  it('getChannel and getChannelBySlug resolve channels', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    db.projects = [{ id: 1, slug: 'yomikaze', name: 'Yomikaze' }];
    const channel = { id: 7, slug: 'general', name: 'General', description: '', type: 'COMMUNITY' as const, project_id: null, is_locked: 0, position: 1 };
    db.channels = [channel];
    expect(await getChannel(env, 7)).toEqual(channel);
    expect(await getChannelBySlug(env, 'general')).toEqual(channel);
    expect(await getChannel(env, 999)).toBeNull();
  });

  it('isUserMuted respects permanent and timed mutes', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const member = db.users.find((u) => u.username === 'member');
    expect(member).toBeDefined();
    if (!member) return;

    expect(await isUserMuted(env, member.id)).toBe(false);

    member.is_muted = 1;
    member.muted_until = null;
    expect(await isUserMuted(env, member.id)).toBe(true);

    member.muted_until = Math.floor(Date.now() / 1000) + 3600;
    expect(await isUserMuted(env, member.id)).toBe(true);

    member.muted_until = Math.floor(Date.now() / 1000) - 3600;
    expect(await isUserMuted(env, member.id)).toBe(false);
  });

  it('getUserPublic omits internal columns', async () => {
    const env = makeEnv();
    const pub = (await getUserPublic(env, 3)) as Record<string, unknown> | null;
    expect(pub?.username).toBe('member');
    expect(pub?.is_banned).toBeUndefined();
    expect(pub?.password_hash).toBeUndefined();
    expect(pub?.email).toBeUndefined();
  });
});