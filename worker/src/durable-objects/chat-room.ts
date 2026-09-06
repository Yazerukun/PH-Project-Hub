import { Env, AuthUser } from '../types';
import { verifySessionToken } from '../auth/session';
import { safeMessage } from '../validation';

interface Client {
  ws: WebSocket;
  user: AuthUser;
  status: 'ONLINE' | 'AWAY';
  joinedAt: number;
}

type OutgoingMessage =
  | { type: 'history'; messages: unknown[]; hasMore: boolean }
  | { type: 'message'; message: unknown }
  | { type: 'presence'; online: ClientState[]; count: number }
  | { type: 'typing'; channelId: string; users: string[] }
  | { type: 'message_deleted'; id: number }
  | { type: 'message_edited'; message: unknown }
  | { type: 'message_pinned'; messageId: number; pinned: boolean }
  | { type: 'reaction_updated'; messageId: number; reactions: Record<string, number> }
  | { type: 'history_updated'; message: unknown }
  | { type: 'error'; message: string };

interface ClientState {
  userId: number;
  username: string;
  displayName: string;
  status: string;
}

interface ChatRoomState {
  channelId: number;
  env: Env;
}

interface WSEvent {
  type: string;
  ch: number;
}

export class ChatRoom {
  state: DurableObjectState;
  channelId: number;
  env: Env;
  clients = new Map<WebSocket, Client>();
  typedChannels = new Map<string, Map<WebSocket, number>>();
  private storageReady: Promise<void>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.channelId = 0;
    this.storageReady = this.init();
  }

  async init(): Promise<void> {
    const stored = await this.state.storage.get<{ channelId: number }>('meta');
    if (stored) this.channelId = stored.channelId;
  }

  now(): number {
    return Math.floor(Date.now() / 1000);
  }

  async fetch(request: Request): Promise<Response> {
    await this.storageReady;
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('ChatRoom: WebSocket upgrade required', { status: 400 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const pathMatch = url.pathname.match(/^\/api\/chat\/([^/]+)\/ws$/);
    const channelId = pathMatch ? Number(pathMatch[1]) : NaN;
    if (!channelId) {
      return new Response('ChatRoom: missing channel', { status: 400 });
    }

    const userId = await verifySessionToken(token, this.env);
    if (userId === null) {
      return new Response('ChatRoom: invalid session', { status: 401 });
    }

    const userRow = await this.env.DB.prepare('SELECT id, username, display_name, avatar, role FROM users WHERE id = ?')
      .bind(userId).first<{ id: number; username: string; display_name: string; avatar: string | null; role: AuthUser['role'] }>();
    if (!userRow || userRow.role === undefined) {
      return new Response('ChatRoom: user not found', { status: 401 });
    }

    const banned = await this.env.DB.prepare('SELECT is_banned FROM users WHERE id = ?')
      .bind(userId).first<{ is_banned: number }>();
    if (banned?.is_banned === 1) {
      return new Response('ChatRoom: user banned', { status: 403 });
    }

    const channel = await this.env.DB.prepare('SELECT id, is_locked FROM channels WHERE id = ?')
      .bind(channelId).first<{ id: number; is_locked: number }>();
    if (!channel) {
      return new Response('ChatRoom: channel not found', { status: 404 });
    }

    if (this.channelId === 0) {
      this.channelId = channelId;
      await this.state.storage.put('meta', { channelId });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    this.clients.set(server, {
      ws: server,
      user: {
        id: userRow.id,
        username: userRow.username,
        display_name: userRow.display_name,
        avatar: userRow.avatar,
        role: userRow.role ?? 'MEMBER',
      },
      status: 'ONLINE',
      joinedAt: this.now(),
    });

    server.addEventListener('message', (event) => {
      const data = (event as MessageEvent).data as string | ArrayBuffer;
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
      this.handleClientMessage(server, text);
    });

    server.addEventListener('close', () => {
      const leaving = this.clients.get(server);
      this.clients.delete(server);
      if (leaving) this.reportPresence('leave', leaving.user);
      this.broadcastPresence();
    });

    server.addEventListener('error', () => {
      const leaving = this.clients.get(server);
      this.clients.delete(server);
      if (leaving) this.reportPresence('leave', leaving.user);
      this.broadcastPresence();
    });

    this.reportPresence('join', { id: userRow.id, username: userRow.username, display_name: userRow.display_name });
    this.broadcastPresence();
    this.sendHistory(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  private clientState(ws: WebSocket): ClientState | null {
    const c = this.clients.get(ws);
    if (!c) return null;
    return {
      userId: c.user.id,
      username: c.user.username,
      displayName: c.user.display_name,
      status: c.status,
    };
  }

  private broadcastPresence(): void {
    const states: ClientState[] = [];
    for (const c of this.clients.values()) {
      states.push(this.clientState(c.ws)!);
    }
    const msg: OutgoingMessage = { type: 'presence', online: states, count: states.length };
    const data = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
    }
  }

  private async reportPresence(
    action: 'join' | 'leave',
    user: { id: number; username: string; display_name: string }
  ): Promise<void> {
    try {
      const id = this.env.PRESENCE.idFromName('global');
      const stub = this.env.PRESENCE.get(id);
      const init =
        action === 'join'
          ? {
              method: 'POST',
              body: JSON.stringify({
                action,
                userId: user.id,
                username: user.username,
                displayName: user.display_name,
                channelId: this.channelId,
              }),
            }
          : {
              method: 'POST',
              body: JSON.stringify({ action, userId: user.id, channelId: this.channelId }),
            };
      if (action === 'join') {
        await stub.fetch('https://presence/presence/join', init);
      } else {
        await stub.fetch('https://presence/presence/leave', init);
      }
    } catch {
      // presence reporting is best-effort
    }
  }

  private send(ws: WebSocket, msg: OutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: OutgoingMessage): void {
    const data = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
    }
  }

  private async sendHistory(ws: WebSocket): Promise<void> {
    const limit = 50;
    const { results } = await this.env.DB.prepare(
      `SELECT m.*, u.username, u.display_name, u.avatar, u.role
         FROM messages m JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.is_deleted = 0
        ORDER BY m.id DESC LIMIT ?`
    ).bind(this.channelId, limit).all();

    const rows = (results as Record<string, unknown>[]).reverse();
    const messages = await this.attachReactions(rows);
    const hasMore = (results as unknown[]).length >= limit;
    this.send(ws, { type: 'history', messages, hasMore });
  }

  private async attachReactions(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => Number(r.id));
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await this.env.DB.prepare(
      `SELECT message_id, reaction, COUNT(*) AS count FROM message_reactions
         WHERE message_id IN (${placeholders}) GROUP BY message_id, reaction`
    ).bind(...ids).all();

    const reactions: Record<number, Record<string, number>> = {};
    for (const row of results as { message_id: number; reaction: string; count: number }[]) {
      reactions[row.message_id] = reactions[row.message_id] ?? {};
      reactions[row.message_id][row.reaction] = row.count;
    }
    return rows.map((r) => ({ ...r, reactions: reactions[Number(r.id)] ?? {} }));
  }

  private async handleClientMessage(ws: WebSocket, raw: string): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      this.send(ws, { type: 'error', message: 'Invalid message format' });
      return;
    }

    const type = typeof data.type === 'string' ? data.type : '';
    const client = this.clients.get(ws);
    if (!client) return;

    switch (type) {
      case 'ping': {
        this.send(ws, { type: 'pong' } as unknown as OutgoingMessage);
        break;
      }
      case 'message': {
        await this.handleSendMessage(ws, data);
        break;
      }
      case 'typing': {
        const typingMap = this.typedChannels.get(`ch${this.channelId}`) ?? new Map<WebSocket, number>();
        typingMap.set(ws, Date.now());
        this.typedChannels.set(`ch${this.channelId}`, typingMap);
        this.broadcastTyping();
        break;
      }
      case 'reaction': {
        await this.handleReaction(ws, data);
        break;
      }
      case 'delete': {
        await this.handleDelete(ws, data);
        break;
      }
      case 'edit': {
        await this.handleEdit(ws, data);
        break;
      }
      case 'pin': {
        await this.handlePin(ws, data);
        break;
      }
      case 'load_older': {
        await this.handleLoadOlder(ws, data);
        break;
      }
      case 'status': {
        const status = data.status === 'AWAY' ? 'AWAY' : 'ONLINE';
        client.status = status;
        this.broadcastPresence();
        break;
      }
      default:
        this.send(ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  private async handleSendMessage(ws: WebSocket, data: Record<string, unknown>): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    const text = safeMessage(data.body);
    if (!text) {
      this.send(ws, { type: 'error', message: 'Message must be 1-2000 characters' });
      return;
    }

    const muted = await this.env.DB.prepare(
      'SELECT is_muted, muted_until FROM users WHERE id = ?'
    ).bind(client.user.id).first<{ is_muted: number; muted_until: number | null }>();
    if (muted?.is_muted === 1) {
      if (!muted.muted_until || muted.muted_until > this.now()) {
        this.send(ws, { type: 'error', message: 'You are muted and cannot send messages' });
        return;
      }
    }

    const locked = await this.env.DB.prepare('SELECT is_locked FROM channels WHERE id = ?')
      .bind(this.channelId).first<{ is_locked: number }>();
    if (locked?.is_locked === 1 && client.user.role !== 'OWNER' && client.user.role !== 'ADMIN' && client.user.role !== 'MODERATOR') {
      this.send(ws, { type: 'error', message: 'This channel is locked' });
      return;
    }

    const replyTo = data.reply_to ? Number(data.reply_to) : null;
    const { meta } = await this.env.DB.prepare(
      'INSERT INTO messages (channel_id, user_id, body, reply_to) VALUES (?, ?, ?, ?)'
    ).bind(this.channelId, client.user.id, text, replyTo).run();

    const row = await this.env.DB.prepare(
      `SELECT m.*, u.username, u.display_name, u.avatar, u.role
         FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
    ).bind(Number(meta.last_row_id)).first();

    if (row) {
      const [withReactions] = await this.attachReactions([row as Record<string, unknown>]);
      this.broadcast({ type: 'message', message: { ...withReactions, reactions: {} } });
    }
  }

  private broadcastTyping(): void {
    const now = Date.now();
    const typingMap = this.typedChannels.get(`ch${this.channelId}`);
    if (!typingMap) return;

    for (const [ws, ts] of typingMap) {
      if (now - ts > 3000) typingMap.delete(ws);
    }

    const users: string[] = [];
    for (const ws of typingMap.keys()) {
      const state = this.clientState(ws);
      if (state) users.push(state.username);
    }
    this.broadcast({ type: 'typing', channelId: `ch${this.channelId}`, users });
  }

  private async handleReaction(ws: WebSocket, data: Record<string, unknown>): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;
    const messageId = Number(data.message_id);
    const allowed = new Set(['❤️', '👍', '🔥', '🎉', '👀', '💯']);
    const reaction = typeof data.reaction === 'string' ? data.reaction : '';
    if (!messageId || !allowed.has(reaction)) {
      this.send(ws, { type: 'error', message: 'Invalid reaction' });
      return;
    }

    const existing = await this.env.DB.prepare(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?'
    ).bind(messageId, client.user.id, reaction).first();
    if (existing) {
      await this.env.DB.prepare('DELETE FROM message_reactions WHERE id = ?').bind(existing.id).run();
    } else {
      await this.env.DB.prepare('INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)')
        .bind(messageId, client.user.id, reaction).run();
    }

    const { results } = await this.env.DB.prepare(
      'SELECT reaction, COUNT(*) AS count FROM message_reactions WHERE message_id = ? GROUP BY reaction'
    ).bind(messageId).all();
    const reactions: Record<string, number> = {};
    for (const r of results as { reaction: string; count: number }[]) reactions[r.reaction] = r.count;

    this.broadcast({ type: 'reaction_updated', messageId, reactions });
  }

  private async handleDelete(ws: WebSocket, data: Record<string, unknown>): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;
    const messageId = Number(data.message_id);
    if (!messageId) return;

    const msg = await this.env.DB.prepare('SELECT user_id FROM messages WHERE id = ? AND is_deleted = 0')
      .bind(messageId).first<{ user_id: number }>();
    if (!msg) return;
    const isMod = client.user.role === 'OWNER' || client.user.role === 'ADMIN' || client.user.role === 'MODERATOR';
    if (msg.user_id !== client.user.id && !isMod) {
      this.send(ws, { type: 'error', message: 'You can only delete your own messages' });
      return;
    }
    await this.env.DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').bind(messageId).run();
    this.broadcast({ type: 'message_deleted', id: messageId });
  }

  private async handleEdit(ws: WebSocket, data: Record<string, unknown>): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;
    const messageId = Number(data.message_id);
    const text = safeMessage(data.body);
    if (!messageId || !text) {
      this.send(ws, { type: 'error', message: 'Invalid edit payload' });
      return;
    }

    const msg = await this.env.DB.prepare('SELECT user_id FROM messages WHERE id = ? AND is_deleted = 0')
      .bind(messageId).first<{ user_id: number }>();
    if (!msg) return;
    if (msg.user_id !== client.user.id) {
      this.send(ws, { type: 'error', message: 'You can only edit your own messages' });
      return;
    }

    await this.env.DB.prepare('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?')
      .bind(text, this.now(), messageId).run();

    const row = await this.env.DB.prepare(
      `SELECT m.*, u.username, u.display_name, u.avatar, u.role
         FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
    ).bind(messageId).first();

    if (row) {
      const [withReactions] = await this.attachReactions([row as Record<string, unknown>]);
      this.broadcast({ type: 'message_edited', message: withReactions });
    }
  }

  private async handlePin(ws: WebSocket, data: Record<string, unknown>): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;
    const isMod = client.user.role === 'OWNER' || client.user.role === 'ADMIN' || client.user.role === 'MODERATOR';
    if (!isMod) {
      this.send(ws, { type: 'error', message: 'Only moderators can pin messages' });
      return;
    }
    const messageId = Number(data.message_id);
    if (!messageId) return;
    const pinned = data.pinned === true ? 1 : 0;
    await this.env.DB.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').bind(pinned, messageId).run();
    this.broadcast({ type: 'message_pinned', messageId, pinned: pinned === 1 });
  }

  private async handleLoadOlder(ws: WebSocket, data: Record<string, unknown>): Promise<void> {
    const before = Number(data.before) || Number.MAX_SAFE_INTEGER;
    const limit = Math.min(Number(data.limit) || 50, 100);
    const { results } = await this.env.DB.prepare(
      `SELECT m.*, u.username, u.display_name, u.avatar, u.role
         FROM messages m JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.is_deleted = 0 AND m.id < ?
        ORDER BY m.id DESC LIMIT ?`
    ).bind(this.channelId, before, limit).all();

    const rows = (results as Record<string, unknown>[]).reverse();
    const messages = await this.attachReactions(rows);
    const hasMore = (results as unknown[]).length >= limit;
    this.send(ws, { type: 'history', messages, hasMore });
  }
}