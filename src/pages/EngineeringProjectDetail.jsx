import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, ListChecks, Clock, ArrowRight, Check } from 'lucide-react';
import { useEngineeringStore } from '../store/engineeringStore';
import { ENGINEERING_PROJECT_TYPES, ENGINEERING_PROJECT_STAGES, ENGINEERING_PROJECT_STATUS } from '../utils/constants';
import { fmtDateShort } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';

const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };
const STAGE_STATUS_LABEL = { 'not-started': 'Pas commencé', 'in-progress': 'En cours', blocked: 'Bloqué', done: 'Terminé' };
const blankTask = () => ({ title: '', stage: '' });

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

const projectFields = [
  { name: 'name', label: 'Nom du projet', type: 'text' },
  { name: 'type', label: 'Type', type: 'select', options: ENGINEERING_PROJECT_TYPES },
  { name: 'deadline', label: 'Échéance', type: 'date' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function EngineeringProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, editProject, deleteProject, setProjectStage, addTask, updateTask, setTaskStatus, deleteTask } = useEngineeringStore();
  const [editModal, setEditModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(blankTask());

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
          </div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.deadline && <p className="text-mute text-sm mt-1">Échéance : {fmtDateShort(project.deadline)}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Éditer</span></Button>
          <Button variant="danger" onClick={removeProject}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Tâches" value={`${done.length}/${tasks.length}`} sub="terminées" />
        <Stat label="Étape" value={`${project.stageIndex + 1}/${ENGINEERING_PROJECT_STAGES.length}`} />
        <Stat label="Type" value={project.type} />
        <Stat label="Échéance" value={project.deadline ? fmtDateShort(project.deadline) : '—'} />
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
    </div>
  );
}
