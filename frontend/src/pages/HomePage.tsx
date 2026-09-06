import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project, ProjectUpdate } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useChannels } from '../stores/channels';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge, Badge } from '../components/ui/Badge';
import { OfficialBadge, OwnerBadge } from '../components/ui/OwnerBadge';
import { timeAgo } from '../lib/format';
import { parseTechStack } from '../lib/format';
import { updateTypeLabel } from '../lib/updates';
import {
  ChatIcon, ArrowUpIcon, BugIcon, IdeaIcon, HashIcon, UsersIcon, FireIcon,
} from '../components/ui/icons';

export function HomePage() {
  const { user } = useAuth();
  const { channels } = useChannels();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<{ count: number }>({ count: 0 });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [projectsData, updatesData, presence] = await Promise.all([
          api<Project[]>('/api/projects', { auth: false }),
          api<ProjectUpdate[]>('/api/updates?limit=8', { auth: false }),
          api<{ count: number }>('/api/presence', { auth: false }).catch(() => ({ count: 0 })),
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
    <div className="space-y-6">
      {/* Compact welcome block */}
      <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              PH <span className="text-primary-400">PROJECT HUB</span>
            </h1>
            <p className="text-xs font-medium text-gray-500">Build · Update · Discuss · Grow</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
              Official home for project updates, releases, bug reports, suggestions, and community chat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {user ? (
              <>
                <button
                  onClick={openChat}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500"
                >
                  <ChatIcon size={16} /> Open #general
                </button>
                <Link
                  to={latest ? `/updates/${latest.id}` : '/updates'}
                  className="inline-flex h-10 items-center rounded-lg border border-ink-500 px-4 text-sm font-medium text-gray-300 hover:bg-ink-600"
                >
                  View Latest Update
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={openChat}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500"
                >
                  <ChatIcon size={16} /> Join the Chat
                </button>
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

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-6 text-center text-sm text-red-300">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Latest official update — hero card */}
            <LatestUpdateCard update={latest} loading={loading} />

            {/* Recent updates */}
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-gray-300">
                  <ArrowUpIcon size={14} className="text-primary-400" /> Recent Updates
                </h2>
                <Link to="/updates" className="text-xs text-primary-400 hover:text-primary-300">All updates →</Link>
              </div>
              {loading ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : updates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-600 px-5 py-8 text-center text-sm text-gray-500">
                  No updates yet — the first one is on its way.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {updates.slice(1, 6).map((u) => (
                    <UpdateRow key={u.id} update={u} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            {/* Live chat discoverability */}
            <LiveChatCard
              generalChannel={generalChannel}
              onlineCount={online.count}
              user={!!user}
              onOpen={() => openChat()}
            />

            {/* Projects */}
            <ProjectStrip projects={projects} loading={loading} />

            {/* Community activity / empty state */}
            <CommunityState hasUpdates={updates.length > 0} hasProjects={projects.length > 0} />
          </div>
        </div>
      )}
    </div>
  );
}

function LatestUpdateCard({ update, loading }: { update?: ProjectUpdate; loading: boolean }) {
  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50">
        <div className="border-b border-ink-600/60 bg-ink-900/50 px-4 py-3"><Skeleton className="h-4 w-40" /></div>
        <div className="space-y-3 p-5"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
      </section>
    );
  }
  if (!update) {
    return (
      <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50">
        <div className="border-b border-ink-600/60 bg-ink-900/50 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Latest Official Update</span>
        </div>
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <FireIcon size={28} className="text-primary-400" />
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
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })();

  return (
    <section className="overflow-hidden rounded-2xl border border-primary-600/30 bg-ink-800/60 shadow-lg shadow-primary-900/10">
      <div className="flex items-center gap-2 border-b border-ink-600/60 bg-ink-900/50 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Latest Official Update</span>
        <OfficialBadge />
        {update.update_type && <Badge tone="accent">{updateTypeLabel(update.update_type)}</Badge>}
        <span className="ml-auto text-[11px] text-gray-500">{timeAgo(update.published_at)}</span>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/projects/${update.project_slug}`} className="text-sm font-semibold text-primary-300 hover:underline">
            {update.project_name}
          </Link>
          {update.version && <Badge tone="gray">v{update.version}</Badge>}
          {update.author_role === 'OWNER' && <OwnerBadge role="OWNER" />}
        </div>
        <h3 className="mt-2 text-lg font-bold leading-snug text-white sm:text-xl">
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
          update.body && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-gray-400">{update.body}</p>
        )}

        <p className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><ChatIcon size={12} /> {update.comment_count ?? 0}</span>
            <span className="flex items-center gap-1.5">
              <span className="size-5 rounded-full bg-ink-700" />
              by {update.author_name}
            </span>
          </span>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/updates/${update.id}`} className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500">
            View Update
          </Link>
          <Link to={`/projects/${update.project_slug}`} className="inline-flex h-9 items-center rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600">
            Open Project
          </Link>
          <Link to={`/chat/${update.project_slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-500 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600">
            <ChatIcon size={13} /> Join Discussion
          </Link>
        </div>
      </div>
    </section>
  );
}

function UpdateRow({ update }: { update: ProjectUpdate }) {
  const changelog: string[] = (() => {
    try {
      const parsed = JSON.parse(update.changelog);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();
  const summary = changelog.length ? changelog[0] : update.body;
  return (
    <Link
      to={`/updates/${update.id}`}
      className="group flex items-start gap-3 rounded-xl border border-ink-600 bg-ink-800/40 p-3.5 transition-colors hover:border-primary-600/40 hover:bg-ink-800/70"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-600/15 text-primary-400">
        <ArrowUpIcon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white group-hover:text-primary-300">{update.title}</span>
          {update.update_type && <Badge tone="accent">{updateTypeLabel(update.update_type)}</Badge>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
          <span className="text-primary-300/80">{update.project_name}</span>
          {summary ? ` — ${summary}` : ''}
        </p>
        <p className="mt-1 text-[11px] text-gray-600">{timeAgo(update.published_at)}{update.version ? ` · v${update.version}` : ''}</p>
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
    <section className="rounded-2xl border border-live/25 bg-ink-800/50 p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        <h2 className="text-sm font-bold text-white">LIVE COMMUNITY CHAT</h2>
        <span className="text-[11px] font-medium text-live">Live</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-300">
        <HashIcon size={13} className="text-primary-400" />
        <span className="font-semibold">#{name.toLowerCase()}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
        Talk with the community, ask questions, share feedback, and discuss project updates.
      </p>
      <div className="mt-2 text-[11px] text-gray-500">
        {user ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-live">
            <UsersIcon size={12} /> {onlineCount} online now
          </span>
        ) : (
          <span>Join the community to start chatting.</span>
        )}
      </div>
      {user ? (
        <button
          onClick={onOpen}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-live/15 px-4 text-xs font-semibold text-live ring-1 ring-live/30 transition-colors hover:bg-live/25"
        >
          <ChatIcon size={14} /> Open Chat
        </button>
      ) : (
        <Link
          to="/register?next=/chat/general"
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-live/15 px-4 text-xs font-semibold text-live ring-1 ring-live/30 transition-colors hover:bg-live/25"
        >
          <ChatIcon size={14} /> Create Account
        </Link>
      )}
    </section>
  );
}

function ProjectStrip({ projects, loading }: { projects: Project[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-ink-600 bg-ink-800/40 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">Projects</h2>
        <div className="mt-3 space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">Projects</h2>
        <Link to="/projects" className="text-xs text-primary-400 hover:text-primary-300">All →</Link>
      </div>
      <div className="space-y-2">
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
        <span className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-600/15 text-xs font-bold text-primary-300">
            {project.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate text-sm font-semibold text-white group-hover:text-primary-300">{project.name}</span>
        </span>
        <StatusBadge status={project.status} />
      </Link>
      <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{project.description}</p>
      {tech.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tech.slice(0, 4).map((t) => (
            <span key={t} className="rounded border border-ink-500 bg-ink-700/50 px-1.5 py-0.5 text-[10px] text-gray-400">{t}</span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-600">
        {project.version && <span>v{project.version}</span>}
        {project.updated_at && <span>Updated {timeAgo(project.updated_at)}</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Link to={`/projects/${project.slug}`} className="inline-flex h-7 flex-1 items-center justify-center rounded-lg border border-ink-500 text-[11px] font-medium text-gray-300 hover:bg-ink-600">
          View
        </Link>
        <Link to={`/chat/${project.slug}`} className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-primary-600/10 text-[11px] font-medium text-primary-300 hover:bg-primary-600/20">
          <ChatIcon size={11} /> Chat
        </Link>
      </div>
    </div>
  );
}

function CommunityState({ hasUpdates, hasProjects }: { hasUpdates: boolean; hasProjects: boolean }) {
  const active = hasUpdates || hasProjects;
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800/40 p-4">
      {active ? (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">Community</h2>
          <div className="mt-3 space-y-1.5">
            {[{ to: '/bugs', icon: BugIcon, label: 'Report a bug' }, { to: '/suggestions', icon: IdeaIcon, label: 'Submit a suggestion' }].map((c) => (
              <Link key={c.to} to={c.to} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-300 hover:bg-ink-700/50">
                <c.icon size={15} className="text-primary-400" /> {c.label}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary-300">Community is just getting started</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-400">Be one of the first members to:</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            <li>· discuss projects</li>
            <li>· report bugs</li>
            <li>· suggest features</li>
            <li>· follow new releases</li>
          </ul>
          <Link to="/register" className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500">
            Join the Community
          </Link>
        </>
      )}
    </section>
  );
}
