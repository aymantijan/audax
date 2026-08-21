import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, HeartPulse, RotateCcw } from 'lucide-react';
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

// `done: true` by default — the prescribed set count is a target, not a
// requirement. A set can be marked not-done (e.g. stopped a set short, ran
// out of time, cut the session at 3/4 sets) via the × button per row, which
// excludes it from both validation and the logged payload instead of
// forcing every prescribed set to be filled before the session can log at
// all.
function makeSets(setsReps) {
  return Array.from({ length: parseSetCount(setsReps) }, () => ({ reps: prefillReps(setsReps), weight: '', rpe: 7, form: 'Good', done: true }));
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
  const { getActiveCuratedProgram, getNextGymSession, getSessionOptions, getEffectiveExercises, logGymSession, markCuratedSessionDone, getCyclePhaseCoaching } = useHealthStore();
  const program = getActiveCuratedProgram();
  const cycleCoaching = getCyclePhaseCoaching();
  // Rotation-based, not calendar-day-based — the next session is whatever
  // comes after the last one actually completed, so missing/rescheduling a
  // day (e.g. training Push a day late) never leaves nothing prescribed or
  // skips a session in the rotation.
  const next = getNextGymSession();
  const sessionOptions = getSessionOptions();
  // Auto-prescribed by default, but the rotation is a GUESS, not a lock —
  // real training doesn't always follow it (e.g. trained legs when the
  // rotation assumed pull). Overriding here logs the session actually done
  // AND advances the rotation from that key, so the next prescription stays
  // sensible instead of repeating the same guess forever.
  const [overrideSessionKey, setOverrideSessionKey] = useState('');
  const activeSessionKey = overrideSessionKey || next?.sessionKey;
  const activeSession = overrideSessionKey && program ? getEffectiveExercises(program.id, overrideSessionKey) : next?.session;
  const exercises = activeSession?.exercises || [];

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
  // "Alléger la séance" — a one-tap version of Programme Extrême's own
  // written auto-regulation rule ("Score 60-79 → réduire le volume de 20%,
  // une série en moins par exercice"), offered on days the cycle-phase hint
  // says lighter_ok (menstrual phase) instead of leaving that rule as text
  // the user has to remember and apply by hand.
  const [lighterMode, setLighterMode] = useState(false);

  // getNextGymSession() advances after a submit (markCuratedSessionDone), but
  // this component doesn't remount — without this, `sets` would still be
  // keyed by the PREVIOUS session's exercise names, and every new exercise
  // would read as undefined (crash on .map/.every below). Keyed on
  // activeSessionKey (not just next?.sessionKey) so switching the "Changer
  // de séance" override also resets to the newly-selected session's fields.
  useEffect(() => {
    setChecked(new Set());
    setSets(Object.fromEntries(exercises.map((e) => [e.name, makeSets(e.setsReps)])));
    setError('');
    setLogDate(todayKey());
    setSessionQuality(7);
    setNotes('');
    setLighterMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionKey]);

  // Once the rotation itself advances (after a submit), drop back to
  // auto-prescribed for the NEXT session — the override was for that one
  // out-of-sequence day, not a standing preference.
  useEffect(() => {
    setOverrideSessionKey('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.sessionKey]);

  // Falls back to a fresh set list when `sets` hasn't caught up yet with a
  // rotation change — the useEffect above fixes it on the next render, but
  // the render that's IN FLIGHT when next.sessionKey changes still has the
  // previous session's `sets` object, which doesn't have the new exercise
  // names as keys.
  const setsFor = (ex) => sets[ex.name] || makeSets(ex.setsReps);
  // The set list actually rendered/submitted — trims the last set per
  // exercise when "Alléger" is on. Slicing off the END (not skipping via
  // index) means updateSet's setIdx values still point at the right entries
  // in the underlying full array, so editing a visible set never touches the
  // wrong one.
  const effectiveSetsFor = (ex) => {
    const all = setsFor(ex);
    return lighterMode && all.length > 1 ? all.slice(0, -1) : all;
  };
  // The sets that actually count — validated and logged. A row toggled
  // "not done" (didn't happen tonight — fatigue, time, injury caution…)
  // never blocks the rest of the session from logging.
  const doneSetsFor = (ex) => effectiveSetsFor(ex).filter((s) => s.done !== false);

  const toggle = (name) => setChecked((s) => { const next = new Set(s); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const updateSet = (ex, setIdx, patch) =>
    setSets((s) => ({ ...s, [ex.name]: setsFor(ex).map((set, i) => (i === setIdx ? { ...set, ...patch } : set)) }));

  const submitTraining = () => {
    setError('');
    const picked = exercises.filter((e) => checked.has(e.name));
    if (!picked.length) return setError('Coche au moins un exercice fait.');
    const noDoneSets = picked.some((e) => !doneSetsFor(e).length);
    if (noDoneSets) return setError('Chaque exercice coché doit avoir au moins une série non décochée (×), ou décoche l\'exercice.');
    const missingReps = picked.some((e) => doneSetsFor(e).some((s) => !s.reps));
    if (missingReps) return setError('Indique les reps pour chaque série non décochée.');
    // Weight is required per set for any loaded exercise (barbell/dumbbell/
    // machine) — only bodyweight-flagged movements (pull-ups, dips…) can
    // legitimately have an empty weight field, meaning "bodyweight only".
    const missingWeight = picked.some((e) => !e.bodyweightExercise && doneSetsFor(e).some((s) => !s.weight));
    if (missingWeight) return setError('Indique le poids de chaque série non décochée (sauf poids du corps).');
    logGymSession({
      date: logDate,
      sessionType: null,
      exercises: picked.map((e) => ({
        exercise: e.name,
        sets: doneSetsFor(e).map((s) => ({ reps: Number(s.reps), weight: s.weight ? Number(s.weight) : 0, rpe: Number(s.rpe) || null, form: s.form || null })),
      })),
      quality: sessionQuality,
      notes: [notes, activeSession.isVariant ? '(variante)' : '', lighterMode ? '(séance allégée -1 série/exercice)' : ''].filter(Boolean).join(' — '),
    });
    markCuratedSessionDone(program.id, activeSessionKey);
    setChecked(new Set());
  };

  const allChecked = exercises.length > 0 && exercises.every((e) => checked.has(e.name));
  // Mirrors submitTraining's validation so the button is disabled (not just
  // rejected after the click) until every CHECKED exercise has at least one
  // non-skipped set, and every non-skipped set has reps (+ weight unless
  // it's a bodyweight movement) — skipped sets are excluded entirely.
  const canSubmit =
    allChecked &&
    exercises.every((e) => {
      const done = doneSetsFor(e);
      return done.length > 0 && done.every((s) => s.reps && (e.bodyweightExercise || s.weight));
    });

  const anySetSkipped = exercises.some((e) => effectiveSetsFor(e).some((s) => s.done === false));
  const resetAllSets = () => setSets(Object.fromEntries(exercises.map((e) => [e.name, setsFor(e).map((s) => ({ ...s, done: true }))])));
  // One tap to mark every remaining set of ONE exercise as not-done, instead
  // of toggling each set individually — the common case is stopping an
  // exercise partway through (or skipping it after checking it off), not
  // toggling one set in isolation.
  const skipRestOfExercise = (ex) => setSets((s) => ({ ...s, [ex.name]: setsFor(ex).map((set) => ({ ...set, done: false })) }));

  if (!program || !next || !exercises.length) return null;

  return (
    <Card
      title={`${overrideSessionKey ? 'Séance' : 'Prochaine séance'} — ${activeSession.label}${activeSession.isVariant ? ' (variante)' : ''}`}
      action={
        sessionOptions.length > 1 && (
          <Select
            className="!py-1 !text-xs w-40"
            value={overrideSessionKey || next.sessionKey}
            onChange={(e) => setOverrideSessionKey(e.target.value === next.sessionKey ? '' : e.target.value)}
            options={sessionOptions.map((o) => ({ value: o.sessionKey, label: o.label }))}
          />
        )
      }
    >
      {overrideSessionKey && (
        <p className="text-[11px] text-mute mb-2">Séance changée manuellement — la rotation avancera à partir de "{activeSession.label}" au lieu de la prescription automatique.</p>
      )}
      {anySetSkipped && (
        <div className="flex items-center justify-between gap-2 text-xs bg-surface border border-line rounded-lg px-3 py-2 mb-3">
          <span className="text-mute">Séance partielle — les séries non faites ne seront ni requises ni loggées.</span>
          <button type="button" onClick={resetAllSets} className="flex items-center gap-1 text-accent hover:underline cursor-pointer shrink-0">
            <RotateCcw size={12} /> Tout remettre à "faite"
          </button>
        </div>
      )}
      {cycleCoaching?.trainingLoadHint === 'lighter_ok' && (
        <label className="flex items-center gap-2 text-xs text-mute mb-3 cursor-pointer border border-line rounded-lg px-3 py-2 bg-surface">
          <input type="checkbox" checked={lighterMode} onChange={(e) => setLighterMode(e.target.checked)} />
          Alléger la séance aujourd'hui (-1 série par exercice) — règle d'auto-régulation du programme, phase menstruelle
        </label>
      )}
      <div className="space-y-3">
        {exercises.map((ex) => (
          <div key={ex.name} className="bg-surface border border-line rounded-lg px-3 py-2">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={checked.has(ex.name)} onChange={() => toggle(ex.name)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{ex.name}</div>
                <div className="text-[11px] text-mute">{ex.setsReps}{ex.note ? ` · ${ex.note}` : ''}</div>
              </div>
              {effectiveSetsFor(ex).some((s) => s.done !== false) && (
                <button
                  type="button"
                  onClick={() => skipRestOfExercise(ex)}
                  className="text-[11px] text-mute hover:text-bad cursor-pointer shrink-0"
                  title="Marquer toutes les séries restantes de cet exercice comme non faites"
                >
                  Arrêté ici
                </button>
              )}
            </div>
            <div className="mt-2 pl-2 sm:pl-7 space-y-2">
              {effectiveSetsFor(ex).map((s, setIdx) => {
                const done = s.done !== false;
                return (
                  <div key={setIdx} className={`flex items-center gap-2 flex-wrap ${done ? '' : 'opacity-50'}`}>
                    {/* A dedicated small icon button, not the "Série N" text itself — that text used to be the
                        whole clickable toggle with no visual sign it was a button, which on mobile got tapped by
                        accident while scrolling and silently marked entire sessions as "ratée" (real incident). */}
                    <button
                      type="button"
                      onClick={() => updateSet(ex, setIdx, { done: !done })}
                      title={done ? 'Marquer cette série comme non faite' : 'Marquer cette série comme faite'}
                      className={`shrink-0 cursor-pointer ${done ? 'text-good' : 'text-bad'}`}
                    >
                      {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                    <span className="text-[10px] text-mute w-14 shrink-0">{done ? `Série ${setIdx + 1}` : 'Série ratée'}</span>
                    <Input type="number" className="!py-1 !text-xs w-14" placeholder="reps" value={s.reps ?? ''} disabled={!done} onChange={(e) => updateSet(ex, setIdx, { reps: e.target.value })} />
                    <Input
                      type="number" className="!py-1 !text-xs w-20"
                      placeholder={ex.bodyweightExercise ? 'poids ajouté' : 'poids (kg)'}
                      value={s.weight ?? ''} disabled={!done} onChange={(e) => updateSet(ex, setIdx, { weight: e.target.value })}
                    />
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <input type="range" min="1" max="10" value={s.rpe} disabled={!done} onChange={(e) => updateSet(ex, setIdx, { rpe: Number(e.target.value) })} className="w-full" />
                      <span className="text-[10px] text-mute w-11 shrink-0">RPE {s.rpe}</span>
                    </div>
                    <Select className="!py-1 !text-xs w-20" value={s.form} disabled={!done} onChange={(e) => updateSet(ex, setIdx, { form: e.target.value })} options={['Good', 'Fair', 'Poor']} />
                  </div>
                );
              })}
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
          {canSubmit ? 'Logger la séance' : !allChecked ? `Coche les ${exercises.length} exercices pour terminer` : 'Remplis reps et poids pour chaque série non décochée'}
        </span>
      </Button>
      <p className="text-[11px] text-mute mt-2">Champ "poids" vide sur une série au poids du corps = faite au poids du corps seul ; un nombre = poids ajouté en plus. Chaque série a son propre poids. Le rond à gauche de chaque série la marque non faite (séance arrêtée en cours, blessure, temps…), ou "Arrêté ici" pour toutes les séries restantes d'un exercice d'un coup — elles ne seront ni requises ni loggées.</p>
    </Card>
  );
}
