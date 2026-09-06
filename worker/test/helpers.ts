import type { Env } from '../src/types';
import type { Role, User } from '../src/types';

export interface TestOptions {
  host?: string;
  headers?: Record<string, string>;
  token?: string;
}

export function seedUsers(): User[] {
  const base = {
    avatar: null,
    bio: null,
    github_url: null,
    website: null,
    status: 'ONLINE' as const,
    status_message: null,
    is_banned: 0,
    is_muted: 0,
    muted_until: null,
    updated_at: Math.floor(Date.now() / 1000),
  };
  return [
    {
      id: 1,
      username: 'admin',
      display_name: 'Admin User',
      email: 'admin@phhub.dev',
      role: 'OWNER',
      created_at: 1700000000,
      ...base,
    },
    {
      id: 2,
      username: 'moderator',
      display_name: 'Moderator',
      email: 'mod@phhub.dev',
      role: 'MODERATOR',
      created_at: 1700000000,
      ...base,
    },
    {
      id: 3,
      username: 'member',
      display_name: 'Member User',
      email: 'member@phhub.dev',
      role: 'MEMBER',
      created_at: 1700000000,
      ...base,
    },
  ];
}

interface SuggestionRow {
  id: number;
  project_id: number;
  author_id: number;
  title: string;
  description: string;
  status: string;
  created_at: number;
  updated_at: number;
}

interface VoteRow {
  id: number;
  suggestion_id: number;
  user_id: number;
}

interface BugRow {
  id: number;
  project_id: number;
  reporter_id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
}

/**
 * A small in-memory D1 substitute that recognizes only the query shapes the
 * handlers under test actually run. It is intentionally narrow so a bug in the
 * real SQL layer is not silently masked by a full-blown SQL engine.
 */
export class FakeD1 {
  users: User[];
  sessions: Array<{ token: string; user_id: number; expires_at: number }> = [];
  projects = [{ id: 1, slug: 'yomikaze', name: 'Yomikaze' }];
  suggestions: SuggestionRow[] = [
    { id: 1, project_id: 1, author_id: 1, title: 'Dark mode', description: 'Add dark mode everywhere', status: 'NEW', created_at: 1700000000, updated_at: 1700000000 },
  ];
  channels: Array<{
    id: number;
    slug: string;
    name: string;
    description: string;
    type: 'PROJECT' | 'COMMUNITY' | 'MODERATION';
    project_id: number | null;
    is_locked: number;
    position: number;
  }> = [
    { id: 1, slug: 'general', name: 'General', description: 'General discussion', type: 'COMMUNITY', project_id: null, is_locked: 0, position: 1 },
  ];
  votes: VoteRow[] = [];
  bugs: BugRow[] = [];
  passwordHashes = new Map<number, string>();
  private nextId = 100;

  constructor(users?: User[]) {
    this.users = users ?? seedUsers();
  }

  prepare(query: string) {
    const fake = this;
    return {
      bind(...binds: unknown[]) {
        return {
          async first<T = unknown>(): Promise<T | null> {
            return fake._first(query, binds) as T | null;
          },
          async all<T = unknown>(): Promise<{ results: T[] }> {
            return fake._all(query, binds) as { results: T[] };
          },
          async run(): Promise<{ meta: { last_row_id: number } }> {
            return fake._run(query, binds);
          },
        };
      },
    };
  }

