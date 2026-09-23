import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Search, Dumbbell, Zap, Plus, Minus, Check } from 'lucide-react';
import {
  EXERCISE_LIBRARY, MUSCLE_GROUPS, searchExercises,
  DRILL_LIBRARY, DRILL_CATEGORIES, DRILL_UNITS, searchDrills,
} from '../../../../utils/exercise-library';

/* ── colours ─────────────────────────────────────────── */
const MG_COLORS = {
  chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', biceps: '#a855f7',
  triceps: '#ec4899', forearms: '#6366f1', quads: '#22c55e', hamstrings: '#14b8a6',
  glutes: '#f97316', calves: '#64748b', core: '#06b6d4', full_body: '#8b5cf6',
  ladder: '#b366ff', sprint: '#ef4444', reactivity: '#f59e0b', plyo: '#22c55e', mobility: '#06b6d4', stretch: '#64748b',
};

// The picker/labels differ between strength work and agility/mobility drills.
const MODES = {
  strength: {
    groups: MUSCLE_GROUPS,
    search: (q, g) => searchExercises(q, g ? [g] : null),
    library: EXERCISE_LIBRARY,
    icon: Dumbbell,
    placeholder: 'Chercher un exercice (ex. bench, squat, overhead press)…',
  },
  drill: {
    groups: DRILL_CATEGORIES,
    search: (q, g) => searchDrills(q, g ? [g] : null),
    library: DRILL_LIBRARY,
    icon: Zap,
    placeholder: 'Chercher un exercice d’agilité / mobilité (ex. icky, sprint, CARs)…',
  },
};
const groupLabel = (mode, g) => MODES[mode].groups.find((m) => m.value === g)?.label || g;

