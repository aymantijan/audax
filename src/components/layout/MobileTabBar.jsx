import { Link, useLocation } from 'react-router-dom';
import { MOBILE_POLES, poleByKey, poleOfPath } from '../../utils/navigation';

// Phone bottom bar: the five sections, Aujourd'hui in the middle and raised.
// Inside a section, the sub-menu under the top bar reaches its pages.
export default function MobileTabBar() {
  const location = useLocation();
  const activePole = poleOfPath(location.pathname);
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Sections"
    >
      {MOBILE_POLES.map((key) => {
        const pole = poleByKey(key);
        const active = activePole?.key === key;
        const center = key === 'today';
        return (
          <Link
            key={key}
            to={pole.home}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-1.5 text-[10px] ${active ? 'text-accent' : 'text-mute'}`}
          >
            {center ? (
              <span className={`-mt-5 mb-0.5 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-4 border-surface ${active ? 'bg-accent text-on-accent' : 'bg-card text-ink'}`}>
                <pole.icon size={21} />
              </span>
            ) : (
              <pole.icon size={20} />
            )}
            {pole.short}
          </Link>
        );
      })}
    </nav>
  );
}
