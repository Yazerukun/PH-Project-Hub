import type { Env } from '../types';

interface PresenceEntry {
  userId: number;
  username: string;
  displayName: string;
  channelIds: number[];
  siteOnline: boolean;
  lastSeen: number;
}

export class PresenceRoom {
  state: DurableObjectState;
  env: Env;
  entries = new Map<number, PresenceEntry>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/presence/join') {
        const { userId, username, displayName, channelId } = await request.json() as {
          userId: number; username: string; displayName: string; channelId: number;
        };
        const existing = this.entries.get(userId);
        if (existing) {
          if (!existing.channelIds.includes(channelId)) existing.channelIds.push(channelId);
          existing.lastSeen = Math.floor(Date.now() / 1000);
        } else {
          this.entries.set(userId, {
            userId, username, displayName, channelIds: [channelId], siteOnline: false, lastSeen: Math.floor(Date.now() / 1000),
          });
        }
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/presence/beat') {
        const { userId, username, displayName } = await request.json() as {
          userId: number; username: string; displayName: string;
        };
        const existing = this.entries.get(userId);
        if (existing) {
          existing.siteOnline = true;
          existing.lastSeen = Math.floor(Date.now() / 1000);
        } else {
          this.entries.set(userId, {
            userId, username, displayName, channelIds: [], siteOnline: true, lastSeen: Math.floor(Date.now() / 1000),
          });
        }
        await this.env.DB.prepare("UPDATE users SET status = 'ONLINE' WHERE id = ?").bind(userId).run().catch(() => {});
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/presence/leave') {
        const { userId, channelId } = await request.json() as { userId: number; channelId: number };
        const entry = this.entries.get(userId);
        if (entry) {
          entry.channelIds = entry.channelIds.filter((c) => c !== channelId);
          if (entry.channelIds.length === 0 && !entry.siteOnline) {
            this.entries.delete(userId);
            await this.env.DB.prepare("UPDATE users SET status = 'OFFLINE' WHERE id = ?").bind(userId).run().catch(() => {});
          }
        }
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/presence/snapshot') {
        const now = Math.floor(Date.now() / 1000);
        const active = Array.from(this.entries.values()).filter((e) => now - e.lastSeen < 120);
        return new Response(
          JSON.stringify({
            count: active.length,
            users: active.map((e) => ({
              userId: e.userId,
              username: e.username,
              displayName: e.displayName,
              status: 'ONLINE',
            })),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('{"error":"not found"}', { status: 404, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response('{"error":"internal"}', { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
}