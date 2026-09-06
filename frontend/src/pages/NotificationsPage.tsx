import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Notification } from '../types';
import { api } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/Feedback';
import { timeAgo } from '../lib/format';
import { CheckIcon } from '../components/ui/icons';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Notification[]>('/api/notifications?limit=100');
      setNotifications(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markAll = async () => {
    try {
      await api('/api/notifications/read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  };

  const markOne = async (id: number) => {
    try {
      await api(`/api/notifications/read/${id}`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAll()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-gray-300 hover:bg-ink-600"
          >
            <CheckIcon size={13} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications" description="Things will show up here when people interact with you." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Link
              key={n.id}
              to={n.link ?? '/updates'}
              onClick={() => void markOne(n.id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                n.is_read === 0
                  ? 'border-primary-600/30 bg-primary-600/5 hover:bg-primary-600/10'
                  : 'border-ink-600 bg-ink-800/50 hover:bg-ink-700/50'
              }`}
            >
              <Avatar name={n.actor_name} src={n.actor_avatar} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200">
                  <span className="font-semibold text-white">{n.title}</span>
                  {n.body && <span className="text-gray-400"> — {n.body}</span>}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{timeAgo(n.created_at)}</p>
              </div>
              {n.is_read === 0 && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary-400" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}