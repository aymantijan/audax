import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, ListChecks, Clock, ArrowRight, Check, CalendarPlus, CalendarCheck, FileDown, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useEngineeringStore } from '../store/engineeringStore';
import { ENGINEERING_PROJECT_TYPES, ENGINEERING_PROJECT_STAGES, ENGINEERING_PROJECT_STATUS, ENGINEERING_PROJECT_GRADES, HAZOP_GUIDEWORDS, HAZOP_SEVERITY, HAZOP_LIKELIHOOD } from '../utils/constants';
import { fmtDateShort } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import ScheduleEventModal from '../components/common/ScheduleEventModal';
import EngineeringGanttChart from './EngineeringGanttChart';

const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };
const STAGE_STATUS_LABEL = { 'not-started': 'Pas commencé', 'in-progress': 'En cours', blocked: 'Bloqué', done: 'Terminé' };
const blankTask = () => ({ title: '', stage: '' });

// Same dynamic-import jsPDF pattern as Engineering.jsx's exportLabEntryPDF /
// BodyComposition.jsx's exportMonthlyReportPDF.
async function exportProjectPDF(project) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(project.name, 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${project.type}${project.deadline ? ` · échéance ${project.deadline}` : ''}`, 14, y);
  y += 6;
  doc.text(`Étape : ${ENGINEERING_PROJECT_STAGES[project.stageIndex]} (${project.stageIndex + 1}/${ENGINEERING_PROJECT_STAGES.length})${project.grade ? ` · Note : ${project.grade}` : ''}`, 14, y);
  y += 10;
  doc.setTextColor(0);

  const section = (label, value) => {
    if (!value) return;
    doc.setFontSize(12);
    doc.text(label, 14, y);
    y += 6;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(value), 180);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 6;
    }
    y += 4;
  };

  section('Description', project.description);

  const tasks = project.tasks || [];
  if (tasks.length) {
    doc.setFontSize(12);
    doc.text(`Tâches (${tasks.filter((t) => t.status === 'done').length}/${tasks.length})`, 14, y);
    y += 7;
    doc.setFontSize(10);
    for (const t of tasks) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(`${t.status === 'done' ? '[x]' : '[ ]'} ${t.title}${t.stage ? ` (${t.stage})` : ''}`, 14, y);
      y += 6;
    }
    y += 4;
  }

  const hazop = project.hazop || [];
  if (hazop.length) {
    doc.setFontSize(12);
    doc.text(`HAZOP (${hazop.length} déviation${hazop.length > 1 ? 's' : ''})`, 14, y);
    y += 7;
    doc.setFontSize(10);
    for (const r of hazop) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(`• [${r.guideWord}] ${r.parameter}${r.deviation ? ` — ${r.deviation}` : ''}${r.severity ? ` (${r.severity})` : ''}`, 14, y);
      y += 6;
    }
    y += 4;
  }

  section('Notes', project.notes);

  doc.save(`audax-projet-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

function StageStepper({ project, onJump }) {
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {ENGINEERING_PROJECT_STAGES.map((label, i) => {
        const state = i < project.stageIndex ? 'done' : i === project.stageIndex ? project.stageStatus : 'pending';
        const color = i <= project.stageIndex ? STAGE_STATUS_COLOR[state] || 'var(--text-secondary)' : 'var(--border)';
        return (
          <div key={label} className="flex items-center flex-1 min-w-[100px] last:flex-none last:min-w-0">
            <button type="button" onClick={() => onJump(i)} className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0" title={`Aller à ${label}`}>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-colors"
                style={{ borderColor: color, color: state === 'pending' ? 'var(--text-secondary)' : color, background: state === 'done' ? color : 'transparent' }}
              >
                {state === 'done' ? <Check size={13} color="var(--bg-primary)" /> : i + 1}
              </span>
              <span className="text-[11px] text-center w-24 leading-tight" style={{ color: i === project.stageIndex ? 'var(--ink)' : 'var(--text-secondary)' }}>{label}</span>
            </button>
            {i < ENGINEERING_PROJECT_STAGES.length - 1 && <div className="h-0.5 flex-1 mb-4" style={{ background: i < project.stageIndex ? STAGE_STATUS_COLOR.done : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
}

const blankHazopRow = () => ({ guideWord: HAZOP_GUIDEWORDS[0], parameter: '', deviation: '', causes: '', consequences: '', safeguards: '', actions: '', severity: '', likelihood: '' });
const HAZOP_SEVERITY_COLOR = { Faible: 'var(--text-secondary)', Modérée: 'var(--warning)', Élevée: 'var(--error)', Critique: 'var(--error)' };

// Structured deviation worksheet (IEC 61882 guide words) — added 2026-08-27
// so "Analyse de sécurité (HAZOP)" is an actual safety-review artifact per
// project, not just another pipeline stage checkbox. Each row is its own
// modal (a real HAZOP row has ~8 fields — a table full of always-visible
// textareas would be unreadable) — the table itself stays a scannable summary.
function HazopSection({ project, addHazopRow, updateHazopRow, deleteHazopRow }) {
  const rows = project.hazop || [];
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankHazopRow());

  const openAdd = () => { setEditing(null); setForm(blankHazopRow()); setModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...blankHazopRow(), ...r }); setModal(true); };
  const submit = (e) => {
    e.preventDefault();
    if (!form.parameter.trim() && !form.deviation.trim()) return;
    if (editing) updateHazopRow(project.id, editing.id, form);
    else addHazopRow(project.id, form);
    setModal(false);
  };

  return (
    <Card
      title={`HAZOP (${rows.length})`}
      action={<Button onClick={openAdd}><span className="flex items-center gap-2"><Plus size={16} /> Nouvelle déviation</span></Button>}
    >
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-line">
                <th className="py-2 pr-4">Mot-guide</th>
                <th className="py-2 pr-4">Paramètre / déviation</th>
                <th className="py-2 pr-4">Conséquences</th>
                <th className="py-2 pr-4">Sévérité</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/50 hover:bg-surface/50 cursor-pointer" onClick={() => openEdit(r)}>
                  <td className="py-2.5 pr-4"><Badge color="var(--accent-secondary)">{r.guideWord}</Badge></td>
                  <td className="py-2.5 pr-4">{r.parameter}{r.deviation ? ` — ${r.deviation}` : ''}</td>
                  <td className="py-2.5 pr-4 text-mute truncate max-w-xs">{r.consequences || '—'}</td>
                  <td className="py-2.5 pr-4">{r.severity ? <Badge color={HAZOP_SEVERITY_COLOR[r.severity]}>{r.severity}</Badge> : '—'}</td>
                  <td className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette déviation HAZOP ?')) deleteHazopRow(project.id, r.id); }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState><ShieldAlert className="mx-auto mb-2 text-mute" size={26} />Aucune déviation analysée. Passe en revue chaque paramètre du procédé avec les mots-guides IEC 61882 (No/Not, More, Less…).</EmptyState>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Éditer la déviation' : 'Nouvelle déviation HAZOP'} wide>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mot-guide"><Select value={form.guideWord} onChange={(e) => setForm({ ...form, guideWord: e.target.value })} options={HAZOP_GUIDEWORDS} /></Field>
            <Field label="Paramètre étudié"><Input value={form.parameter} onChange={(e) => setForm({ ...form, parameter: e.target.value })} placeholder="ex. Débit d'alimentation" /></Field>
          </div>
          <Field label="Déviation" hint="Mot-guide + paramètre = la déviation étudiée (ex. « Pas de débit »)."><Input value={form.deviation} onChange={(e) => setForm({ ...form, deviation: e.target.value })} placeholder="ex. Pas de débit d'alimentation" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Causes possibles"><Textarea rows={2} value={form.causes} onChange={(e) => setForm({ ...form, causes: e.target.value })} /></Field>
            <Field label="Conséquences"><Textarea rows={2} value={form.consequences} onChange={(e) => setForm({ ...form, consequences: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sévérité"><Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} options={[{ value: '', label: '—' }, ...HAZOP_SEVERITY.map((s) => ({ value: s, label: s }))]} /></Field>
            <Field label="Probabilité"><Select value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: e.target.value })} options={[{ value: '', label: '—' }, ...HAZOP_LIKELIHOOD.map((l) => ({ value: l, label: l }))]} /></Field>
          </div>
          <Field label="Sauvegardes existantes"><Textarea rows={2} value={form.safeguards} onChange={(e) => setForm({ ...form, safeguards: e.target.value })} /></Field>
          <Field label="Actions recommandées"><Textarea rows={2} value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

const projectFields = [
  { name: 'name', label: 'Nom du projet', type: 'text' },
  { name: 'type', label: 'Type', type: 'select', options: ENGINEERING_PROJECT_TYPES },
  { name: 'deadline', label: 'Échéance', type: 'date' },
  { name: 'grade', label: 'Note (une fois soutenu/rendu)', type: 'select', options: [{ value: '', label: 'Pas encore noté' }, ...ENGINEERING_PROJECT_GRADES.map((g) => ({ value: g, label: g }))] },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function EngineeringProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, editProject, deleteProject, setProjectStage, addTask, updateTask, setTaskStatus, deleteTask, setTaskCalendarEvent, addHazopRow, updateHazopRow, deleteHazopRow } = useEngineeringStore();
  const [editModal, setEditModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(blankTask());
  const [schedulingTask, setSchedulingTask] = useState(null);

  const project = projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState>Projet introuvable. <Link to="/engineering" className="text-accent">Retour à Ingénierie</Link></EmptyState>
      </div>
    );
  }

  const tasks = project.tasks || [];
  const done = tasks.filter((t) => t.status === 'done');
  const isFinished = project.stageIndex === ENGINEERING_PROJECT_STAGES.length - 1 && project.stageStatus === 'done';
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !isFinished && project.deadline && project.deadline < today;
  const dueSoon = !isFinished && !overdue && project.deadline && project.deadline <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const openAddTask = () => {
    setEditingTask(null);
    setForm({ title: '', stage: ENGINEERING_PROJECT_STAGES[project.stageIndex] });
    setTaskModal(true);
  };
  const openEditTask = (t) => {
    setEditingTask(t);
    setForm({ title: t.title, stage: t.stage || '' });
    setTaskModal(true);
  };

  const submitTask = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editingTask) updateTask(project.id, editingTask.id, form);
    else addTask(project.id, form);
    setTaskModal(false);
  };

  const removeProject = () => {
    if (!confirm(`Supprimer "${project.name}" ?`)) return;
    deleteProject(project.id);
    navigate('/engineering');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color="var(--accent-secondary)">{project.type}</Badge>
            <Badge color={STAGE_STATUS_COLOR[project.stageStatus]}>{ENGINEERING_PROJECT_STAGES[project.stageIndex]} · {STAGE_STATUS_LABEL[project.stageStatus]}</Badge>
            {project.grade && <Badge color="var(--success)">Note : {project.grade}</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.deadline && (
            <p className={`text-sm mt-1 ${overdue ? 'text-bad' : dueSoon ? 'text-warn' : 'text-mute'}`}>
              {(overdue || dueSoon) && <AlertTriangle size={13} className="inline mr-1 -mt-0.5" />}
              Échéance : {fmtDateShort(project.deadline)}{overdue ? ' — dépassée' : dueSoon ? ' — bientôt' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportProjectPDF(project)}><span className="flex items-center gap-2"><FileDown size={14} /> Exporter en PDF</span></Button>
          <Button variant="secondary" onClick={() => setEditModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Éditer</span></Button>
          <Button variant="danger" onClick={removeProject}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Tâches" value={`${done.length}/${tasks.length}`} sub="terminées" />
        <Stat label="Étape" value={`${project.stageIndex + 1}/${ENGINEERING_PROJECT_STAGES.length}`} />
        <Stat label="Type" value={project.type} />
        <Stat label="Échéance" value={project.deadline ? fmtDateShort(project.deadline) : '—'} color={overdue ? 'var(--error)' : dueSoon ? 'var(--warning)' : undefined} />
        <Stat label="HAZOP" value={(project.hazop || []).length} sub="déviations" />
      </div>

      <Card title="Étape du projet">
        <StageStepper project={project} onJump={(i) => setProjectStage(project.id, { stageIndex: i })} />
        <div className="flex items-center flex-wrap gap-2 mt-4 pt-4 border-t border-line">
          <span className="text-xs text-mute mr-1">{ENGINEERING_PROJECT_STAGES[project.stageIndex]} :</span>
          {ENGINEERING_PROJECT_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setProjectStage(project.id, { stageStatus: s })}
              className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${project.stageStatus === s ? '' : 'border-line text-mute hover:text-ink'}`}
              style={project.stageStatus === s ? { borderColor: STAGE_STATUS_COLOR[s], color: STAGE_STATUS_COLOR[s], background: `color-mix(in srgb, ${STAGE_STATUS_COLOR[s]} 12%, transparent)` } : undefined}
            >
              {STAGE_STATUS_LABEL[s]}
            </button>
          ))}
          {project.stageStatus === 'done' && project.stageIndex < ENGINEERING_PROJECT_STAGES.length - 1 && (
            <Button className="ml-auto" onClick={() => setProjectStage(project.id, { stageIndex: project.stageIndex + 1 })}>
              <span className="flex items-center gap-2">Suivant : {ENGINEERING_PROJECT_STAGES[project.stageIndex + 1]} <ArrowRight size={14} /></span>
            </Button>
          )}
        </div>
      </Card>

      {tasks.length > 0 && (
        <Card title="Progression">
          <ProgressBar value={done.length} max={tasks.length} color="var(--success)" />
        </Card>
      )}

      {tasks.length > 0 && <EngineeringGanttChart project={project} updateTask={updateTask} deleteTask={deleteTask} />}

      <HazopSection project={project} addHazopRow={addHazopRow} updateHazopRow={updateHazopRow} deleteHazopRow={deleteHazopRow} />

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
                        onChange={() => setTaskStatus(project.id, t.id, t.status === 'done' ? 'todo' : 'done')}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className={t.status === 'done' ? 'line-through text-mute' : ''}>{t.title}</div>
                      {t.stage && <div className="text-[11px] text-mute mt-0.5">{t.stage}</div>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        disabled={t.status === 'done'}
                        onClick={() => setTaskStatus(project.id, t.id, t.status === 'in-progress' ? 'todo' : 'in-progress')}
                        title={t.status === 'in-progress' ? 'En cours — cliquer pour annuler' : 'Marquer en cours'}
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
                        title={t.googleEventLink ? 'Éditer dans Google Calendar' : 'Planifier dans Google Calendar'}
                      >
                        {t.googleEventLink ? <CalendarCheck size={14} /> : <CalendarPlus size={14} />}
                      </button>
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => openEditTask(t)} title="Éditer">
                        <Pencil size={14} />
                      </button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette tâche ?')) deleteTask(project.id, t.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><ListChecks className="mx-auto mb-2 text-mute" size={26} />Aucune tâche pour l'instant.</EmptyState>
        )}
      </Card>

      {(project.description || project.notes) && (
        <Card title="Description & Notes">
          {project.description && <p className="text-sm text-mute whitespace-pre-wrap">{project.description}</p>}
          {project.notes && <p className="text-sm text-mute whitespace-pre-wrap mt-2">{project.notes}</p>}
        </Card>
      )}

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={editingTask ? 'Éditer la tâche' : 'Ajouter une tâche'}>
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="Tâche">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="ex. Simuler la colonne sous Aspen Plus" autoFocus />
          </Field>
          <Field label="Étape" hint="À quelle étape du projet cette tâche appartient.">
            <Select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} options={[{ value: '', label: 'Non assignée' }, ...ENGINEERING_PROJECT_STAGES.map((s) => ({ value: s, label: s }))]} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setTaskModal(false)}>Annuler</Button>
            <Button type="submit">{editingTask ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      </Modal>

      <EntityFormModal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Éditer le projet"
        fields={projectFields}
        initial={project}
        wide
        onSave={(values) => editProject(project.id, values)}
      />

      <ScheduleEventModal
        open={!!schedulingTask}
        onClose={() => setSchedulingTask(null)}
        title="cette tâche"
        defaultSummary={schedulingTask ? `${schedulingTask.title} — ${project.name}` : ''}
        description={project.notes}
        existingEventId={schedulingTask?.googleEventId || null}
        existingEventLink={schedulingTask?.googleEventLink || null}
        onScheduled={({ eventId, htmlLink }) => setTaskCalendarEvent(project.id, schedulingTask.id, { eventId, htmlLink })}
        onUnschedule={() => setTaskCalendarEvent(project.id, schedulingTask.id, { eventId: null, htmlLink: null })}
      />
    </div>
  );
}
