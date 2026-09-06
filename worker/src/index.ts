import { Env } from './types';
import { json } from './utils/http';
import { ok, unauthorized, forbidden, serverError } from './utils/http';
import { corsHeaders } from './middleware/cors';
import { checkRateLimit } from './middleware/rateLimit';
import { register, login, logout, me, updateProfile } from './routes/auth';
import { requireAuth, isAdmin } from './auth/session';
import { listProjects, getProject, createProject, updateProject, deleteProject } from './routes/projects';
import { listUpdates, getUpdate, createUpdate, reactToUpdate, addComment, editComment, deleteComment } from './routes/updates';
import { listChannels, getMessages, sendMessageRest, reactToMessage, pinMessage, deleteMessage, editMessage } from './routes/chat';
import {
  listBugs, createBug, updateBug,
  listSuggestions, createSuggestion, updateSuggestion, voteSuggestion,
  listRoadmap, createRoadmapItem, updateRoadmapItem,
  followProject, getFollowerState,
} from './routes/community';
import { listNotifications, unreadCount, markNotificationRead, searchSomething } from './routes/misc';
import { createReport, listReports, resolveReport, listUsers, updateUser, changeRole, listModerationActions } from './routes/moderation';
import { ChatRoom } from './durable-objects/chat-room';
import { PresenceRoom } from './durable-objects/presence-room';

export { ChatRoom, PresenceRoom };

type RouteHandler = (request: Request, env: Env, param: string) => Promise<Response>;

// Adapter for handlers that take a numeric id param
function num(fn: (request: Request, env: Env, id: number) => Promise<Response>): RouteHandler {
  return (request, env, param) => fn(request, env, Number(param));
}

// Adapters for handlers that take the path param as their first argument
const getProjectR: RouteHandler = (_r, env, slug) => getProject(slug ?? '', env);
const getUpdateR: RouteHandler = (_r, env, id) => getUpdate(Number(id), env);
const getFollowerStateR: RouteHandler = (r, env, slug) => getFollowerState(r, env, slug ?? '');
const markReadR: RouteHandler = (r, env, id) => markNotificationRead(r, env, id ? Number(id) : null);

interface RouteDef {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
  ratelimit?: { key: string; max: number; windowMs: number };
}

