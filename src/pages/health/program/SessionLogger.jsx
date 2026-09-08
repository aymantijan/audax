import { useState, useMemo } from 'react';
import { Play, Save, X, Plus, Minus } from 'lucide-react';
import { Modal, Button, Field, Input, Select, Badge } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';

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
    return exercises.map((ex) => ({
      exercise_name: ex.exercise_name,
      exercise_key: ex.exercise_key,
      planned_sets: ex.sets_count,
      planned_reps: `${ex.reps_min}-${ex.reps_max}`,
      planned_rpe: ex.target_rpe,
      actual_sets: Array.from({ length: ex.sets_count }, () => ({
        reps: ex.reps_prefill || Math.round((ex.reps_min + ex.reps_max) / 2),
        weight_kg: '',
        rpe: ex.target_rpe || 7,
        rest_seconds: ex.rest_seconds || 90,
        form_rating: 'good',
      })),
    }));
  }, [exercises, logged]);

  const [exerciseRows, setExerciseRows] = useState(initialExercises);
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
        exercises_performed: exerciseRows,
        session_rpe: sessionRpe ? parseFloat(sessionRpe) : null,
        energy_level: energyLevel ? parseInt(energyLevel) : null,
        notes: notes || null,
        status,
      };

      if (isEdit) {
        await store.updateSessionLog(logged.id, date, payload);
      } else {
        await store.logSession(payload);
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

        {/* Exercises */}
        {exerciseRows.map((row, exIdx) => (
          <div key={exIdx} className="border border-line rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{row.exercise_name}</span>
              <span className="text-xs text-mute">
                Plan: {row.planned_sets}×{row.planned_reps} @ RPE {row.planned_rpe}
              </span>
            </div>

            {/* Sets table */}
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-1 text-[10px] text-mute font-semibold uppercase">
                <span>Set</span><span>Reps</span><span>Poids (kg)</span><span>RPE</span><span>Forme</span>
              </div>
              {row.actual_sets.map((s, setIdx) => (
                <div key={setIdx} className="grid grid-cols-5 gap-1 items-center">
                  <span className="text-xs text-mute text-center">{setIdx + 1}</span>
                  <input
                    type="number"
                    min={0}
                    value={s.reps}
                    onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                    className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink text-center w-full"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={s.weight_kg}
                    onChange={(e) => updateSet(exIdx, setIdx, 'weight_kg', parseFloat(e.target.value) || '')}
                    className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink text-center w-full"
                  />
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
