import { useCallback, useEffect, useState } from 'react';
import type { ProjectUpdate } from '../types';
import { api } from '../lib/api';
import { UpdateCard } from '../components/UpdateCard';
import { Skeleton, Card } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../stores/auth';
import { updateTypeLabel } from '../lib/updates';

const FILTERS = ['All', 'RELEASE', 'ANNOUNCEMENT', 'FEATURE', 'IMPROVEMENT', 'FIX', 'MAINTENANCE'] as const;

export function UpdatesPage() {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ProjectUpdate[]>('/api/updates?limit=50', { auth: false });
      setUpdates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load updates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReact = useCallback(
    async (updateId: number, reaction: string) => {
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
    },
    [user]
  );

  const filtered = filter === 'All' ? updates : updates.filter((u) => u.update_type === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Project Updates</h1>
          <p className="text-sm text-gray-500">Official changelogs and announcements from every project.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter updates by type">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                : 'border-ink-500 bg-ink-800/40 text-gray-400 hover:bg-ink-700'
            }`}
          >
{f === 'All' ? 'All' : updateTypeLabel(f)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState title="No updates here" description="This filter has no updates yet. Check back soon." />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <UpdateCard key={u.id} update={u} onReact={(r) => void handleReact(u.id, r)} />
          ))}
        </div>
      )}
    </div>
  );
}