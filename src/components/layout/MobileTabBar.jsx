import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, TrendingUp, Wallet, HeartPulse, MoreHorizontal, X, Target, BookOpen, Flame, Handshake, Rocket, GitBranch, Trophy, Settings, FlaskConical, Briefcase, Timer, Palette, Building2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// Bottom tab bar, mobile only (hidden md:up — the existing Navbar's horizontal
// links + hamburger stay the desktop/tablet pattern). Five most-opened
// destinations get a permanent thumb-reach slot; everything else lives behind
// "More", a bottom sheet rather than a second nav level, since a phone screen
// can't fit AUDAX's ~10 top-level sections as tabs without them becoming
// unreadable.
const PRIMARY_TABS = [
  { to: '/today', label: 'Aujourd’hui', icon: Sun, end: true },
  { to: '/trading', label: 'Trading', icon: TrendingUp },
  { to: '/finance', label: 'Finances', icon: Wallet },
  { to: '/health', label: 'Santé', icon: HeartPulse },
];

const MORE_ITEMS = [
  { to: '/goals', label: 'Objectifs', icon: Target },
  { to: '/learning', label: 'Apprentissage', icon: BookOpen },
  { to: '/habits', label: 'Habitudes', icon: Flame },
  { to: '/deals', label: 'Private equity', icon: Handshake },
  { to: '/businesses', label: 'Projets business', icon: Rocket },
  { to: '/engineering', label: 'Ingénierie', icon: FlaskConical },
  { to: '/career', label: 'Carrière', icon: Briefcase },
  { to: '/focus', label: 'Deep Work', icon: Timer },
  { to: '/fundraising', label: 'Levée de fonds', icon: Rocket },
  { to: '/freelance', label: 'Freelance', icon: Briefcase },
  { to: '/creative', label: 'Création', icon: Palette },
  { to: '/real-estate', label: 'Immobilier', icon: Building2 },
  { to: '/skills', label: 'Compétences', icon: GitBranch },
  { to: '/leaderboard', label: 'Classement', icon: Trophy },
  { to: '/dashboard', label: 'Tableau de bord', icon: TrendingUp },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

export default function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const tradingEnabled = user?.enabledModules?.trading ?? true;
  const peEnabled = user?.enabledModules?.pe ?? true;
  const businessEnabled = user?.enabledModules?.business ?? true;
  const engineeringEnabled = user?.enabledModules?.engineering ?? false;
  const careerEnabled = (user?.enabledModules?.career || user?.enabledModules?.networking || user?.enabledModules?.content) ?? false;
  const focusEnabled = user?.enabledModules?.focus ?? false;
  const fundraisingEnabled = user?.enabledModules?.fundraising ?? false;
  const freelanceEnabled = user?.enabledModules?.freelance ?? false;
  const creativeEnabled = user?.enabledModules?.creative ?? false;
  const realEstateEnabled = user?.enabledModules?.realEstate ?? false;
  const primaryTabs = PRIMARY_TABS.filter((t) => t.to !== '/trading' || tradingEnabled);
  const moreItems = MORE_ITEMS.filter(
    (t) =>
      (t.to !== '/deals' || peEnabled) &&
      (t.to !== '/businesses' || businessEnabled) &&
      (t.to !== '/engineering' || engineeringEnabled) &&
      (t.to !== '/career' || careerEnabled) &&
      (t.to !== '/focus' || focusEnabled) &&
      (t.to !== '/fundraising' || fundraisingEnabled) &&
      (t.to !== '/freelance' || freelanceEnabled) &&
      (t.to !== '/creative' || creativeEnabled) &&
      (t.to !== '/real-estate' || realEstateEnabled)
  );

  const tabClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] cursor-pointer ${
      isActive ? 'text-accent' : 'text-mute'
    }`;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {primaryTabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
            <t.icon size={19} />
            {t.label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] text-mute cursor-pointer">
          <MoreHorizontal size={19} />
          Plus
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
              <span className="text-sm font-semibold text-mute uppercase tracking-wide">Plus</span>
              <button onClick={() => setMoreOpen(false)} className="text-mute hover:text-ink cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((item) => (
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
