import { useMemo } from 'react';
import GanttChart from '../components/common/gantt/GanttChart';

const STATUSES = [
  { value: 'todo', label: 'À faire', color: 'var(--text-secondary)' },
  { value: 'in-progress', label: 'En cours', color: 'var(--warning)' },
  { value: 'done', label: 'Terminée', color: 'var(--success)' },
];

// Engineering project tasks (flat, no phases) on the shared planning chart.
// Status stays managed from the task list, where it awards XP.
const toStore = ({ name, ...patch }) => (name !== undefined ? { ...patch, title: name } : patch);

export default function EngineeringGanttChart({ project, updateTask, deleteTask }) {
  const tasks = useMemo(() => (project.tasks || []).map((t) => ({ ...t, name: t.title })), [project.tasks]);
  return (
    <GanttChart
      title={project.name}
      tasks={tasks}
      statuses={STATUSES}
      emptyText="Ajoute des tâches (bouton ci-dessus) pour voir apparaître le planning."
      onUpdate={(id, patch) => updateTask(project.id, id, toStore(patch))}
      onDelete={(id) => deleteTask(project.id, id)}
    />
  );
}
