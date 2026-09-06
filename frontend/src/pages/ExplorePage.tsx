import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';
import { api } from '../lib/api';
import { StatusBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { parseTechStack } from '../lib/format';
import { UsersIcon, GithubIcon, LinkIcon } from '../components/ui/icons';

const STATUS_FILTERS = ['All', 'LIVE', 'BETA', 'IN DEVELOPMENT', 'MAINTENANCE', 'ARCHIVED'] as const;

export function ExplorePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api<Project[]>('/api/projects', { auth: false });
        if (active) setProjects(data);
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

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const statusOk = filter === 'All' || p.status === filter;
      const q = query.trim().toLowerCase();
      const queryOk = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return statusOk && queryOk;
    });
  }, [projects, filter, query]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Explore Projects</h1>
        <p className="text-sm text-gray-500">Everything we&apos;re building, in one place.</p>
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
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No projects found" description="Try changing your filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.slug}`}
              className="group flex flex-col rounded-xl border border-ink-600 bg-ink-800/60 p-5 transition-colors hover:border-primary-600/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary-600/15 text-sm font-bold text-primary-300">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-white group-hover:text-primary-300">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <p className="mt-3 line-clamp-2 text-sm text-gray-400">{p.description}</p>

              {parseTechStack(p.tech_stack).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {parseTechStack(p.tech_stack).slice(0, 4).map((tech) => (
                    <span key={tech} className="rounded border border-ink-500 bg-ink-700/50 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3 border-t border-ink-600/50 pt-3 text-xs text-gray-500">
                {p.version && <span>v{p.version}</span>}
                <span className="inline-flex items-center gap-1">
                  <UsersIcon size={13} /> {p.follower_count ?? 0}
                </span>
                {p.github_url && <GithubIcon size={13} />}
                {p.live_url && <LinkIcon size={13} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}