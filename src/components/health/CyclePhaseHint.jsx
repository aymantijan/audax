import { AlertTriangle, Sparkles } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';

const HINT_COPY = {
  push_ok: { label: 'Fenêtre favorable', color: 'var(--success)' },
  moderate: { label: 'Adapter si besoin', color: 'var(--warning)' },
  lighter_ok: { label: 'Alléger si besoin', color: 'var(--warning)' },
};

// Deliberately conservative and general (ACOG guidance) rather than trying
// to auto-filter/substitute exercises — the app has no way to verify a real
// clearance to exercise, so it defers that call to the person's own
// clinician instead of pretending to make it safe automatically.
const PREGNANCY_SAFETY_NOTE = "Grossesse : fais valider ton activité sportive par ta sage-femme/médecin. Recommandations générales ACOG : après le 1er trimestre, évite les positions allongées sur le dos prolongées, les sports de contact/à risque de chute, et arrête si douleur, saignement, essoufflement inhabituel ou vertiges.";
const POSTPARTUM_SAFETY_NOTE = "Post-partum : la reprise du sport doit être validée par ton médecin (souvent au minimum 6 semaines, plus après une césarienne), en particulier pour le renforcement abdominal et le périnée. Reprends progressivement.";

// Progesterone raises core body temperature through the luteal phase (~0.3-
// 0.5°C), which lowers heat tolerance margin during cardio specifically —
// worth a heads-up in hot conditions, not in Gym where thermal load is much
// lower. Only shown when the phase estimate is hormonally reliable (see
// isCyclePhaseHormonallyReliable in healthStore.js).
const LUTEAL_CARDIO_NOTE = "Ta température corporelle centrale est légèrement plus élevée en phase lutéale — par forte chaleur, hydrate-toi un peu plus et n'hésite pas à réduire l'intensité si tu la sens.";

// Surfaces the cycle-phase training-load hint (previously computed but never
// read anywhere outside CycleTracking.jsx) directly where training decisions
// actually happen — Gym/Cardio. Informational only, never blocks or alters
// the prescribed session; renders nothing when cycle tracking isn't
// applicable (male account, or female account with no phase data yet).
export default function CyclePhaseHint({ context = null }) {
  // Destructure the getter (subscribes to the store reference only) and call
  // it in the render body — NOT `useHealthStore(s => s.getCyclePhaseCoaching())`,
  // which re-invokes the getter inside the selector on every check. The
  // getter builds a fresh object each call, so that pattern makes Zustand
  // see "the snapshot changed" on every render and loops infinitely.
  const { getCyclePhaseCoaching, isCyclePhaseHormonallyReliable, healthProfile } = useHealthStore();
  const coaching = getCyclePhaseCoaching();
  const lifeStage = healthProfile.lifeStage;
  const safetyNote = lifeStage === 'pregnant' ? PREGNANCY_SAFETY_NOTE : lifeStage === 'postpartum' ? POSTPARTUM_SAFETY_NOTE : null;

  if (!coaching?.note && !safetyNote) return null;
  const copy = coaching ? HINT_COPY[coaching.trainingLoadHint] : null;
  const showCardioHeatNote = context === 'cardio' && coaching?.phase === 'luteal' && isCyclePhaseHormonallyReliable();

  return (
    <div className="flex flex-col gap-2">
      {safetyNote && (
        <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <div className="text-sm text-mute flex-1">{safetyNote}</div>
        </div>
      )}
      {coaching?.note && (
        <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            {copy && <span className="font-medium mr-1.5" style={{ color: copy.color }}>{copy.label} —</span>}
            <span className="text-mute">{coaching.note}</span>
            {showCardioHeatNote && <div className="text-mute mt-1">{LUTEAL_CARDIO_NOTE}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
