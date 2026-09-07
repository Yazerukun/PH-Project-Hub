import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Channel } from '../../types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useChannels } from '../../stores/channels';
import { useAuth } from '../../stores/auth';
import { useSitePresence } from '../../hooks/useSitePresence';
import { OnboardingSheet } from '../OnboardingSheet';
import {
  ChatIcon,
  HomeIcon,
  UpdatesIcon,
  ExploreIcon,
  UserIcon,
  CloseIcon,
  HashIcon,
  LockIcon,
} from '../ui/icons';
import { orderCommunity, formatChannelName, projectInitials, projectColor } from './channelUi';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  useSitePresence();
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!drawerOpen) return;

    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeydown);

    // Lock body scroll while the mobile drawer is open (prevent behind-scroll).
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarW}px`;

    return () => {
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      previouslyFocused.current?.focus?.();
    };
  }, [drawerOpen]);

  const mobileNav = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/updates', label: 'Updates', icon: UpdatesIcon },
    { to: '/chat/general', label: 'Chat', icon: ChatIcon },
    { to: '/projects', label: 'Projects', icon: ExploreIcon },
    { to: user ? '/profile' : '/login', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header onOpenDrawer={() => setDrawerOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden lg:block" />
        <div
          className={`fixed inset-0 z-20 flex lg:hidden ${drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden={!drawerOpen}
        >
          <div
            className={`absolute inset-0 transition-opacity duration-200 ease-out ${
              drawerOpen ? 'bg-black/60 opacity-100 backdrop-blur-sm' : 'opacity-0'
            }`}
          />
          <div
            className={`fixed inset-y-0 left-0 z-30 flex h-full w-[90vw] max-w-sm flex-col transition-transform duration-200 ease-out ${
              drawerOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            inert={!drawerOpen}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 z-40 flex size-9 items-center justify-center rounded-lg text-gray-300 hover:bg-ink-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-ink-900"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
            <Sidebar className="w-full" />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div
            className={`w-full px-3 py-4 sm:px-6 lg:py-6 ${
              pathname === '/' ? 'max-w-[1440px]' : 'max-w-[920px]'
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="flex h-14 shrink-0 items-stretch border-t border-ink-600 bg-ink-900 lg:hidden" aria-label="Mobile navigation">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                isActive ? 'text-primary-400' : 'text-gray-500'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile channel drawer bottom sheet */}
      <MobileChannelDrawer />

      <OnboardingSheet />
    </div>
  );
}

function MobileChannelDrawer() {
  const { projectChannels, communityChannels } = useChannels();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;
  const isChat = location.pathname.startsWith('/chat');
  const community = orderCommunity(communityChannels);

  return (
    <>
      {!isChat && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-16 right-3 z-20 flex size-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-900/40 lg:hidden"
          aria-label="Open channels"
        >
          <HashIcon size={20} />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="h-[60vh] w-full overflow-y-auto rounded-t-2xl border-t border-ink-500 bg-ink-800 pb-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Channels"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-600 bg-ink-800 px-4 py-3">
              <span className="text-sm font-semibold text-gray-200">Channels</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Close channels"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="p-1.5">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Community
              </p>
              {community.map((c: Channel) => (
                <NavLink
                  key={c.slug}
                  to={`/chat/${c.slug}`}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-primary-600/12 text-primary-200 font-medium border-l-2 border-primary-500'
                        : 'text-gray-300 hover:bg-ink-700 hover:translate-x-[3px]'
                    }`
                  }
                >
                  <HashIcon size={14} className="shrink-0 text-gray-500" />
                  <span>{`# ${c.name || formatChannelName(c.slug)}`}</span>
                  {(c.is_locked === 1 || c.slug === 'announcements') && (
                    <LockIcon size={12} className="ml-auto shrink-0 text-gray-500" aria-label="Read only" />
                  )}
                </NavLink>
              ))}

              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Projects
              </p>
              {projectChannels.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-600">No project channels yet</p>
              ) : (
                projectChannels.map((c: Channel) => (
                  <NavLink
                    key={c.slug}
                    to={`/chat/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-primary-600/12 text-primary-200 font-medium border-l-2 border-primary-500'
                          : 'text-gray-300 hover:bg-ink-700 hover:translate-x-[3px]'
                      }`
                    }
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold leading-tight text-white ${projectColor(c.slug)}`}
                      aria-label={`Project ${c.name || formatChannelName(c.slug)}`}
                    >
                      {projectInitials(c.slug)}
                    </span>
                    <span>{c.name || formatChannelName(c.slug)}</span>
                  </NavLink>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}