  private _first(query: string, binds: unknown[]): unknown | null {
    if (query.startsWith('SELECT id FROM users WHERE username = ? OR email = ?')) {
      const [username, email] = binds as [string, string];
      return this.users.find((u) => u.username === username || u.email.toLowerCase() === email.toLowerCase()) ?? null;
    }
    if (query.startsWith('SELECT * FROM users WHERE email = ? COLLATE NOCASE')) {
      const [email] = binds as [string];
      const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (user && this.passwordHashes.has(user.id)) {
        return { ...user, password_hash: this.passwordHashes.get(user.id) };
      }
      return user ? { ...user } : null;
    }
    if (query === 'SELECT * FROM users WHERE id = ?') {
      const [id] = binds as [number];
      return this.users.find((u) => u.id === id) ?? null;
    }
    if (query.startsWith('SELECT id, username, display_name')) {
      const [id] = binds as [number];
      const u = this.users.find((x) => x.id === id);
      if (!u) return null;
      return {
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        ...(query.includes('email') ? { email: u.email } : {}),
        avatar: u.avatar,
        bio: u.bio,
        github_url: u.github_url,
        website: u.website,
        role: u.role,
        status: u.status,
        status_message: u.status_message,
        created_at: u.created_at,
      };
    }
    if (query === 'SELECT password_hash FROM users WHERE id = ?') {
      const [id] = binds as [number];
      return this.users.some((u) => u.id === id) ? { password_hash: this.passwordHashes.get(id) ?? null } : null;
    }
    if (query === 'SELECT id FROM users WHERE id = ?') {
      const [id] = binds as [number];
      return this.users.find((u) => u.id === id && u.is_banned !== 1) ?? null;
    }
    if (query.startsWith('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')) {
      const [token, now] = binds as [string, number];
      const session = this.sessions.find((s) => s.token === token && s.expires_at > now);
      return session ? { ...session } : null;
    }
    if (query.startsWith('SELECT id FROM projects WHERE id = ?') || query.startsWith('SELECT id FROM projects WHERE slug = ?')) {
      const key = query.includes('slug') ? 'slug' : 'id';
      const [val] = binds as [unknown];
      return this.projects.find((p) => p[key as 'id'] === val || (key as string) === 'slug' && p.slug === val) ?? null;
    }
    if (query.startsWith('SELECT id FROM suggestions WHERE id = ?') || query.startsWith('SELECT * FROM suggestions WHERE id = ?')) {
      const [id] = binds as [number];
      return this.suggestions.find((s) => s.id === id) ?? null;
    }
    if (query.startsWith('SELECT id FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?')) {
      const [suggestionId, userId] = binds as [number, number];
      return this.votes.find((v) => v.suggestion_id === suggestionId && v.user_id === userId) ?? null;
    }
    if (query.startsWith('SELECT * FROM bug_reports WHERE id = ?')) {
      const [id] = binds as [number];
      return this.bugs.find((b) => b.id === id) ?? null;
    }
    if (query === 'SELECT * FROM channels WHERE id = ?') {
      const [id] = binds as [number];
      return this.channels.find((c) => c.id === id) ?? null;
    }
    if (query === 'SELECT * FROM channels WHERE slug = ?') {
      const [slug] = binds as [string];
      return this.channels.find((c) => c.slug === slug) ?? null;
    }
    if (query.startsWith('SELECT is_muted, muted_until FROM users WHERE id = ?')) {
      const [id] = binds as [number];
      const u = this.users.find((x) => x.id === id);
      return u ? { is_muted: u.is_muted, muted_until: u.muted_until } : null;
    }
    return null;
  }

  private _all(query: string, binds: unknown[]): { results: unknown[] } {
    if (query.includes('SELECT COUNT(*) AS count FROM suggestion_votes WHERE suggestion_id = ?')) {
      const [suggestionId] = binds as [number];
      const count = this.votes.filter((v) => v.suggestion_id === suggestionId).length;
      return { results: [{ count }] };
    }
    if (query.startsWith('DELETE')) {
      return { results: [] };
    }
    return { results: [] };
  }

