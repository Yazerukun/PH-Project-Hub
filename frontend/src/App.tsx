import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ChannelsProvider } from './stores/channels';
import { useAuth } from './stores/auth';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { resetPageMeta } from './lib/seo';
import { UpdatesPage } from './pages/UpdatesPage';
import { UpdateDetailPage } from './pages/UpdateDetailPage';
import { ExplorePage } from './pages/ExplorePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ChatPage } from './pages/ChatPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { GuidelinesPage } from './pages/GuidelinesPage';
import { SearchPage } from './pages/SearchPage';
import { BugReportsPage } from './pages/BugReportsPage';
import { SuggestionsPage } from './pages/SuggestionsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthPage } from './pages/AuthPage';
import { NewBugPage } from './pages/NewBugPage';
import { NewSuggestionPage } from './pages/NewSuggestionPage';
import { NewUpdatePage } from './pages/NewUpdatePage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Skeleton } from './components/ui/Skeleton';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const DYNAMIC_ROUTE = /^\/projects\/.+$/;

function PageMetaResetter() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Dynamic routes (e.g. project pages) set their own meta; reset for everything else.
    if (!DYNAMIC_ROUTE.test(pathname)) {
      resetPageMeta();
    }
  }, [pathname]);
  return null;
}

function Bootstrapper() {
  const { initialized, fetchMe } = useAuth();
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  if (!initialized) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <ChannelsProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/updates/:id" element={<UpdateDetailPage />} />
          <Route path="/projects" element={<ExplorePage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/projects/:slug/discussion" element={<ProjectDetailPage initialTab="discussion" />} />
          <Route path="/chat/:channel" element={<ChatPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/guidelines" element={<GuidelinesPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bugs" element={<BugReportsPage />} />
          <Route path="/bugs/new" element={<ProtectedRoute><NewBugPage /></ProtectedRoute>} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/suggestions/new" element={<ProtectedRoute><NewSuggestionPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/admin/new-update" element={<ProtectedRoute><NewUpdatePage /></ProtectedRoute>} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ChannelsProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageMetaResetter />
      <Bootstrapper />
    </BrowserRouter>
  );
}