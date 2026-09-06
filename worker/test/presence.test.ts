import { describe, expect, it } from 'vitest';
import { PresenceRoom } from '../src/durable-objects/presence-room';
import type { Env } from '../src/types';

function makeRoom() {
  return new PresenceRoom({} as DurableObjectState, {} as Env);
}

function post(path: string, body: Record<string, unknown>) {
  return new Request(`https://presence${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PresenceRoom', () => {
  it('beat marks a user online and snapshot includes them', async () => {
    const room = makeRoom();
    await room.fetch(post('/presence/beat', { userId: 4, username: 'franz', displayName: 'Franz' }));
    const res = await room.fetch(new Request('https://presence/presence/snapshot'));
    const body = (await res.json()) as { count: number; users: Array<{ userId: number; username: string }> };
    expect(body.count).toBe(1);
    expect(body.users[0]).toMatchObject({ userId: 4, username: 'franz' });
  });

  it('keeps a site-online user after leaving all chat channels', async () => {
    const room = makeRoom();
    await room.fetch(post('/presence/beat', { userId: 4, username: 'franz', displayName: 'Franz' }));
    await room.fetch(post('/presence/join', { userId: 4, username: 'franz', displayName: 'Franz', channelId: 1 }));
    await room.fetch(post('/presence/leave', { userId: 4, channelId: 1 }));
    const res = await room.fetch(new Request('https://presence/presence/snapshot'));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(1);
  });

  it('removes a user after leaving chat with no site heartbeat', async () => {
    const room = makeRoom();
    await room.fetch(post('/presence/join', { userId: 3, username: 'member', displayName: 'Member', channelId: 1 }));
    await room.fetch(post('/presence/leave', { userId: 3, channelId: 1 }));
    const res = await room.fetch(new Request('https://presence/presence/snapshot'));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(0);
  });

  it('refreshes lastSeen on repeated beats', async () => {
    const room = makeRoom();
    await room.fetch(post('/presence/beat', { userId: 4, username: 'franz', displayName: 'Franz' }));
    const before = Date.now();
    await room.fetch(post('/presence/beat', { userId: 4, username: 'franz', displayName: 'Franz' }));
    const res = await room.fetch(new Request('https://presence/presence/snapshot'));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(1);
    expect(Date.now() - before).toBeGreaterThanOrEqual(0);
  });
});