import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Channel } from '../../types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useChannels } from '../../stores/channels';
import { useAuth } from '../../stores/auth';
import { useSitePresence } from '../../hooks/useSitePresence';
import { ChatIcon, HomeIcon, UpdatesIcon, ExploreIcon, UserIcon, CloseIcon, HashIcon } from '../ui/icons';

export function AppLayout({ contextPanel }: { contextPanel?: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  useSitePresence();

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
        <Sidebar
          className={`fixed inset-0 z-30 w-72 transition-transform duration-200 lg:hidden ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        />
        {drawerOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setDrawerOpen(false)}>
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-gray-300 hover:bg-ink-700"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 lg:py-6">
            <Outlet />
          </div>
        </main>

        {contextPanel && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-ink-600 bg-ink-900 p-4 xl:block">
            {contextPanel}
          </aside>
        )}
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
      {drawerOpen === false && null}
      <MobileChannelDrawer />
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
            className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl border-t border-ink-500 bg-ink-800 p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Channels"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-200">Channels</span>
              <button onClick={() => setOpen(false)} className="text-gray-400" aria-label="Close channels">
                <CloseIcon size={18} />
              </button>
            </div>
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Community</p>
            {[{ slug: 'general', name: 'General' }, ...communityChannels].map((c) => (
              <NavLink
                key={c.slug}
                to={`/chat/${c.slug}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primary-600/15 text-primary-300' : 'text-gray-300 hover:bg-ink-700'}`
                }
              >
                <HashIcon size={14} className="text-gray-500" />
                {c.name ?? c.slug}
              </NavLink>
            ))}
            <p className="mt-3 mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Projects</p>
            {projectChannels.map((c: Channel) => (
              <NavLink
                key={c.slug}
                to={`/chat/${c.slug}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primary-600/15 text-primary-300' : 'text-gray-300 hover:bg-ink-700'}`
                }
              >
                <HashIcon size={14} className="text-gray-500" />
                {c.name}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  );
}