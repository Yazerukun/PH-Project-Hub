import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Suggestion } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { timeAgo } from '../lib/format';
import { IdeaIcon, ArrowUpIcon } from '../components/ui/icons';

const statusTone: Record<string, 'gray' | 'warn' | 'accent' | 'live' | 'danger'> = {
  NEW: 'gray',
  'UNDER REVIEW': 'warn',
  PLANNED: 'accent',
  'IN PROGRESS': 'accent',
  COMPLETED: 'live',
  REJECTED: 'danger',
};

export function SuggestionsPage() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Suggestion[]>('/api/suggestions', { auth: false });
      setSuggestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vote = async (id: number) => {
    if (!user) return;
    try {
      const data = await api<{ votes: number; has_voted: boolean }>(`/api/suggestions/${id}/vote`, { method: 'POST' });
      setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, votes: data.votes, has_voted: data.has_voted ? 1 : 0 } : s)));
    } catch {
      // ignore
    }
  };

  const sorted = useMemo(() => [...suggestions].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)), [suggestions]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Feature Suggestions</h1>
          <p className="text-sm text-gray-500">Shape what we build next. Upvote the ideas you love.</p>
        </div>
        <Link
          to="/suggestions/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500"
        >
          <IdeaIcon size={16} /> Submit a suggestion
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : sorted.length === 0 ? (
        <EmptyState title="No suggestions yet" description="Be the first to suggest a feature." />
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => (
            <div key={s.id} className="flex gap-4 rounded-xl border border-ink-600 bg-ink-800/60 p-4">
              <button
                onClick={() => void vote(s.id)}
                disabled={!user}
                className={`flex h-full min-h-[3.5rem] w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors ${
                  s.has_voted === 1
                    ? 'border-primary-600 bg-primary-600/20 text-primary-300'
                    : 'border-ink-500 bg-ink-800 text-gray-400 hover:border-primary-600/40 hover:text-primary-300'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={user ? 'Upvote' : 'Log in to upvote'}
                aria-label="Upvote suggestion"
              >
                <ArrowUpIcon size={16} />
                <span className="text-xs font-bold">{s.votes ?? 0}</span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[s.status] ?? 'gray'}>{s.status}</Badge>
                  <Link to={`/projects/${s.project_slug}`} className="text-xs font-semibold text-primary-400 hover:text-primary-300">
                    {s.project_name}
                  </Link>
                  <span className="ml-auto text-xs text-gray-500">
                    by {s.author_name} · {timeAgo(s.created_at)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-200">{s.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}