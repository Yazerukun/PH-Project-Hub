import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useChannels } from '../../stores/channels';
import { useAuth } from '../../stores/auth';
import { api } from '../../lib/api';
import {
  HashIcon,
  HomeIcon,
  UpdatesIcon,
  RoadmapIcon,
  ChatIcon,
  LockIcon,
  BellIcon,
  ChevronDownIcon,
  ProjectsIcon,
  GuidelinesIcon,
} from '../ui/icons';
import type { Icon } from './channelUi';
import { formatChannelName, projectInitials, projectColor, channelLink, orderCommunity } from './channelUi';
import { Avatar } from '../ui/Avatar';
import { RoleBadge } from '../ui/Badge';
import { OwnerBadge } from '../ui/OwnerBadge';
import type { Channel } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, exact: true },
  { to: '/updates', label: 'Updates', icon: UpdatesIcon },
  { to: '/projects', label: 'Projects', icon: ProjectsIcon },
  { to: '/roadmap', label: 'Roadmap', icon: RoadmapIcon },
  { to: '/guidelines', label: 'Guidelines', icon: GuidelinesIcon },
];

const STORAGE_KEY = 'ph-sidebar-sections';

type SectionState = Record<string, boolean>;

function readSections(): SectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SectionState) : {};
  } catch {
    return {};
  }
}

function writeSections(state: SectionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
const baseRow =
  'flex items-center gap-2.5 rounded-xl border-l-2 border-transparent px-2.5 py-2 text-sm transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';
const hoverRow =
  'text-gray-300 hover:text-gray-200 hover:bg-ink-700/60 hover:translate-x-[3px]';
const activeRow =
  'bg-primary-600/12 text-primary-200 font-medium border-l-2 border-primary-500 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]';

function CollapseSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => {
    const stored = readSections();
    return stored[title] !== undefined ? Boolean(stored[title]) : defaultOpen;
  });

  useEffect(() => {
    writeSections({ ...readSections(), [title]: open });
  }, [open, title]);

  return (
    <div className="mb-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
          aria-expanded={open}
        >
        {icon}
        <span>{title}</span>
        <ChevronDownIcon
          size={12}
          className={`ml-auto transition-transform duration-200 ease-out ${open ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>
      <div
        className={
          'overflow-hidden space-y-0.5 transition-all duration-300 ease-out ' +
          (open ? 'max-h-[48rem] opacity-100' : 'max-h-0 opacity-0')
        }
      >
        {children}
      </div>
    </div>
  );
}

interface ChannelRowProps {
  slug: string;
  label: string;
  icon?: ReactNode;
  locked?: number;
  unread?: boolean;
}

function ChannelRow({ slug, label, icon, locked, unread }: ChannelRowProps) {
  const isAnnouncements = slug === 'announcements';
  return (
    <NavLink
      to={channelLink(slug)}
      end={false}
      className={({ isActive }) =>
        `${baseRow} ${isActive ? activeRow : `${hoverRow} ${isAnnouncements ? 'text-gray-400' : ''}`}`
      }
    >
      {icon ?? <HashIcon size={14} className="shrink-0 text-gray-500" />}
      <span className="truncate">{label}</span>
      {unread && (
        <span
          className="ml-auto size-1.5 shrink-0 animate-pulse rounded-full bg-accent-400"
          title="Unread messages"
        />
      )}
      {(locked === 1 || isAnnouncements) && (
        <LockIcon size={12} className="shrink-0 text-gray-500" aria-label="Read only" />
      )}
    </NavLink>
  );
}

function ProjectRow({ slug, label }: { slug: string; label: string }) {
  return (
    <ChannelRow
      slug={slug}
      label={label}
      icon={
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold leading-tight text-white ${projectColor(slug)}`}
          aria-label={`Project ${label}`}
        >
          {projectInitials(slug)}
        </span>
      }
    />
  );
}

export function Sidebar({ className = '' }: { className?: string }) {
  const { communityChannels, projectChannels, loading } = useChannels();
  const { user } = useAuth();
  const [online, setOnline] = useState<{
    count: number;
    users: Array<{ username: string; displayName: string }>;
  }>({ count: 0, users: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<{ count: number; users: Array<{ username: string; displayName: string }> }>(
          '/api/presence',
          { auth: false }
        );
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

  const community = orderCommunity(communityChannels);

  return (
    <aside
      className={`flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-ink-600 bg-ink-900 ${className}`}
    >
      <div className="border-b border-ink-600/60 bg-ink-900/80 px-4 py-4">
        <Link to="/" className="text-sm font-bold tracking-tight text-white">
          PH <span className="text-primary-400">PROJECT HUB</span>
        </Link>
        <p className="mt-0.5 text-[11px] text-gray-500">Build · Update · Discuss · Grow</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <CollapseSection title="Navigation" icon={<HomeIcon size={14} className="shrink-0 text-gray-400" />}>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => `${baseRow} ${isActive ? activeRow : hoverRow}`}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} className={`shrink-0 ${isActive ? 'text-primary-300' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/notifications"
                className={({ isActive }) => `${baseRow} ${isActive ? activeRow : hoverRow}`}
              >
                {({ isActive }) => (
                  <>
                    <BellIcon size={16} className={`shrink-0 ${isActive ? 'text-primary-300' : 'text-gray-400'}`} />
                    <span>Notifications</span>
                  </>
                )}
              </NavLink>
            )}
          </div>
        </CollapseSection>

        {loading ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="h-8 w-28 animate-pulse rounded-lg bg-ink-700/60" />
              <div className="space-y-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-xl bg-ink-700/60" />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="h-8 w-24 animate-pulse rounded-lg bg-ink-700/60" />
              <div className="space-y-0.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-xl bg-ink-700/60" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <CollapseSection title="Project Channels" icon={<ChatIcon size={14} className="shrink-0 text-gray-400" />}>
              {projectChannels.length === 0 ? (
                <p className="px-2.5 text-xs text-gray-600">No project channels yet</p>
              ) : (
                <div className="space-y-1">
                  {projectChannels.map((c: Channel) => (
                    <ProjectRow key={c.slug} slug={c.slug} label={c.name || formatChannelName(c.slug)} />
                  ))}
                </div>
              )}
            </CollapseSection>

            <CollapseSection title="Community" icon={<HashIcon size={14} className="shrink-0 text-gray-400" />}>
              {community.length === 0 ? (
                <p className="px-2.5 text-xs text-gray-600">No community channels yet</p>
              ) : (
                <div className="space-y-1">
                  {community.map((c: Channel) => (
                    <ChannelRow
                      key={c.slug}
                      slug={c.slug}
                      label={`# ${c.name || formatChannelName(c.slug)}`}
                      locked={c.is_locked}
                    />
                  ))}
                </div>
              )}
            </CollapseSection>
          </>
        )}
      </nav>

      <footer className="shrink-0 border-t border-ink-600/60 bg-ink-900/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-live opacity-60" />
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
        {user && (
          <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-ink-800/60 px-2.5 py-2">
            <Avatar name={user.display_name} src={user.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.display_name}</p>
              <p className="truncate text-[11px] text-gray-500">@{user.username}</p>
            </div>
            <span className="shrink-0">
              {user.role === 'OWNER' ? <OwnerBadge /> : <RoleBadge role={user.role} />}
            </span>
          </div>
        )}
      </footer>
    </aside>
  );
}
