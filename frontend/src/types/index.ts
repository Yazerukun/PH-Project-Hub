export type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface User {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  avatar: string | null;
  bio?: string | null;
  github_url?: string | null;
  website?: string | null;
  role: Role;
  status?: 'ONLINE' | 'AWAY' | 'OFFLINE';
  status_message?: string | null;
  created_at?: number;
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  cover: string | null;
  category: string;
  status: 'LIVE' | 'BETA' | 'IN DEVELOPMENT' | 'MAINTENANCE' | 'ARCHIVED';
  version: string | null;
  tech_stack: string;
  github_url: string | null;
  live_url: string | null;
  created_at: number;
  updated_at: number;
  follower_count?: number;
  update_count?: number;
  bug_count?: number;
  suggestion_count?: number;
}

export type UpdateType = 'ANNOUNCEMENT' | 'RELEASE' | 'FEATURE' | 'IMPROVEMENT' | 'FIX' | 'MAINTENANCE';

export interface ProjectUpdate {
  id: number;
  project_id: number;
  author_id: number;
  version: string | null;
  title: string;
  body: string;
  image: string | null;
  update_type: UpdateType;
  changelog: string;
  published_at: number;
  pinned: number;
  live_url: string | null;
  github_url: string | null;
  project_slug: string;
  project_name: string;
  project_status: string;
  project_cover?: string | null;
  author_name: string;
  author_username: string;
  author_avatar: string | null;
  author_role?: Role;
  comment_count?: number;
  reactions?: Record<string, number>;
}

export interface UpdateComment {
  id: number;
  update_id: number;
  author_id: number;
  parent_id: number | null;
  body: string;
  is_deleted: number;
  created_at: number;
  updated_at: number;
  username: string;
  display_name: string;
  avatar: string | null;
  role: Role;
}

export type ChannelType = 'PROJECT' | 'COMMUNITY' | 'MODERATION';

export interface Channel {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: ChannelType;
  project_id: number | null;
  is_locked: number;
  position: number;
}

export interface ChatMessage {
  id: number;
  channel_id: number;
  user_id: number;
  body: string;
  reply_to: number | null;
  is_pinned: number;
  is_deleted: number;
  edited_at: number | null;
  created_at: number;
  username: string;
  display_name: string;
  avatar: string | null;
  role: Role;
  reactions: Record<string, number>;
}

export interface BugReport {
  id: number;
  project_id: number;
  reporter_id: number;
  title: string;
  description: string;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
  browser: string;
  device: string;
  screenshot: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'FIXED' | 'CLOSED';
  created_at: number;
  updated_at: number;
  project_name?: string;
  project_slug?: string;
  reporter_username?: string;
  reporter_name?: string;
}

export interface Suggestion {
  id: number;
  project_id: number;
  author_id: number;
  title: string;
  description: string;
  status: 'NEW' | 'UNDER REVIEW' | 'PLANNED' | 'IN PROGRESS' | 'COMPLETED' | 'REJECTED';
  created_at: number;
  updated_at: number;
  project_name?: string;
  project_slug?: string;
  author_username?: string;
  author_name?: string;
  votes: number;
  has_voted: number | boolean;
}

export interface RoadmapItem {
  id: number;
  project_id: number;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  target_version: string | null;
  status: 'PLANNED' | 'IN PROGRESS' | 'COMPLETED';
  position: number;
  created_at: number;
  updated_at: number;
  project_name?: string;
  project_slug?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  actor_id: number | null;
  is_read: number;
  created_at: number;
  actor_username?: string | null;
  actor_name?: string | null;
  actor_avatar?: string | null;
}

export interface ApiEnvelope<T> {
  data?: T;
  error?: string;
  total?: number;
}

export interface SearchResults {
  query: string;
  projects?: Project[];
  updates?: Array<Pick<ProjectUpdate, 'id' | 'title' | 'body' | 'published_at' | 'update_type'> & { project_slug: string; project_name: string }>;
  users?: Array<{ id: number; username: string; display_name: string; avatar: string | null; role: Role }>;
  messages?: Array<{ id: number; body: string; created_at: number; channel_id: number; channel_name: string; channel_slug: string; author_username: string; author_name: string }>;
}

export interface UserSummary {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  avatar: string | null;
  role: Role;
  status: 'ONLINE' | 'AWAY' | 'OFFLINE';
  is_banned: number;
  is_muted: number;
  created_at: number;
}

export interface Report {
  id: number;
  reporter_id: number;
  target_type: 'MESSAGE' | 'USER';
  target_id: number;
  reason: string;
  details: string | null;
  status: 'PENDING' | 'RESOLVED';
  created_at: number;
  reporter_username?: string;
  reporter_name?: string;
}