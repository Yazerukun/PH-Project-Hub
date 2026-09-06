import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
  PRESENCE: DurableObjectNamespace;
  AUTH_SECRET: string;
  SESSION_TTL_SECONDS?: string;
  RATE_LIMIT_MAX?: string;
  ADMIN_EMAILS?: string;
  OWNER_EMAILS?: string;
}

export type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  github_url: string | null;
  website: string | null;
  role: Role;
  status: 'ONLINE' | 'AWAY' | 'OFFLINE';
  status_message: string | null;
  is_banned: number;
  is_muted: number;
  muted_until: number | null;
  created_at: number;
  updated_at: number;
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  role: Role;
}

export interface ApiResponse<T = unknown> {
  error?: string;
  data?: T;
  message?: string;
  total?: number;
}

export type Bindings = [Env, ExecutionContext];
