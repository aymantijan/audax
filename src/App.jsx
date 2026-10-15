import { Fragment, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useHealthStore } from './store/healthStore';
import { isSupabaseConfigured } from './services/supabase';
import { getSession, onAuthChange } from './services/auth-supabase';
import { startCloudSync, stopCloudSync } from './services/cloud-sync';
import { preloadGoogleCalendar } from './services/google-calendar';
import { toast } from './store/uiStore';
import { useHealthReminders } from './hooks/useHealthReminders';
import { useEcheanceAlerts } from './hooks/useEcheanceAlerts';
import { useHabitReminders } from './hooks/useHabitReminders';
import { useClassReminders } from './hooks/useClassReminders';
import { useBudgetAlerts } from './hooks/useBudgetAlerts';
import MainLayout from './components/layout/MainLayout';
import PwaUpdatePrompt from './components/layout/PwaUpdatePrompt';
import Welcome from './pages/Welcome';
import { lazyWithRetry } from './utils/lazyRetry';
import { applyDisplay, resolveDisplay } from './utils/display';
import { useLang } from './i18n';
import { PageLoader } from './components/common/ui';

// Route-level code splitting: each page (and its heavy deps — recharts, d3)
// downloads on first visit instead of bloating the initial bundle.
// lazyWithRetry: if a tab stays open across a new deploy, its old chunk hashes
// 404 — one automatic reload fetches the current build instead of crashing.
const Onboarding = lazy(lazyWithRetry(() => import('./pages/Onboarding'), 'Onboarding'));
const Today = lazy(lazyWithRetry(() => import('./pages/Today'), 'Today'));
const Learning = lazy(lazyWithRetry(() => import('./pages/Learning'), 'Learning'));
const Finance = lazy(lazyWithRetry(() => import('./pages/Finance'), 'Finance'));
const Habits = lazy(lazyWithRetry(() => import('./pages/Habits'), 'Habits'));
const Health = lazy(lazyWithRetry(() => import('./pages/Health'), 'Health'));
const Skills = lazy(lazyWithRetry(() => import('./pages/Skills'), 'Skills'));
const GoalsHub = lazy(lazyWithRetry(() => import('./pages/GoalsHub'), 'GoalsHub'));
const Leaderboard = lazy(lazyWithRetry(() => import('./pages/Leaderboard'), 'Leaderboard'));
const FocusSessions = lazy(lazyWithRetry(() => import('./pages/FocusSessions'), 'FocusSessions'));
const Creative = lazy(lazyWithRetry(() => import('./pages/Creative'), 'Creative'));
const CoursePage = lazy(lazyWithRetry(() => import('./pages/CoursePage'), 'CoursePage'));
const Readings = lazy(lazyWithRetry(() => import('./pages/Readings'), 'Readings'));
const Library = lazy(lazyWithRetry(() => import('./pages/Library'), 'Library'));
const SettingsPage = lazy(lazyWithRetry(() => import('./pages/Settings'), 'Settings'));
const DesignReference = lazy(lazyWithRetry(() => import('./pages/DesignReference'), 'DesignReference'));
const PoleHome = lazy(lazyWithRetry(() => import('./pages/PoleHome'), 'PoleHome'));
const Challenges = lazy(lazyWithRetry(() => import('./pages/Challenges'), 'Challenges'));
const Timeline = lazy(lazyWithRetry(() => import('./pages/Timeline'), 'Timeline'));
const Week = lazy(lazyWithRetry(() => import('./pages/Week'), 'Week'));

function AuthGuard({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/welcome" replace />;
  // New registrations (local or cloud, see authStore#register) start with
  // onboarded:false — every real route stays gated behind the wizard until
  // it calls completeOnboarding(), so nobody lands on an empty "Aujourd'hui"
  // with zero context on what to do first.
  if (!user.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}


export default function App() {
  const user = useAuthStore((s) => s.user);
  const lang = useLang((s) => (s.dict ? s.lang : 'fr')); // a new language remounts the screens (i18n/index.js)

  // Theme, text size and contrast (utils/display.js): profile first, then this device.
  useEffect(() => {
    applyDisplay(resolveDisplay(user));
  }, [user?.theme, user?.textSize, user?.contrast, user?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-time migration: sex/dobYear/heightCm used to live on healthStore's
  // healthProfile (Health-scoped) — now they live on the global profile
  // (authStore.user), reused across the app. Copies over once for anyone who
  // already filled the old Health questionnaire, then never touches it again.
  useEffect(() => {
    if (!user) return;
    const healthProfile = useHealthStore.getState().healthProfile;
    const legacySex = healthProfile?.sex;
    const legacyDobYear = healthProfile?.dobYear;
    const legacyHeightCm = healthProfile?.heightCm;
    if ((legacyDobYear || legacyHeightCm) && !user.dobYear && !user.heightCm) {
      useAuthStore.getState().updateProfile({
        gender: user.gender || legacySex || null,
        dobYear: user.dobYear || legacyDobYear || null,
        heightCm: user.heightCm || legacyHeightCm || null,
      });
    }
  }, [user]);

  // Fetch the Google Identity Services script ahead of any click — see
  // preloadGoogleCalendar's comment for why this must happen before, not
  // during, the "Connect" click.
  useEffect(() => {
    preloadGoogleCalendar();
  }, []);

  useHealthReminders(); // local-only browser-notification reminders (see hook for scope/limits)
  useEcheanceAlerts(); // local-only browser-notification alerts for overdue échéances
  useHabitReminders(); // habit reminders at their chosen time (local only)
  useClassReminders(); // class heads-up + check-in nudge (attendance)
  useBudgetAlerts(); // local-only browser-notification alerts for budget overruns

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
    <Fragment key={lang}>
      <PwaUpdatePrompt />
      {/* Top-level fallback: /onboarding and other lazy pages outside MainLayout */}
      <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route path="/welcome" element={user ? <Navigate to="/" replace /> : <Welcome />} />
      <Route
        path="/onboarding"
        element={!user ? <Navigate to="/welcome" replace /> : user.onboarded ? <Navigate to="/today" replace /> : <Onboarding />}
      />
      <Route
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/dashboard" element={<Navigate to="/today" replace />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/learning/course/:courseId" element={<CoursePage />} />
        <Route path="/learning/readings" element={<Readings />} />
        <Route path="/learning/readings/library" element={<Library />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/health" element={<Health />} />
        <Route path="/focus" element={<FocusSessions />} />
        <Route path="/creative" element={<Creative />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/goals" element={<GoalsHub />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/design" element={<DesignReference />} />
        <Route path="/defis" element={<Challenges />} />
        <Route path="/chronologie" element={<Timeline />} />
        <Route path="/semaine" element={<Week />} />
        {/* Section home page (étape 3); Santé and Patrimoine have a single page each */}
        <Route path="/etudes" element={<PoleHome key="etudes" poleKey="etudes" />} />
        <Route path="/patrimoine" element={<Navigate to="/finance" replace />} />
        <Route path="/sante" element={<Navigate to="/health" replace />} />
        <Route path="/aujourdhui" element={<Navigate to="/today" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Fragment>
  );
}
