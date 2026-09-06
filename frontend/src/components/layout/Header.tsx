import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../stores/auth';
import { api } from '../../lib/api';
import type { Notification } from '../../types';
import { Avatar } from '../ui/Avatar';
import { RoleBadge } from '../ui/Badge';
import { BellIcon, SearchIcon, LogoutIcon, UserIcon, MenuIcon, GithubIcon } from '../ui/icons';
import { timeAgo } from '../../lib/format';

export function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [list, count] = await Promise.all([
          api<Notification[]>('/api/notifications?limit=6'),
          api<{ count: number }>('/api/notifications/unread'),
        ]);
        setNotifications(list);
        setUnread(count.count);
      } catch {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async () => {
    try {
      await api('/api/notifications/read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-ink-600 bg-ink-900/90 px-3 backdrop-blur sm:px-4">
      <button
        onClick={onOpenDrawer}
        className="flex size-9 items-center justify-center rounded-lg text-gray-300 hover:bg-ink-600 lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon />
      </button>

      <div className="hidden items-center gap-2 lg:flex">
        <Link to="/" className="text-sm font-bold tracking-tight text-white">
          PH <span className="text-primary-400">PROJECT HUB</span>
        </Link>
      </div>

      <form onSubmit={submitSearch} className="relative mx-auto w-full max-w-md lg:ml-6 lg:mr-auto">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects, updates, messages…"
          className="h-9 w-full rounded-lg border border-ink-500 bg-ink-800 pl-9 pr-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
          aria-label="Search"
        />
      </form>

      <div className="flex items-center gap-1.5">
        {user ? (
          <>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif((v) => !v)}
                className="relative flex size-9 items-center justify-center rounded-lg text-gray-300 hover:bg-ink-600"
                aria-label="Notifications"
              >
                <BellIcon size={18} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-11 w-[340px] overflow-hidden rounded-xl border border-ink-500 bg-ink-800 shadow-2xl shadow-black/40">
                  <div className="flex items-center justify-between border-b border-ink-600 px-3 py-2">
                    <span className="text-sm font-semibold text-gray-200">Notifications</span>
                    {unread > 0 && (
                      <button onClick={markRead} className="text-xs text-primary-400 hover:text-primary-300">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 && (
                      <p className="px-3 py-6 text-center text-xs text-gray-500">No notifications yet</p>
                    )}
                    {notifications.map((n) => (
                      <Link
                        key={n.id}
                        onClick={() => setShowNotif(false)}
                        to={n.link ?? '/updates'}
                        className={`flex gap-2.5 border-b border-ink-600/50 px-3 py-2.5 hover:bg-ink-700/50 ${n.is_read ? '' : 'bg-primary-600/5'}`}
                      >
                        <Avatar name={n.actor_name} src={n.actor_avatar} size="sm" />
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs text-gray-300">
                            <span className="font-semibold text-gray-100">{n.title}</span>
                            {n.body && <span className="text-gray-400"> — {n.body}</span>}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.is_read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-400" />}
                      </Link>
                    ))}
                  </div>
                  <Link
                    onClick={() => setShowNotif(false)}
                    to="/notifications"
                    className="block border-t border-ink-600 px-3 py-2 text-center text-xs text-primary-400 hover:bg-ink-700/40"
                  >
                    View all
                  </Link>
                </div>
              )}
            </div>

            <div className="relative" ref={userRef}>
              <button
                onClick={() => setShowUser((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1 hover:bg-ink-600"
                aria-label="Account menu"
              >
                <Avatar name={user.display_name} src={user.avatar} size="sm" />
              </button>
              {showUser && (
                <div className="absolute right-0 top-11 w-60 overflow-hidden rounded-xl border border-ink-500 bg-ink-800 shadow-2xl shadow-black/40">
                  <div className="border-b border-ink-600 px-3 py-3">
                    <p className="text-sm font-semibold text-white">{user.display_name}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                    <div className="mt-2"><RoleBadge role={user.role} /></div>
                  </div>
                  <div className="p-1.5">
                    <Link
                      onClick={() => setShowUser(false)}
                      to="/profile"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-ink-700"
                    >
                      <UserIcon size={16} /> My profile
                    </Link>
                    <Link
                      onClick={() => setShowUser(false)}
                      to="https://github.com/phprojecthub"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-ink-700"
                    >
                      <GithubIcon size={16} /> GitHub
                    </Link>
                    <button
                      onClick={async () => {
                        await logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      <LogoutIcon size={16} /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="h-9 rounded-lg px-3.5 text-sm font-medium text-gray-300 hover:bg-ink-600 inline-flex items-center"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-3.5 text-sm font-medium text-white hover:bg-primary-500"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}