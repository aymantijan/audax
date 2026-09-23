/**
 * GoalsBoard — THE goals UI of the app (unified system, healthStore).
 * Used in Santé > Progrès (all goals) and in Programme (goals linked to that
 * program, new ones linked to it + optional phase; reaching them awards the
 * program trophy).
 */
import { useMemo, useState } from 'react';
import { Target, Plus, Pencil, Trash2, Trophy, ChevronDown, ChevronRight, ArrowUp, ArrowDown, CalendarClock, BookOpen, X, Check } from 'lucide-react';
import { Button, Input, Select, Field, Badge, EmptyState } from '../../../components/common/ui';
import { useHealthStore } from '../../../store/healthStore';
import { useHabitStore } from '../../../store/habitStore';
import { GOAL_METRICS, METRIC_CATEGORIES, metricInfo, buildMetricSource, evaluateMetric } from '../../../utils/metric-engine';
import { EXERCISE_LIBRARY } from '../../../utils/exercise-library';

const PRIORITIES = [
  { value: 'low', label: 'Basse', color: 'var(--text-secondary)' },
  { value: 'medium', label: 'Moyenne', color: 'var(--accent-primary)' },
  { value: 'high', label: 'Haute', color: 'var(--warning)' },
  { value: 'critical', label: 'Critique', color: 'var(--error)' },
];
const prio = (v) => PRIORITIES.find((p) => p.value === v) || PRIORITIES[1];
const fmt = (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString());
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (s) => (s ? new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function Sparkline({ series, color }) {
  const pts = series.slice(-30);
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals); const max = Math.max(...vals); const span = max - min || 1;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${26 - ((p.value - min) / span) * 22 - 2}`).join(' ');
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="h-7 w-full">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const blank = { metricKey: 'body_weight', exercise: '', target: '', direction: '', targetDate: '', priority: 'medium', title: '', phaseId: '' };

function GoalForm({ initial = blank, programId, phases, onSubmit, onCancel, submitLabel, lockMetric = false }) {
  const [f, setF] = useState(initial);
  const health = useHealthStore();
  const habit = useHabitStore();
  const def = metricInfo(f.metricKey) || {};
  const needsExercise = !!def.exercise;

  const exerciseNames = useMemo(() => {
    const logged = (health.workouts || []).filter((w) => w.type === 'strength' && w.exercise).map((w) => w.exercise);
    return [...new Set([...logged, ...EXERCISE_LIBRARY.map((e) => e.name)])];
  }, [health.workouts]);

  // Live "current value" so the user sets a realistic target
  const current = useMemo(() => {
    if (f.metricKey === 'manual' || (needsExercise && !f.exercise.trim())) return null;
    const src = buildMetricSource(health, habit);
    return evaluateMetric({ key: f.metricKey, exercise: f.exercise.trim() || undefined }, src).current;
  }, [f.metricKey, f.exercise, health, habit, needsExercise]);

  const autoDir = f.target !== '' && current != null && Number(f.target) !== current
    ? (Number(f.target) < current ? 'lower' : 'higher')
    : def.dir || 'higher';
  const dir = f.direction || autoDir;
  const valid = f.target !== '' && (!needsExercise || f.exercise.trim()) && (f.metricKey !== 'manual' || f.title.trim());

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      metric: { key: f.metricKey, ...(needsExercise ? { exercise: f.exercise.trim() } : {}) },
      target: Number(f.target),
      direction: f.direction || null,
      targetDate: f.targetDate || null,
      priority: f.priority,
      title: f.title.trim() || null,
      programId: programId || null,
      phaseId: f.phaseId || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ce que tu veux améliorer">
          <select
            value={f.metricKey}
            disabled={lockMetric}
            onChange={(e) => setF({ ...f, metricKey: e.target.value, exercise: '', direction: '' })}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
          >
            {METRIC_CATEGORIES.map((c) => (
              <optgroup key={c.key} label={c.label}>
                {GOAL_METRICS.filter((m) => m.category === c.key).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </optgroup>
            ))}
            {!metricInfo(f.metricKey) || GOAL_METRICS.some((m) => m.key === f.metricKey) ? null : <option value={f.metricKey}>{def.label}</option>}
          </select>
        </Field>
        {needsExercise ? (
          <Field label="Exercice">
            <Input list="goal-exercises" value={f.exercise} onChange={(e) => setF({ ...f, exercise: e.target.value })} placeholder="ex. Barbell Bench Press" disabled={lockMetric} />
            <datalist id="goal-exercises">{exerciseNames.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
        ) : (
          <Field label={f.metricKey === 'manual' ? 'Nom de la mesure' : 'Titre (facultatif)'}>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.metricKey === 'manual' ? 'ex. Tractions strictes' : 'ex. Passer sous 78 kg'} />
          </Field>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={`Cible${def.unit ? ` (${def.unit})` : ''}`} hint={current != null ? `Actuel : ${fmt(current)} ${def.unit || ''}` : (f.metricKey === 'manual' ? 'Tu saisiras les valeurs toi-même' : 'Pas encore de données')}>
          <Input type="number" step="any" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} required />
        </Field>
        <Field label="Sens" hint={!f.direction ? 'Automatique' : undefined}>
          <Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}
            options={[{ value: '', label: dir === 'lower' ? 'Auto (↓ baisser)' : 'Auto (↑ augmenter)' }, { value: 'higher', label: '↑ Augmenter' }, { value: 'lower', label: '↓ Baisser' }]} />
        </Field>
        <Field label="Date cible (facultatif)">
          <Input type="date" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} />
        </Field>
        <Field label="Priorité">
          <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
        </Field>
      </div>

      {needsExercise && (
        <Field label="Titre (facultatif)">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="ex. Bench à 100 kg" />
        </Field>
      )}
      {programId && phases?.length > 0 && (
        <Field label="Phase (facultatif)">
          <Select value={f.phaseId} onChange={(e) => setF({ ...f, phaseId: e.target.value })}
            options={[{ value: '', label: '— Tout le programme —' }, ...phases.map((p) => ({ value: p.id, label: `Phase ${p.phase_order} — ${p.name}` }))]} />
        </Field>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>}
        <Button type="submit" disabled={!valid}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function GoalCard({ g, phases, onEdit, onDelete, onLog, showProgram }) {
  const [val, setVal] = useState('');
  const color = g.reached ? 'var(--success)' : g.percent >= 50 ? 'var(--accent-primary)' : 'var(--warning)';
  const overdue = g.targetDate && !g.reached && g.targetDate < todayStr();
  const phase = phases?.find((p) => p.id === g.phaseId);
  const p = prio(g.priority);

  return (
    <li className="rounded-xl border border-line bg-surface/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{g.title || g.what}</span>
            <Badge color={p.color}>{p.label}</Badge>
            {showProgram && g.programId && <Badge color="var(--accent-secondary)"><BookOpen size={10} className="mr-0.5 inline" />Programme</Badge>}
            {phase && <Badge color="var(--accent-secondary)">{phase.name}</Badge>}
          </div>
          {g.title && <div className="mt-0.5 text-xs text-mute">{g.what}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEdit} className="rounded-md p-1.5 text-mute hover:bg-card hover:text-accent cursor-pointer" title="Modifier"><Pencil size={14} /></button>
          <button onClick={onDelete} className="rounded-md p-1.5 text-mute hover:bg-card hover:text-bad cursor-pointer" title="Supprimer"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-sm">
          <span className="text-2xl font-bold text-ink">{fmt(g.current)}</span>
          <span className="text-mute"> {g.unit} </span>
          <span className="text-mute">{g.direction === 'lower' ? <ArrowDown size={13} className="inline" /> : <ArrowUp size={13} className="inline" />} {fmt(g.target)} {g.unit}</span>
        </div>
        <span className="text-sm font-semibold" style={{ color }}>{fmt(g.percent)} %</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full transition-all" style={{ width: `${g.percent}%`, background: color }} />
      </div>
      <Sparkline series={g.series} color={color} />

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
        <span>
          {[
            g.current == null && 'Pas encore de données',
            g.etaWeeks != null && `≈ ${g.etaWeeks} semaine${g.etaWeeks > 1 ? 's' : ''} au rythme actuel`,
            g.start != null && g.current != null && `départ ${fmt(g.start)} ${g.unit || ''}`.trim(),
          ].filter(Boolean).join(' · ')}
        </span>
        {g.targetDate && (
          <span className={`flex items-center gap-1 ${overdue ? 'text-bad' : ''}`}>
            <CalendarClock size={12} /> {overdue ? 'Échéance dépassée : ' : 'Échéance : '}{fmtDate(g.targetDate)}
          </span>
        )}
      </div>

      {g.metric?.key === 'manual' && (
        <div className="mt-3 flex items-center gap-2">
          <Input type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} placeholder={`Valeur du jour${g.unit ? ` (${g.unit})` : ''}`} />
          <Button className="shrink-0 !px-3" disabled={val === ''} onClick={() => { onLog(Number(val)); setVal(''); }}>
            <span className="flex items-center gap-1"><Plus size={13} /> Noter</span>
          </Button>
        </div>
      )}
    </li>
  );
}

export default function GoalsBoard({ programId = null, phases = [] }) {
  const { addGoal, editGoal, deleteGoal, logGoalValue, getGoalsWithProgress, bodyComp } = useHealthStore();
  useHabitStore((s) => s.energyLogs); // re-render on new check-ins (sleep/energy goals)
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAchieved, setShowAchieved] = useState(false);

  // Recomputed every render: goals are few, and any new log (workout, weigh-in,
  // meal, check-in) must move them immediately.
  const all = getGoalsWithProgress();
  const goals = programId ? all.filter((g) => g.programId === programId) : all;
  const active = goals.filter((g) => !g.achieved);
  const achieved = goals.filter((g) => g.achieved);

  const weight = [...(bodyComp || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.weightKg;
  const templates = [
    weight && { label: 'Perdre 5 kg en 12 sem.', goal: { metric: { key: 'body_weight' }, target: Math.round((weight - 5) * 10) / 10, targetDate: addDays(84) } },
    { label: 'Bench 100 kg', goal: { metric: { key: 'max_weight_lifted', exercise: 'Barbell Bench Press' }, target: 100, title: 'Bench à 100 kg' } },
    { label: 'Sommeil 8/10', goal: { metric: { key: 'sleep_quality' }, target: 8 } },
    { label: '5 séances / semaine', goal: { metric: { key: 'workout_frequency' }, target: 5 } },
    { label: '150 g de protéines / jour', goal: { metric: { key: 'daily_protein' }, target: 150 } },
  ].filter(Boolean);

  const editing = editingId ? goals.find((g) => g.id === editingId) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink"><Target size={16} className="text-accent" /> Objectifs</h3>
            <p className="mt-0.5 text-xs text-mute">
              {programId ? 'Objectifs de ce programme — un objectif atteint débloque un trophée.' : 'Tous tes objectifs, mesurés automatiquement à partir de ce que tu enregistres.'}
            </p>
          </div>
          {!creating && <Button onClick={() => setCreating(true)}><span className="flex items-center gap-1.5"><Plus size={14} /> Nouvel objectif</span></Button>}
        </div>

        {creating && (
          <div className="mt-4 border-t border-line pt-4">
            {!programId && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <button key={t.label} type="button" onClick={() => { addGoal(t.goal); setCreating(false); }}
                    className="rounded-full border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-accent hover:text-accent cursor-pointer">
                    + {t.label}
                  </button>
                ))}
              </div>
            )}
            <GoalForm programId={programId} phases={phases} submitLabel="Ajouter l’objectif"
              onSubmit={(data) => { addGoal(data); setCreating(false); }} onCancel={() => setCreating(false)} />
          </div>
        )}
      </div>

      {editing && (
        <div className="rounded-2xl border border-accent/40 bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">Modifier l’objectif</h4>
            <button onClick={() => setEditingId(null)} className="text-mute hover:text-ink cursor-pointer"><X size={16} /></button>
          </div>
          <GoalForm
            lockMetric
            programId={editing.programId}
            phases={phases}
            submitLabel={<span className="flex items-center gap-1"><Check size={14} /> Enregistrer</span>}
            initial={{ metricKey: editing.metric.key, exercise: editing.metric.exercise || '', target: editing.target ?? '', direction: editing.direction || '', targetDate: editing.targetDate || '', priority: editing.priority || 'medium', title: editing.title || '', phaseId: editing.phaseId || '' }}
            onSubmit={(d) => { editGoal(editing.id, { target: d.target, direction: d.direction, targetDate: d.targetDate, priority: d.priority, title: d.title, phaseId: d.phaseId }); setEditingId(null); }}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {active.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((g) => (
            <GoalCard key={g.id} g={g} phases={phases} showProgram={!programId}
              onEdit={() => setEditingId(g.id)} onDelete={() => deleteGoal(g.id)} onLog={(v) => logGoalValue(g.id, v)} />
          ))}
        </ul>
      ) : (
        !creating && <div className="rounded-2xl border border-dashed border-line"><EmptyState>Aucun objectif en cours. Crée-en un : poids, 1RM sur un exercice, sommeil, protéines, séances par semaine…</EmptyState></div>
      )}

      {achieved.length > 0 && (
        <div>
          <button onClick={() => setShowAchieved(!showAchieved)} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink cursor-pointer">
            {showAchieved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Trophy size={14} className="text-good" /> Atteints ({achieved.length})
          </button>
          {showAchieved && (
            <ul className="mt-2 space-y-1.5">
              {achieved.map((g) => (
                <li key={g.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <Check size={14} className="text-good" />
                  <span className="flex-1 text-ink">{g.label}</span>
                  <span className="text-xs text-mute">{g.achievedAt ? new Date(g.achievedAt).toLocaleDateString('fr-FR') : ''}</span>
                  <button onClick={() => deleteGoal(g.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
