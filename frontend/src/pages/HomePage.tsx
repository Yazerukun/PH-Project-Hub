import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project, ProjectUpdate } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useChannels } from '../stores/channels';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { OfficialBadge, OwnerBadge } from '../components/ui/OwnerBadge';
import { Avatar } from '../components/ui/Avatar';
import { timeAgo, parseTechStack, renderText } from '../lib/format';
import { updateTypeLabel } from '../lib/updates';
import {
  ChatIcon, BugIcon, IdeaIcon, HashIcon, UsersIcon, FireIcon,
} from '../components/ui/icons';

interface Presence {
  count: number;
  users: Array<{ username: string; displayName: string }>;
}

export function HomePage() {
  const { user } = useAuth();
  const { channels } = useChannels();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<Presence>({ count: 0, users: [] });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [projectsData, updatesData, presence] = await Promise.all([
          api<Project[]>('/api/projects', { auth: false }),
          api<ProjectUpdate[]>('/api/updates?limit=8', { auth: false }),
          api<Presence>('/api/presence', { auth: false }).catch(() => ({ count: 0, users: [] })),
        ]);
        if (!active) return;
        setProjects(projectsData);
        setUpdates(updatesData);
        setOnline(presence);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const latest = updates[0];
  const generalChannel = channels.find((c) => c.slug === 'general');

  const openChat = () => navigate(user ? '/chat/general' : '/register?next=/chat/general');

  return (
    <div className="flex items-start gap-4 xl:gap-6">
      {/* Main feed */}
      <div className="min-w-0 flex-1 space-y-6">
        <WelcomeStrip displayName={user?.display_name ?? null} latest={latest} onOpenChat={openChat} />

        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-6 text-center text-sm text-red-300">{error}</p>
        ) : (
          <>
            {/* Latest official update — editorial anchor */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-section-title text-gray-300">Latest Official Update</h2>
                <Link to="/updates" className="text-xs font-medium text-primary-300 hover:text-primary-200">
                  All updates →
                </Link>
              </div>
              <LatestUpdateCard update={latest} loading={loading} />
            </section>

            {/* Live chat CTA — tablet & mobile only (rail owns it on desktop) */}
            <div className="xl:hidden">
              <LiveChatCard
                generalChannel={generalChannel}
                onlineCount={online.count}
                user={!!user}
                onOpen={() => openChat()}
              />
            </div>

            {/* Recent activity — timeline */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-section-title text-gray-300">Recent Activity</h2>
              </div>
              {loading ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : updates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-600 px-5 py-8 text-center text-sm text-gray-500">
                  No updates yet — the first one is on its way.
                </p>
              ) : (
                <ActivityTimeline updates={updates.slice(1, 6)} />
              )}
            </section>

            {/* Projects — tablet & mobile only */}
            <div className="xl:hidden">
              <ProjectStrip projects={projects} loading={loading} />
            </div>
          </>
        )}
      </div>

      {/* Desktop right rail */}
      <aside className="hidden w-[300px] shrink-0 2xl:w-[320px] xl:block">
        <div className="space-y-5">
          <LiveChatCard
            generalChannel={generalChannel}
            onlineCount={online.count}
            user={!!user}
            onOpen={() => openChat()}
          />

          <ProjectStrip projects={projects} loading={loading} />

          <OnlineRoster online={online} />

          <CommunityLinks />
        </div>
      </aside>
    </div>
  );
}

