import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BugReport } from '../types';
import { api } from '../lib/api';
import { SeverityBadge, Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { timeAgo } from '../lib/format';
import { BugIcon } from '../components/ui/icons';

const statusTone: Record<string, 'danger' | 'warn' | 'live' | 'gray'> = {
  OPEN: 'danger',
  INVESTIGATING: 'warn',
  FIXED: 'live',
  CLOSED: 'gray',
};

export function BugReportsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<BugReport[]>('/api/bugs', { auth: false });
      setBugs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bug reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = statusFilter === 'All' ? bugs : bugs.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Bug Reports</h1>
          <p className="text-sm text-gray-500">Reported issues across all projects.</p>
        </div>
        <Link
          to="/bugs/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500"
        >
          <BugIcon size={16} /> Report a bug
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All', 'OPEN', 'INVESTIGATING', 'FIXED', 'CLOSED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                : 'border-ink-500 bg-ink-800/40 text-gray-400 hover:bg-ink-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No bug reports" description="Submit one and help make things better." />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={b.severity} />
                <Badge tone={statusTone[b.status]}>{b.status}</Badge>
                <Link to={`/projects/${b.project_slug}`} className="text-xs font-semibold text-primary-400 hover:text-primary-300">
                  {b.project_name}
                </Link>
                <span className="ml-auto text-xs text-gray-500">
                  by {b.reporter_name} · {timeAgo(b.created_at)}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-200">{b.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{b.description}</p>
              {b.browser && (
                <p className="mt-2 text-[11px] text-gray-600">
                  Browser: {b.browser}
                  {b.device ? ` · Device: ${b.device}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}