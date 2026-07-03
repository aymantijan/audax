import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { ToastContainer } from '../common/ui';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <Navbar />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
