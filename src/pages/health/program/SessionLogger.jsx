import { useState, useMemo } from 'react';
import { Play, Save, X, Plus, Minus } from 'lucide-react';
import { Modal, Button, Field, Input, Select, Badge } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { useHealthStore } from '../../../store/healthStore';
import { getCardioConfig, HR_ZONES, CARDIO_METRIC_LABELS } from '../../../utils/exercise-library';

// ── Progressive overload ──────────────────────────────────────────
// Last logged performance of an exercise (from healthStore, which every
// Programme strength log mirrors into), strictly before `beforeDate`.
function lastPerformance(exerciseName, beforeDate) {
  if (!exerciseName) return null;
  const key = exerciseName.trim().toLowerCase();
  let workouts = [];
  try { workouts = useHealthStore.getState().workouts || []; } catch { return null; }
  const past = workouts.filter((w) => w.type === 'strength' && (w.exercise || '').trim().toLowerCase() === key && w.date < beforeDate);
  if (!past.length) return null;
  const lastDate = past.reduce((m, w) => (w.date > m ? w.date : m), past[0].date);
  const sets = past.filter((w) => w.date === lastDate).flatMap((w) => w.sets || [])
    .map((st) => ({ reps: Number(st.reps) || 0, weight: Number(st.weight) || 0, rpe: Number(st.rpe) || null }))
    .filter((st) => st.reps || st.weight);
  return sets.length ? { date: lastDate, sets } : null;
}

// Double progression: all sets at the top of the rep range, at or under the
// target RPE → add load (+2.5 kg, +1 kg for light loads). Any set under the
// bottom of the range → keep the load. Otherwise → same load, chase reps.
function suggestLoad(last, plan) {
  if (!last) return null;
  const top = Math.max(0, ...last.sets.map((st) => st.weight));
  if (!top) return null;
  const working = last.sets.filter((st) => st.weight >= top * 0.9);
  const repsMax = Number(plan.reps_max) || null;
  const repsMin = Number(plan.reps_min) || null;
  const targetRpe = Number(plan.target_rpe) || null;
  const rpes = working.map((st) => st.rpe).filter(Boolean);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const allTop = repsMax && working.every((st) => st.reps >= repsMax);
  const rpeOk = !targetRpe || avgRpe == null || avgRpe <= targetRpe;
  if (allTop && rpeOk) {
    const inc = top >= 20 ? 2.5 : 1;
    return { weight: Math.round((top + inc) * 4) / 4, kind: 'up', reason: `Toutes les séries à ${repsMax} reps${avgRpe ? ` (RPE ${avgRpe.toFixed(1)})` : ''} → +${inc} kg` };
  }
  if (allTop && !rpeOk) {
    return { weight: top, kind: 'hold', reason: `Reps atteintes mais RPE ${avgRpe.toFixed(1)} > cible ${targetRpe} → garder ${top} kg` };
  }
  if (repsMin && working.some((st) => st.reps < repsMin)) {
    return { weight: top, kind: 'hold', reason: `Une série sous ${repsMin} reps → garder ${top} kg` };
  }
  return { weight: top, kind: 'reps', reason: `Même charge, vise ${repsMax || 'plus de'} reps sur chaque série` };
}

/**
 * Log a programme session — exercises come prefilled from the plan,
 * user taps to change reps/weight/RPE for each set.
 */
