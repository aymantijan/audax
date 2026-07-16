import { useState } from 'react';
import { Trash2, Target } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { Card, Button, Field, Input, Select, ProgressBar, Badge, EmptyState } from '../../components/common/ui';

const GOAL_TYPES = [
  { value: 'weight', label: 'Target weight' },
  { value: 'strength', label: 'Strength PR' },
  { value: 'sleep', label: 'Average sleep quality' },
];

const blankGoal = { type: 'weight', targetKg: '', exercise: '', targetScore: '' };

export default function Goals() {
  const { addGoal, deleteGoal, getGoalsWithProgress } = useHealthStore();
  const [form, setForm] = useState(blankGoal);
  const goals = getGoalsWithProgress();

  const submit = (e) => {
    e.preventDefault();
    addGoal(form);
    setForm(blankGoal);
  };

  return (
    <div className="space-y-6">
      <Card title="New Goal">
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={GOAL_TYPES} />
          </Field>
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
          <Button type="submit">Add goal</Button>
        </form>
      </Card>

      <Card title="Your Goals">
        {goals.length ? (
          <ul className="space-y-4">
            {goals.map((g) => (
              <li key={g.id} className="bg-surface border border-line rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Target size={14} className="text-accent" /> {g.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {g.achieved && <Badge color="var(--success)">Achieved</Badge>}
                    <button onClick={() => deleteGoal(g.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>
                <ProgressBar value={g.percent} color={g.percent >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                <div className="flex justify-between text-xs text-mute mt-1.5">
                  <span>{g.current != null ? `Current: ${g.current}` : 'No data yet'} · {g.percent}%</span>
                  {g.etaWeeks != null && <span>~{g.etaWeeks} week{g.etaWeeks !== 1 ? 's' : ''} to go at current rate</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No goals yet — set a target weight, a strength PR, or a sleep quality target above.</EmptyState>
        )}
      </Card>
    </div>
  );
}
