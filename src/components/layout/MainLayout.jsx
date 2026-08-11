import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import MobileTabBar from './MobileTabBar';
import QuickAdd from './QuickAdd';
import ErrorBoundary from '../common/ErrorBoundary';
import { ToastContainer, PageLoader } from '../common/ui';

export default function MainLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-base text-ink">
      <Navbar />
      {/* pb-20: clears the fixed mobile bottom tab bar so page content (and the
          QuickAdd FAB) never sits underneath it — desktop has no bottom bar,
          hence md:pb-0. */}
      <main className="pt-16 pb-20 md:pb-0">
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
      <MobileTabBar />
      <ToastContainer />
    </div>
  );
}
