import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSkillStore } from './store/skillStore';
import { isSupabaseConfigured } from './services/supabase';
import { getSession, onAuthChange } from './services/auth-supabase';
import { startCloudSync, stopCloudSync } from './services/cloud-sync';
import { toast } from './store/uiStore';
import MainLayout from './components/layout/MainLayout';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import Learning from './pages/Learning';
import Finance from './pages/Finance';
import Habits from './pages/Habits';
import Skills from './pages/Skills';
import Deals from './pages/Deals';
import CoursePage from './pages/CoursePage';
import SettingsPage from './pages/Settings';

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
