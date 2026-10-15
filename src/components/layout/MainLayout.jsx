import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import MobileTabBar from './MobileTabBar';
import PoleSubNav from './PoleSubNav';
import SampleBanner from './SampleBanner';
import DemoBanner from './DemoBanner';
import AssistantPanel from '../assistant/AssistantPanel';
import { syncChallengeScores } from '../../services/challenges';
import { StudyTimerDock } from '../learning/StudyTimer';
import { useAutoHabitSync } from '../../hooks/useAutoHabitSync';
import QuickAdd from './QuickAdd';
import ErrorBoundary from '../common/ErrorBoundary';
import { ToastContainer, PageLoader } from '../common/ui';

export default function MainLayout() {
  const location = useLocation();
  useAutoHabitSync(); // measured habits tick themselves from the other sections
  // Challenges: publish my scores once, a little after opening (only if signed in).
  useEffect(() => {
    const t = setTimeout(() => { syncChallengeScores().catch(() => {}); }, 15000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen bg-base text-ink">
      <Navbar />
      {/* Bottom space: the last card can scroll clear of the phone tab bar AND of
          the floating + button above it (pb-36), and of the + alone on desktop (J2). */}
      <main className="pt-16 pb-36 md:pb-24">
        <PoleSubNav />
        <DemoBanner />
        <SampleBanner />
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* resetKey: navigating away from a crashed page auto-clears the error */}
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <QuickAdd />
      <StudyTimerDock />
      <MobileTabBar />
      <AssistantPanel />
      <ToastContainer />
    </div>
  );
}
