import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, ListChecks } from 'lucide-react';
import { useBusinessStore } from '../../store/businessStore';
import { PROJECT_STAGES } from '../../utils/constants';
import { Card, Stat, Button, Field, Input, Modal, Badge, EmptyState, ProgressBar } from '../common/ui';
import EntityFormModal from '../common/EntityFormModal';
import { LightStageStepper } from './BusinessParts';

export const LIGHT_STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];
export const lightBusinessFields = [
  { name: 'name', label: 'Nom', type: 'text' },
  { name: 'sector', label: 'Domaine', type: 'text' },
  { name: 'status', label: 'Statut', type: 'select', options: LIGHT_STATUS_OPTIONS },
  { name: 'url', label: 'Lien', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
];

export function LightBusinessDetail({ business }) {
  const navigate = useNavigate();
  const { editBusiness, deleteBusiness, setStage, addSimpleTask, editSimpleTask, setSimpleTaskStatus, deleteSimpleTask } = useBusinessStore();
  const [editModal, setEditModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');

  const tasks = business.tasks || [];
  const done = tasks.filter((t) => t.status === 'done');

  const openAddTask = () => { setEditingTask(null); setTaskTitle(''); setTaskModal(true); };
  const openEditTask = (t) => { setEditingTask(t); setTaskTitle(t.title); setTaskModal(true); };
  const submitTask = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    if (editingTask) editSimpleTask(business.id, editingTask.id, { title: taskTitle });
    else addSimpleTask(business.id, { title: taskTitle });
    setTaskModal(false);
  };
  const removeBusiness = () => {
    if (!confirm(`Supprimer "${business.name}" ?`)) return;
    deleteBusiness(business.id);
    navigate('/businesses');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/businesses" className="flex items-center gap-1.5 text-sm text-mute hover:text-ink w-fit">
        <ArrowLeft size={14} /> Business Projects
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color="var(--accent-secondary)">Léger</Badge>
            {business.sector && <Badge>{business.sector}</Badge>}
            <span className="text-xs text-mute capitalize">{LIGHT_STATUS_OPTIONS.find((s) => s.value === business.status)?.label}</span>
          </div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          {business.url && <a href={business.url} target="_blank" rel="noreferrer" className="text-accent text-sm hover:underline">{business.url}</a>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Éditer</span></Button>
          <Button variant="danger" onClick={removeBusiness}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Tâches" value={`${done.length}/${tasks.length}`} sub="terminées" />
        <Stat label="Étape" value={`${business.stageIndex + 1}/${PROJECT_STAGES.length}`} />
        <Stat label="Statut" value={LIGHT_STATUS_OPTIONS.find((s) => s.value === business.status)?.label} />
      </div>

      <Card title="Étape">
        <LightStageStepper business={business} onJump={(i) => setStage(business.id, i)} />
        {business.stageIndex < PROJECT_STAGES.length - 1 && (
          <div className="flex justify-end mt-4 pt-4 border-t border-line">
            <Button onClick={() => setStage(business.id, business.stageIndex + 1)}>
              Suivant : {PROJECT_STAGES[business.stageIndex + 1]}
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
                <input type="checkbox" checked={t.status === 'done'} onChange={() => setSimpleTaskStatus(business.id, t.id, t.status === 'done' ? 'todo' : 'done')} className="w-4 h-4 cursor-pointer" />
                <span className={`flex-1 ${t.status === 'done' ? 'line-through text-mute' : ''}`}>{t.title}</span>
                <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openEditTask(t)}><Pencil size={13} /></button>
                <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette tâche ?')) deleteSimpleTask(business.id, t.id); }}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState><ListChecks className="mx-auto mb-2 text-mute" size={26} />Aucune tâche pour l'instant.</EmptyState>
        )}
      </Card>

      {business.description && (
        <Card title="Description">
          <p className="text-sm text-mute whitespace-pre-wrap">{business.description}</p>
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
        title="Éditer"
        fields={lightBusinessFields}
        initial={business}
        wide
        onSave={(values) => editBusiness(business.id, values)}
      />
    </div>
  );
}
