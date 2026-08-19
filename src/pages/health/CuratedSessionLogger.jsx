import { useEffect, useState } from 'react';
import { CheckCircle2, HeartPulse } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Input, Field, Select } from '../../components/common/ui';

// Midpoint of a "4 × 6-8" style prescribed range, or the plain number in a
// fixed-rep prescription like "2 × 10/jambe" — used to prefill the reps
// field so a bare checkbox-check still produces a valid, non-empty log entry
// (logGymSession silently drops any exercise whose reps AND weight are both
// empty — this prefill is what prevents that from ever happening, and also
// what stops the "coche tout" completion gate from silently staying blocked
// on notations like "/jambe" that the range pattern alone doesn't cover).
function prefillReps(setsReps) {
  const range = /(\d+)-(\d+)/.exec(setsReps || '');
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = /×\s*(\d+)/.exec(setsReps || '');
  return single ? Number(single[1]) : '';
}

// Leading number in "3 × 8-12" / "2 × 10/jambe" — how many separate sets to
// render input rows for. Each set is worked with its own weight (a warm-up
// set and a working set are never the same load), so one combined field per
// exercise isn't enough — falls back to 3 (the most common prescription)
// if the string can't be parsed.
function parseSetCount(setsReps) {
  const match = /^(\d+)\s*×/.exec(setsReps || '');
  return match ? Number(match[1]) : 3;
}

