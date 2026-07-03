import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, Settings, Menu, X, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logout as cloudLogout } from '../../services/auth-supabase';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/trading', label: 'Trading' },
  { to: '/learning', label: 'Learning' },
  { to: '/finance', label: 'Finance' },
  { to: '/habits', label: 'Habits' },
  { to: '/deals', label: 'PE / Deals' },
  { to: '/skills', label: 'Skill Tree' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = user?.theme || 'dark';

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    updateProfile({ theme: next });
    document.documentElement.dataset.theme = next;
  };

  const handleLogout = () => {
    cloudLogout(); // best-effort Supabase sign-out (no-op if not configured)
    logout();
    navigate('/welcome');
  };

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors pb-0.5 border-b-2 ${
      isActive ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
    }`;

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-surface border-b border-line z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        {/* Left: logo */}
        <button className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/')}>
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
            <Zap size={16} className="text-black" />
          </span>
          <span className="text-lg font-bold tracking-widest hidden sm:inline">AUDAX</span>
        </button>

        {/* Center: nav links */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Right: theme + settings + profile + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleTheme} className="p-2 rounded-lg text-mute hover:text-ink hover:bg-card transition-colors cursor-pointer" title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `p-2 rounded-lg transition-colors cursor-pointer ${isActive ? 'text-accent' : 'text-mute hover:text-ink hover:bg-card'}`}
            title="Settings"
          >
            <Settings size={18} />
          </NavLink>
          <div className="hidden sm:flex items-center gap-2 pl-1">
            <span className="w-7 h-7 rounded-full bg-accent2/20 text-accent2 flex items-center justify-center text-xs font-bold">
              {(user?.name || '?')[0].toUpperCase()}
            </span>
            <span className="text-sm text-ink truncate max-w-24">{user?.name}</span>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg text-mute hover:text-bad hover:bg-card transition-colors cursor-pointer" title="Log out">
            <LogOut size={18} />
          </button>
          <button onClick={() => setMobileOpen((v) => !v)} className="md:hidden p-2 rounded-lg text-mute hover:text-ink cursor-pointer">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-surface border-b border-line">
          <div className="flex flex-col p-3 gap-1">
            {[...NAV_ITEMS, { to: '/settings', label: 'Settings' }].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `text-sm font-medium px-3 py-2 rounded-lg ${isActive ? 'bg-card text-accent' : 'text-mute hover:text-ink hover:bg-card'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
