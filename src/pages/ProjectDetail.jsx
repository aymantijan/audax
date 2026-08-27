import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, ListChecks, Check } from 'lucide-react';
import { useProjectsStore } from '../store/projectsStore';
import { PROJECT_STAGES, LIFE_DOMAINS } from '../utils/constants';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];

function StageStepper({ project, onJump }) {
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {PROJECT_STAGES.map((label, i) => {
        const done = i < project.stageIndex;
        const current = i === project.stageIndex;
        const color = i <= project.stageIndex ? 'var(--accent-primary)' : 'var(--border)';
        return (
          <div key={label} className="flex items-center flex-1 min-w-[92px] last:flex-none last:min-w-0">
            <button type="button" onClick={() => onJump(i)} className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0" title={`Aller à ${label}`}>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-colors"
                style={{ borderColor: color, color: current ? 'var(--ink)' : done ? color : 'var(--text-secondary)', background: done ? color : 'transparent' }}
              >
                {done ? <Check size={13} color="var(--bg-primary)" /> : i + 1}
              </span>
              <span className="text-[11px] text-center w-20 leading-tight" style={{ color: current ? 'var(--ink)' : 'var(--text-secondary)' }}>{label}</span>
            </button>
            {i < PROJECT_STAGES.length - 1 && <div className="h-0.5 flex-1 mb-4" style={{ background: i < project.stageIndex ? 'var(--accent-primary)' : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
}

const projectFields = [
  { name: 'name', label: 'Nom', type: 'text' },
  { name: 'domain', label: 'Domaine', type: 'select', options: LIFE_DOMAINS },
  { name: 'status', label: 'Statut', type: 'select', options: STATUS_OPTIONS },
  { name: 'url', label: 'Lien', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, editProject, deleteProject, setStage, addTask, editTask, setTaskStatus, deleteTask } = useProjectsStore();
  const [editModal, setEditModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');

  const project = projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState>Projet introuvable. <Link to="/projects" className="text-accent">Retour aux Projects</Link></EmptyState>
      </div>
    );
  }

  const tasks = project.tasks || [];
  const done = tasks.filter((t) => t.status === 'done');

  const openAddTask = () => { setEditingTask(null); setTaskTitle(''); setTaskModal(true); };
  const openEditTask = (t) => { setEditingTask(t); setTaskTitle(t.title); setTaskModal(true); };
  const submitTask = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    if (editingTask) editTask(project.id, editingTask.id, { title: taskTitle });
    else addTask(project.id, { title: taskTitle });
    setTaskModal(false);
  };
  const removeProject = () => {
    if (!confirm(`Supprimer "${project.name}" ?`)) return;
    deleteProject(project.id);
    navigate('/projects');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/projects" className="flex items-center gap-1.5 text-sm text-mute hover:text-ink w-fit">
        <ArrowLeft size={14} /> Projects
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge>{project.domain}</Badge>
            <span className="text-xs text-mute capitalize">{STATUS_OPTIONS.find((s) => s.value === project.status)?.label}</span>
          </div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.url && <a href={project.url} target="_blank" rel="noreferrer" className="text-accent text-sm hover:underline">{project.url}</a>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Éditer</span></Button>
          <Button variant="danger" onClick={removeProject}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Tâches" value={`${done.length}/${tasks.length}`} sub="terminées" />
        <Stat label="Étape" value={`${project.stageIndex + 1}/${PROJECT_STAGES.length}`} />
        <Stat label="Statut" value={STATUS_OPTIONS.find((s) => s.value === project.status)?.label} />
      </div>

      <Card title="Étape du projet">
        <StageStepper project={project} onJump={(i) => setStage(project.id, i)} />
        {project.stageIndex < PROJECT_STAGES.length - 1 && (
          <div className="flex justify-end mt-4 pt-4 border-t border-line">
            <Button onClick={() => setStage(project.id, project.stageIndex + 1)}>
              Suivant : {PROJECT_STAGES[project.stageIndex + 1]}
            </Button>
          </div>
        )}
      </Card>

      {tasks.length > 0 && (
        <Card title="Progression">
          <ProgressBar value={done.length} max={tasks.length} color="var(--success)" />
        </Card>
      )}

      <Card title={`Tâches (${tasks.length})`} action={<Button onClick={openAddTask}><span className="flex items-center gap-2"><Plus size={16} /> Ajouter</span></Button>}>
        {tasks.length ? (
          <ul className="space-y-1.5">
            {[...tasks].sort((a, b) => b.createdAt - a.createdAt).map((t) => (
              <li key={t.id} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm">
                <input type="checkbox" checked={t.status === 'done'} onChange={() => setTaskStatus(project.id, t.id, t.status === 'done' ? 'todo' : 'done')} className="w-4 h-4 cursor-pointer" />
                <span className={`flex-1 ${t.status === 'done' ? 'line-through text-mute' : ''}`}>{t.title}</span>
                <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openEditTask(t)}><Pencil size={13} /></button>
                <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette tâche ?')) deleteTask(project.id, t.id); }}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState><ListChecks className="mx-auto mb-2 text-mute" size={26} />Aucune tâche pour l'instant.</EmptyState>
        )}
      </Card>

      {project.description && (
        <Card title="Description">
          <p className="text-sm text-mute whitespace-pre-wrap">{project.description}</p>
        </Card>
      )}

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={editingTask ? 'Éditer la tâche' : 'Nouvelle tâche'}>
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="Tâche"><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} autoFocus /></Field>
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
