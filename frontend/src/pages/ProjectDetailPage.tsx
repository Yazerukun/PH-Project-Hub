import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Project, ProjectUpdate, BugReport, Suggestion, RoadmapItem } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { StatusBadge, SeverityBadge, Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/Feedback';
import { UpdateCard } from '../components/UpdateCard';
import { parseTechStack, timeAgo } from '../lib/format';
import { updateTypeLabel } from '../lib/updates';
import { applyPageMeta, resetPageMeta } from '../lib/seo';
import {
  GithubIcon, LinkIcon, UsersIcon, ArrowUpIcon, BookmarkIcon, ChatIcon, BugIcon, IdeaIcon,
} from '../components/ui/icons';

type Tab = 'overview' | 'updates' | 'roadmap' | 'discussion' | 'bugs' | 'suggestions';

interface ProjectPageProps {
  initialTab?: Tab;
}

export function ProjectDetailPage({ initialTab = 'overview' }: ProjectPageProps) {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const projectData = await api<Project & { follower_count: number; update_count: number; bug_count: number }>(
          `/api/projects/${slug}`,
          { auth: false }
        );
        if (!active) return;
        setProject(projectData);
        const [updatesData, bugsData, suggestionsData, roadmapData] = await Promise.all([
          api<ProjectUpdate[]>(`/api/updates?projectId=${projectData.id}&limit=10`, { auth: false }),
          api<BugReport[]>(`/api/bugs?projectId=${projectData.id}`, { auth: false }),
          api<Suggestion[]>(`/api/suggestions?projectId=${projectData.id}`, { auth: false }),
          api<RoadmapItem[]>(`/api/roadmap?projectId=${projectData.id}`, { auth: false }),
        ]);
        if (!active) return;
        setUpdates(updatesData);
        setBugs(bugsData);
        setSuggestions(suggestionsData);
        setRoadmap(roadmapData);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load project');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (project) {
      applyPageMeta(
        `${project.name} — ${project.status} | PH Project Hub`,
        `${project.description}${project.version ? ` Current version: v${project.version}.` : ''}`
      );
    }
    return () => {
      resetPageMeta();
    };
  }, [project]);

  useEffect(() => {
    if (!user || !slug) return;
    let active = true;
    void api<{ following: boolean }>(`/api/projects/${slug}/follow`).then((data) => {
      if (active) setFollowing(data.following);
    });
    return () => {
      active = false;
    };
  }, [user, slug]);

  const toggleFollow = async () => {
    if (!user) return;
    try {
      const data = await api<{ following: boolean; count: number }>(`/api/projects/${slug}/follow`, { method: 'POST' });
      setFollowing(data.following);
      setProject((prev) => (prev ? { ...prev, follower_count: data.count } : prev));
    } catch {
      // ignore
    }
  };

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'updates', label: 'Updates', count: updates.length },
    { id: 'roadmap', label: 'Roadmap', count: roadmap.filter((r) => r.status !== 'COMPLETED').length },
    { id: 'discussion', label: 'Discussion' },
    { id: 'bugs', label: 'Bug Reports', count: bugs.filter((b) => b.status === 'OPEN').length },
    { id: 'suggestions', label: 'Suggestions', count: suggestions.filter((s) => s.status === 'NEW').length },
  ];

  const roadmapByStatus = useMemo(
    () => ({
      PLANNED: roadmap.filter((r) => r.status === 'PLANNED'),
      'IN PROGRESS': roadmap.filter((r) => r.status === 'IN PROGRESS'),
      COMPLETED: roadmap.filter((r) => r.status === 'COMPLETED'),
    }),
    [roadmap]
  );

  const handleReact = async (updateId: number, reaction: string) => {
    if (!user) return;
    try {
      const reactions = await api<Record<string, number>>(`/api/updates/${updateId}/reactions`, {
        method: 'POST',
        body: { reaction },
      });
      setUpdates((prev) => prev.map((u) => (u.id === updateId ? { ...u, reactions } : u)));
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !project) {
    return <ErrorState message={error ?? 'Project not found'} />;
  }

  const techStack = parseTechStack(project.tech_stack);
  const channelSlug = project.slug;

  return (
    <div className="space-y-5">
      {/* Identity header */}
      <section className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/50">
        {project.cover && (
          <img src={project.cover} alt="" className="h-32 w-full object-cover" loading="lazy" />
        )}
        <div className="p-6">
          <div className="flex flex-wrap items-start gap-4">
            {!project.cover && (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary-600/15 text-2xl font-bold text-primary-300">
                {project.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title text-white">{project.name}</h1>
                <StatusBadge status={project.status} />
                {project.version && <span className="text-meta text-gray-500">v{project.version}</span>}
              </div>
              <p className="mt-1 text-xs text-gray-500">{project.category}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-400">{project.description}</p>

              {techStack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {techStack.map((tech) => (
                    <span key={tech} className="rounded border border-ink-500 bg-ink-700/50 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {project.live_url && (
                <a href={project.live_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500">
                  <LinkIcon size={13} /> Visit Website
                </a>
              )}
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-500 bg-ink-800 px-4 text-xs font-medium text-gray-300 hover:bg-ink-600">
                  <GithubIcon size={13} /> GitHub
                </a>
              )}
              <Link
                to={`/chat/${channelSlug}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 text-xs font-semibold text-accent-300 hover:bg-accent-500/20"
              >
                <ChatIcon size={13} /> Join Project Chat
              </Link>
              {user ? (
                <button
                  onClick={() => void toggleFollow()}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-4 text-xs font-medium transition-colors ${
                    following
                      ? 'border-primary-600/40 bg-primary-600/10 text-primary-300 hover:bg-primary-600/20'
                      : 'border-ink-500 bg-ink-800 text-gray-300 hover:bg-ink-600'
                  }`}
                >
                  <BookmarkIcon size={13} /> {following ? 'Following' : 'Follow'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4 border-t border-ink-600/50 pt-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><UsersIcon size={13} /> {project.follower_count ?? 0} followers</span>
            <span className="inline-flex items-center gap-1"><ArrowUpIcon size={13} /> {project.update_count ?? 0} updates</span>
            <span className="inline-flex items-center gap-1"><BugIcon size={13} /> {project.bug_count ?? 0} bugs</span>
            <span className="ml-auto">Last update {project.updated_at ? timeAgo(project.updated_at) : '—'}</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-ink-600" role="tablist" aria-label="Project sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-primary-500 text-primary-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? 'bg-primary-600/20 text-primary-300' : 'bg-ink-600 text-gray-400'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-ink-600 bg-ink-800/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{project.description}</p>
          </section>

          <section className="rounded-xl border border-ink-600 bg-ink-800/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">Recent Activity</h2>
            <div className="mt-3 space-y-2.5">
              {updates.slice(0, 5).map((u) => (
                <Link key={u.id} to={`/updates/${u.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-700/50">
                  <Badge tone="accent">{updateTypeLabel(u.update_type)}</Badge>
                  <span className="line-clamp-1 flex-1 text-sm text-gray-300">{u.title}</span>
                  <span className="text-[11px] text-gray-500">{timeAgo(u.published_at)}</span>
                </Link>
              ))}
              {updates.length === 0 && <p className="text-sm text-gray-500">No activity yet.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'updates' && (
        <div className="space-y-3">
          {updates.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No updates yet.</p>}
          {updates.map((u) => (
            <UpdateCard key={u.id} update={u} onReact={(r) => void handleReact(u.id, r)} />
          ))}
        </div>
      )}

      {tab === 'roadmap' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(Object.keys(roadmapByStatus) as Array<keyof typeof roadmapByStatus>).map((col) => (
            <div key={col} className="rounded-xl border border-ink-600 bg-ink-800/40 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{col}</div>
              <div className="space-y-2.5">
                {roadmapByStatus[col].length === 0 && (
                  <p className="rounded-lg border border-dashed border-ink-600 px-3 py-5 text-center text-xs text-gray-600">Empty</p>
                )}
                {roadmapByStatus[col].map((item) => (
                  <div key={item.id} className="rounded-lg border border-ink-600 bg-ink-800/80 p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={item.priority === 'HIGH' ? 'danger' : item.priority === 'MEDIUM' ? 'warn' : 'gray'}>{item.priority}</Badge>
                      {item.target_version && <Badge tone="accent">v{item.target_version}</Badge>}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-gray-200">{item.title}</p>
                    {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'discussion' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/40 px-6 py-12 text-center">
          <ChatIcon size={32} className="text-primary-400" />
          <p className="text-sm font-medium text-gray-200">Join the {project.name} discussion channel</p>
          <p className="max-w-sm text-xs text-gray-500">Real-time chat with the community — reactions, presence, and more.</p>
          <Link
            to={`/chat/${channelSlug}`}
            className="mt-1 inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-500"
          >
            <ChatIcon size={16} /> Open #{channelSlug}
          </Link>
        </div>
      )}

      {tab === 'bugs' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to={`/bugs/new?project=${project.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500">
              <BugIcon size={14} /> Report a bug
            </Link>
          </div>
          {bugs.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No bug reports yet.</p>}
          {bugs.map((b) => (
            <div key={b.id} className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={b.severity} />
                <Badge tone={b.status === 'OPEN' ? 'danger' : b.status === 'INVESTIGATING' ? 'warn' : b.status === 'FIXED' ? 'live' : 'gray'}>
                  {b.status}
                </Badge>
                <span className="ml-auto text-xs text-gray-500">{timeAgo(b.created_at)}</span>
              </div>
              <p className="mt-2 font-medium text-gray-200">{b.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{b.description}</p>
              <p className="mt-2 text-xs text-gray-600">by {b.reporter_name}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'suggestions' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to="/suggestions" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-xs font-semibold text-white hover:bg-primary-500">
              <IdeaIcon size={14} /> All suggestions
            </Link>
          </div>
          {suggestions.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No suggestions yet.</p>}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
              <div className="flex items-center gap-2">
                <Badge tone={s.status === 'COMPLETED' ? 'live' : s.status === 'REJECTED' ? 'danger' : s.status === 'PLANNED' || s.status === 'IN PROGRESS' ? 'accent' : 'gray'}>
                  {s.status}
                </Badge>
                <span className="text-xs text-gray-500">by {s.author_name}</span>
              </div>
              <p className="mt-2 font-medium text-gray-200">{s.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{s.description}</p>
              <p className="mt-2 text-xs text-gray-500">{s.votes ?? 0} votes</p>
            </div>
          ))}
        </div>
      )}

      <p className="pt-1 text-center text-[11px] text-gray-600">
        Follow this project to get notified about releases · <Link to={`/chat/${channelSlug}`} className="text-primary-400 hover:underline">#{channelSlug}</Link>
      </p>
    </div>
  );
}