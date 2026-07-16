import { useState } from 'react';
import { LayoutDashboard, Moon, Dumbbell, Salad, HeartPulse, Scale, Zap, LineChart, CalendarHeart, Target } from 'lucide-react';
import { useHealthStore } from '../store/healthStore';
import { Modal, Button } from '../components/common/ui';
import HealthDashboard from './health/Dashboard';
import SleepTracker from './health/SleepTracker';
import WorkoutLogging from './health/WorkoutLogging';
import NutritionTracker from './health/NutritionTracker';
import RecoveryTracker from './health/RecoveryTracker';
import BodyComposition from './health/BodyComposition';
import EnergyStress from './health/EnergyStress';
import CycleTracking from './health/CycleTracking';
import Goals from './health/Goals';
import Analytics from './health/Analytics';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, Component: HealthDashboard },
  { key: 'sleep', label: 'Sleep', icon: Moon, Component: SleepTracker },
  { key: 'workout', label: 'Workout', icon: Dumbbell, Component: WorkoutLogging },
  { key: 'nutrition', label: 'Nutrition', icon: Salad, Component: NutritionTracker },
  { key: 'recovery', label: 'Recovery', icon: HeartPulse, Component: RecoveryTracker },
  { key: 'body', label: 'Body Comp', icon: Scale, Component: BodyComposition },
  { key: 'energy', label: 'Energy & Stress', icon: Zap, Component: EnergyStress },
  { key: 'cycle', label: 'Cycle', icon: CalendarHeart, Component: CycleTracking },
  { key: 'goals', label: 'Goals', icon: Target, Component: Goals },
  { key: 'analytics', label: 'Analytics', icon: LineChart, Component: Analytics },
];

const TAB_FOR_LINK = { cardio: 'workout', strength: 'workout', recovery: 'recovery', mindfulness: 'recovery', nutrition: 'nutrition', sleep: 'sleep', reflection: 'dashboard' };

export default function Health() {
  const [tab, setTab] = useState('dashboard');
  const { pendingPrompts, dismissPrompt } = useHealthStore();
  const [activePrompt, setActivePrompt] = useState(null);

  const Active = TABS.find((t) => t.key === tab)?.Component || HealthDashboard;
  const promptForActiveTab = activePrompt && TAB_FOR_LINK[activePrompt.type] === tab ? activePrompt : null;

  const openPrompt = (p) => {
    setActivePrompt(p);
    setTab(TAB_FOR_LINK[p.type] || 'dashboard');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Health</h1>
        <p className="text-mute text-sm mt-1">Sleep, training, nutrition, recovery, body composition, and cross-domain correlations — one place to see if you're primed or overreaching.</p>
      </div>

      {pendingPrompts.length > 0 && (
        <div className="space-y-2">
          {pendingPrompts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border border-good/40 bg-good/10 rounded-lg px-4 py-3">
              <span className="text-sm">💚 Log <strong>{p.habitName}</strong> in Health? ~1 min.</span>
              <div className="flex gap-2 shrink-0">
                <Button className="!px-3 !py-1.5 text-xs" onClick={() => openPrompt(p)}>Log Activity</Button>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => dismissPrompt(p.id)}>Dismiss</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
                active ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <Active goTo={setTab} pendingPrompt={promptForActiveTab} />
    </div>
  );
}
