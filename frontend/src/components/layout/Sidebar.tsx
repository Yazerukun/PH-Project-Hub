import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useChannels } from '../../stores/channels';
import { useAuth } from '../../stores/auth';
import { api } from '../../lib/api';
import { HashIcon, HomeIcon, UpdatesIcon, ExploreIcon, RoadmapIcon, ChatIcon, LockIcon } from '../ui/icons';
import { Avatar } from '../ui/Avatar';
import type { Channel } from '../../types';

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/updates', label: 'Project Updates', icon: UpdatesIcon },
  { to: '/projects', label: 'Explore Projects', icon: ExploreIcon },
  { to: '/roadmap', label: 'Roadmap', icon: RoadmapIcon },
];

export function Sidebar({ className = '' }: { className?: string }) {
  const { communityChannels, projectChannels, loading } = useChannels();
  const { user } = useAuth();
  const [online, setOnline] = useState<{ count: number; users: Array<{ username: string; displayName: string }> }>({
    count: 0,
    users: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<{ count: number; users: Array<{ username: string; displayName: string }> }>('/api/presence', { auth: false });
        setOnline(data);
      } catch {
        setOnline({ count: 0, users: [] });
      } finally {
        setLoaded(true);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const channelLink = (slug: string) => `/chat/${slug}`;

  const activeStyle = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
      isActive ? 'bg-primary-600/15 font-medium text-primary-300' : 'text-gray-300 hover:bg-ink-600'
    }`;

  const ChannelLink = ({ slug, label, locked, unread }: { slug: string; label: string; locked?: number; unread?: boolean }) => (
    <NavLink to={channelLink(slug)} end={false} className={activeStyle}>
      <HashIcon size={14} className="shrink-0 text-gray-500" />
      <span className="truncate">{label}</span>
      {unread && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary-400" />}
      {locked === 1 && <LockIcon size={12} className="ml-auto shrink-0 text-gray-500" />}
    </NavLink>
  );

  const general = { slug: 'general', label: '# general' } as const;

  return (
    <aside className={`flex h-full w-60 flex-col overflow-y-auto border-r border-ink-600 bg-ink-900 ${className}`}>
      <div className="border-b border-ink-600 px-4 py-4">
        <Link to="/" className="text-sm font-bold tracking-tight text-white">
          PH <span className="text-primary-400">PROJECT HUB</span>
        </Link>
        <p className="mt-0.5 text-[11px] text-gray-500">Build · Update · Discuss · Grow</p>
      </div>

      <nav className="flex-1 px-2.5 py-3">
        <div className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Home</div>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={activeStyle}>
            <item.icon size={16} className="shrink-0 text-gray-400" />
            {item.label}
            {item.to === '/updates' && (
              <span className="ml-auto rounded bg-accent-500/15 px-1.5 text-[10px] font-semibold text-accent-300">NEW</span>
            )}
          </NavLink>
        ))}

        <div className="mt-5 mb-1 flex items-center gap-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <ChatIcon size={12} /> Chat Channels
        </div>

        {loading ? (
          <div className="space-y-1.5 px-1 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 rounded-lg bg-ink-700/60" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* General (pinned) */}
            <div className="space-y-0.5">
              <ChannelLink slug={general.slug} label={general.label} />
            </div>

            {/* Community channels */}
            <div>
              <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">Community</div>
              <div className="space-y-0.5">
                {communityChannels.map((c: Channel) => (
                  <ChannelLink key={c.slug} slug={c.slug} label={`# ${c.slug}`} locked={c.is_locked} />
                ))}
              </div>
            </div>

            {/* Project channels */}
            <div>
              <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">Projects</div>
              <div className="space-y-0.5">
                {projectChannels.map((c: Channel) => (
                  <ChannelLink key={c.slug} slug={c.slug} label={`# ${c.slug}`} locked={c.is_locked} />
                ))}
              </div>
            </div>

            {user && (
              <Link
                to="/notifications"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-300 hover:bg-ink-600"
              >
                Notifications
              </Link>
            )}
          </div>
        )}
      </nav>

      <div className="border-t border-ink-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-live" />
          </span>
          <span className="text-xs font-medium text-gray-300">
            {!loaded
              ? 'Checking…'
              : online.count > 0
                ? `${online.count} online`
                : 'No one else is online yet'}
          </span>
        </div>
        <div className="mt-2 flex -space-x-2">
          {online.users.slice(0, 5).map((u) => (
            <Avatar key={u.username} name={u.displayName} size="sm" className="rounded-full ring-2 ring-ink-900" />
          ))}
          {online.count > 5 && (
            <span className="flex size-8 items-center justify-center rounded-full bg-ink-600 text-[11px] font-semibold text-gray-300 ring-2 ring-ink-900">
              +{online.count - 5}
            </span>
          )}
        </div>
        <p className="mt-2.5 text-[11px] leading-snug text-gray-500">
          Community of builders from the Philippines 🇵🇭
        </p>
        <Link
          to="/guidelines"
          className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-ink-600"
        >
          Community guidelines
        </Link>
        {user && user.role === 'ADMIN' || user?.role === 'OWNER' ? (
          <Link
            to="/admin"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-gray-300 hover:bg-ink-600"
          >
            Admin panel
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
