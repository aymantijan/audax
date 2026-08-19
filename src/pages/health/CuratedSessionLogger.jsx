import { useState } from 'react';
import { CheckCircle2, HeartPulse } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Input } from '../../components/common/ui';

// Midpoint of a "4 × 6-8" style prescribed range — used to prefill the reps
// field so a bare checkbox-check still produces a valid, non-empty log entry
// (logGymSession silently drops any exercise whose reps AND weight are both
// empty — this prefill is what prevents that from ever happening here).
function prefillReps(setsReps) {
  const match = /(\d+)-(\d+)$/.exec(setsReps || '');
  if (!match) return '';
  return Math.round((Number(match[1]) + Number(match[2])) / 2);
}

// The fast-path structured logger for today's prescribed cardio block from
// the active curated program — checkbox "done" + duration, instead of
// building a free-form cardio entry from scratch. Renders nothing if no
// curated program is active or today has no cardio block scheduled.
export function CuratedCardioLogger() {
  const { getActiveCuratedProgram, getTodayCuratedSession, logWorkout } = useHealthStore();
  const program = getActiveCuratedProgram();
  const today = getTodayCuratedSession();
  const cardioBlock = today?.dayEntry?.blocks?.find((b) => b.type === 'cardio');

  const [cardioDone, setCardioDone] = useState(false);
  const [cardioMin, setCardioMin] = useState(cardioBlock?.durationMin || 30);

  const submitCardio = () => {
    logWorkout({ type: 'cardio', category: 'cardio', exercise: `Cardio — ${program.name}`, durationMin: Number(cardioMin) || cardioBlock.durationMin, quality: null, notes: '' });
    setCardioDone(true);
  };

  if (!program || !cardioBlock) return null;

  return (
    <Card title="Cardio du jour">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={cardioDone} onChange={(e) => setCardioDone(e.target.checked)} />
          Cardio fait
        </label>
        <Input type="number" className="!py-1 !text-xs w-20" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} />
        <span className="text-xs text-mute">min</span>
        <Button className="!px-3 !py-1.5 text-xs ml-auto" disabled={!cardioDone} onClick={submitCardio}>
          <span className="flex items-center gap-1.5"><HeartPulse size={12} /> Logger le cardio</span>
        </Button>
      </div>
    </Card>
  );
}

// Same idea for today's prescribed gym session — checkbox "done" + reps +
// optional weight per exercise, instead of picking exercises/sets from
// scratch. Bodyweight exercises (pull-ups, dips…) default to bodyweight-only
// unless a weight is entered — the "weight" field is then added weight, not
// a replacement.
export function CuratedGymLogger() {
  const { getActiveCuratedProgram, getTodayCuratedSession, logGymSession } = useHealthStore();
  const program = getActiveCuratedProgram();
  const today = getTodayCuratedSession();

  const trainingBlock = today?.dayEntry?.blocks?.find((b) => b.type === 'training');
  const exercises = today?.session?.exercises || [];

  const [checked, setChecked] = useState(() => new Set());
  const [reps, setReps] = useState(() => Object.fromEntries(exercises.map((e) => [e.name, prefillReps(e.setsReps)])));
  const [weight, setWeight] = useState(() => Object.fromEntries(exercises.map((e) => [e.name, ''])));
  const [error, setError] = useState('');

  const toggle = (name) => setChecked((s) => { const next = new Set(s); next.has(name) ? next.delete(name) : next.add(name); return next; });

  const submitTraining = () => {
    setError('');
    const picked = exercises.filter((e) => checked.has(e.name));
    if (!picked.length) return setError('Coche au moins un exercice fait.');
    const missingReps = picked.some((e) => !reps[e.name]);
    if (missingReps) return setError('Indique les reps pour chaque exercice coché.');
    logGymSession({
      date: todayKey(),
      sessionType: null,
      exercises: picked.map((e) => ({
        exercise: e.name,
        sets: [{ reps: Number(reps[e.name]), weight: weight[e.name] ? Number(weight[e.name]) : 0, rpe: null, form: null }],
      })),
      quality: null,
      notes: today.session.isVariant ? '(variante)' : '',
    });
    setChecked(new Set());
  };

  const allChecked = exercises.length > 0 && exercises.every((e) => checked.has(e.name));

  if (!program || !trainingBlock || !exercises.length) return null;

  return (
    <Card title={`Séance du jour — ${today.session.label}${today.session.isVariant ? ' (variante)' : ''}`}>
      <div className="space-y-2">
        {exercises.map((ex) => (
          <div key={ex.name} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2">
            <input type="checkbox" checked={checked.has(ex.name)} onChange={() => toggle(ex.name)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{ex.name}</div>
              <div className="text-[11px] text-mute">{ex.setsReps}{ex.note ? ` · ${ex.note}` : ''}</div>
            </div>
            <Input type="number" className="!py-1 !text-xs w-16" placeholder="reps" value={reps[ex.name] ?? ''} onChange={(e) => setReps({ ...reps, [ex.name]: e.target.value })} />
            <Input
              type="number" className="!py-1 !text-xs w-24"
              placeholder={ex.bodyweightExercise ? 'poids ajouté' : 'poids (kg)'}
              value={weight[ex.name] ?? ''} onChange={(e) => setWeight({ ...weight, [ex.name]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-bad mt-2">{error}</p>}
      <Button className="mt-3" onClick={submitTraining} disabled={!allChecked}>
        <span className="flex items-center gap-2"><CheckCircle2 size={14} /> {allChecked ? 'Logger la séance' : `Coche les ${exercises.length} exercices pour terminer`}</span>
      </Button>
      <p className="text-[11px] text-mute mt-2">Champ "poids" vide sur un exercice au poids du corps = fait au poids du corps seul ; un nombre = poids ajouté en plus.</p>
    </Card>
  );
}
