import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sun, Dumbbell, Salad, HeartPulse, TrendingUp, LayoutDashboard, BookOpen, Activity, Moon,
  Leaf, Zap, Scale, CalendarHeart, Target, Gauge, LineChart,
} from 'lucide-react';
import { useHealthStore } from '../store/healthStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/ui';
import HealthDashboard from './health/Dashboard';
import SleepTracker from './health/SleepTracker';
import NutritionTracker from './health/NutritionTracker';
import RecoveryTracker from './health/RecoveryTracker';
import BodyComposition from './health/BodyComposition';
import EnergyStress from './health/EnergyStress';
import CycleTracking from './health/CycleTracking';
import Performance from './health/Performance';
import Goals from './health/Goals';
import Analytics from './health/Analytics';
import ProgramTab from './health/program/ProgramTab';
import CardioLogging from './health/CardioLogging';
import GymLogging from './health/GymLogging';
import SportLogging from './health/SportLogging';

// 5 spaces instead of 14 flat tabs. Page keys are unchanged (deep links,
// goTo() calls and habit prompts keep working); the space is derived from them.
const SPACES = [
  {
    key: 'today', label: 'Aujourd’hui', desc: 'Check-in & journée', icon: Sun,
    pages: [{ key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, Component: HealthDashboard }],
  },
  {
    key: 'training', label: 'Entraînement', desc: 'Programme & séances', icon: Dumbbell,
    pages: [
      { key: 'programs', label: 'Programme', icon: BookOpen, Component: ProgramTab },
      { key: 'gym', label: 'Musculation', icon: Dumbbell, Component: GymLogging },
      { key: 'cardio', label: 'Cardio', icon: HeartPulse, Component: CardioLogging },
      { key: 'sport', label: 'Autres sports', icon: Activity, Component: SportLogging },
    ],
  },
  {
    key: 'nutrition', label: 'Nutrition', desc: 'Repas & hydratation', icon: Salad,
    pages: [{ key: 'nutrition', label: 'Nutrition', icon: Salad, Component: NutritionTracker }],
  },
  {
    key: 'body', label: 'Corps & récup', desc: 'Sommeil, récup, stress', icon: Leaf,
    pages: [
      { key: 'sleep', label: 'Sommeil', icon: Moon, Component: SleepTracker },
      { key: 'recovery', label: 'Récupération', icon: Leaf, Component: RecoveryTracker },
      { key: 'energy', label: 'Énergie & stress', icon: Zap, Component: EnergyStress },
      { key: 'body', label: 'Composition corporelle', icon: Scale, Component: BodyComposition },
      { key: 'cycle', label: 'Cycle', icon: CalendarHeart, Component: CycleTracking, femaleOnly: true },
    ],
  },
  {
    key: 'progress', label: 'Progrès', desc: 'Objectifs & analyses', icon: TrendingUp,
    pages: [
      { key: 'goals', label: 'Objectifs', icon: Target, Component: Goals },
      { key: 'performance', label: 'Performance', icon: Gauge, Component: Performance },
      { key: 'analytics', label: 'Analyses', icon: LineChart, Component: Analytics },
    ],
  },
];

// Old / alias keys still used by some buttons (e.g. Dashboard's "Start a workout").
const ALIASES = { workout: 'gym', setup: 'programs' };
const TAB_FOR_LINK = { cardio: 'cardio', strength: 'gym', recovery: 'recovery', mindfulness: 'recovery', nutrition: 'nutrition', sleep: 'sleep', reflection: 'dashboard' };

export default function Health() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pendingPrompts, dismissPrompt } = useHealthStore();
  const gender = useAuthStore((s) => s.user?.gender);
  const [activePrompt, setActivePrompt] = useState(null);

  // Cycle is strictly gender-gated (female accounts only), as before.
  const spaces = useMemo(
    () => SPACES.map((sp) => ({ ...sp, pages: sp.pages.filter((p) => !p.femaleOnly || gender === 'female') })),
    [gender]
  );
  const allPages = useMemo(() => spaces.flatMap((sp) => sp.pages.map((p) => ({ ...p, space: sp.key }))), [spaces]);

  // QuickAdd deep-links as /health?quickadd=workout → Musculation.
  const initial = searchParams.get('quickadd') === 'workout' ? 'gym' : (searchParams.get('tab') || 'dashboard');
  const [page, setPageRaw] = useState(initial);
  const resolved = ALIASES[page] || page;
  const current = allPages.find((p) => p.key === resolved) || allPages[0];
  const currentSpace = spaces.find((sp) => sp.key === current.space);

  // Remember the last page visited in each space.
  const [lastInSpace, setLastInSpace] = useState({});
  const setPage = (key) => setPageRaw(ALIASES[key] || key);

  useEffect(() => {
    setLastInSpace((m) => ({ ...m, [current.space]: current.key }));
    if (searchParams.get('tab') !== current.key || searchParams.has('quickadd')) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', current.key);
      next.delete('quickadd');
      setSearchParams(next, { replace: true });
    }
  }, [current.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const goSpace = (sp) => setPage(lastInSpace[sp.key] || sp.pages[0].key);

  const Active = current.Component;
  const promptForActive = activePrompt && TAB_FOR_LINK[activePrompt.type] === current.key ? activePrompt : null;
  const openPrompt = (p) => { setActivePrompt(p); setPage(TAB_FOR_LINK[p.type] || 'dashboard'); };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Santé</h1>
        <p className="mt-1 text-sm text-mute">Entraînement, nutrition, sommeil et récupération — pour savoir chaque jour si tu es prêt à pousser ou s’il faut récupérer.</p>
      </div>

      {pendingPrompts.length > 0 && (
        <div className="space-y-2">
          {pendingPrompts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-good/40 bg-good/10 px-4 py-3">
              <span className="text-sm">💚 Enregistrer <strong>{p.habitName}</strong> ? ~1 min.</span>
              <div className="flex shrink-0 gap-2">
                <Button className="!px-3 !py-1.5 text-xs" onClick={() => openPrompt(p)}>Enregistrer</Button>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => dismissPrompt(p.id)}>Ignorer</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Level 1 — spaces */}
      <nav className="grid grid-cols-5 gap-1.5 rounded-2xl border border-line bg-surface p-1.5" aria-label="Espaces santé">
        {spaces.map((sp) => {
          const Icon = sp.icon;
          const active = sp.key === currentSpace.key;
          return (
            <button
              key={sp.key}
              onClick={() => goSpace(sp)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition-colors cursor-pointer sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left ${
                active ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:bg-card/50 hover:text-ink'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-accent/15 text-accent' : 'bg-card/60'}`}>
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold sm:text-sm">{sp.label}</span>
                <span className="hidden truncate text-[11px] text-mute lg:block">{sp.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Level 2 — pages of the space (hidden when there's only one) */}
      {currentSpace.pages.length > 1 && (
        <div className="-mt-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {currentSpace.pages.map((p) => {
            const Icon = p.icon;
            const active = p.key === current.key;
            return (
              <button
                key={p.key}
                onClick={() => setPage(p.key)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active ? 'border-accent text-accent' : 'border-transparent text-mute hover:text-ink'
                }`}
              >
                <Icon size={15} /> {p.label}
              </button>
            );
          })}
        </div>
      )}

      <Active goTo={setPage} pendingPrompt={promptForActive} />
    </div>
  );
}