/* ── Search with dropdown ────────────────────────────── */
function ExerciseSearch({ mode, value, exerciseKey, onChange }) {
  const cfg = MODES[mode];
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [filterGroup, setFilterGroup] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  useEffect(() => { setQuery(value || ''); }, [value]);

  const results = cfg.search(query, filterGroup).slice(0, 25);
  const trimmed = query.trim();
  const exactExists = results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());

  const pick = useCallback((ex) => { setQuery(ex.name); setOpen(false); onChange(ex.name, ex.id); }, [onChange]);
  const pickCustom = useCallback(() => { if (!trimmed) return; setOpen(false); onChange(trimmed, null); }, [trimmed, onChange]);

  const handleKey = (e) => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') { setHighlighted((h) => Math.min(h + 1, results.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlighted((h) => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter') { if (results[highlighted]) pick(results[highlighted]); else pickCustom(); e.preventDefault(); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={cfg.placeholder}
          className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-16 text-sm font-medium text-ink placeholder:text-mute placeholder:font-normal outline-none transition-colors focus:border-accent"
        />
        {exerciseKey && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-good">
            <Check size={10} /> suivi
          </span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-line bg-card shadow-2xl">
          <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-line bg-card p-2">
            {[{ value: null, label: 'Tous' }, ...cfg.groups].map((g) => {
              const active = filterGroup === g.value;
              const color = g.value ? MG_COLORS[g.value] || 'var(--accent-primary)' : 'var(--accent-primary)';
              return (
                <button
                  key={g.label}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setFilterGroup(active ? null : g.value); setHighlighted(0); }}
                  className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer"
                  style={active
                    ? { background: color, borderColor: color, color: '#0b0e14' }
                    : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {!results.length && !trimmed && <div className="p-4 text-center text-sm text-mute">Tapez pour chercher…</div>}

          {results.map((ex, i) => (
            <button
              key={ex.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(ex); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${i === highlighted ? 'bg-accent/10' : 'hover:bg-surface'}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MG_COLORS[ex.muscleGroup] || '#888' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{ex.name}</span>
                <span className="block truncate text-[11px] text-mute">
                  {groupLabel(mode, ex.muscleGroup)} · {ex.equipment}
                  {ex.unit ? ` · ${DRILL_UNITS[ex.unit]}` : ''}
                  {ex.secondaryMuscles?.length ? ` · + ${ex.secondaryMuscles.map((m) => groupLabel(mode, m)).join(', ')}` : ''}
                </span>
              </span>
            </button>
          ))}

          {trimmed && !exactExists && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pickCustom(); }}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface cursor-pointer"
            >
              <Plus size={15} className="shrink-0 text-accent" />
              <span>Ajouter <span className="font-semibold text-ink">« {trimmed} »</span> <span className="text-[11px] text-mute">(personnalisé)</span></span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Compact −/+ stepper ─────────────────────────────── */
function Stepper({ label, value, onChange, min = 0, max = 999, step = 1, width = 'w-12' }) {
  const n = Number(value) || 0;
  const set = (v) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-mute">{label}</span>
      <div className="inline-flex items-center rounded-lg border border-line bg-surface">
        <button type="button" onClick={() => set(n - step)} className="px-1.5 py-1.5 text-mute hover:text-ink cursor-pointer" aria-label={`${label} moins`}><Minus size={12} /></button>
        <input
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`${width} bg-transparent text-center text-sm font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <button type="button" onClick={() => set(n + step)} className="px-1.5 py-1.5 text-mute hover:text-ink cursor-pointer" aria-label={`${label} plus`}><Plus size={12} /></button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-mute">{label}</span>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-2.5 py-[7px] text-sm text-ink placeholder:text-mute outline-none focus:border-accent"
      />
    </label>
  );
}

/* ── Main row ────────────────────────────────────────── */
/**
 * One exercise (strength) or drill (agility/mobility) in the session builder.
 * Line 1: searchable name. Line 2: prescription (sets, reps, rest, RPE, tempo, notes).
 */
export default function ExerciseRow({ exercise, index, onChange, onRemove, mode = 'strength' }) {
  const update = (field, value) => onChange(index, { ...exercise, [field]: value });
  const handlePick = useCallback((name, key) => {
    onChange(index, { ...exercise, exercise_name: name, exercise_key: key });
  }, [exercise, index, onChange]);

  const lib = exercise.exercise_key ? MODES[mode].library.find((x) => x.id === exercise.exercise_key) : null;
  const isDrill = mode === 'drill';
  const repsLabel = isDrill ? (DRILL_UNITS[lib?.unit] || 'Qté') : 'Reps';

  const setReps = (field, v) => {
    const next = { ...exercise, [field]: v };
    const lo = Number(next.reps_min) || 0;
    const hi = Number(next.reps_max) || lo;
    next.reps_prefill = Math.round((lo + hi) / 2);
    onChange(index, next);
  };

  return (
    <div className="rounded-xl border border-line bg-card/60 p-3 transition-colors hover:border-accent/40">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-mute">{index + 1}</span>
        <ExerciseSearch mode={mode} value={exercise.exercise_name} exerciseKey={exercise.exercise_key} onChange={handlePick} />
        <button type="button" onClick={() => onRemove(index)} className="shrink-0 rounded-lg p-2 text-mute transition-colors hover:bg-bad/10 hover:text-bad cursor-pointer" aria-label="Supprimer">
          <Trash2 size={15} />
        </button>
      </div>

      {lib && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-9 text-[11px] text-mute">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: MG_COLORS[lib.muscleGroup] || '#888' }} />
          {groupLabel(mode, lib.muscleGroup)} · {lib.equipment}{lib.mechanic && !isDrill ? ` · ${lib.mechanic}` : ''}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3 pl-9">
        <Stepper label="Séries" value={exercise.sets_count} min={1} max={20} onChange={(v) => update('sets_count', v === '' ? '' : v)} width="w-8" />
        <div className="flex items-end gap-1.5">
          <Stepper label={`${repsLabel} min`} value={exercise.reps_min} min={0} max={600} onChange={(v) => setReps('reps_min', v)} width="w-10" />
          <span className="pb-2 text-mute">–</span>
          <Stepper label="max" value={exercise.reps_max} min={0} max={600} onChange={(v) => setReps('reps_max', v)} width="w-10" />
        </div>
        <Stepper label="Repos (s)" value={exercise.rest_seconds} min={0} max={600} step={15} onChange={(v) => update('rest_seconds', v)} width="w-10" />
        {!isDrill && (
          <>
            <Stepper label="RPE" value={exercise.target_rpe} min={1} max={10} step={0.5} onChange={(v) => update('target_rpe', v)} width="w-9" />
            <TextField label="Tempo" value={exercise.tempo} onChange={(v) => update('tempo', v)} placeholder="3-1-1-0" className="w-24" />
          </>
        )}
        <TextField label="Notes" value={exercise.notes} onChange={(v) => update('notes', v)} placeholder={isDrill ? 'ex: 5-10 m, changement de direction' : 'ex: superset, pause en bas'} className="min-w-[160px] flex-1" />
      </div>
    </div>
  );
}

/** Default values for a new row. Drills default to 3 × 3 passes, 60 s rest. */
ExerciseRow.blank = (order = 0, mode = 'strength') => (mode === 'drill'
  ? { exercise_order: order, exercise_name: '', exercise_key: null, sets_count: 3, reps_min: 3, reps_max: 3, reps_prefill: 3, rest_seconds: 60, target_rpe: null, tempo: '', notes: '' }
  : { exercise_order: order, exercise_name: '', exercise_key: null, sets_count: 3, reps_min: 8, reps_max: 12, reps_prefill: 10, rest_seconds: 90, target_rpe: 7.0, tempo: '', notes: '' });
