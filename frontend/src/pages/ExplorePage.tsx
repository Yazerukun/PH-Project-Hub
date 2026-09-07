import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, ProjectUpdate } from '../types';
import { api } from '../lib/api';
import { StatusBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { parseTechStack, timeAgo } from '../lib/format';
import { UsersIcon, GithubIcon, LinkIcon, ChatIcon } from '../components/ui/icons';

const STATUS_FILTERS = ['All', 'LIVE', 'BETA', 'IN DEVELOPMENT', 'MAINTENANCE', 'ARCHIVED'] as const;

export function ExplorePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [data, up] = await Promise.all([
          api<Project[]>('/api/projects', { auth: false }),
          api<ProjectUpdate[]>('/api/updates?limit=100', { auth: false }),
        ]);
        if (active) {
          setProjects(data);
          setUpdates(up);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load projects');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const latestByProject = useMemo(() => {
    const map = new Map<number, ProjectUpdate>();
    for (const u of updates) {
      if (!map.has(u.project_id)) map.set(u.project_id, u);
    }
    return map;
  }, [updates]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const statusOk = filter === 'All' || p.status === filter;
      const q = query.trim().toLowerCase();
      const queryOk = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return statusOk && queryOk;
    });
  }, [projects, filter, query]);

  const liveCount = projects.filter((p) => p.status === 'LIVE').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-page-title text-white">Explore Projects</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything we&apos;re building, in one place — {projects.length} projects{liveCount > 0 ? `, ${liveCount} live` : ''}.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                  : 'border-ink-500 bg-ink-800/40 text-gray-400 hover:bg-ink-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter projects…"
          className="h-9 w-full rounded-lg border border-ink-500 bg-ink-800 px-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none sm:ml-auto sm:w-56"
          aria-label="Filter projects"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No projects found" description="Try changing your filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} latest={latestByProject.get(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectMark({ project, cover = false }: { project: Project; cover?: boolean }) {
  if (cover && project.cover) {
    return <img src={project.cover} alt="" className="size-11 shrink-0 rounded-xl object-cover" loading="lazy" />;
  }
  const initials = project.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-600/15 text-sm font-bold text-primary-300">
      {initials}
    </span>
  );
}

function ProjectCard({ project, latest }: { project: Project; latest?: ProjectUpdate }) {
  const tech = parseTechStack(project.tech_stack);
  return (
    <Link
      key={project.id}
      to={`/projects/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-800/60 transition-colors hover:border-primary-600/40"
    >
      {project.cover ? (
        <img src={project.cover} alt="" className="h-24 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-16 items-center justify-center border-b border-ink-600/50 bg-ink-900/40">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-600/15 text-xs font-bold text-primary-300">
            {project.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectMark project={project} cover />
            <div className="min-w-0">
              <p className="truncate font-semibold text-white group-hover:text-primary-300">{project.name}</p>
              <p className="truncate text-xs text-gray-500">{project.category}</p>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-400">{project.description}</p>

        {tech.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tech.slice(0, 4).map((t) => (
              <span key={t} className="rounded border border-ink-500 bg-ink-700/50 px-1.5 py-0.5 text-[10px] text-gray-400">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4">
          {latest && (
            <p className="line-clamp-1 text-meta text-gray-500">
              <span className="font-medium text-gray-300">Latest:</span> {latest.title}
              <span className="text-gray-600"> · {timeAgo(latest.published_at)}</span>
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-3 border-t border-ink-600/50 pt-2.5 text-xs text-gray-500">
            {project.version && <span>v{project.version}</span>}
            <span className="inline-flex items-center gap-1">
              <UsersIcon size={13} /> {project.follower_count ?? 0}
            </span>
            {project.github_url && <GithubIcon size={13} />}
            {project.live_url && <LinkIcon size={13} />}
            <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary-300 group-hover:text-primary-200">
              <ChatIcon size={12} /> View →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}