import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SearchResults } from '../types';
import { api } from '../lib/api';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/Badge';
import { timeAgo } from '../lib/format';
import { SearchIcon, HashIcon } from '../components/ui/icons';

type Tab = 'all' | 'projects' | 'updates' | 'messages' | 'users';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects' },
  { id: 'updates', label: 'Updates' },
  { id: 'messages', label: 'Messages' },
  { id: 'users', label: 'Users' },
];

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const [tab, setTab] = useState<Tab>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void api<SearchResults>(`/api/search?q=${encodeURIComponent(q)}&tab=${tab}`, { auth: false })
      .then((data) => {
        if (active) setResults(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Search failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [q, tab]);

  if (!q.trim()) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <SearchIcon size={40} className="text-gray-600" />
        <p className="text-sm text-gray-500">Search across projects, updates, messages, and users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Search results</h1>
        <p className="text-sm text-gray-500">
          “{q}” <span className="text-gray-700">·</span>{' '}
          {results && ` ${countResults(results)} result${countResults(results) === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                : 'border-ink-500 bg-ink-800/40 text-gray-400 hover:bg-ink-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : results && countResults(results) === 0 ? (
        <EmptyState title="No results found" description={`Nothing matched “${q}”. Try different keywords.`} />
      ) : results ? (
        <div className="space-y-3">
          {results.projects?.map((p) => (
            <Link key={`p-${p.id}`} to={`/projects/${p.slug}`} className="block rounded-xl border border-ink-600 bg-ink-800/60 p-4 hover:border-primary-600/40">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{p.name}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{p.description}</p>
            </Link>
          ))}
          {results.updates?.map((u) => (
            <Link key={`u-${u.id}`} to={`/updates/${u.id}`} className="block rounded-xl border border-ink-600 bg-ink-800/60 p-4 hover:border-primary-600/40">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary-400">{u.project_name}</p>
              <p className="mt-1 text-sm font-semibold text-white">{u.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{u.body}</p>
              <p className="mt-1 text-[11px] text-gray-600">{timeAgo(u.published_at)}</p>
            </Link>
          ))}
          {results.messages?.map((m) => (
            <Link key={`m-${m.id}`} to={`/chat/${m.channel_slug}`} className="block rounded-xl border border-ink-600 bg-ink-800/60 p-4 hover:border-primary-600/40">
              <div className="flex items-center gap-2">
                <HashIcon size={13} className="text-gray-500" />
                <span className="text-xs font-semibold text-primary-300">{m.channel_name}</span>
                <span className="text-xs text-gray-500">{m.author_name}</span>
                <span className="ml-auto text-[11px] text-gray-600">{timeAgo(m.created_at)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-gray-300">{m.body}</p>
            </Link>
          ))}
          {results.users?.map((u) => (
            <div key={`user-${u.id}`} className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/60 p-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary-300">
                {u.display_name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{u.display_name}</p>
                <p className="text-xs text-gray-500">@{u.username}</p>
              </div>
              <span className="ml-auto text-[11px] text-gray-500">{u.role}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function countResults(r: SearchResults): number {
  return (r.projects?.length ?? 0) + (r.updates?.length ?? 0) + (r.messages?.length ?? 0) + (r.users?.length ?? 0);
}