function makeSets(setsReps) {
  return Array.from({ length: parseSetCount(setsReps) }, () => ({ reps: prefillReps(setsReps), weight: '', rpe: 7, form: 'Good' }));
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
  // Rétroactif : par défaut aujourd'hui, mais rattrapable pour une séance
  // faite (et non loggée) un autre jour.
  const [logDate, setLogDate] = useState(todayKey());
  const [quality, setQuality] = useState(7);

  const submitCardio = () => {
    logWorkout({ date: logDate, type: 'cardio', category: 'cardio', exercise: `Cardio — ${program.name}`, durationMin: Number(cardioMin) || cardioBlock.durationMin, quality, notes: '' });
    setCardioDone(true);
    setLogDate(todayKey());
    setQuality(7);
  };

  if (!program || !cardioBlock) return null;

  return (
    <Card title="Cardio du jour">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={cardioDone} onChange={(e) => setCardioDone(e.target.checked)} />
          Cardio fait
        </label>
        <Input type="number" className="!py-1 !text-xs w-20" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} />
        <span className="text-xs text-mute">min</span>
        <Input type="date" className="!py-1 !text-xs w-36" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} title="Rattraper une séance manquée" />
        <div className="flex items-center gap-1.5">
          <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-20" />
          <span className="text-[10px] text-mute w-14">Ressenti {quality}/10</span>
        </div>
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
  const { getActiveCuratedProgram, getNextGymSession, logGymSession, markCuratedSessionDone } = useHealthStore();
  const program = getActiveCuratedProgram();
  // Rotation-based, not calendar-day-based — the next session is whatever
  // comes after the last one actually completed, so missing/rescheduling a
  // day (e.g. training Push a day late) never leaves nothing prescribed or
  // skips a session in the rotation.
  const next = getNextGymSession();
  const exercises = next?.session?.exercises || [];

  const [checked, setChecked] = useState(() => new Set());
  // Per exercise, an array of {reps, weight, rpe, form} — one entry per
  // prescribed set, since each set is worked with its own weight (warm-up
  // vs. working sets) and can feel harder/easier (RPE) or break down in form
  // independently of the others.
  const [sets, setSets] = useState(() => Object.fromEntries(exercises.map((e) => [e.name, makeSets(e.setsReps)])));
  const [error, setError] = useState('');
  // Session-level: rétroactif (par défaut aujourd'hui, backdatable pour une
  // séance faite plus tôt et pas encore loggée), + ressenti global + notes —
  // symétrique avec ce que le formulaire libre capture déjà.
  const [logDate, setLogDate] = useState(todayKey());
  const [sessionQuality, setSessionQuality] = useState(7);
  const [notes, setNotes] = useState('');

  // getNextGymSession() advances after a submit (markCuratedSessionDone), but
  // this component doesn't remount — without this, `sets` would still be
  // keyed by the PREVIOUS session's exercise names, and every new exercise
  // would read as undefined (crash on .map/.every below).
  useEffect(() => {
    setChecked(new Set());
    setSets(Object.fromEntries(exercises.map((e) => [e.name, makeSets(e.setsReps)])));
    setError('');
    setLogDate(todayKey());
    setSessionQuality(7);
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.sessionKey]);

  // Falls back to a fresh set list when `sets` hasn't caught up yet with a
  // rotation change — the useEffect above fixes it on the next render, but
  // the render that's IN FLIGHT when next.sessionKey changes still has the
  // previous session's `sets` object, which doesn't have the new exercise
  // names as keys.
  const setsFor = (ex) => sets[ex.name] || makeSets(ex.setsReps);

  const toggle = (name) => setChecked((s) => { const next = new Set(s); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const updateSet = (ex, setIdx, patch) =>
    setSets((s) => ({ ...s, [ex.name]: setsFor(ex).map((set, i) => (i === setIdx ? { ...set, ...patch } : set)) }));

  const submitTraining = () => {
    setError('');
    const picked = exercises.filter((e) => checked.has(e.name));
    if (!picked.length) return setError('Coche au moins un exercice fait.');
    const missingReps = picked.some((e) => setsFor(e).some((s) => !s.reps));
    if (missingReps) return setError('Indique les reps pour chaque série.');
    // Weight is required per set for any loaded exercise (barbell/dumbbell/
    // machine) — only bodyweight-flagged movements (pull-ups, dips…) can
    // legitimately have an empty weight field, meaning "bodyweight only".
    const missingWeight = picked.some((e) => !e.bodyweightExercise && setsFor(e).some((s) => !s.weight));
    if (missingWeight) return setError('Indique le poids de chaque série (sauf poids du corps).');
    logGymSession({
      date: logDate,
      sessionType: null,
      exercises: picked.map((e) => ({
        exercise: e.name,
        sets: setsFor(e).map((s) => ({ reps: Number(s.reps), weight: s.weight ? Number(s.weight) : 0, rpe: Number(s.rpe) || null, form: s.form || null })),
      })),
      quality: sessionQuality,
      notes: [notes, next.session.isVariant ? '(variante)' : ''].filter(Boolean).join(' — '),
    });
    markCuratedSessionDone(program.id, next.sessionKey);
    setChecked(new Set());
  };

  const allChecked = exercises.length > 0 && exercises.every((e) => checked.has(e.name));
  // Mirrors submitTraining's validation so the button is disabled (not just
  // rejected after the click) until every checked exercise's sets all have
  // reps, plus a weight unless it's a bodyweight movement.
  const canSubmit = allChecked && exercises.every((e) => setsFor(e).every((s) => s.reps && (e.bodyweightExercise || s.weight)));

  if (!program || !exercises.length) return null;

  return (
    <Card title={`Prochaine séance — ${next.session.label}${next.session.isVariant ? ' (variante)' : ''}`}>
      <div className="space-y-3">
        {exercises.map((ex) => (
          <div key={ex.name} className="bg-surface border border-line rounded-lg px-3 py-2">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={checked.has(ex.name)} onChange={() => toggle(ex.name)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{ex.name}</div>
                <div className="text-[11px] text-mute">{ex.setsReps}{ex.note ? ` · ${ex.note}` : ''}</div>
              </div>
            </div>
            <div className="mt-2 pl-7 space-y-1.5">
              {setsFor(ex).map((s, setIdx) => (
                <div key={setIdx} className="flex items-center gap-2">
                  <span className="text-[10px] text-mute w-10 shrink-0">Série {setIdx + 1}</span>
                  <Input type="number" className="!py-1 !text-xs w-14" placeholder="reps" value={s.reps ?? ''} onChange={(e) => updateSet(ex, setIdx, { reps: e.target.value })} />
                  <Input
                    type="number" className="!py-1 !text-xs w-20"
                    placeholder={ex.bodyweightExercise ? 'poids ajouté' : 'poids (kg)'}
                    value={s.weight ?? ''} onChange={(e) => updateSet(ex, setIdx, { weight: e.target.value })}
                  />
                  <div className="flex items-center gap-1 w-24 shrink-0">
                    <input type="range" min="1" max="10" value={s.rpe} onChange={(e) => updateSet(ex, setIdx, { rpe: Number(e.target.value) })} className="w-full" />
                    <span className="text-[10px] text-mute w-11 shrink-0">RPE {s.rpe}</span>
                  </div>
                  <Select className="!py-1 !text-xs w-20" value={s.form} onChange={(e) => updateSet(ex, setIdx, { form: e.target.value })} options={['Good', 'Fair', 'Poor']} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Field label="Date" hint="Rattraper une séance manquée">
          <Input type="date" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} />
        </Field>
        <Field label={`Ressenti global de la séance : ${sessionQuality}/10`}>
          <input type="range" min="1" max="10" value={sessionQuality} onChange={(e) => setSessionQuality(Number(e.target.value))} className="w-full" />
        </Field>
      </div>
      <Field label="Notes (optionnel)">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="text-xs text-bad mt-2">{error}</p>}
      <Button className="mt-3" onClick={submitTraining} disabled={!canSubmit}>
        <span className="flex items-center gap-2">
          <CheckCircle2 size={14} />
          {canSubmit ? 'Logger la séance' : !allChecked ? `Coche les ${exercises.length} exercices pour terminer` : 'Remplis reps et poids pour chaque série'}
        </span>
      </Button>
      <p className="text-[11px] text-mute mt-2">Champ "poids" vide sur une série au poids du corps = faite au poids du corps seul ; un nombre = poids ajouté en plus. Chaque série a son propre poids.</p>
    </Card>
  );
}
