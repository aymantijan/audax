import { useEffect, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSkillStore } from './store/skillStore';
import { isSupabaseConfigured } from './services/supabase';
import { getSession, onAuthChange } from './services/auth-supabase';
import { startCloudSync, stopCloudSync } from './services/cloud-sync';
import { toast } from './store/uiStore';
import MainLayout from './components/layout/MainLayout';
import Welcome from './pages/Welcome';
import { lazyWithRetry } from './utils/lazyRetry';

// Route-level code splitting: each page (and its heavy deps — recharts, d3)
// downloads on first visit instead of bloating the initial bundle.
// lazyWithRetry: if a tab stays open across a new deploy, its old chunk hashes
// 404 — one automatic reload fetches the current build instead of crashing.
const Dashboard = lazy(lazyWithRetry(() => import('./pages/Dashboard'), 'Dashboard'));
const Trading = lazy(lazyWithRetry(() => import('./pages/Trading'), 'Trading'));
const Learning = lazy(lazyWithRetry(() => import('./pages/Learning'), 'Learning'));
const Finance = lazy(lazyWithRetry(() => import('./pages/Finance'), 'Finance'));
const Habits = lazy(lazyWithRetry(() => import('./pages/Habits'), 'Habits'));
const Skills = lazy(lazyWithRetry(() => import('./pages/Skills'), 'Skills'));
const Deals = lazy(lazyWithRetry(() => import('./pages/Deals'), 'Deals'));
const CoursePage = lazy(lazyWithRetry(() => import('./pages/CoursePage'), 'CoursePage'));
const Readings = lazy(lazyWithRetry(() => import('./pages/Readings'), 'Readings'));
const Library = lazy(lazyWithRetry(() => import('./pages/Library'), 'Library'));
const SettingsPage = lazy(lazyWithRetry(() => import('./pages/Settings'), 'Settings'));

function AuthGuard({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/welcome" replace />;
  return children;
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const checkDecay = useSkillStore((s) => s.checkDecay);

  useEffect(() => {
    document.documentElement.dataset.theme = user?.theme || 'dark';
  }, [user?.theme]);

  useEffect(() => {
    checkDecay(); // daily skill decay pass on app load
  }, [checkDecay]);

  // Cloud sync: only active when Supabase is configured AND the user has a
  // real Supabase session (not just a local profile). Starts/stops on login/logout
  // and follows token refreshes; local-first behavior is unaffected otherwise.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    (async () => {
      const session = await getSession();
      if (!cancelled && session?.user) {
        await startCloudSync(session.user.id);
        toast('Cloud sync active', 'success');
      }
    })();

    const unsubscribe = onAuthChange((session) => {
      if (session?.user) {
        startCloudSync(session.user.id);
      } else {
        stopCloudSync();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      stopCloudSync();
    };
  }, []);

  return (
    <Routes>
      <Route path="/welcome" element={user ? <Navigate to="/" replace /> : <Welcome />} />
      <Route
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/learning/course/:courseId" element={<CoursePage />} />
        <Route path="/learning/readings" element={<Readings />} />
        <Route path="/learning/readings/library" element={<Library />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
