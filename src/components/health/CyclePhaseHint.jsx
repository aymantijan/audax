import { Sparkles } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';

const HINT_COPY = {
  push_ok: { label: 'Fenêtre favorable', color: 'var(--success)' },
  moderate: { label: 'Adapter si besoin', color: 'var(--warning)' },
  lighter_ok: { label: 'Alléger si besoin', color: 'var(--warning)' },
};

// Surfaces the cycle-phase training-load hint (previously computed but never
// read anywhere outside CycleTracking.jsx) directly where training decisions
// actually happen — Gym/Cardio. Informational only, never blocks or alters
// the prescribed session; renders nothing when cycle tracking isn't
// applicable (male account, or female account with no phase data yet).
export default function CyclePhaseHint() {
  // Destructure the getter (subscribes to the store reference only) and call
  // it in the render body — NOT `useHealthStore(s => s.getCyclePhaseCoaching())`,
  // which re-invokes the getter inside the selector on every check. The
  // getter builds a fresh object each call, so that pattern makes Zustand
  // see "the snapshot changed" on every render and loops infinitely.
  const { getCyclePhaseCoaching } = useHealthStore();
  const coaching = getCyclePhaseCoaching();
  if (!coaching?.note) return null;
  const copy = HINT_COPY[coaching.trainingLoadHint];

  return (
    <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
      <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
      <div className="text-sm flex-1">
        {copy && <span className="font-medium mr-1.5" style={{ color: copy.color }}>{copy.label} —</span>}
        <span className="text-mute">{coaching.note}</span>
      </div>
    </div>
  );
}
