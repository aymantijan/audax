import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { MODULES, enabledModules, moduleOfPath, poleOfPath } from '../../utils/navigation';

// Pages of the current section, as a row of chips under the top bar. Shown
// only when the section has more than one page to offer.
export default function PoleSubNav() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const pole = poleOfPath(location.pathname);
  if (!pole) return null;
  const keys = enabledModules(user, pole);
  const hasHome = !pole.modules.some((k) => MODULES[k].to === pole.home);
  const entries = [
    ...(hasHome ? [{ key: '__home', label: 'Vue d’ensemble', to: pole.home, icon: pole.icon }] : []),
    ...keys.map((k) => ({ key: k, ...MODULES[k] })),
  ];
  if (entries.length < 2) return null;
  const current = moduleOfPath(location.pathname);
  const onHome = location.pathname === pole.home;

  return (
    <div className="sticky top-16 z-40 border-b border-line bg-base/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto py-2 [scrollbar-width:none]" role="navigation" aria-label={pole.label}>
        {entries.map((e) => {
          const active = e.key === '__home' ? onHome : current === e.key && !onHome;
          return (
            <Link
              key={e.key}
              to={e.to}
              aria-current={active ? 'page' : undefined}
              className={`ui-btn shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}
            >
              <e.icon size={14} />
              {e.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
