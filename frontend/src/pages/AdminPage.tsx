import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectUpdate, BugReport, Suggestion, Report, UserSummary, Role } from '../types';
import { api } from '../lib/api';
import { Badge, RoleBadge, SeverityBadge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState, Banner } from '../components/ui/Feedback';
import { timeAgo } from '../lib/format';
import { updateTypeLabel } from '../lib/updates';
import { useAuth } from '../stores/auth';
import { CheckIcon, CloseIcon } from '../components/ui/icons';

type Tab = 'overview' | 'updates' | 'bugs' | 'suggestions' | 'reports' | 'members';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'updates', label: 'Updates' },
  { id: 'bugs', label: 'Bugs' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'reports', label: 'Reports' },
  { id: 'members', label: 'Members' },
];

const REFRESH_MS = 15000;
const ROLE_OPTIONS: Role[] = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'];

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [deltas, setDeltas] = useState<Record<Tab, number>>({ overview: 0, updates: 0, bugs: 0, suggestions: 0, reports: 0, members: 0 });

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const emptyReports: Report[] = [];

  const load = useCallback(
    async (mode: 'initial' | 'silent' | 'force' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      setError(null);
      try {
        const [u, b] = await Promise.all([
          api<ProjectUpdate[]>('/api/updates', { auth: false }),
          api<BugReport[]>('/api/bugs', { auth: false }),
        ]);
        setUpdates(u);
        setBugs(b);
        setSuggestions(await api<Suggestion[]>('/api/suggestions', { auth: false }));

        let newReports: Report[] = emptyReports;
        let newUsers: UserSummary[] = [];
        if (isAdmin) {
          setStats(await api<Record<string, number>>('/api/admin/stats'));
          newReports = await api<Report[]>('/api/moderation/reports');
          newUsers = await api<UserSummary[]>('/api/users');
        }
        setReports(newReports);
        setUsers(newUsers);

        const presence = await api<{ users: Array<{ userId: number; status: string }> }>('/api/presence', { auth: false });
        setOnlineIds(new Set(presence.users.filter((u) => u.status === 'ONLINE').map((u) => u.userId)));

        if (mode !== 'initial') {
          setDeltas((prev) => ({
            ...prev,
            reports: prev.reports + Math.max(0, newReports.length - reports.length),
            members: prev.members + Math.max(0, newUsers.length - users.length),
          }));
        }
        setLive(true);
      } catch (e) {
        if (mode === 'initial') setError(e instanceof Error ? e.message : 'Failed to load admin data');
      } finally {
        if (mode === 'initial') setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, reports.length, users.length]
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load('silent'), REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load('silent');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const flash = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBanner(null);
    await fn();
    setBanner(okMsg);
    window.setTimeout(() => setBanner(null), 2500);
    await load('silent');
  };

  const setBugStatus = (id: number, status: string) =>
    flash(() => api(`/api/admin/bugs/${id}/status`, { method: 'PATCH', body: { status } }), 'Bug status updated');

  const setSuggestionStatus = (id: number, status: string) =>
    flash(() => api(`/api/admin/suggestions/${id}/status`, { method: 'PATCH', body: { status } }), 'Suggestion updated');

  const resolveReport = (id: number, status: 'RESOLVED' | 'DISMISSED') =>
    flash(() => api(`/api/moderation/resolve/${id}`, { method: 'POST', body: { status } }), 'Report resolved');

  const changeRole = (id: number, role: Role) =>
    flash(() => api(`/api/admin/users/${id}/role`, { method: 'POST', body: { role } }), `Role changed to ${role}`);

  if (!user) return null;

  const canMod = user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MODERATOR';
  const canManageRoles = user.role === 'OWNER' || user.role === 'ADMIN';

  const selectTab = (id: Tab) => {
    setTab(id);
    setDeltas((d) => ({ ...d, [id]: 0 }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-page-title text-white">
            Admin
            {live && (
              <span className="flex items-center gap-1.5 rounded-full border border-live/30 bg-live/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-live">
                <span className="size-1.5 animate-pulse rounded-full bg-live" />
                Live
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">
            Content moderation and platform controls, refreshing in realtime for {user.username}.
          </p>
        </div>
        {banner && <Banner tone="success">{banner}</Banner>}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className={`relative rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                : 'border-ink-500 bg-ink-800/40 text-gray-400 hover:bg-ink-700'
            }`}
          >
            {t.label}
            {deltas[t.id] > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white">
                +{deltas[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {!canMod ? (
        <ErrorState message="You don't have permission to view the admin panel." />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          {tab === 'overview' && isAdmin && stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
                  <p className="text-2xl font-bold text-white">{v}</p>
                  <p className="text-xs uppercase tracking-wider text-gray-500">{k.replaceAll('_', ' ')}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'updates' && (
            <div className="space-y-2">
              <div className="flex justify-end pb-1">
                <Link to="/updates/new" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
                  Publish update
                </Link>
              </div>
              {updates.slice(0, 20).map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{u.title}</p>
                    <p className="text-xs text-gray-500">{u.project_name} · {timeAgo(u.published_at)}</p>
                  </div>
                  <Badge tone={u.pinned === 1 ? 'warn' : 'gray'}>{u.pinned === 1 ? 'Pinned' : updateTypeLabel(u.update_type)}</Badge>
                </div>
              ))}
              {updates.length === 0 && <EmptyState title="No updates yet" description="Publish the first official update." />}
            </div>
          )}

          {tab === 'bugs' && (
            <div className="space-y-2">
              {bugs.map((b) => (
                <div key={b.id} className="rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={b.severity} />
                    <Link to={`/projects/${b.project_slug}`} className="text-xs font-semibold text-primary-400">{b.project_name}</Link>
                    <span className="ml-auto text-xs text-gray-500">{timeAgo(b.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-200">{b.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['OPEN', 'INVESTIGATING', 'FIXED', 'CLOSED'].map((s) => (
                      <button
                        key={s}
                        onClick={() => void setBugStatus(b.id, s)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          b.status === s
                            ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                            : 'border-ink-500 text-gray-400 hover:bg-ink-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {bugs.length === 0 && <EmptyState title="No bugs reported" description="All projects look healthy." />}
            </div>
          )}

          {tab === 'suggestions' && (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">{s.votes ?? 0} ▲</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{s.title}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['NEW', 'UNDER REVIEW', 'PLANNED', 'IN PROGRESS', 'COMPLETED', 'REJECTED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => void setSuggestionStatus(s.id, st)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          s.status === st
                            ? 'border-primary-600 bg-primary-600/15 text-primary-300'
                            : 'border-ink-500 text-gray-400 hover:bg-ink-700'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {suggestions.length === 0 && <EmptyState title="No suggestions" description="Members haven't suggested anything yet." />}
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-2">
              {reports.length === 0 && <EmptyState title="No reports" description="All clear — nothing needs your attention." />}
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.reason === 'ABUSE' || r.reason === 'HARASSMENT' ? 'danger' : 'warn'}>{r.reason}</Badge>
                    <span className="text-xs font-semibold text-white">{r.target_type} #{r.target_id}</span>
                    <span className="ml-auto text-xs text-gray-500">by {r.reporter_name} · {timeAgo(r.created_at)}</span>
                  </div>
                  {r.details && <p className="mt-1 text-sm text-gray-400">{r.details}</p>}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void resolveReport(r.id, 'DISMISSED')}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink-500 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-ink-700"
                    >
                      <CheckIcon size={12} /> Dismiss
                    </button>
                    <button
                      onClick={() => void resolveReport(r.id, 'RESOLVED')}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary-600/40 px-2.5 py-1 text-[11px] text-primary-300 hover:bg-primary-600/10"
                    >
                      <CloseIcon size={12} /> Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                New signups appear here automatically as {isAdmin ? 'members' : 'members'}; promote or demote roles to keep the team healthy.
              </p>
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary-300">
                    {u.display_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                      {u.display_name}
                      {u.id === user.id && <Badge tone="accent">you</Badge>}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      @{u.username}{u.email ? ` · ${u.email}` : ''}
                    </p>
                  </div>
                  <RoleBadge role={u.role} />
                  {u.is_banned === 1 && <Badge tone="danger">Banned</Badge>}
                  {u.is_muted === 1 && <Badge tone="warn">Muted</Badge>}
                  <Badge tone={onlineIds.has(u.id) ? 'live' : 'gray'}>{onlineIds.has(u.id) ? 'ONLINE' : 'OFFLINE'}</Badge>
                  {canManageRoles && u.id !== user.id && (
                    <select
                      value={u.role}
                      onChange={(e) => void changeRole(u.id, e.target.value as Role)}
                      className="rounded-lg border border-ink-500 bg-ink-800 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-ink-700 focus:outline-none"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              {users.length === 0 && <EmptyState title="No members yet" description="Shared accounts will appear here." />}
            </div>
          )}
        </>
      )}
    </div>
  );
}