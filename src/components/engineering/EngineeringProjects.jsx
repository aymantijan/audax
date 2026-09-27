import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useEngineeringStore } from '../../store/engineeringStore';
import { ENGINEERING_PROJECT_TYPES, ENGINEERING_PROJECT_STAGES, GRADE_POINTS } from '../../utils/constants';
import { fmtDateShort } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../common/ui';
import { tooltipStyle } from '../common/chart-theme';
import { blankProject } from './LabJournal';

export const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };

// jsPDF loaded on demand (dynamic import), same reasoning as
// BodyComposition.jsx's exportMonthlyReportPDF — its ~200KB shouldn't bloat
// this page's initial chunk for the vast majority of visits that never export.
export function Projects() {
  const { projects, addProject, deleteProject, getDeadlineAlerts } = useEngineeringStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankProject());

  const byType = useMemo(
    () => ENGINEERING_PROJECT_TYPES.map((t) => ({ name: t, count: projects.filter((p) => p.type === t).length })).filter((p) => p.count > 0),
    [projects]
  );
  // getDeadlineAlerts() allocates a fresh array — called inside this useMemo
  // (keyed on the raw `projects` slice), never as a bare store selector (see
  // the useSyncExternalStore infinite-loop note in project memory).
  const deadlineAlerts = useMemo(() => getDeadlineAlerts(), [projects]);
  const gradedProjects = useMemo(() => projects.filter((p) => p.grade && GRADE_POINTS[p.grade] !== undefined), [projects]);
  const avgGrade = gradedProjects.length ? gradedProjects.reduce((a, p) => a + GRADE_POINTS[p.grade], 0) / gradedProjects.length : null;

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addProject(form);
    setModal(false);
    setForm(blankProject());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-mute text-sm">Un projet par PFE/stage/projet de conception — chacun avance à travers les étapes réelles d'un projet d'ingénierie (cahier des charges → HAZOP → rapport → soutenance).</p>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouveau projet</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Projets" value={projects.length} />
        <Stat label="En cours" value={projects.filter((p) => p.stageStatus !== 'done' || p.stageIndex < ENGINEERING_PROJECT_STAGES.length - 1).length} />
        <Stat label="Terminés" value={projects.filter((p) => p.stageIndex === ENGINEERING_PROJECT_STAGES.length - 1 && p.stageStatus === 'done').length} />
        <Stat label="Types utilisés" value={byType.length} sub={`sur ${ENGINEERING_PROJECT_TYPES.length}`} />
        <Stat label="Moyenne" value={avgGrade != null ? avgGrade.toFixed(2) : '—'} sub={gradedProjects.length ? `${gradedProjects.length} noté${gradedProjects.length > 1 ? 's' : ''}` : 'aucun projet noté'} />
      </div>

      {deadlineAlerts.length > 0 && (
        <div className="space-y-1.5">
          {deadlineAlerts.map(({ project, overdue }) => (
            <div key={project.id} className={`flex items-center gap-2 text-sm border rounded-lg px-4 py-2.5 ${overdue ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`}>
              <AlertTriangle size={14} className="shrink-0" />
              <Link to={`/engineering/${project.id}`} className="hover:underline font-medium">{project.name}</Link>
              <span>{overdue ? `— échéance dépassée (${fmtDateShort(project.deadline)})` : `— échéance le ${fmtDateShort(project.deadline)}`}</span>
            </div>
          ))}
        </div>
      )}

      {byType.length > 1 && (
        <Card title="Projets par type">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#66ccff" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title={`Projets (${projects.length})`}>
        {projects.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Projet</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Étape</th>
                  <th className="py-2 pr-4">Tâches</th>
                  <th className="py-2 pr-4">Échéance</th>
                  <th className="py-2 pr-4">Note</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...projects].sort((a, b) => b.createdAt - a.createdAt).map((p) => {
                  const tasks = p.tasks || [];
                  const done = tasks.filter((t) => t.status === 'done').length;
                  return (
                    <tr key={p.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4"><Link to={`/engineering/${p.id}`} className="hover:text-accent">{p.name}</Link></td>
                      <td className="py-2.5 pr-4 text-mute">{p.type}</td>
                      <td className="py-2.5 pr-4"><Badge color={STAGE_STATUS_COLOR[p.stageStatus] || 'var(--text-secondary)'}>{ENGINEERING_PROJECT_STAGES[p.stageIndex ?? 0]}</Badge></td>
                      <td className="py-2.5 pr-4 text-mute">{tasks.length ? `${done}/${tasks.length}` : '—'}</td>
                      <td className="py-2.5 pr-4 text-mute">{p.deadline ? fmtDateShort(p.deadline) : '—'}</td>
                      <td className="py-2.5 pr-4 text-mute">{p.grade || '—'}</td>
                      <td className="py-2.5 text-right">
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) deleteProject(p.id); }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><FolderKanban className="mx-auto mb-2 text-mute" size={26} />Aucun projet pour l'instant.</EmptyState>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau projet">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom du projet"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Dimensionnement d'un réacteur PFR" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={ENGINEERING_PROJECT_TYPES} /></Field>
            <Field label="Échéance"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
