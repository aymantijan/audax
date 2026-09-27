import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, CalendarRange } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { HORIZONS, periodOf, periodLabel, objectiveProgress } from '../../utils/objectives';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Modal, ProgressBar, EmptyState, IconButton, playSeal } from '../common/ui';

const childOf = (h) => HORIZONS.find((x) => x.key === h)?.child;
const labelOf = (h) => HORIZONS.find((x) => x.key === h)?.label;

function ObjectiveForm({ initial, habits, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || '');
  const [habitIds, setHabitIds] = useState(initial.habitIds || []);
  const toggle = (id) => setHabitIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) { onSave({ title, habitIds }); onClose(); } }} className="space-y-4">
      <Field label="Objectif" hint={initial.horizon === 'week' ? 'Concret et faisable cette semaine.' : 'Ce que tu veux avoir accompli à la fin de la période.'}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder={initial.horizon === 'year' ? 'ex. Valider mon année avec mention' : initial.horizon === 'quarter' ? 'ex. 12 de moyenne au premier semestre' : 'ex. Finir les fiches de deux chapitres'} />
      </Field>
      {habits.length > 0 && (
        <Field label="Habitudes qui y contribuent" hint="Sans sous-objectif, la progression suit ces habitudes sur la période.">
          <div className="flex flex-wrap gap-2 pt-1">
            {habits.map((h) => (
              <button key={h.id} type="button" onClick={() => toggle(h.id)} aria-pressed={habitIds.includes(h.id)}
                className={`ui-btn rounded-full border px-3 py-1.5 text-xs cursor-pointer ${habitIds.includes(h.id) ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'}`}>
                {h.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}

function ObjectiveRow({ o, all, ctx, depth, onAdd, onEdit }) {
  const { editObjective, deleteObjective } = useHabitStore();
  const today = todayKey();
  const child = childOf(o.horizon);
  const childPeriod = child ? periodOf(child, today) : null;
  const children = all.filter((c) => c.parentId === o.id && (!childPeriod || c.period === childPeriod));
  const progress = objectiveProgress(o, all, ctx);
  const linked = ctx.habits.filter((h) => (o.habitIds || []).includes(h.id));
  return (
    <li className={depth ? 'ml-4 sm:ml-6 border-l border-line pl-3 sm:pl-4' : ''}>
      <div className="flex items-start gap-2.5 py-2">
        <button type="button" aria-label={o.done ? `Rouvrir ${o.title}` : `Marquer ${o.title} comme atteint`} aria-pressed={o.done}
          onClick={(e) => { if (!o.done) playSeal(e.currentTarget); editObjective(o.id, { done: !o.done }); }}
          className={`ui-icon-btn mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer ${o.done ? 'bg-good border-good text-on-accent' : 'border-line hover:border-accent'}`}>
          {o.done && <Check size={12} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-mute">{labelOf(o.horizon)}</span>
            <span className={`text-sm font-medium ${o.done ? 'line-through text-mute' : ''}`}>{o.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-32 sm:w-44"><ProgressBar value={progress} height={5} color={progress >= 100 ? 'var(--success)' : 'var(--accent-primary)'} /></div>
            <span className="font-data text-[11px] text-mute">{progress} %</span>
          </div>
          {linked.length > 0 && <div className="text-[11px] text-mute mt-1 truncate">Habitudes : {linked.map((h) => h.name).join(', ')}</div>}
        </div>
        <div className="flex items-center shrink-0">
          {child && <IconButton label={`Ajouter un objectif ${labelOf(child).toLowerCase()}`} onClick={() => onAdd({ horizon: child, period: childPeriod, parentId: o.id })}><Plus size={14} /></IconButton>}
          <IconButton label="Modifier" onClick={() => onEdit(o)}><Pencil size={13} /></IconButton>
          <IconButton label="Supprimer" tone="danger" onClick={() => { if (confirm(`Supprimer « ${o.title} »${children.length ? ' et ses sous-objectifs' : ''} ?`)) deleteObjective(o.id); }}><Trash2 size={13} /></IconButton>
        </div>
      </div>
      {children.length > 0 && (
        <ul>{children.map((c) => <ObjectiveRow key={c.id} o={c} all={all} ctx={ctx} depth={depth + 1} onAdd={onAdd} onEdit={onEdit} />)}</ul>
      )}
    </li>
  );
}

// "Mon plan": this year's objectives, this quarter's steps, this week's actions.
export default function YearPlan() {
  const today = todayKey();
  const { objectives = [], habits, logs, addObjective, editObjective } = useHabitStore();
  const [form, setForm] = useState(null); // { mode: 'add'|'edit', ... }
  const activeHabits = habits.filter((h) => !h.archived);
  const ctx = { habits: activeHabits, logs, today };
  const year = periodOf('year', today);
  const quarter = periodOf('quarter', today);
  const week = periodOf('week', today);
  const roots = objectives.filter((o) => (o.horizon === 'year' && o.period === year)
    || (o.horizon === 'quarter' && o.period === quarter && !objectives.some((p) => p.id === o.parentId))
    || (o.horizon === 'week' && o.period === week && !objectives.some((p) => p.id === o.parentId)));

  return (
    <Card
      title={<span className="flex items-center gap-2"><CalendarRange size={15} /> Mon plan · {year}</span>}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setForm({ mode: 'add', horizon: 'week', period: week })}>+ Cette semaine</Button>
          <Button className="!px-3 !py-1.5 text-xs" onClick={() => setForm({ mode: 'add', horizon: 'year', period: year })}>+ Objectif de l’année</Button>
        </div>
      }
    >
      <p className="text-xs text-mute mb-2">Un objectif pour l’année, découpé en étapes pour le {periodLabel(quarter)}, puis en actions pour la {periodLabel(week)}. Relie-les à tes habitudes : la progression se calcule toute seule.</p>
      {roots.length ? (
        <ul className="divide-y divide-line/50">
          {roots.map((o) => <ObjectiveRow key={o.id} o={o} all={objectives} ctx={ctx} depth={0} onAdd={(d) => setForm({ mode: 'add', ...d })} onEdit={(obj) => setForm({ mode: 'edit', ...obj })} />)}
        </ul>
      ) : (
        <EmptyState action={<Button onClick={() => setForm({ mode: 'add', horizon: 'year', period: year })}>Fixer mon objectif de l’année</Button>}>
          Pas encore de plan pour {year}.
        </EmptyState>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form ? `${form.mode === 'edit' ? 'Modifier' : 'Nouvel'} objectif · ${labelOf(form.horizon)?.toLowerCase()}` : ''}>
        {form && (
          <ObjectiveForm
            initial={form}
            habits={activeHabits}
            onClose={() => setForm(null)}
            onSave={(data) => (form.mode === 'edit' ? editObjective(form.id, data) : addObjective({ ...form, ...data }))}
          />
        )}
      </Modal>
    </Card>
  );
}
