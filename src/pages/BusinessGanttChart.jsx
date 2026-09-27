import { useMemo } from 'react';
import GanttChart from '../components/common/gantt/GanttChart';

export const TASK_STATUS = [
  { value: 'todo', label: 'À faire', color: 'var(--text-secondary)' },
  { value: 'in_progress', label: 'En cours', color: 'var(--warning)' },
  { value: 'done', label: 'Terminée', color: 'var(--success)' },
];

// Business plan tasks grouped by phase, on the shared planning chart.
const toStore = ({ groupId, ...patch }) => (groupId !== undefined ? { ...patch, phaseId: groupId } : patch);

export default function GanttTab({ business, store }) {
  const tasks = useMemo(() => (business.tasks || []).map((t) => ({ ...t, groupId: t.phaseId })), [business.tasks]);
  return (
    <GanttChart
      title={business.name}
      tasks={tasks}
      groups={business.phases}
      statuses={TASK_STATUS}
      editStatus
      report
      emptyText="Aucune tâche. Ajoute la première tâche d’une phase pour voir apparaître le planning."
      onCreate={(form) => store.addTask(business.id, toStore(form))}
      onUpdate={(id, patch) => store.editTask(business.id, id, toStore(patch))}
      onDelete={(id) => store.deleteTask(business.id, id)}
    />
  );
}