function WelcomeStrip({
  displayName,
  latest,
  onOpenChat,
}: {
  displayName: string | null;
  latest?: ProjectUpdate;
  onOpenChat: () => void;
}) {
  const firstName = displayName?.trim().split(/\s+/)[0];
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800/40 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-section-title text-gray-500">PH PROJECT HUB</p>
          <h1 className="mt-1 text-card-title text-white">
            {firstName ? (
              <>
                Welcome back, <span className="text-primary-300">{firstName}</span> 👋
              </>
            ) : (
              'Welcome to PH Project Hub 👋'
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            The hub for Filipino builders — release updates, feedback, and community chat.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {firstName ? (
            <>
              <Button size="md" icon={<ChatIcon size={16} />} onClick={onOpenChat}>
                Open #general
              </Button>
              <Link
                to={latest ? `/updates/${latest.id}` : '/updates'}
                className="inline-flex h-10 items-center rounded-lg border border-ink-500 px-4 text-sm font-medium text-gray-300 hover:bg-ink-600"
              >
                View Latest Update
              </Link>
            </>
          ) : (
            <>
              <Button size="md" icon={<ChatIcon size={16} />} onClick={onOpenChat}>
                Join the Chat
              </Button>
              <Link
                to="/projects"
                className="inline-flex h-10 items-center rounded-lg border border-ink-500 px-4 text-sm font-medium text-gray-300 hover:bg-ink-600"
              >
                Explore Projects
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function LatestUpdateCard({ update, loading }: { update?: ProjectUpdate; loading: boolean }) {
  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50">
        <div className="border-b border-ink-600/60 bg-ink-900/40 px-4 py-3"><Skeleton className="h-4 w-48" /></div>
        <div className="space-y-3 p-5">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    );
  }
  if (!update) {
    return (
      <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50">
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <FireIcon size={26} className="text-primary-400" />
          <p className="text-sm font-semibold text-gray-200">No official updates yet</p>
          <p className="max-w-sm text-xs leading-relaxed text-gray-500">
            When the owner publishes a release, announcement, or changelog, it will appear here first.
          </p>
          <Link to="/updates" className="mt-1 inline-flex h-9 items-center rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600">
            All updates
          </Link>
        </div>
      </section>
    );
  }

  const changelog: string[] = (() => {
    try {
      const parsed = JSON.parse(update.changelog);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').map(renderText) : [];
    } catch {
      return [];
    }
  })();

  return (
    <article className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-600/60 bg-ink-900/40 px-4 py-3">
        <Link to={`/projects/${update.project_slug}`} className="text-xs font-bold uppercase tracking-widest text-primary-300 hover:text-primary-200">
          {update.project_name}
        </Link>
        <OfficialBadge />
        {update.update_type && <Badge tone={update.update_type === 'RELEASE' ? 'live' : 'accent'}>{updateTypeLabel(update.update_type)}</Badge>}
        {update.author_role === 'OWNER' && <OwnerBadge role="OWNER" showIcon={false} />}
        <span className="ml-auto text-[11px] text-gray-500">{timeAgo(update.published_at)}</span>
      </div>

      <div className="p-5">
        <h3 className="text-card-title text-white">
          <Link to={`/updates/${update.id}`} className="hover:text-primary-300">{update.title}</Link>
        </h3>

        {update.image && (
          <img src={update.image} alt="" className="mt-3 max-h-64 w-full rounded-xl object-cover" loading="lazy" />
        )}

        {changelog.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {changelog.slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          update.body && (
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-400">{renderText(update.body)}</p>
          )
        )}

        <p className="mt-4 flex items-center justify-between text-meta text-gray-500">
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><ChatIcon size={12} /> {update.comment_count ?? 0} comments</span>
            <span className="inline-flex items-center gap-1.5">
              by {update.author_name}
              {update.version && <span>· v{update.version}</span>}
            </span>
          </span>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={`/updates/${update.id}`}
            className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500"
          >
            View Update
          </Link>
          <Link
            to={`/projects/${update.project_slug}`}
            className="inline-flex h-9 items-center rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600"
          >
            Open Project
          </Link>
          <Link
            to={`/chat/${update.project_slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600"
          >
            <ChatIcon size={13} /> Join Discussion
          </Link>
        </div>
      </div>
    </article>
  );
}

function ActivityTimeline({ updates }: { updates: ProjectUpdate[] }) {
  return (
    <div className="relative">
      <div className="absolute bottom-3 left-[7px] top-3 w-px bg-ink-600" aria-hidden="true" />
      <div className="space-y-1">
        {updates.map((u) => (
          <TimelineRow key={u.id} update={u} />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ update }: { update: ProjectUpdate }) {
  const changelog: string[] = (() => {
    try {
      const parsed = JSON.parse(update.changelog);
      return Array.isArray(parsed) ? parsed.map(String).map(renderText) : [];
    } catch {
      return [];
    }
  })();
  const summary = changelog.length ? changelog[0] : renderText(update.body ?? '');
  return (
    <Link
      to={`/updates/${update.id}`}
      className="group relative flex items-start gap-3 rounded-lg py-2 pl-0 pr-2 transition-colors hover:bg-ink-700/40"
    >
      <span className="relative z-10 mt-2 size-3.5 shrink-0 rounded-full border-2 border-ink bg-primary-400/80 ring-4 ring-ink" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-primary-300/90">{update.project_name}</span>
          {update.version && <span className="text-meta text-gray-500">v{update.version}</span>}
          <span className="text-meta text-gray-600">{timeAgo(update.published_at)}</span>
        </div>
        <p className="truncate text-sm font-medium text-gray-100 group-hover:text-primary-200">{update.title}</p>
        {summary && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-gray-500">{summary}</p>}
      </div>
    </Link>
  );
}

function LiveChatCard({
  generalChannel,
  onlineCount,
  user,
  onOpen,
}: {
  generalChannel?: { name?: string; slug: string } | undefined;
  onlineCount: number;
  user: boolean;
  onOpen: () => void;
}) {
  const name = generalChannel?.name ?? 'General';
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800/50 p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        <h2 className="text-section-title text-gray-200">Live Community Chat</h2>
        <span className="text-[11px] font-medium text-live">Live</span>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-sm text-gray-300">
        <HashIcon size={13} className="text-primary-400" />
        <span className="font-semibold">#{name.toLowerCase()}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
        Talk with the community, ask questions, share feedback, and discuss project updates.
      </p>
      <div className="mt-3">
        {user ? (
          <button
            onClick={onOpen}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-live/15 px-4 text-xs font-semibold text-live ring-1 ring-live/30 transition-colors hover:bg-live/25"
          >
            <ChatIcon size={14} /> Open Chat
          </button>
        ) : (
          <Link
            to="/register?next=/chat/general"
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-live/15 px-4 text-xs font-semibold text-live ring-1 ring-live/30 transition-colors hover:bg-live/25"
          >
            <ChatIcon size={14} /> Create Account
          </Link>
        )}
      </div>
      <p className="mt-2.5 text-[11px] text-gray-500">
        {user ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-live">
            <UsersIcon size={12} /> {onlineCount} online now
          </span>
        ) : (
          <span>Join the community to start chatting.</span>
        )}
      </p>
    </section>
  );
}

function ProjectStrip({ projects, loading }: { projects: Project[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-ink-600 bg-ink-800/40 p-4">
        <h2 className="text-section-title text-gray-300">Projects</h2>
        <div className="mt-3 space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-section-title text-gray-300">Projects</h2>
        <Link to="/projects" className="text-xs font-medium text-primary-300 hover:text-primary-200">All →</Link>
      </div>
      <div className="space-y-2">
        {projects.length === 0 && <p className="text-xs text-gray-600">No projects yet.</p>}
        {projects.slice(0, 5).map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const tech = parseTechStack(project.tech_stack);
  return (
    <div className="group rounded-xl border border-ink-600 bg-ink-800/40 p-3 transition-colors hover:border-primary-600/40">
      <Link to={`/projects/${project.slug}`} className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <ProjectMark name={project.name} size="sm" />
          <span className="truncate text-sm font-semibold text-white group-hover:text-primary-300">{project.name}</span>
        </span>
        <StatusBadge status={project.status} />
      </Link>
      <div className="mt-2 flex flex-col gap-2">
        <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">{project.description}</p>
        {tech.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tech.slice(0, 4).map((t) => (
              <span key={t} className="rounded border border-ink-500 bg-ink-700/50 px-1.5 py-0.5 text-[10px] text-gray-400">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-3 border-t border-ink-600/40 pt-2 text-[10px] text-gray-600">
        {project.version && <span>v{project.version}</span>}
        {project.updated_at && <span>Updated {timeAgo(project.updated_at)}</span>}
      </div>
    </div>
  );
}

function ProjectMark({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-primary-600/15 font-bold text-primary-300 ${
        size === 'sm' ? 'size-8 text-xs' : 'size-11 text-sm'
      }`}
    >
      {initials}
    </span>
  );
}

function OnlineRoster({
  online,
}: {
  online: { count: number; users: Array<{ username: string; displayName: string }> };
}) {
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title text-gray-300">Online Members</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-live">
          <span className="size-1.5 rounded-full bg-live" />
          {online.count}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {online.users.slice(0, 8).map((u) => (
          <Avatar key={u.username} name={u.displayName} size="sm" online className="rounded-full" />
        ))}
        {online.users.length === 0 && <p className="text-xs text-gray-600">No one else is online yet.</p>}
      </div>
    </section>
  );
}

function CommunityLinks() {
  return (
    <div className="flex items-center gap-4 px-1 text-xs text-gray-500">
      <Link to="/bugs" className="inline-flex items-center gap-1.5 hover:text-gray-300">
        <BugIcon size={13} /> Report a bug
      </Link>
      <Link to="/suggestions" className="inline-flex items-center gap-1.5 hover:text-gray-300">
        <IdeaIcon size={13} /> Suggest a feature
      </Link>
    </div>
  );
}