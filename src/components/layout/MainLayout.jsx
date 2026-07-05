import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import ErrorBoundary from '../common/ErrorBoundary';
import { ToastContainer, PageLoader } from '../common/ui';

export default function MainLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-base text-ink">
      <Navbar />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* resetKey: navigating away from a crashed page auto-clears the error */}
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
