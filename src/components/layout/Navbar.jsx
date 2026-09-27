import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, Settings, Trophy, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logout as cloudLogout } from '../../services/auth-supabase';
import { DESKTOP_POLES, poleByKey, poleOfPath } from '../../utils/navigation';
import GlobalSearch from './GlobalSearch';

// Top bar: logo, the five sections (from md up; phones use the bottom tabs),
// search, and a profile menu holding Paramètres, Classement, theme, sign-out.
function ProfileMenu({ user, theme, onToggleTheme, onLogout }) {
  const [open, setOpen] = useState(false);
  const item = 'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-left cursor-pointer';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu du profil"
        aria-expanded={open}
        className="ui-icon-btn flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-card cursor-pointer"
      >
        <span className="w-8 h-8 rounded-full bg-accent2/20 text-accent2 flex items-center justify-center text-xs font-bold">
          {(user?.name || '?')[0].toUpperCase()}
        </span>
        <span className="hidden lg:inline text-sm text-ink truncate max-w-28">{user?.name}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-card border border-line rounded-xl shadow-2xl z-50 py-1.5" role="menu">
            <div className="px-3.5 py-2 text-xs text-mute border-b border-line mb-1 truncate">{user?.name}</div>
            <NavLink to="/settings" role="menuitem" onClick={() => setOpen(false)} className={({ isActive }) => `${item} ${isActive ? 'text-accent' : 'text-ink hover:bg-line/40'}`}>
              <Settings size={16} /> Paramètres
            </NavLink>
            <NavLink to="/leaderboard" role="menuitem" onClick={() => setOpen(false)} className={({ isActive }) => `${item} ${isActive ? 'text-accent' : 'text-ink hover:bg-line/40'}`}>
              <Trophy size={16} /> Classement
            </NavLink>
            <button type="button" role="menuitem" onClick={() => { onToggleTheme(); setOpen(false); }} className={`${item} text-ink hover:bg-line/40`}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Thème {theme === 'dark' ? 'clair' : 'sombre'}
            </button>
            <button type="button" role="menuitem" onClick={onLogout} className={`${item} text-bad hover:bg-bad/10`}>
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateProfile, logout } = useAuthStore();
  const theme = user?.theme || 'dark';
  const activePole = poleOfPath(location.pathname);

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

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-surface border-b border-line z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        <button type="button" className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/today')} aria-label="VAUDAX, aller à Aujourd’hui">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
            <Zap size={16} className="text-on-accent" />
          </span>
          <span className="font-display text-xl tracking-widest">VAUDAX</span>
        </button>

        <div className="hidden md:flex items-center gap-1 lg:gap-2">
          {DESKTOP_POLES.map((key) => {
            const pole = poleByKey(key);
            const active = activePole?.key === key;
            return (
              <Link
                key={key}
                to={pole.home}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'text-accent bg-accent/10' : 'text-mute hover:text-ink hover:bg-card'}`}
              >
                <pole.icon size={16} />
                <span className="hidden lg:inline">{pole.label}</span>
                <span className="lg:hidden">{pole.short}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <GlobalSearch />
          <ProfileMenu user={user} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} />
        </div>
      </div>
    </nav>
  );
}