  private _run(query: string, binds: unknown[]): { meta: { last_row_id: number } } {
    if (query.startsWith('INSERT INTO users')) {
      const cols = query.match(/INSERT INTO users \(([^)]+)\)/)?.[1] ?? '';
      const names = cols.split(',').map((c) => c.trim());
      const values: Record<string, unknown> = {};
      names.forEach((name, i) => (values[name] = binds[i]));
      const id = this.nextId++;
      this.users.push({
        id,
        username: values.username as string,
        display_name: (values.display_name as string) ?? (values.username as string),
        email: values.email as string,
        avatar: null,
        bio: null,
        github_url: null,
        website: null,
        role: (values.role as Role) ?? 'MEMBER',
        status: 'OFFLINE',
        status_message: null,
        is_banned: 0,
        is_muted: 0,
        muted_until: null,
        // password_hash stored separately to keep User interface clean
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      } as Omit<User, 'password_hash'>);
      if (values.password_hash) this.passwordHashes.set(id, values.password_hash as string);
      return { meta: { last_row_id: id } };
    }
    if (query.startsWith('INSERT INTO sessions')) {
      const cols = query.match(/INSERT INTO sessions \(([^)]+)\)/)?.[1] ?? '';
      const names = cols.split(',').map((c) => c.trim());
      const values: Record<string, unknown> = {};
      names.forEach((name, i) => (values[name] = binds[i]));
      this.sessions.push({
        token: values.token as string,
        user_id: values.user_id as number,
        expires_at: values.expires_at as number,
      });
      return { meta: { last_row_id: this.nextId++ } };
    }
    if (query.startsWith('DELETE FROM sessions')) {
      const [token] = binds as [string];
      this.sessions = this.sessions.filter((s) => s.token !== token);
      return { meta: { last_row_id: 0 } };
    }
    if (query.startsWith('DELETE FROM suggestion_votes')) {
      const [id] = binds as [number];
      this.votes = this.votes.filter((v) => v.id !== id);
      return { meta: { last_row_id: id } };
    }
    if (query.startsWith('INSERT INTO suggestion_votes')) {
      this.votes.push({ id: this.nextId++, suggestion_id: binds[0] as number, user_id: binds[1] as number });
      return { meta: { last_row_id: this.nextId - 1 } };
    }
    if (query.startsWith('INSERT INTO suggestions')) {
      const cols = query.match(/INSERT INTO suggestions \(([^)]+)\)/)?.[1] ?? '';
      const names = cols.split(',').map((c) => c.trim());
      const values: Record<string, unknown> = {};
      names.forEach((name, i) => (values[name] = binds[i]));
      const id = this.nextId++;
      this.suggestions.push({
        id,
        project_id: values.project_id as number,
        author_id: values.author_id as number,
        title: values.title as string,
        description: values.description as string,
        status: 'NEW',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      });
      return { meta: { last_row_id: id } };
    }
    if (query.startsWith('INSERT INTO bug_reports')) {
      const cols = query.match(/INSERT INTO bug_reports \(([^)]+)\)/)?.[1] ?? '';
      const names = cols.split(',').map((c) => c.trim());
      const values: Record<string, unknown> = {};
      names.forEach((name, i) => (values[name] = binds[i]));
      const id = this.nextId++;
      this.bugs.push({
        id,
        project_id: values.project_id as number,
        reporter_id: values.reporter_id as number,
        title: values.title as string,
        description: values.description as string,
        severity: (values.severity as string) ?? 'MEDIUM',
        status: 'OPEN',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      });
      return { meta: { last_row_id: id } };
    }
    if (query.startsWith('UPDATE users')) {
      const cols = query.match(/SET ([^W]+) WHERE id = \?/)?.[1] ?? '';
      const pairs = cols.split(',').map((c) => c.trim());
      const fullBinds = [...binds];
      const id = fullBinds.pop() as number;
      const row = this.users.find((u) => u.id === id);
      if (row) {
        for (const pair of pairs) {
          const setName = pair.match(/^(\w+)\s*=\s*\?/)?.[1];
          const value = fullBinds.shift();
          if (setName === 'password_hash' && value !== undefined) {
            this.passwordHashes.set(id, value as string);
          } else if (setName && value !== undefined && setName !== 'updated_at') {
            (row as unknown as Record<string, unknown>)[setName] = value;
          }
        }
      }
      return { meta: { last_row_id: id } };
    }
    if (query.startsWith('UPDATE bug_reports')) {
      const cols = query.match(/SET ([^W]+) WHERE id = \?/)?.[1] ?? '';
      const pairs = cols.split(',').map((c) => c.trim());
      const fullBinds = [...binds];
      const id = fullBinds.pop() as number;
      const row = this.bugs.find((b) => b.id === id);
      if (row) {
        for (const pair of pairs) {
          const setName = pair.match(/^(\w+)\s*=\s*\?/)?.[1];
          const value = fullBinds.shift();
          if (setName && value !== undefined) row[setName] = value;
        }
      }
      return { meta: { last_row_id: id } };
    }
    if (query.startsWith('UPDATE suggestions')) {
      const cols = query.match(/SET ([^W]+) WHERE id = \?/)?.[1] ?? '';
      const pairs = cols.split(',').map((c) => c.trim());
      const fullBinds = [...binds];
      const id = fullBinds.pop() as number;
      const row = this.suggestions.find((s) => s.id === id);
      if (row) {
        for (const pair of pairs) {
          const setName = pair.match(/^(\w+)\s*=\s*\?/)?.[1];
          const value = fullBinds.shift();
          if (setName && value !== undefined) row[setName as keyof SuggestionRow] = value as never;
        }
      }
      return { meta: { last_row_id: id } };
    }
    throw new Error(`FakeD1: unhandled SQL: ${query}`);
  }
}

export function makeEnv(opts: { db?: FakeD1; sessionTtl?: string; adminEmails?: string; ownerEmails?: string } = {}): Env {
  return {
    DB: (opts.db ?? new FakeD1()) as unknown as D1Database,
    AUTH_SECRET: 'test-secret-do-not-use-in-prod',
    SESSION_TTL_SECONDS: opts.sessionTtl ?? '3600',
    ADMIN_EMAILS: opts.adminEmails,
    OWNER_EMAILS: opts.ownerEmails,
    CHAT_ROOM: {} as DurableObjectNamespace,
    PRESENCE: {} as DurableObjectNamespace,
  };
}

export function authedRequest(url: string, init: { method?: string; body?: unknown; token?: string } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  return new Request(`https://phhub.test${url}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}