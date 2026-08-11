import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, TrendingUp, Wallet, HeartPulse, MoreHorizontal, X, BookOpen, Flame, Handshake, GitBranch, Trophy, Settings } from 'lucide-react';

// Bottom tab bar, mobile only (hidden md:up — the existing Navbar's horizontal
// links + hamburger stay the desktop/tablet pattern). Five most-opened
// destinations get a permanent thumb-reach slot; everything else lives behind
// "More", a bottom sheet rather than a second nav level, since a phone screen
// can't fit AUDAX's ~10 top-level sections as tabs without them becoming
// unreadable.
const PRIMARY_TABS = [
  { to: '/today', label: 'Today', icon: Sun, end: true },
  { to: '/trading', label: 'Trading', icon: TrendingUp },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/health', label: 'Health', icon: HeartPulse },
];

const MORE_ITEMS = [
  { to: '/learning', label: 'Learning', icon: BookOpen },
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/deals', label: 'Deals', icon: Handshake },
  { to: '/skills', label: 'Skill Tree', icon: GitBranch },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/dashboard', label: 'Dashboard', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);

  const tabClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] cursor-pointer ${
      isActive ? 'text-accent' : 'text-mute'
    }`;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {PRIMARY_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
            <t.icon size={19} />
            {t.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] text-mute cursor-pointer">
          <MoreHorizontal size={19} />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full bg-surface border-t border-line rounded-t-2xl p-4 pb-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-mute uppercase tracking-wide">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-mute hover:text-ink cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs cursor-pointer ${
                      isActive ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'
                    }`
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
