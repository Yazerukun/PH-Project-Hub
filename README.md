# PH PROJECT HUB

Build · Update · Discuss · Grow

[![Deploy Production](https://github.com/Yazerukun/PH-Project-Hub/actions/workflows/deploy.yml/badge.svg)](https://github.com/Yazerukun/PH-Project-Hub/actions/workflows/deploy.yml)

**Live site:** https://ph-project-hub.pages.dev/
**API:** https://ph-project-hub-api.yomikaze-md.workers.dev

**Status:** automatically validated, built, and deployed to production on every push to `main` by GitHub Actions (badge above tracks the latest run).

PH PROJECT HUB is the official community home for the Philippine open-source project lineup. It publishes official build updates and project status, rolls out program announcements and priorities, and runs a real-time, moderated community chat organized around project channels.

## Overview

A single repository that ships two pieces:

- **Backend** — a Cloudflare Worker with D1 (SQLite at the edge) and two Durable Objects (`ChatRoom` per channel, `PresenceRoom` global). Handles auth, projects, official updates, bug reports, suggestions with voting, roadmap, search, notifications, moderation, admin, and the WebSocket chat.
- **Frontend** — a React 19 + TypeScript + Vite + Tailwind v4 single-page app that talks to the backend over a typed REST + WebSocket API.

Data is served through a thin `{ data }` / `{ error }` envelope, authenticated with bearer tokens, and tested with Vitest against an in-memory D1 substitute.

## Features

- **Auth** — register, login, profile editing, roles `MEMBER` / `MODERATOR` / `ADMIN` / `OWNER`.
- **Real-time project & community chat** — per-channel WebSocket chat with presence, typing indicators, reactions, edit/delete/pin, reply threading, history + load-older, and banned/muted/locked enforcement.
- **WebSocket presence** — site-wide heartbeat (`PresenceRoom`) that powers realtime ONLINE/OFFLINE status on profiles and the admin Members list.
- **Projects** — project catalog with status + version badges, tech stack, live/GitHub links, and seeded channels per project.
- **Official project updates** — release/announcement/feature/fix/maintenance posts with comments, reactions, and pinning.
- **Bug reports** — severity + lifecycle (OPEN → INVESTIGATING → FIXED → CLOSED).
- **Suggestions + voting** — propose improvements, toggle votes, admin status workflow.
- **Roadmap** — prioritized, statused roadmap items.
- **Notifications** — per-user feed (replies, reactions, votes, reports involving you).
- **Search** — single query across users, projects, updates, bugs, suggestions, roadmap.
- **Moderation** — mutes, report lifecycle, ban enforcement, moderation-action audit view.
- **Admin dashboard** — realtime (polling + presence) Overview stats, Updates, Bugs, Suggestions, Reports, and Members tabs with role management (promote/demote) and email-driven owner/administrator bootstrapping.

## Architecture

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite 6, TypeScript, Tailwind v4, React Router 7 |
| Backend | Cloudflare Workers (ES modules) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Realtime | Durable Objects + WebSockets (`ChatRoom`) + presence heartbeats (`PresenceRoom`) |
| State | Zustand |
| Auth | Scrypt password hashing, HMAC-signed session tokens, 7-day TTL |
| Tests | Vitest + FakeD1 (in-memory D1), 64 passing |
| Lint | oxlint + `tsc` strict, both workspaces |

## Screenshots

Clean production captures live in [`docs/screenshots/`](docs/screenshots/).

| | |
| --- | --- |
| Home | [docs/screenshots/home.png](docs/screenshots/home.png) |
| Projects | [docs/screenshots/projects.png](docs/screenshots/projects.png) |
| Updates | [docs/screenshots/updates.png](docs/screenshots/updates.png) |

Authenticated surfaces (chat, profile, admin) need a login — capture those on the live site or locally with `npm run dev`.

## Local development

Prerequisites: Node.js ≥ 20, npm, and a Cloudflare account for D1.

```bash
npm install
```

### 1. Backend

```bash
cp .env.example worker/.dev.vars          # then fill AUTH_SECRET (openssl rand -hex 32)
npm run migrate:local                     # apply migrations to the local D1
npm run dev:worker                        # wrangler dev → http://localhost:8787
```

### 2. Frontend

```bash
npm run dev                               # Vite → http://localhost:5173 (/api proxied to :8787)
```

### Test / lint / typecheck

```bash
npm test                                  # 64 worker tests against FakeD1
npm run typecheck                         # tsc strict, both workspaces
npm run lint                              # oxlint, frontend
npm run build                             # Vite production build (frontend/ + dist/)
```

## Environment configuration

**Variable names only** — real values are never committed (`worker/.dev.vars` is gitignored; production values live in Cloudflare secrets/vars).

| Variable | Where | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | `worker/.dev.vars` / Cloudflare secret | signs session tokens (`openssl rand -hex 32`) |
| `ADMIN_EMAILS` | Cloudflare var / secret | comma-separated emails → `ADMIN` role on sign-up |
| `OWNER_EMAILS` | Cloudflare var / secret | comma-separated emails → `OWNER` role; auto-promoted on login |
| `SESSION_TTL_SECONDS` | optional | session lifetime (default 604800) |
| `RATE_LIMIT_MAX` | optional | per-window rate-limit cap |
| `VITE_API_BASE` | `frontend/.env.production` / Pages env | the production Worker URL the SPA calls |

## D1 migrations

Migrations live in `worker/migrations/` and are applied with wrangler:

```bash
npm run migrate:local     # local D1
npm run migrate:remote    # remote/production D1
```

`0002_seed.sql` ships the project catalog and channel list. To wipe a local D1 and start fresh:

```bash
rm -rf worker/.wrangler/state/v3/d1
npm run migrate:local
```

## Cloudflare deployment

The production architecture is **Pages (`ph-project-hub`, frontend) + Worker (`ph-project-hub-api`) + D1 (`ph-project-hub-db`) + Durable Objects (`CHAT_ROOM`, `PRESENCE`)**. Deployment is fully automatic through GitHub Actions; the existing production resources are preserved.

### Pipeline

```
git push main
   → GitHub Actions (.github/workflows/deploy.yml)
   → npm ci · typecheck · lint · 64 tests · production build
   → verify build output (no localhost / localhost-refs / leaked secrets in dist)
   → deploy Worker (ph-project-hub-api) with OWNER_EMAILS / ADMIN_EMAILS from repo secrets
   → deploy frontend (frontend/dist) to the EXISTING Pages project ph-project-hub via wrangler
   → production smoke test (pages.dev, API, SPA routes, JS/CSS assets)
```

Any critical validation failure stops the job before either deployment runs, and the run goes visibly red. Runs are serialized with `concurrency: ph-project-hub-production` so two `main` pushes never deploy at the same time.

### Cloudflare Pages (frontend)

`ph-project-hub` is a **Direct Upload** Pages project. Direct Upload projects cannot be converted to native Cloudflare Git integration, so GitHub Actions **is** the CI/CD: it builds `frontend/dist` in CI and uploads it to the existing project with `wrangler pages deploy`. The Pages project intentionally stays Direct Upload while GitHub Actions provides automatic deployment.

```bash
cd worker   # wrangler is a devDependency of the worker workspace
npx wrangler pages deploy ../frontend/dist --project-name ph-project-hub --branch main
```

Production configuration is set at build time from workflow environment:

- **Build command:** `npm run build` (frontend workspace)
- **Output directory:** `frontend/dist`
- **Environment variable:** `VITE_API_BASE=https://ph-project-hub-api.yomikaze-md.workers.dev` (declared in `.github/workflows/deploy.yml` and `frontend/.env.production`; the Worker URL is public configuration, not a secret)

### Cloudflare Worker (backend)

Deployed by the same workflow from the worker workspace. The deploy step requires the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets, and a guard step refuses to run unless the `OWNER_EMAILS` and `ADMIN_EMAILS` repository secrets are set, so privileged emails stay out of Git history.

```bash
cd worker
npm run deploy -- \
  --var OWNER_EMAILS:'<comma-separated owner emails>' \
  --var ADMIN_EMAILS:'<comma-separated admin emails>'
```

**D1:** `worker/wrangler.jsonc` holds the `database_id`; apply migrations with `npm run migrate:remote`.

### Previous deployments & rollback

Every `wrangler pages deploy` upload creates a new Cloudflare deployment; prior deployments are kept by the platform and are inspectable in the dashboard under **Workers & Pages → ph-project-hub → Deployments** (or via the Cloudflare API `pages/projects/ph-project-hub/deployments`). Old deployments are never deleted automatically. Smoke-test failures fail the GitHub Actions run even if the upload itself exited 0 — the live site is the source of truth, not the deploy step's exit code.

## Security notes

- No secrets are committed: `worker/.dev.vars`, `.env`, `.wrangler/`, `dist/`, `coverage/`, and logs are gitignored.
- `AUTH_SECRET`, `OWNER_EMAILS`, and `ADMIN_EMAILS` are supplied at deploy time (Cloudflare secrets/vars or CI), never stored in source.
- Session tokens are HMAC-signed and expire; passwords are salted with Scrypt.
- Banned or muted users are blocked at the socket and in API writes; admin-only endpoints enforce `ADMIN`/`OWNER` gates.

## Owner bootstrapping

There is no hard-coded admin in the repository. At deploy time you supply `ADMIN_EMAILS` and `OWNER_EMAILS`:

- The first user to register with an `ADMIN_EMAILS` email is created with the `ADMIN` role.
- An `OWNER_EMAILS` account gets `OWNER` on sign-up and is **auto-promoted on login** if it was created earlier as a member.

From there, roles are managed from the Admin → Members panel or with a one-line update:

```bash
npx wrangler d1 execute ph-project-hub-db --remote \
  --command "UPDATE users SET role='ADMIN' WHERE email='you@example.com'"
```

## API surface (highlights)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` · `/api/auth/login` | public | create / sign in |
| GET | `/api/auth/me` · PATCH `/api/auth/me` | bearer | get / edit profile |
| GET | `/api/projects` | public | project catalog |
| GET | `/api/channels` | public | channel list |
| POST | `/api/updates` | ADMIN+ | official update (`project_id` in body) |
| GET/POST | `/api/bugs` · `/api/suggestions` | public / MEMBER+ | reports & proposals |
| POST | `/api/suggestions/:id/vote` | bearer | toggle vote |
| GET | `/api/roadmap` · `/api/search` · `/api/users` | public | browse / find |
| GET/POST | `/api/presence` · `/api/presence/beat` | public / bearer | realtime presence |
| GET | `/api/notifications` | bearer | feed |
| WS | `/api/chat/:channelId/ws?token=` | bearer | realtime chat |
| GET | `/api/channels/:channelId/messages` | bearer | history + load older |
| GET/POST | `/api/moderation/reports` · `/api/moderation/resolve/:id` | MOD+ | report queue |
| GET | `/api/admin/stats` · `/api/admin/users` · `/api/admin/users/:id/role` | ADMIN+ | admin panel |
| PATCH | `/api/admin/bugs/:id/status` etc. | ADMIN+ | status lifecycle |

Role gates: admin endpoints require `ADMIN`/`OWNER`; moderation requires `MODERATOR`+; banned or muted users are blocked at the socket and in API writes.

## Repository layout

```
worker/
  migrations/           # 0001_init.sql, 0002_seed.sql
  src/
    index.ts            # router, aliases, /api/admin/stats, /api/presence/*
    auth/session.ts     # sign/verify tokens, requireAuth, isAdmin/isOwner
    routes/             # auth, projects, updates, bugs, suggestions, roadmap,
                        # misc (search/channels), moderation, notifications
    durable-objects/    # chat-room.ts, presence-room.ts
  test/                 # Vitest + FakeD1 helpers
frontend/
  src/pages/            # routed pages
  src/components/       # layout, chat, ui primitives
  src/hooks/            # useChatSocket, useSitePresence, useCountryFlag
  src/stores/           # auth, channels, presence (Zustand)
  src/lib/              # api client, format, country, updates labels
docs/screenshots/       # production captures
.github/workflows/      # worker deploy workflow
```

## License

MIT — see [LICENSE](LICENSE).