import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, GripVertical, Search, Dumbbell } from 'lucide-react';
import { Input } from '../../../../components/common/ui';
import { EXERCISE_LIBRARY, MUSCLE_GROUPS, searchExercises } from '../../../../utils/exercise-library';

/* ── colour by muscle group ───────────────────────────── */
const MG_COLORS = {
  chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', biceps: '#a855f7',
  triceps: '#ec4899', forearms: '#6366f1', quads: '#22c55e', hamstrings: '#14b8a6',
  glutes: '#f97316', calves: '#64748b', core: '#06b6d4', full_body: '#8b5cf6',
};
const mgLabel = (g) => MUSCLE_GROUPS.find((m) => m.value === g)?.label || g;

/* ── ExerciseSearch autocomplete ──────────────────────── */
function ExerciseSearch({ value, exerciseKey, onChange }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [filterGroup, setFilterGroup] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync external value
  useEffect(() => { setQuery(value || ''); }, [value]);

  const results = searchExercises(query, filterGroup ? [filterGroup] : null).slice(0, 20);

  const pick = useCallback((ex) => {
    setQuery(ex.name);
    setOpen(false);
    onChange(ex.name, ex.id);
  }, [onChange]);

  const handleKey = (e) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') { setHighlighted((h) => Math.min(h + 1, results.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlighted((h) => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && results[highlighted]) { pick(results[highlighted]); e.preventDefault(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Chercher un exercice…"
          className="w-full py-1.5 pl-7 pr-2 text-sm font-medium rounded-md border border-line bg-surface focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors"
        />
        {exerciseKey && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-good font-medium">✓ lié</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto bg-surface border border-line rounded-lg shadow-xl">
          {/* Muscle group filter chips */}
          <div className="sticky top-0 bg-surface border-b border-line p-1.5 flex flex-wrap gap-1">
            <button
              onClick={() => { setFilterGroup(null); setHighlighted(0); }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                !filterGroup ? 'bg-accent text-white' : 'bg-surface-alt text-mute hover:text-heading'
              }`}
            >Tous</button>
            {MUSCLE_GROUPS.map((mg) => (
              <button
                key={mg.value}
                onClick={() => { setFilterGroup(filterGroup === mg.value ? null : mg.value); setHighlighted(0); }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                  filterGroup === mg.value ? 'text-white' : 'text-mute hover:text-heading'
                }`}
                style={filterGroup === mg.value ? { backgroundColor: MG_COLORS[mg.value] || '#6366f1' } : { backgroundColor: 'var(--surface-alt, #f1f1f1)' }}
              >{mg.label}</button>
            ))}
          </div>

          {results.length === 0 ? (
            <div className="p-3 text-sm text-mute text-center">Aucun exercice trouvé</div>
          ) : (
            results.map((ex, i) => (
              <button
                key={ex.id}
                onMouseDown={() => pick(ex)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                  i === highlighted ? 'bg-accent/10' : 'hover:bg-surface-alt'
                }`}
              >
                <Dumbbell size={14} style={{ color: MG_COLORS[ex.muscleGroup] || '#888' }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ex.name}</div>
                  <div className="text-[10px] text-mute flex gap-2">
                    <span style={{ color: MG_COLORS[ex.muscleGroup] }}>{mgLabel(ex.muscleGroup)}</span>
                    <span>• {ex.equipment}</span>
                    <span>• {ex.mechanic}</span>
                    {ex.secondaryMuscles.length > 0 && (
                      <span className="opacity-70">+ {ex.secondaryMuscles.map(mgLabel).join(', ')}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main ExerciseRow ─────────────────────────────────── */
/**
 * A single exercise row in the session builder.
 * Exercise name is picked from EXERCISE_LIBRARY via autocomplete.
 * All numeric fields are pre-filled with sensible defaults and editable on click.
 */
export default function ExerciseRow({ exercise, index, onChange, onRemove }) {
  const update = (field, value) => onChange(index, { ...exercise, [field]: value });

  const handleExercisePick = useCallback((name, key) => {
    onChange(index, { ...exercise, exercise_name: name, exercise_key: key });
  }, [exercise, index, onChange]);

  // Find the library entry to show muscle group badge
  const libEntry = exercise.exercise_key
    ? EXERCISE_LIBRARY.find((ex) => ex.id === exercise.exercise_key)
    : null;

  return (
    <div className="flex items-start gap-2 group border border-line rounded-lg p-3 bg-surface hover:border-accent/40 transition-colors">
      <div className="text-mute pt-1 cursor-grab opacity-0 group-hover:opacity-60"><GripVertical size={14} /></div>

      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
        {/* Exercise name — col 1-4 */}
        <div className="col-span-4">
          <ExerciseSearch
            value={exercise.exercise_name}
            exerciseKey={exercise.exercise_key}
            onChange={handleExercisePick}
          />
          {libEntry && (
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: MG_COLORS[libEntry.muscleGroup] || '#888' }}
              />
              <span className="text-[10px] text-mute">{mgLabel(libEntry.muscleGroup)} • {libEntry.equipment}</span>
            </div>
          )}
        </div>

        {/* Sets — col 5 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Séries</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={exercise.sets_count}
            onChange={(e) => update('sets_count', parseInt(e.target.value) || 1)}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Reps min — col 6 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Reps min</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={exercise.reps_min}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 1;
              update('reps_min', v);
              const mid = Math.round((v + (exercise.reps_max || v)) / 2);
              onChange(index, { ...exercise, reps_min: v, reps_prefill: mid });
            }}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Reps max — col 7 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Reps max</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={exercise.reps_max}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 1;
              const mid = Math.round(((exercise.reps_min || v) + v) / 2);
              onChange(index, { ...exercise, reps_max: v, reps_prefill: mid });
            }}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Rest — col 8 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Repos (s)</label>
          <Input
            type="number"
            min={0}
            step={15}
            value={exercise.rest_seconds}
            onChange={(e) => update('rest_seconds', parseInt(e.target.value) || 0)}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* RPE — col 9 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">RPE</label>
          <Input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={exercise.target_rpe}
            onChange={(e) => update('target_rpe', parseFloat(e.target.value) || 7)}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Tempo — col 10 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Tempo</label>
          <Input
            value={exercise.tempo || ''}
            onChange={(e) => update('tempo', e.target.value)}
            placeholder="3-1-1-0"
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Notes — col 11-12 */}
        <div className="col-span-2">
          <label className="block text-[10px] text-mute mb-0.5">Notes</label>
          <Input
            value={exercise.notes || ''}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="ex: superset"
            className="!py-1 !px-2 !text-sm"
          />
        </div>
      </div>

      <button onClick={() => onRemove(index)} className="text-mute hover:text-bad p-1 pt-5 cursor-pointer shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** Default values for a new exercise row. */
ExerciseRow.blank = (order = 0) => ({
  exercise_order: order,
  exercise_name: '',
  exercise_key: null,
  sets_count: 3,
  reps_min: 8,
  reps_max: 12,
  reps_prefill: 10,
  rest_seconds: 90,
  target_rpe: 7.0,
  tempo: '',
  notes: '',
});
