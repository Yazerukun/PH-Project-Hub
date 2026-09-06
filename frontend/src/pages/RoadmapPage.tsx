import { useEffect, useMemo, useState } from 'react';
import type { RoadmapItem } from '../types';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';

const COLUMNS: Array<{ key: 'PLANNED' | 'IN PROGRESS' | 'COMPLETED'; label: string }> = [
  { key: 'PLANNED', label: 'Planned' },
  { key: 'IN PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

export function RoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api<RoadmapItem[]>('/api/roadmap', { auth: false });
        if (active) setItems(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load roadmap');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, RoadmapItem[]> = { PLANNED: [], 'IN PROGRESS': [], COMPLETED: [] };
    for (const item of items) {
      (g[item.status] ??= []).push(item);
    }
    // Sort by priority then position
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    for (const key of Object.keys(g)) {
      g[key].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1) || a.position - b.position);
    }
    return g;
  }, [items]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Roadmap</h1>
        <p className="text-sm text-gray-500">What we&apos;re planning, building, and shipping across all projects.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing planned yet" description="Check back soon for roadmap updates." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className="flex flex-col rounded-xl border border-ink-600 bg-ink-800/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{col.label}</span>
                <span className="rounded-full bg-ink-600 px-1.5 py-0.5 text-[10px] text-gray-400">{grouped[col.key].length}</span>
              </div>
              <div className="flex-1 space-y-2.5">
                {grouped[col.key].length === 0 && (
                  <p className="rounded-lg border border-dashed border-ink-600 px-3 py-6 text-center text-xs text-gray-600">Nothing here</p>
                )}
                {grouped[col.key].map((item) => (
                  <div key={item.id} className="rounded-lg border border-ink-600 bg-ink-800/80 p-3.5">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={item.priority === 'HIGH' ? 'danger' : item.priority === 'MEDIUM' ? 'warn' : 'gray'}>
                        {item.priority}
                      </Badge>
                      {item.target_version && <Badge tone="accent">v{item.target_version}</Badge>}
                      <span className="ml-auto truncate text-xs text-primary-300">{item.project_name}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug text-gray-200">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}