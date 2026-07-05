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

// Route-level code splitting: each page (and its heavy deps — recharts, d3)
// downloads on first visit instead of bloating the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trading = lazy(() => import('./pages/Trading'));
const Learning = lazy(() => import('./pages/Learning'));
const Finance = lazy(() => import('./pages/Finance'));
const Habits = lazy(() => import('./pages/Habits'));
const Skills = lazy(() => import('./pages/Skills'));
const Deals = lazy(() => import('./pages/Deals'));
const CoursePage = lazy(() => import('./pages/CoursePage'));
const Readings = lazy(() => import('./pages/Readings'));
const Library = lazy(() => import('./pages/Library'));
const SettingsPage = lazy(() => import('./pages/Settings'));

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
