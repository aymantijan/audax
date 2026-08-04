import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, ListChecks, CalendarPlus, CalendarCheck, Clock, ArrowRight, Check } from 'lucide-react';
import { useDealsStore, suggestTaskAward } from '../store/dealsStore';
import { DEAL_TYPES, DEAL_ROLES, DEAL_STATUS, DEAL_STAGES, DEAL_STAGE_STATUS, SKILL_MAP } from '../utils/constants';
import { fmtMoney, fmtDateShort } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import SkillPicker from '../components/common/SkillPicker';
import EntityFormModal from '../components/common/EntityFormModal';
import ScheduleEventModal from '../components/common/ScheduleEventModal';

const STATUS_COLOR = { ongoing: 'var(--accent-primary)', completed: 'var(--success)', passed: 'var(--text-secondary)' };
const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };
const STAGE_STATUS_LABEL = { 'not-started': 'Not started', 'in-progress': 'In progress', blocked: 'Blocked', done: 'Done' };
const blankTask = () => ({ title: '', skillId: '', xpAmount: 8, stage: '' });

function StageStepper({ deal, onJump }) {
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {DEAL_STAGES.map((label, i) => {
        const state = i < deal.stageIndex ? 'done' : i === deal.stageIndex ? deal.stageStatus : 'pending';
        const color = i <= deal.stageIndex ? STAGE_STATUS_COLOR[state] || 'var(--text-secondary)' : 'var(--border)';
        return (
          <div key={label} className="flex items-center flex-1 min-w-[92px] last:flex-none last:min-w-0">
            <button type="button" onClick={() => onJump(i)} className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0" title={`Jump to ${label}`}>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-colors"
                style={{ borderColor: color, color: state === 'pending' ? 'var(--text-secondary)' : color, background: state === 'done' ? color : 'transparent' }}
              >
                {state === 'done' ? <Check size={13} color="var(--bg-primary)" /> : i + 1}
              </span>
              <span className="text-[11px] text-center w-20 leading-tight" style={{ color: i === deal.stageIndex ? 'var(--ink)' : 'var(--text-secondary)' }}>{label}</span>
            </button>
            {i < DEAL_STAGES.length - 1 && <div className="h-0.5 flex-1 mb-4" style={{ background: i < deal.stageIndex ? STAGE_STATUS_COLOR.done : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
}

const dealFields = [
  { name: 'name', label: 'Deal name', type: 'text' },
  { name: 'type', label: 'Type', type: 'select', options: DEAL_TYPES },
  { name: 'role', label: 'Your role', type: 'select', options: DEAL_ROLES },
  { name: 'status', label: 'Status', type: 'select', options: DEAL_STATUS },
  { name: 'size', label: 'Deal size', type: 'number', step: 'any', currency: '$' },
  { name: 'firm', label: 'Firm / sponsor', type: 'text' },
  { name: 'date', label: 'Date', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'text' },
];

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deals, editDeal, deleteDeal, setDealStage, addTask, updateTask, setTaskStatus, deleteTask, setTaskCalendarEvent } = useDealsStore();
  const [editDealModal, setEditDealModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(blankTask());
  const [touchedSkill, setTouchedSkill] = useState(false);
  const [schedulingTask, setSchedulingTask] = useState(null);

  const deal = deals.find((d) => d.id === id);
  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState>Deal not found. <Link to="/deals" className="text-accent">Back to PE / Deals</Link></EmptyState>
      </div>
    );
  }

  const tasks = deal.tasks || [];
  const done = tasks.filter((t) => t.status === 'done');
  const xpEarned = done.reduce((a, t) => a + t.xpAmount, 0);

  const openAddTask = () => {
    setEditingTask(null);
    setForm({ ...blankTask(), stage: DEAL_STAGES[deal.stageIndex] });
    setTouchedSkill(false);
    setTaskModal(true);
  };
  const openEditTask = (t) => {
    setEditingTask(t);
    setForm({ title: t.title, skillId: t.skillId, xpAmount: t.xpAmount, stage: t.stage || '' });
    setTouchedSkill(true);
    setTaskModal(true);
  };
  const onTitleChange = (title) => {
    setForm((f) => {
      if (touchedSkill) return { ...f, title };
      const suggestion = suggestTaskAward(deal, title);
      return { ...f, title, skillId: suggestion.skillId, xpAmount: f.skillId ? f.xpAmount : suggestion.xpAmount };
    });
  };

  const submitTask = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.skillId) return;
    if (editingTask) updateTask(deal.id, editingTask.id, form);
    else addTask(deal.id, form);
    setTaskModal(false);
  };

  const removeDeal = () => {
    if (!confirm(`Delete "${deal.name}"? Its tasks and their XP will be reversed.`)) return;
    deleteDeal(deal.id);
    navigate('/deals');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color="var(--accent-secondary)">{deal.type}</Badge>
            <span className="text-xs capitalize" style={{ color: STATUS_COLOR[deal.status] }}>{deal.status}</span>
            <Badge color={STAGE_STATUS_COLOR[deal.stageStatus]}>{DEAL_STAGES[deal.stageIndex]} · {STAGE_STATUS_LABEL[deal.stageStatus]}</Badge>
            {deal.firm && <span className="text-xs text-mute">· {deal.firm}</span>}
          </div>
          <h1 className="text-2xl font-bold">{deal.name}</h1>
          <p className="text-mute text-sm mt-1">{deal.role} · {fmtDateShort(deal.date)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditDealModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Edit</span></Button>
          <Button variant="danger" onClick={removeDeal}><span className="flex items-center gap-2"><Trash2 size={14} /> Delete</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Tasks" value={`${done.length}/${tasks.length}`} sub="completed" />
        <Stat label="Task XP earned" value={xpEarned} sub="from completed tasks" />
        <Stat label="Deal size" value={deal.size ? fmtMoney(deal.size) : '—'} />
        <Stat label="Status" value={deal.status} />
      </div>

      <Card title="Deal Stage">
        <StageStepper deal={deal} onJump={(i) => setDealStage(deal.id, { stageIndex: i })} />
        <div className="flex items-center flex-wrap gap-2 mt-4 pt-4 border-t border-line">
          <span className="text-xs text-mute mr-1">{DEAL_STAGES[deal.stageIndex]}:</span>
          {DEAL_STAGE_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDealStage(deal.id, { stageStatus: s })}
              className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${deal.stageStatus === s ? '' : 'border-line text-mute hover:text-ink'}`}
              style={deal.stageStatus === s ? { borderColor: STAGE_STATUS_COLOR[s], color: STAGE_STATUS_COLOR[s], background: `color-mix(in srgb, ${STAGE_STATUS_COLOR[s]} 12%, transparent)` } : undefined}
            >
              {STAGE_STATUS_LABEL[s]}
            </button>
          ))}
          {deal.stageStatus === 'done' && deal.stageIndex < DEAL_STAGES.length - 1 && (
            <Button className="ml-auto" onClick={() => setDealStage(deal.id, { stageIndex: deal.stageIndex + 1 })}>
              <span className="flex items-center gap-2">Next: {DEAL_STAGES[deal.stageIndex + 1]} <ArrowRight size={14} /></span>
            </Button>
          )}
        </div>
      </Card>

      {tasks.length > 0 && (
        <Card title="Progress">
          <ProgressBar value={done.length} max={tasks.length} color="var(--success)" />
        </Card>
      )}

      <Card
        title={`Tasks (${tasks.length})`}
        action={<Button onClick={openAddTask}><span className="flex items-center gap-2"><Plus size={16} /> Add Task</span></Button>}
      >
        {tasks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-3 w-8" />
                  <th className="py-2 pr-4">Task</th>
                  <th className="py-2 pr-4">Target skill</th>
                  <th className="py-2 pr-4 text-right">XP</th>
                  <th className="py-2 pr-3" />
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...tasks].sort((a, b) => b.createdAt - a.createdAt).map((t) => (
                  <tr key={t.id} className="border-b border-line/50 hover:bg-surface/50">
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={() => setTaskStatus(deal.id, t.id, t.status === 'done' ? 'todo' : 'done')}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className={t.status === 'done' ? 'line-through text-mute' : ''}>{t.title}</div>
                      {t.stage && <div className="text-[11px] text-mute mt-0.5">{t.stage}</div>}
                    </td>
                    <td className="py-2.5 pr-4"><Badge color="var(--accent-primary)">{SKILL_MAP[t.skillId]?.name || t.skillId}</Badge></td>
                    <td className="py-2.5 pr-4 text-right">{t.xpAmount}</td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        disabled={t.status === 'done'}
                        onClick={() => setTaskStatus(deal.id, t.id, t.status === 'in-progress' ? 'todo' : 'in-progress')}
                        title={t.status === 'in-progress' ? 'In progress — click to unmark' : 'Mark in progress'}
                        className={`cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${t.status === 'in-progress' ? '' : 'text-mute hover:text-ink'}`}
                        style={t.status === 'in-progress' ? { color: 'var(--warning)' } : undefined}
                      >
                        <Clock size={14} />
                      </button>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {t.googleEventLink ? (
                        <a href={t.googleEventLink} target="_blank" rel="noreferrer" className="text-good hover:text-accent mr-3" title="Open in Google Calendar">
                          <CalendarCheck size={14} />
                        </a>
                      ) : (
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setSchedulingTask(t)} title="Schedule in Google Calendar">
                          <CalendarPlus size={14} />
                        </button>
                      )}
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => openEditTask(t)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this task? Its XP (if completed) will be reversed.')) deleteTask(deal.id, t.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><ListChecks className="mx-auto mb-2 text-mute" size={26} />No tasks yet. Log what you're working on to start earning XP.</EmptyState>
        )}
      </Card>

      {deal.notes && (
        <Card title="Notes">
          <p className="text-sm text-mute whitespace-pre-wrap">{deal.notes}</p>
        </Card>
      )}

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={editingTask ? 'Edit task' : 'Add task'}>
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="Task">
            <Input value={form.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="e.g. Build LBO model, run DD calls…" autoFocus />
          </Field>
          <Field label="Target skill" hint="Auto-suggested from the deal type and task name — adjust if needed.">
            <SkillPicker value={form.skillId} onChange={(id) => { setForm((f) => ({ ...f, skillId: id })); setTouchedSkill(true); }} multi={false} />
          </Field>
          <Field label="XP on completion">
            <Input type="number" min="1" value={form.xpAmount} onChange={(e) => setForm((f) => ({ ...f, xpAmount: e.target.value }))} />
          </Field>
          <Field label="Stage" hint="Which part of the deal process this task belongs to.">
            <Select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} options={[{ value: '', label: 'Unassigned' }, ...DEAL_STAGES.map((s) => ({ value: s, label: s }))]} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setTaskModal(false)}>Cancel</Button>
            <Button type="submit">{editingTask ? 'Save changes' : 'Add task'}</Button>
          </div>
        </form>
      </Modal>

      <EntityFormModal
        open={editDealModal}
        onClose={() => setEditDealModal(false)}
        title="Edit deal"
        fields={dealFields}
        initial={deal}
        wide
        onSave={(values) => editDeal(deal.id, values)}
      />

      <ScheduleEventModal
        open={!!schedulingTask}
        onClose={() => setSchedulingTask(null)}
        title="Schedule this task"
        defaultSummary={schedulingTask ? `${schedulingTask.title} — ${deal.name}` : ''}
        description={deal.notes}
        onScheduled={({ eventId, htmlLink }) => setTaskCalendarEvent(deal.id, schedulingTask.id, { eventId, htmlLink })}
      />
    </div>
  );
}