export default function SessionLogger({ event, date, onClose }) {
  const store = useProgramStore();
  const { session, planned_time, phase, logged } = event;
  const isEdit = !!logged;
  const exercises = store.getExercisesForSession(session.id);

  // Build initial exercise rows from plan (or from existing log)
  const initialExercises = useMemo(() => {
    // Cardio sessions store a cardio entry in exercises_performed, not strength
    // rows — the cardio block handles those, so keep the exercise list empty.
    if (session.type === 'cardio') return [];
    if (isEdit && logged.exercises_performed?.length) {
      return logged.exercises_performed.map((ep) => ({
        exercise_name: ep.exercise_name,
        exercise_key: ep.exercise_key,
        planned_sets: ep.planned_sets,
        planned_reps: ep.planned_reps,
        planned_rpe: ep.planned_rpe,
        actual_sets: ep.actual_sets || [],
      }));
    }
    // Prefill from plan
    return exercises.map((ex) => {
      const last = session.type === 'strength' ? lastPerformance(ex.exercise_name, date) : null;
      const suggestion = suggestLoad(last, ex);
      return {
        exercise_name: ex.exercise_name,
        exercise_key: ex.exercise_key,
        planned_sets: ex.sets_count,
        planned_reps: ex.reps_min === ex.reps_max ? `${ex.reps_min ?? ''}` : `${ex.reps_min}-${ex.reps_max}`,
        planned_rpe: ex.target_rpe,
        last,
        suggestion,
        actual_sets: Array.from({ length: ex.sets_count }, (_, k) => ({
          reps: ex.reps_prefill || Math.round(((ex.reps_min || 0) + (ex.reps_max || 0)) / 2),
          // Pre-filled with the suggested load (or last time's load)
          weight_kg: suggestion?.weight ?? (last?.sets[k]?.weight || ''),
          rpe: ex.target_rpe || 7,
          rest_seconds: ex.rest_seconds || 90,
          form_rating: 'good',
        })),
      };
    });
  }, [exercises, logged]);

  const [exerciseRows, setExerciseRows] = useState(initialExercises);

  // ── Cardio logging ──────────────────────────────────────────────
  const isCardio = session.type === 'cardio';
  const isDrill = session.type === 'agility' || session.type === 'mobility';
  const parsedCardio = useMemo(() => getCardioConfig(session), [session]);
  const cardioModality = parsedCardio.modality;
  // Metric keys captured for this modality (duration handled by the top field)
  const cardioMetricKeys = (cardioModality?.metrics || ['distance', 'avgHr', 'zone']).filter((m) => m !== 'duration');
  const [cardioMetrics, setCardioMetrics] = useState(() => {
    const logCardio = isEdit ? logged?.exercises_performed?.find?.((e) => e.is_cardio) : null;
    if (logCardio?.metrics) return logCardio.metrics;
    const init = {};
    for (const k of cardioMetricKeys) init[k] = k === 'zone' ? (parsedCardio.zone || 2) : '';
    return init;
  });
  const setCardioMetric = (key, value) => setCardioMetrics((prev) => ({ ...prev, [key]: value }));

  const [sessionRpe, setSessionRpe] = useState(logged?.session_rpe || '');
  const [energyLevel, setEnergyLevel] = useState(logged?.energy_level || 7);
  const [notes, setNotes] = useState(logged?.notes || '');
  const [startTime, setStartTime] = useState(
    logged?.actual_start
      ? new Date(logged.actual_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : planned_time || ''
  );
  const [durationMin, setDurationMin] = useState(logged?.duration_min || session.estimated_duration_min || '');
  const [status, setStatus] = useState(logged?.status || 'completed');
  const [saving, setSaving] = useState(false);

  // Update a specific set in a specific exercise row
  const updateSet = (exIdx, setIdx, field, value) => {
    setExerciseRows((prev) => prev.map((row, i) => {
      if (i !== exIdx) return row;
      return {
        ...row,
        actual_sets: row.actual_sets.map((s, j) =>
          j !== setIdx ? s : { ...s, [field]: value }
        ),
      };
    }));
  };

  // Add/remove set from an exercise
  const addSet = (exIdx) => {
    setExerciseRows((prev) => prev.map((row, i) => {
      if (i !== exIdx) return row;
      const last = row.actual_sets[row.actual_sets.length - 1];
      return { ...row, actual_sets: [...row.actual_sets, { ...last }] };
    }));
  };

  const removeSet = (exIdx) => {
    setExerciseRows((prev) => prev.map((row, i) => {
      if (i !== exIdx || row.actual_sets.length <= 1) return row;
      return { ...row, actual_sets: row.actual_sets.slice(0, -1) };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const actualStart = startTime
        ? new Date(`${date}T${startTime.padEnd(5, ':00')}`).toISOString()
        : null;
      const actualEnd = actualStart && durationMin
        ? new Date(new Date(actualStart).getTime() + durationMin * 60000).toISOString()
        : null;

      const payload = {
        program_id: store.activeProgram.id,
        phase_id: phase.id,
        session_id: session.id,
        planned_date: date,
        actual_date: date,
        planned_time: planned_time || null,
        actual_start: actualStart,
        actual_end: actualEnd,
        duration_min: durationMin ? parseInt(durationMin) : null,
        location_id: event.location_id || null,
        exercises_performed: isCardio
          ? [{
              is_cardio: true,
              modality_id: cardioModality?.id || null,
              modality_name: cardioModality?.name || session.label,
              metrics: { ...cardioMetrics, duration: durationMin ? parseInt(durationMin) : null },
            }]
          : exerciseRows.map(({ last, suggestion, ...r }) => r), // helper fields stay client-side
        session_rpe: sessionRpe ? parseFloat(sessionRpe) : null,
        energy_level: energyLevel ? parseInt(energyLevel) : null,
        notes: notes || null,
        status,
      };

      let savedLog;
      if (isEdit) {
        savedLog = await store.updateSessionLog(logged.id, date, payload);
      } else {
        savedLog = await store.logSession(payload);
      }

      // ── Mirror into healthStore — unified tracking (PRs, 1RM, volume,
      // cardio history) keyed on the program session-log id, so a Programme
      // session shows up everywhere a manually-logged workout would, and the
      // exercise_key/name feeds the same evolution curves. Idempotent: a
      // re-log reconciles the same sessionId instead of duplicating.
      try {
        const health = useHealthStore.getState();
        const logId = savedLog?.id || logged?.id;
        if (logId && status !== 'skipped') {
          const isDrillSession = session.type === 'agility' || session.type === 'mobility';
          const hasStrength = session.type === 'strength' && exerciseRows.some(
            (r) => r.exercise_name && (r.actual_sets || []).some((s) => s.reps || s.weight_kg)
          );
          if (isDrillSession) {
            // Agility / mobility: one 'sport' entry (duration) — never mixed into
            // strength PRs / 1RM / volume, which drills would otherwise pollute.
            if (isEdit) health.deleteSession(logId);
            health.logWorkout({
              sessionId: logId,
              date,
              type: 'sport',
              category: session.type,
              sessionType: session.label,
              exercise: session.label,
              durationMin: durationMin ? parseInt(durationMin) : 0,
              avgRpe: sessionRpe ? parseFloat(sessionRpe) : null,
              notes: [notes, exerciseRows.filter((r) => r.exercise_name).map((r) => `${r.exercise_name} ${(r.actual_sets || []).length}×${r.actual_sets?.[0]?.reps ?? ''}`).join(' · ')].filter(Boolean).join(' — '),
            });
          } else if (hasStrength) {
            const mirror = {
              sessionId: logId,
              date,
              sessionType: session.label,
              notes: notes || '',
              exercises: exerciseRows.map((r) => ({
                exercise: r.exercise_name,
                sets: (r.actual_sets || []).map((s) => ({
                  reps: s.reps,
                  weight: s.weight_kg,
                  rpe: s.rpe,
                })),
              })),
            };
            if (isEdit) health.editGymSession(logId, mirror);
            else health.logGymSession(mirror);
          } else if (isCardio) {
            // Cardio entry with full metric set — feeds the cardio trend.
            if (isEdit) health.deleteSession(logId);
            health.logWorkout({
              sessionId: logId,
              date,
              type: 'cardio',
              category: 'cardio',
              sessionType: session.label,
              exercise: cardioModality?.name || session.label,
              durationMin: durationMin ? parseInt(durationMin) : 0,
              avgRpe: sessionRpe ? parseFloat(sessionRpe) : null,
              notes: notes || '',
              cardio: {
                modalityId: cardioModality?.id || null,
                modalityName: cardioModality?.name || session.label,
                ...cardioMetrics,
              },
            });
          }
        }
        // New performance → goals linked to KPIs may have moved / been reached
        store.syncGoals();
      } catch (mirrorErr) {
        console.error('healthStore mirror failed:', mirrorErr);
      }

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`${isEdit ? 'Modifier' : 'Logger'} — ${session.label}`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Timing */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Heure de début">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Durée (min)">
            <Input type="number" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </Field>
          <Field label="Statut">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="completed">✅ Complété</option>
              <option value="partial">⚠️ Partiel</option>
              <option value="skipped">⏭️ Passé</option>
            </Select>
          </Field>
        </div>

        {/* Cardio metrics — for cardio sessions */}
        {isCardio && (
          <div className="border border-line rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                🫀 {cardioModality?.name || session.label}
              </span>
              {parsedCardio.zone && (
                <Badge color="var(--success)">Cible : Zone {parsedCardio.zone}</Badge>
              )}
            </div>
            {cardioModality?.note && (
              <p className="text-[11px] text-mute">💡 {cardioModality.note}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              {cardioMetricKeys.map((key) => (
                <Field key={key} label={CARDIO_METRIC_LABELS[key] || key}>
                  {key === 'zone' ? (
                    <Select
                      value={String(cardioMetrics[key] ?? parsedCardio.zone ?? 2)}
                      onChange={(e) => setCardioMetric(key, parseInt(e.target.value))}
                    >
                      {HR_ZONES.map((z) => (
                        <option key={z.value} value={z.value}>Zone {z.value}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step={key === 'distance' || key === 'pace' ? 0.01 : 1}
                      value={cardioMetrics[key] ?? ''}
                      onChange={(e) => setCardioMetric(key, e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="—"
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}

        {/* Exercises */}
        {exerciseRows.map((row, exIdx) => (
          <div key={exIdx} className="rounded-xl border border-line bg-surface/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{row.exercise_name}</span>
              <span className="text-xs text-mute">
                Plan : {row.planned_sets}×{row.planned_reps}{row.planned_rpe ? ` @ RPE ${row.planned_rpe}` : ''}
              </span>
            </div>
            {(row.last || row.suggestion) && (
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                {row.last && (
                  <span className="rounded-md bg-card px-2 py-1 text-mute">
                    Dernière fois ({new Date(row.last.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}) :{' '}
                    <span className="text-ink">{row.last.sets.map((st) => `${st.reps}×${st.weight}`).join(' · ')} kg</span>
                  </span>
                )}
                {row.suggestion && (
                  <button
                    type="button"
                    onClick={() => setExerciseRows((prev) => prev.map((r, i) => (i !== exIdx ? r : { ...r, actual_sets: r.actual_sets.map((st) => ({ ...st, weight_kg: row.suggestion.weight })) })))}
                    className={`rounded-md px-2 py-1 font-medium cursor-pointer ${row.suggestion.kind === 'up' ? 'bg-good/15 text-good' : 'bg-accent/10 text-accent'}`}
                    title="Appliquer cette charge à toutes les séries"
                  >
                    {row.suggestion.kind === 'up' ? '↑ ' : ''}{row.suggestion.weight} kg — {row.suggestion.reason}
                  </button>
                )}
              </div>
            )}

            {/* Sets table */}
            <div className="space-y-1">
              <div className={`grid ${isDrill ? 'grid-cols-4' : 'grid-cols-5'} gap-1 text-[10px] text-mute font-semibold uppercase`}>
                <span>Set</span><span>{isDrill ? 'Qté' : 'Reps'}</span>{!isDrill && <span>Poids (kg)</span>}<span>RPE</span><span>Forme</span>
              </div>
              {row.actual_sets.map((s, setIdx) => (
                <div key={setIdx} className={`grid ${isDrill ? 'grid-cols-4' : 'grid-cols-5'} gap-1 items-center`}>
                  <span className="text-xs text-mute text-center">{setIdx + 1}</span>
                  <input
                    type="number"
                    min={0}
                    value={s.reps}
                    onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                    className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink text-center w-full"
                  />
{!isDrill && (<input
                    type="number"
                    min={0}
                    step={0.5}
                    value={s.weight_kg}
                    onChange={(e) => updateSet(exIdx, setIdx, 'weight_kg', parseFloat(e.target.value) || '')}
                    className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink text-center w-full"
                  />)}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={s.rpe}
                    onChange={(e) => updateSet(exIdx, setIdx, 'rpe', parseFloat(e.target.value) || 7)}
                    className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink text-center w-full"
                  />
                  <select
                    value={s.form_rating}
                    onChange={(e) => updateSet(exIdx, setIdx, 'form_rating', e.target.value)}
                    className="bg-surface border border-line rounded px-1 py-1 text-xs text-ink w-full"
                  >
                    <option value="good">👍</option>
                    <option value="ok">👌</option>
                    <option value="poor">👎</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-1 mt-2">
              <button onClick={() => addSet(exIdx)} className="text-[10px] text-accent flex items-center gap-0.5 cursor-pointer">
                <Plus size={10} /> Série
              </button>
              {row.actual_sets.length > 1 && (
                <button onClick={() => removeSet(exIdx)} className="text-[10px] text-mute flex items-center gap-0.5 cursor-pointer ml-2">
                  <Minus size={10} /> Retirer
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Session summary */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="RPE global">
            <Input type="number" min={1} max={10} step={0.5} value={sessionRpe} onChange={(e) => setSessionRpe(e.target.value)} placeholder="7.0" />
          </Field>
          <Field label="Niveau d'énergie (1-10)">
            <Input type="number" min={1} max={10} value={energyLevel} onChange={(e) => setEnergyLevel(e.target.value)} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-surface border border-line rounded-lg p-2 text-sm text-ink resize-none"
            rows={2}
            placeholder="Sensations, ajustements…"
          />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-line">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving}>
          <span className="flex items-center gap-1">
            <Save size={14} /> {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Enregistrer'}
          </span>
        </Button>
      </div>
    </Modal>
  );
}
