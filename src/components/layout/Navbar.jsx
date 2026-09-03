import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, Settings, Menu, X, Zap, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logout as cloudLogout } from '../../services/auth-supabase';
import GlobalSearch from './GlobalSearch';

// Only these two stay as direct top-level links — everything else lives
// under a "Page mère ▾" dropdown group below, no matter how many (or few)
// of its children are enabled for this account.
const DIRECT_ITEMS = [
  { to: '/today', label: 'Aujourd’hui', end: true },
  { to: '/dashboard', label: 'Dashboard' },
];

// Grouped ("Page mère → pages child") links. `enabledKey` (checked against
// user.enabledModules[key]) gates optional domains; items without it are
// always shown. `defaultEnabled` covers accounts that predate the flag. A
// group disappears entirely when none of its children are enabled, but
// otherwise ALWAYS renders as a dropdown — even with a single child — per
// the "everything but Today/Dashboard is a dropdown" rule.
const NAV_GROUPS = [
  {
    label: 'Deals',
    items: [
      { to: '/deals', label: 'Deals (PE)', enabledKey: 'pe', defaultEnabled: true },
      { to: '/fundraising', label: 'Fundraising', enabledKey: 'fundraising', defaultEnabled: false },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/learning', label: 'Learning' },
      { to: '/focus', label: 'Deep Work', enabledKey: 'focus', defaultEnabled: false },
      { to: '/creative', label: 'Creative', enabledKey: 'creative', defaultEnabled: false },
    ],
  },
  {
    label: 'Career',
    items: [
      { to: '/trading', label: 'Trading', enabledKey: 'trading', defaultEnabled: true },
      { to: '/engineering', label: 'Engineering', enabledKey: 'engineering', defaultEnabled: false },
      { to: '/businesses', label: 'Business Projects', enabledKey: 'business', defaultEnabled: true },
      { to: '/career', label: 'Career', enabledKey: 'career', defaultEnabled: false },
      { to: '/networking', label: 'Networking', enabledKey: 'networking', defaultEnabled: false },
      { to: '/content', label: 'Content', enabledKey: 'content', defaultEnabled: false },
      { to: '/freelance', label: 'Freelance', enabledKey: 'freelance', defaultEnabled: false },
    ],
  },
  {
    label: 'Life',
    items: [
      { to: '/habits', label: 'Habits' },
      { to: '/health', label: 'Health' },
      { to: '/finance', label: 'Finance' },
      { to: '/real-estate', label: 'Real Estate', enabledKey: 'realEstate', defaultEnabled: false },
    ],
  },
  {
    label: 'Others',
    items: [
      { to: '/skills', label: 'Skill Tree' },
      { to: '/leaderboard', label: 'Leaderboard' },
    ],
  },
];

const isItemEnabled = (user, item) => (item.enabledKey ? user?.enabledModules?.[item.enabledKey] ?? item.defaultEnabled ?? true : true);

const linkClass = ({ isActive }) =>
  `text-sm font-medium transition-colors pb-0.5 border-b-2 ${
    isActive ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
  }`;

// One "Page mère" — renders nothing when none of its children are enabled,
// otherwise always a "Label ▾" dropdown (even for a single child), reusing
// the open/outside-click-to-close pattern from AccountSwitcher.jsx.
function NavGroup({ group, enabledChildren }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (enabledChildren.length === 0) return null;

  const isGroupActive = enabledChildren.some((c) => location.pathname.startsWith(c.to));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-sm font-medium transition-colors pb-0.5 border-b-2 cursor-pointer ${
          isGroupActive ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
        }`}
      >
        {group.label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-48 bg-card border border-line rounded-xl shadow-2xl z-50 py-1.5">
            {enabledChildren.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block px-3.5 py-2 text-sm font-medium ${isActive ? 'text-accent bg-accent/10' : 'text-mute hover:text-ink hover:bg-line/40'}`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = user?.theme || 'dark';

  const directItems = DIRECT_ITEMS.filter((item) => isItemEnabled(user, item));
  const groups = NAV_GROUPS.map((group) => ({ group, enabledChildren: group.items.filter((item) => isItemEnabled(user, item)) }));

  // Mobile keeps a flat list (its dropdown is already a full-screen panel,
  // not a crowded horizontal bar) — just every enabled item, grouped or not.
  const mobileItems = [...directItems, ...groups.flatMap((g) => g.enabledChildren)];

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
        {/* Left: logo */}
        <button className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/')}>
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
            <Zap size={16} className="text-black" />
          </span>
          <span className="text-lg font-bold tracking-widest hidden sm:inline">AUDAX</span>
        </button>

        {/* Center: nav links */}
        <div className="hidden md:flex items-center gap-7">
          {directItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          {groups.map(({ group, enabledChildren }) => (
            <NavGroup key={group.label} group={group} enabledChildren={enabledChildren} />
          ))}
        </div>

        {/* Right: theme + settings + profile + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <GlobalSearch />
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

      {/* Mobile dropdown — flat list, grouping is a desktop-crowding fix only */}
      {mobileOpen && (
        <div className="md:hidden bg-surface border-b border-line">
          <div className="flex flex-col p-3 gap-1">
            {[...mobileItems, { to: '/settings', label: 'Settings' }].map((item) => (
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
