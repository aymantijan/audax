import { useState } from 'react';
import { Trash2, Target, Pencil } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { fmtDateShort } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, ProgressBar, Badge, EmptyState } from '../../components/common/ui';

const GOAL_TYPES = [
  { value: 'weight', label: 'Target weight' },
  { value: 'strength', label: 'Strength PR' },
  { value: 'sleep', label: 'Average sleep quality' },
  { value: 'bodyfat', label: 'Target body fat %' },
  { value: 'workoutFrequency', label: 'Workout frequency (per week)' },
];

const blankGoal = { type: 'weight', targetKg: '', exercise: '', targetScore: '', targetBodyFatPct: '', targetPerWeek: '', targetDate: '' };

// The editable target field(s) for a goal type — shared between the "New
// Goal" form and inline editing of an existing goal (same fields either way).
function TargetFields({ form, setForm }) {
  return (
    <>
      {form.type === 'weight' && (
        <Field label="Target weight (kg)">
          <Input type="number" step="0.1" value={form.targetKg} onChange={(e) => setForm({ ...form, targetKg: e.target.value })} required />
        </Field>
      )}
      {form.type === 'strength' && (
        <>
          <Field label="Exercise">
            <Input value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })} placeholder="e.g. Deadlift" required />
          </Field>
          <Field label="Target weight (kg)">
            <Input type="number" step="0.5" value={form.targetKg} onChange={(e) => setForm({ ...form, targetKg: e.target.value })} required />
          </Field>
        </>
      )}
      {form.type === 'sleep' && (
        <Field label="Target avg quality (/10)">
          <Input type="number" min="1" max="10" step="0.5" value={form.targetScore} onChange={(e) => setForm({ ...form, targetScore: e.target.value })} required />
        </Field>
      )}
      {form.type === 'bodyfat' && (
        <Field label="Target body fat (%)">
          <Input type="number" min="1" max="60" step="0.5" value={form.targetBodyFatPct} onChange={(e) => setForm({ ...form, targetBodyFatPct: e.target.value })} required />
        </Field>
      )}
      {form.type === 'workoutFrequency' && (
        <Field label="Workouts / week">
          <Input type="number" min="1" max="14" value={form.targetPerWeek} onChange={(e) => setForm({ ...form, targetPerWeek: e.target.value })} required />
        </Field>
      )}
      <Field label="Target date (optional)">
        <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
      </Field>
    </>
  );
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Goals() {
  const { addGoal, editGoal, deleteGoal, getGoalsWithProgress, bodyComp } = useHealthStore();
  const [form, setForm] = useState(blankGoal);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(blankGoal);
  const goals = getGoalsWithProgress();

  const currentWeight = [...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.weightKg;
  const GOAL_TEMPLATES = [
    currentWeight && { label: `Perdre 5kg en 12 sem.`, goal: { type: 'weight', targetKg: Math.round((currentWeight - 5) * 10) / 10, targetDate: addDays(84) } },
    { label: 'Développé couché 100kg', goal: { type: 'strength', exercise: 'Barbell Bench Press', targetKg: 100 } },
    { label: 'Sommeil moyen 8/10', goal: { type: 'sleep', targetScore: 8 } },
    { label: "S'entraîner 4x/semaine", goal: { type: 'workoutFrequency', targetPerWeek: 4 } },
  ].filter(Boolean);

  const submit = (e) => {
    e.preventDefault();
    addGoal(form);
    setForm(blankGoal);
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setEditForm({ ...blankGoal, ...g, targetDate: g.targetDate || '' });
  };

  const saveEdit = (e) => {
    e.preventDefault();
    editGoal(editingId, {
      targetKg: editForm.targetKg !== '' ? Number(editForm.targetKg) : undefined,
      exercise: editForm.exercise || undefined,
      targetScore: editForm.targetScore !== '' ? Number(editForm.targetScore) : undefined,
      targetBodyFatPct: editForm.targetBodyFatPct !== '' ? Number(editForm.targetBodyFatPct) : undefined,
      targetPerWeek: editForm.targetPerWeek !== '' ? Number(editForm.targetPerWeek) : undefined,
      targetDate: editForm.targetDate || undefined,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <Card title="New Goal">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {GOAL_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => addGoal(t.goal)}
              className="text-xs px-2.5 py-1.5 rounded-full border border-line text-mute hover:border-accent hover:text-accent cursor-pointer"
            >
              + {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...blankGoal, type: e.target.value })} options={GOAL_TYPES} />
          </Field>
          <TargetFields form={form} setForm={setForm} />
          <Button type="submit">Add goal</Button>
        </form>
      </Card>

      <Card title="Your Goals">
        {goals.length ? (
          <ul className="space-y-4">
            {goals.map((g) => (
              <li key={g.id} className="bg-surface border border-line rounded-lg p-4">
                {editingId === g.id ? (
                  <form onSubmit={saveEdit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                    <TargetFields form={editForm} setForm={setEditForm} />
                    <div className="flex gap-2">
                      <Button type="submit" className="!px-3 !py-1.5 text-xs">Save</Button>
                      <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Target size={14} className="text-accent" /> {g.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {g.achieved && <Badge color="var(--success)">Achieved</Badge>}
                        <button onClick={() => startEdit(g)} className="text-mute hover:text-accent cursor-pointer"><Pencil size={13} /></button>
                        <button onClick={() => deleteGoal(g.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <ProgressBar value={g.percent} color={g.percent >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                    <div className="flex justify-between text-xs text-mute mt-1.5">
                      <span>{g.current != null ? `Current: ${g.current}` : 'No data yet'} · {g.percent}%</span>
                      <span>
                        {g.etaWeeks != null && `~${g.etaWeeks} week${g.etaWeeks !== 1 ? 's' : ''} to go at current rate`}
                        {g.targetDate && `${g.etaWeeks != null ? ' · ' : ''}target ${fmtDateShort(g.targetDate)}`}
                      </span>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No goals yet — set a target weight, a strength PR, a sleep quality target, a body-fat %, or a weekly workout frequency above.</EmptyState>
        )}
      </Card>
    </div>
  );
}
