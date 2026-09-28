import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, ListChecks, CalendarPlus, CalendarCheck, Clock, ArrowRight, Check } from 'lucide-react';
import { useDealsStore, suggestTaskAward } from '../store/dealsStore';
import { computeDealReturns, blankDealModel } from '../utils/deal-valuation';
import { DEAL_TYPES, DEAL_ROLES, DEAL_STATUS_LABEL, DEAL_STATUS_OPTIONS, DEAL_STAGES, DEAL_STAGE_STATUS } from '../utils/constants';
import { fmtMoney, fmtDateShort, fmtPct } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import SkillPicker from '../components/common/SkillPicker';
import EntityFormModal from '../components/common/EntityFormModal';
import ScheduleEventModal from '../components/common/ScheduleEventModal';
import { skillLabel } from '../utils/skill-families';

const STATUS_COLOR = { ongoing: 'var(--accent-primary)', completed: 'var(--success)', passed: 'var(--text-secondary)' };
const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };
const STAGE_STATUS_LABEL = { 'not-started': 'Pas commencée', 'in-progress': 'En cours', blocked: 'Bloquée', done: 'Terminée' };
const blankTask = () => ({ title: '', skillId: '', xpAmount: 8, stage: '' });

function StageStepper({ deal, onJump }) {
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {DEAL_STAGES.map((label, i) => {
        const state = i < deal.stageIndex ? 'done' : i === deal.stageIndex ? deal.stageStatus : 'pending';
        const color = i <= deal.stageIndex ? STAGE_STATUS_COLOR[state] || 'var(--text-secondary)' : 'var(--border)';
        return (
          <div key={label} className="flex items-center flex-1 min-w-[92px] last:flex-none last:min-w-0">
            <button type="button" onClick={() => onJump(i)} className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0" title={`Aller à ${label}`}>
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

// Simplified, indicative LBO/growth returns model — see utils/deal-valuation.js
// for the math. Debt/paydown fields only make sense for a leveraged deal
// (LBO); Growth/VC are shown as an all-equity calc (entryDebtPct locked at 0).
function DealModeling({ deal, form, setForm, onSave }) {
  const isLbo = deal.type === 'LBO';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const returns = computeDealReturns({
    entryEbitda: Number(form.entryEbitda) || 0,
    entryMultiple: Number(form.entryMultiple) || 0,
    entryDebtPct: isLbo ? Number(form.entryDebtPct) || 0 : 0,
    exitMultiple: Number(form.exitMultiple) || Number(form.entryMultiple) || 0,
    ebitdaGrowthPct: Number(form.ebitdaGrowthPct) || 0,
    debtPaydownPct: isLbo ? Number(form.debtPaydownPct) || 0 : 0,
    holdYears: Number(form.holdYears) || 1,
  });
  const hasInputs = Number(form.entryEbitda) > 0 && Number(form.entryMultiple) > 0;

  return (
    <Card title={isLbo ? 'Modeling — LBO' : 'Modeling — Valuation'} action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => onSave(form)}>Enregistrer</Button>}>
      <p className="text-xs text-mute mb-3">Indicatif seulement : un pont entrée/sortie simplifié, pas un modèle complet à trois états financiers. Entre tes hypothèses pour obtenir un TRI et un MOIC indicatifs.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Field label="EBITDA d’entrée ($)"><Input type="number" step="any" value={form.entryEbitda} onChange={set('entryEbitda')} /></Field>
        <Field label="Multiple d’entrée (x)"><Input type="number" step="any" value={form.entryMultiple} onChange={set('entryMultiple')} /></Field>
        {isLbo && <Field label="Dette (% de l’EV)"><Input type="number" step="any" min="0" max="100" value={form.entryDebtPct} onChange={set('entryDebtPct')} /></Field>}
        <Field label="Durée de détention (ans)"><Input type="number" step="any" min="0.25" value={form.holdYears} onChange={set('holdYears')} /></Field>
        <Field label="Croissance de l’EBITDA (%/an)"><Input type="number" step="any" value={form.ebitdaGrowthPct} onChange={set('ebitdaGrowthPct')} /></Field>
        <Field label="Multiple de sortie (x)"><Input type="number" step="any" placeholder="= entrée" value={form.exitMultiple} onChange={set('exitMultiple')} /></Field>
        {isLbo && <Field label="Dette remboursée (% de la dette initiale)"><Input type="number" step="any" min="0" max="100" value={form.debtPaydownPct} onChange={set('debtPaydownPct')} /></Field>}
      </div>
      {hasInputs ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-line">
          <Stat label="EV d’entrée" value={fmtMoney(returns.entryEV)} />
          <Stat label="Fonds propres d’entrée" value={fmtMoney(returns.entryEquity)} sub={isLbo ? `${fmtMoney(returns.entryDebt)} de dette` : undefined} />
          <Stat label="Fonds propres de sortie" value={fmtMoney(returns.exitEquity)} />
          <Stat label="MOIC / TRI" value={returns.moic != null ? `${returns.moic.toFixed(2)}x` : '—'} sub={returns.irr != null ? `TRI ${fmtPct(returns.irr * 100, 1)}` : undefined} color="var(--success)" />
        </div>
      ) : (
        <p className="text-xs text-mute">Renseigne l’EBITDA et le multiple d’entrée pour voir les rendements indicatifs.</p>
      )}
    </Card>
  );
}

const dealFields = [
  { name: 'name', label: 'Nom du deal', type: 'text' },
  { name: 'type', label: 'Type', type: 'select', options: DEAL_TYPES },
  { name: 'role', label: 'Ton rôle', type: 'select', options: DEAL_ROLES },
  { name: 'status', label: 'Statut', type: 'select', options: DEAL_STATUS_OPTIONS },
  { name: 'size', label: 'Taille du deal', type: 'number', step: 'any', currency: '$' },
  { name: 'firm', label: 'Fonds / sponsor', type: 'text' },
  { name: 'date', label: 'Date', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'text' },
];

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deals, editDeal, deleteDeal, setDealStage, addTask, updateTask, setTaskStatus, deleteTask, setTaskCalendarEvent, setDealModel } = useDealsStore();
  const [editDealModal, setEditDealModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(blankTask());
  const [touchedSkill, setTouchedSkill] = useState(false);
  const [schedulingTask, setSchedulingTask] = useState(null);
  const deal = deals.find((d) => d.id === id);
  const [modelForm, setModelForm] = useState(() => deal?.model || blankDealModel());
  // Re-seed the form when navigating between deals (id changes) — DealDetail
  // doesn't remount on a param-only route change, so without this the form
  // would silently keep showing the previous deal's model values.
  useEffect(() => { setModelForm(deal?.model || blankDealModel()); }, [deal?.id]);

  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState>Deal introuvable. <Link to="/deals" className="text-accent">Retour aux deals</Link></EmptyState>
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
    if (!confirm(`Supprimer « ${deal.name} » ? Ses tâches et l’XP gagnée seront annulées.`)) return;
    deleteDeal(deal.id);
    navigate('/deals');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color="var(--accent-secondary)">{deal.type}</Badge>
            <span className="text-xs" style={{ color: STATUS_COLOR[deal.status] }}>{DEAL_STATUS_LABEL[deal.status] || deal.status}</span>
            <Badge color={STAGE_STATUS_COLOR[deal.stageStatus]}>{DEAL_STAGES[deal.stageIndex]} · {STAGE_STATUS_LABEL[deal.stageStatus]}</Badge>
            {deal.firm && <span className="text-xs text-mute">· {deal.firm}</span>}
          </div>
          <h1 className="text-2xl font-bold">{deal.name}</h1>
          <p className="text-mute text-sm mt-1">{deal.role} · {fmtDateShort(deal.date)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditDealModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Modifier</span></Button>
          <Button variant="danger" onClick={removeDeal}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Tâches" value={`${done.length}/${tasks.length}`} sub="terminées" />
        <Stat label="XP gagnée" value={xpEarned} sub="par les tâches terminées" />
        <Stat label="Taille du deal" value={deal.size ? fmtMoney(deal.size) : '—'} />
        <Stat label="Statut" value={DEAL_STATUS_LABEL[deal.status] || deal.status} />
      </div>

      <Card title="Étape du deal">
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
              <span className="flex items-center gap-2">Étape suivante : {DEAL_STAGES[deal.stageIndex + 1]} <ArrowRight size={14} /></span>
            </Button>
          )}
        </div>
      </Card>

      <DealModeling deal={deal} form={modelForm} setForm={setModelForm} onSave={(m) => setDealModel(deal.id, m)} />

      {tasks.length > 0 && (
        <Card title="Avancement">
          <ProgressBar value={done.length} max={tasks.length} color="var(--success)" />
        </Card>
      )}

      <Card
        title={`Tâches (${tasks.length})`}
        action={<Button onClick={openAddTask}><span className="flex items-center gap-2"><Plus size={16} /> Ajouter une tâche</span></Button>}
      >
        {tasks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-3 w-8" />
                  <th className="py-2 pr-4">Tâche</th>
                  <th className="py-2 pr-4">Compétence visée</th>
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
                    <td className="py-2.5 pr-4"><Badge color="var(--accent-primary)">{skillLabel(t.skillId)}</Badge></td>
                    <td className="py-2.5 pr-4 text-right">{t.xpAmount}</td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        disabled={t.status === 'done'}
                        onClick={() => setTaskStatus(deal.id, t.id, t.status === 'in-progress' ? 'todo' : 'in-progress')}
                        title={t.status === 'in-progress' ? 'En cours : clique pour retirer' : 'Marquer en cours'}
                        className={`cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${t.status === 'in-progress' ? '' : 'text-mute hover:text-ink'}`}
                        style={t.status === 'in-progress' ? { color: 'var(--warning)' } : undefined}
                      >
                        <Clock size={14} />
                      </button>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button
                        className={`mr-3 cursor-pointer ${t.googleEventLink ? 'text-good hover:text-accent' : 'text-mute hover:text-accent'}`}
                        onClick={() => setSchedulingTask(t)}
                        title={t.googleEventLink ? 'Modifier dans Google Agenda' : 'Planifier dans Google Agenda'}
                      >
                        {t.googleEventLink ? <CalendarCheck size={14} /> : <CalendarPlus size={14} />}
                      </button>
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => openEditTask(t)} title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette tâche ? Son XP (si elle était terminée) sera annulée.')) deleteTask(deal.id, t.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><ListChecks className="mx-auto mb-2 text-mute" size={26} />Aucune tâche pour l’instant. Note ce sur quoi tu travailles pour commencer à progresser.</EmptyState>
        )}
      </Card>

      {deal.notes && (
        <Card title="Notes">
          <p className="text-sm text-mute whitespace-pre-wrap">{deal.notes}</p>
        </Card>
      )}

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={editingTask ? 'Modifier la tâche' : 'Ajouter une tâche'}>
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="Tâche">
            <Input value={form.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="ex. Construire le modèle LBO, appels de due diligence…" autoFocus />
          </Field>
          <Field label="Compétence visée" hint="Proposée d’après le type de deal et le nom de la tâche : ajuste si besoin.">
            <SkillPicker value={form.skillId} onChange={(id) => { setForm((f) => ({ ...f, skillId: id })); setTouchedSkill(true); }} multi={false} />
          </Field>
          <Field label="XP à la fin de la tâche">
            <Input type="number" min="1" value={form.xpAmount} onChange={(e) => setForm((f) => ({ ...f, xpAmount: e.target.value }))} />
          </Field>
          <Field label="Étape" hint="L’étape du deal à laquelle cette tâche se rattache.">
            <Select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} options={[{ value: '', label: 'Sans étape' }, ...DEAL_STAGES.map((s) => ({ value: s, label: s }))]} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setTaskModal(false)}>Annuler</Button>
            <Button type="submit">{editingTask ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      </Modal>

      <EntityFormModal
        open={editDealModal}
        onClose={() => setEditDealModal(false)}
        title="Modifier le deal"
        fields={dealFields}
        initial={deal}
        wide
        onSave={(values) => editDeal(deal.id, values)}
      />

      <ScheduleEventModal
        open={!!schedulingTask}
        onClose={() => setSchedulingTask(null)}
        title="cette tâche"
        defaultSummary={schedulingTask ? `${schedulingTask.title} — ${deal.name}` : ''}
        description={deal.notes}
        existingEventId={schedulingTask?.googleEventId || null}
        existingEventLink={schedulingTask?.googleEventLink || null}
        onScheduled={({ eventId, htmlLink }) => setTaskCalendarEvent(deal.id, schedulingTask.id, { eventId, htmlLink })}
        onUnschedule={() => setTaskCalendarEvent(deal.id, schedulingTask.id, { eventId: null, htmlLink: null })}
      />
    </div>
  );
}