const routes: RouteDef[] = [
  // Auth
  { method: 'POST', pattern: /^\/api\/auth\/register$/, handler: register, ratelimit: { key: 'register', max: 5, windowMs: 60000 } },
  { method: 'POST', pattern: /^\/api\/auth\/login$/, handler: login, ratelimit: { key: 'login', max: 10, windowMs: 60000 } },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, handler: logout },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, handler: me },
  { method: 'PATCH', pattern: /^\/api\/auth\/me$/, handler: updateProfile },

  // Projects
  { method: 'GET', pattern: /^\/api\/projects$/, handler: listProjects },
  { method: 'POST', pattern: /^\/api\/projects$/, handler: createProject },
  { method: 'GET', pattern: /^\/api\/projects\/([^/]+)$/, handler: getProjectR },
  { method: 'PUT', pattern: /^\/api\/projects\/([^/]+)$/, handler: updateProject },
  { method: 'DELETE', pattern: /^\/api\/projects\/([^/]+)$/, handler: deleteProject },
  { method: 'POST', pattern: /^\/api\/projects\/([^/]+)\/follow$/, handler: followProject },
  { method: 'GET', pattern: /^\/api\/projects\/([^/]+)\/follow$/, handler: getFollowerStateR },

  // Updates
  { method: 'GET', pattern: /^\/api\/updates$/, handler: listUpdates },
  { method: 'POST', pattern: /^\/api\/updates$/, handler: createUpdate, ratelimit: { key: 'update', max: 20, windowMs: 60000 } },
  { method: 'GET', pattern: /^\/api\/updates\/([^/]+)$/, handler: getUpdateR },
  { method: 'POST', pattern: /^\/api\/updates\/([^/]+)\/reactions$/, handler: num(reactToUpdate) },
  { method: 'POST', pattern: /^\/api\/updates\/([^/]+)\/comments$/, handler: num(addComment), ratelimit: { key: 'comment', max: 30, windowMs: 60000 } },
  { method: 'PATCH', pattern: /^\/api\/comments\/([^/]+)$/, handler: num(editComment) },
  { method: 'DELETE', pattern: /^\/api\/comments\/([^/]+)$/, handler: num(deleteComment) },

  // Channels
  { method: 'GET', pattern: /^\/api\/channels$/, handler: listChannels },
  { method: 'GET', pattern: /^\/api\/channels\/([^/]+)\/messages$/, handler: num(getMessages) },
  { method: 'POST', pattern: /^\/api\/channels\/([^/]+)\/messages$/, handler: num(sendMessageRest), ratelimit: { key: 'msg', max: 60, windowMs: 60000 } },
  { method: 'POST', pattern: /^\/api\/messages\/([^/]+)\/reactions$/, handler: num(reactToMessage) },
  { method: 'POST', pattern: /^\/api\/messages\/([^/]+)\/pin$/, handler: num(pinMessage) },
  { method: 'DELETE', pattern: /^\/api\/messages\/([^/]+)$/, handler: num(deleteMessage) },
  { method: 'PATCH', pattern: /^\/api\/messages\/([^/]+)$/, handler: num(editMessage) },

  // Bugs
  { method: 'GET', pattern: /^\/api\/bugs$/, handler: listBugs },
  { method: 'POST', pattern: /^\/api\/bugs$/, handler: createBug, ratelimit: { key: 'bug', max: 10, windowMs: 60000 } },
  { method: 'PATCH', pattern: /^\/api\/bugs\/([^/]+)$/, handler: num(updateBug) },

  // Suggestions
  { method: 'GET', pattern: /^\/api\/suggestions$/, handler: listSuggestions },
  { method: 'POST', pattern: /^\/api\/suggestions$/, handler: createSuggestion, ratelimit: { key: 'suggestion', max: 10, windowMs: 60000 } },
  { method: 'PATCH', pattern: /^\/api\/suggestions\/([^/]+)$/, handler: num(updateSuggestion) },
  { method: 'POST', pattern: /^\/api\/suggestions\/([^/]+)\/vote$/, handler: num(voteSuggestion) },

  // Roadmap
  { method: 'GET', pattern: /^\/api\/roadmap$/, handler: listRoadmap },
  { method: 'POST', pattern: /^\/api\/roadmap$/, handler: createRoadmapItem },
  { method: 'PATCH', pattern: /^\/api\/roadmap\/([^/]+)$/, handler: num(updateRoadmapItem) },

  // Notifications
  { method: 'GET', pattern: /^\/api\/notifications$/, handler: listNotifications },
  { method: 'GET', pattern: /^\/api\/notifications\/unread$/, handler: unreadCount },
  { method: 'POST', pattern: /^\/api\/notifications\/read\/([^/]+)$/, handler: markReadR },
  { method: 'POST', pattern: /^\/api\/notifications\/read$/, handler: markReadR },

  // Search
  { method: 'GET', pattern: /^\/api\/search$/, handler: searchSomething },

  // Admin / moderation aliases used by the frontend console
  { method: 'GET', pattern: /^\/api\/users$/, handler: listUsers },
  { method: 'GET', pattern: /^\/api\/moderation\/reports$/, handler: listReports },
  { method: 'POST', pattern: /^\/api\/moderation\/resolve\/([^/]+)$/, handler: num(resolveReport) },
  { method: 'PATCH', pattern: /^\/api\/admin\/bugs\/([^/]+)\/status$/, handler: num(updateBug) },
  { method: 'PATCH', pattern: /^\/api\/admin\/suggestions\/([^/]+)\/status$/, handler: num(updateSuggestion) },
  { method: 'GET', pattern: /^\/api\/admin\/stats$/, handler: async (req, env) => {
    const auth = await requireAuth(req, env);
    if (!auth) return unauthorized();
    if (!isAdmin(auth.user)) return forbidden('Only admins can view stats');
    const count = async (table: string): Promise<number> => {
      const res = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>();
      return Number(res?.count ?? 0);
    };
    const [users, projects, updates, bugs, suggestions, messages, reports, channels] = await Promise.all([
      count('users'), count('projects'), count('project_updates'), count('bug_reports'),
      count('suggestions'), count('messages'), count('reports'), count('channels'),
    ]);
    return ok({ users, projects, updates, bugs, suggestions, messages, reports, channels });
  } },

  // Presence (global online count from real connections)
  { method: 'GET', pattern: /^\/api\/presence$/, handler: async (req, env) => {
    const id = env.PRESENCE.idFromName('global');
    const stub = env.PRESENCE.get(id);
    const res = await stub.fetch('https://presence/presence/snapshot');
    const body = await res.json();
    const response = json({ data: body });
    for (const [k, v] of Object.entries(corsHeaders(req.headers.get('Origin')))) response.headers.set(k, v);
    return response;
  } },
  { method: 'POST', pattern: /^\/api\/presence\/beat$/, handler: async (req, env) => {
    const auth = await requireAuth(req, env);
    if (!auth) {
      return unauthorized();
    }
    const { user } = auth;
    const id = env.PRESENCE.idFromName('global');
    const stub = env.PRESENCE.get(id);
    const res = await stub.fetch('https://presence/presence/beat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, username: user.username, displayName: user.display_name }),
    });
    if (!res.ok) {
      return serverError('Presence update failed');
    }
    return ok({ success: true });
  } },

  // Moderation
  { method: 'POST', pattern: /^\/api\/reports$/, handler: createReport },
  { method: 'GET', pattern: /^\/api\/reports$/, handler: listReports },
  { method: 'POST', pattern: /^\/api\/reports\/([^/]+)\/resolve$/, handler: num(resolveReport) },
  { method: 'GET', pattern: /^\/api\/admin\/users$/, handler: listUsers },
  { method: 'PATCH', pattern: /^\/api\/admin\/users\/([^/]+)$/, handler: num(updateUser) },
  { method: 'POST', pattern: /^\/api\/admin\/users\/([^/]+)\/role$/, handler: num(changeRole) },
  { method: 'GET', pattern: /^\/api\/admin\/actions$/, handler: listModerationActions },
];

const wsRoute = /^\/api\/chat\/([^/]+)\/ws$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const wsMatch = url.pathname.match(wsRoute);
      if (wsMatch) {
        const channelId = wsMatch[1];
        const roomId = `channel:${channelId}`;
        const id = env.CHAT_ROOM.idFromName(roomId);
        const stub = env.CHAT_ROOM.get(id);
        const upstream = new Request(request.url, request);
        return stub.fetch(upstream);
      }

      const method = request.method;
      for (const route of routes) {
        if (route.method !== method) continue;
        const match = url.pathname.match(route.pattern);
        if (!match) continue;

        if (route.ratelimit) {
          const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
          const key = `${route.ratelimit.key}:${ip}`;
          if (!checkRateLimit(key, route.ratelimit.max, route.ratelimit.windowMs)) {
            return json({ error: 'Too many requests. Please slow down.' }, 429);
          }
        }

        const response = await route.handler(request, env, match[1]);
        for (const [k, v] of Object.entries(cors)) {
          response.headers.set(k, v);
        }
        return response;
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Unhandled error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};