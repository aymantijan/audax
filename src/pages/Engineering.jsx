import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, FolderKanban, Plus, Trash2, Pencil, FileDown, Send, BookMarked, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useEngineeringStore } from '../store/engineeringStore';
import { useLearningStore } from '../store/learningStore';
import { useAuthStore } from '../store/authStore';
import { ENGINEERING_PROJECT_TYPES, ENGINEERING_PROJECT_STAGES, GRADE_POINTS } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';
import { askAIEngineeringQuestion } from '../services/engineering-coach-ai';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };

// jsPDF loaded on demand (dynamic import), same reasoning as
// BodyComposition.jsx's exportMonthlyReportPDF — its ~200KB shouldn't bloat
// this page's initial chunk for the vast majority of visits that never export.
async function exportLabEntryPDF(entry) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(entry.title || 'Rapport de laboratoire', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${entry.date}${entry.course ? ` · ${entry.course}` : ''}`, 14, y);
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

  if (entry.yieldPercent !== '' && entry.yieldPercent != null) section('Rendement', `${entry.yieldPercent}%`);
  section('Objectif', entry.objective);
  section('Protocole', entry.protocol);
  section('Réactifs / matériel', entry.reagents);
  section('Observations', entry.observations);
  section('Conclusion', entry.conclusion);

  doc.save(`audax-lab-${(entry.title || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${entry.date}.pdf`);
}

// Aggregate portfolio export — unlike exportLabEntryPDF (one experiment) and
// EngineeringProjectDetail's exportProjectPDF (one project), this compiles a
// CHOSEN subset of projects + lab entries into a single CV-style document —
// what a student would actually attach to an internship/job application.
// Same dynamic-import jsPDF pattern as every other PDF export in the app.
async function exportPortfolioPDF({ projects, labEntries, userName }) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.text('Portfolio Ingénierie', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${userName ? `${userName} · ` : ''}Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, y);
  y += 10;
  doc.setTextColor(0);

  const ensureRoom = (needed) => { if (y + needed > 280) { doc.addPage(); y = 20; } };
  const section = (label, value, indent = 14) => {
    if (!value) return;
    ensureRoom(12);
    doc.setFontSize(9.5);
    doc.setTextColor(100);
    doc.text(label, indent, y);
    doc.setTextColor(0);
    y += 5;
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(String(value), pageW - indent - 14);
    for (const line of lines) { ensureRoom(6); doc.text(line, indent, y); y += 5; }
    y += 2;
  };

  if (projects.length) {
    ensureRoom(10);
    doc.setFontSize(13);
    doc.text(`Projets (${projects.length})`, 14, y);
    y += 8;
    for (const p of projects) {
      ensureRoom(14);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(p.name, 14, y);
      doc.setFont(undefined, 'normal');
      y += 5.5;
      doc.setFontSize(9);
      doc.setTextColor(120);
      const tasks = p.tasks || [];
      const done = tasks.filter((t) => t.status === 'done').length;
      doc.text(`${p.type} · ${ENGINEERING_PROJECT_STAGES[p.stageIndex ?? 0]}${p.grade ? ` · note ${p.grade}` : ''}${p.deadline ? ` · échéance ${p.deadline}` : ''}${tasks.length ? ` · ${done}/${tasks.length} tâches` : ''}${(p.hazop || []).length ? ` · ${p.hazop.length} déviation(s) HAZOP` : ''}`, 14, y);
      y += 6;
      doc.setTextColor(0);
      section('Description', p.description);
      y += 2;
    }
    y += 4;
  }

  if (labEntries.length) {
    ensureRoom(10);
    doc.setFontSize(13);
    doc.text(`Expériences de laboratoire (${labEntries.length})`, 14, y);
    y += 8;
    for (const e of labEntries) {
      ensureRoom(12);
      doc.setFontSize(10.5);
      doc.setFont(undefined, 'bold');
      doc.text(e.title, 14, y);
      doc.setFont(undefined, 'normal');
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${e.date}${e.course ? ` · ${e.course}` : ''}${e.yieldPercent !== '' && e.yieldPercent != null ? ` · rendement ${e.yieldPercent}%` : ''}`, 14, y);
      y += 6;
      doc.setTextColor(0);
      section('Objectif', e.objective);
      section('Conclusion', e.conclusion);
      y += 2;
    }
  }

  doc.save(`audax-portfolio-ingenierie-${todayKey()}.pdf`);
}

function PortfolioExportModal({ open, onClose, projects, labEntries }) {
  const userName = useAuthStore((s) => s.user?.name);
  const [selProjects, setSelProjects] = useState(() => new Set(projects.map((p) => p.id)));
  const [selLabs, setSelLabs] = useState(() => new Set(labEntries.map((e) => e.id)));

  // The modal stays mounted (just visually hidden) between opens — as a
  // Modal-open-controlled child, not remounted — so the lazy useState
  // initializers above only ever ran once against whatever existed at first
  // render. Without this, adding a project/lab entry after that first render
  // left it permanently unselected (silently excluded from every export)
  // even though the checklist correctly SHOWS the new item. Re-select
  // everything fresh each time the modal actually opens.
  useEffect(() => {
    if (open) {
      setSelProjects(new Set(projects.map((p) => p.id)));
      setSelLabs(new Set(labEntries.map((e) => e.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (set, setSet, id) => setSet((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doExport = () => {
    exportPortfolioPDF({
      projects: projects.filter((p) => selProjects.has(p.id)),
      labEntries: labEntries.filter((e) => selLabs.has(e.id)),
      userName,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Exporter le portfolio" wide>
      <div className="space-y-4">
        <p className="text-xs text-mute">Choisis ce qui figure dans le document — utile pour ne pas envoyer tes brouillons ou TP secondaires avec une candidature.</p>

        {projects.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Projets ({selProjects.size}/{projects.length})</div>
            <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                  <input type="checkbox" checked={selProjects.has(p.id)} onChange={() => toggle(selProjects, setSelProjects, p.id)} />
                  <span className="truncate">{p.name}</span>
                  <span className="text-mute ml-auto shrink-0">{p.type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {labEntries.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Expériences de laboratoire ({selLabs.size}/{labEntries.length})</div>
            <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {labEntries.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                  <input type="checkbox" checked={selLabs.has(e.id)} onChange={() => toggle(selLabs, setSelLabs, e.id)} />
                  <span className="truncate">{e.title}</span>
                  <span className="text-mute ml-auto shrink-0">{fmtDateShort(e.date)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="button" onClick={doExport} disabled={!selProjects.size && !selLabs.size}>
            <span className="flex items-center gap-2"><FileDown size={14} /> Exporter</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const blankEntry = () => ({
  date: todayKey(), title: '', course: '', objective: '', protocol: '', reagents: '', yieldPercent: '', observations: '', conclusion: '', tags: '',
});
const blankProject = () => ({ name: '', type: ENGINEERING_PROJECT_TYPES[0], description: '', deadline: '', notes: '' });

function LabJournal() {
  const { labEntries, addLabEntry, editLabEntry, deleteLabEntry } = useEngineeringStore();
  const courses = useLearningStore((s) => s.courses);
  // Suggests the user's own tracked Learning courses so "Génie des réacteurs"
  // in the lab journal can match the same course logged in Learning — still
  // free text underneath (a lab session for a course not tracked there is
  // just as valid), this only autocompletes, never restricts the value.
  const courseNames = useMemo(() => [...new Set(courses.map((c) => c.name))], [courses]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankEntry());

  const editFields = [
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'title', label: "Titre de l'expérience", type: 'text' },
    { name: 'course', label: 'Cours / module', type: 'text', placeholder: 'ex. Génie des réacteurs', list: 'lab-course-options', listOptions: courseNames },
    { name: 'yieldPercent', label: 'Rendement (%)', type: 'number', step: 'any' },
    { name: 'objective', label: 'Objectif', type: 'textarea' },
    { name: 'protocol', label: 'Protocole', type: 'textarea' },
    { name: 'reagents', label: 'Réactifs / matériel', type: 'textarea' },
    { name: 'observations', label: 'Observations', type: 'textarea' },
    { name: 'conclusion', label: 'Conclusion', type: 'textarea' },
    { name: 'tags', label: 'Tags (séparés par des virgules)', type: 'text' },
  ];

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    addLabEntry(form);
    setModal(false);
    setForm(blankEntry());
  };

  const [yieldCourseFilter, setYieldCourseFilter] = useState('all');
  const yieldedEntries = useMemo(() => labEntries.filter((e) => e.yieldPercent !== '' && e.yieldPercent != null), [labEntries]);
  const yieldCourses = useMemo(() => [...new Set(yieldedEntries.map((e) => e.course).filter(Boolean))], [yieldedEntries]);
  const yieldTrend = useMemo(
    () =>
      yieldedEntries
        .filter((e) => yieldCourseFilter === 'all' || e.course === yieldCourseFilter)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => ({ date: e.date.slice(5), yield: Number(e.yieldPercent), title: e.title })),
    [yieldedEntries, yieldCourseFilter]
  );
  // Rendement moyen par cours — le graphique "dans le temps" mélangeait tout
  // (un TP de distillation et un TP de cinétique n'ont pas le même rendement
  // "normal"), donc impossible de voir si UN cours en particulier se dégrade.
  const yieldByCourse = useMemo(() => {
    const groups = {};
    for (const e of yieldedEntries) {
      const key = e.course || 'Sans cours';
      (groups[key] ??= []).push(Number(e.yieldPercent));
    }
    return Object.entries(groups)
      .map(([course, values]) => ({ course, avg: Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10, count: values.length }))
      .sort((a, b) => b.avg - a.avg);
  }, [yieldedEntries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-mute text-sm">Journal d'expériences/TP — une entrée par manip. Le rendement et les observations restent consultables pour rédiger tes rapports plus tard.</p>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Logger une expérience</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Expériences loggées" value={labEntries.length} />
        <Stat label="Rendement moyen" value={labEntries.filter((e) => e.yieldPercent !== '' && e.yieldPercent != null).length ? `${Math.round((labEntries.reduce((a, e) => a + (Number(e.yieldPercent) || 0), 0) / labEntries.filter((e) => e.yieldPercent !== '' && e.yieldPercent != null).length) * 10) / 10}%` : '—'} />
        <Stat label="Cours couverts" value={new Set(labEntries.map((e) => e.course).filter(Boolean)).size} />
      </div>

      {yieldedEntries.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card
            title="Rendement dans le temps"
            action={
              yieldCourses.length > 1 ? (
                <Select
                  value={yieldCourseFilter}
                  onChange={(e) => setYieldCourseFilter(e.target.value)}
                  options={[{ value: 'all', label: 'Tous les cours' }, ...yieldCourses.map((c) => ({ value: c, label: c }))]}
                  className="!py-1 !px-2 text-xs w-40"
                />
              ) : undefined
            }
          >
            {yieldTrend.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={yieldTrend}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit="%" />
                  <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v}%`, p.payload.title]} />
                  <Line type="monotone" dataKey="yield" stroke="#66ccff" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>Pas assez d'entrées avec rendement pour ce cours.</EmptyState>
            )}
          </Card>

          {yieldByCourse.length > 1 && (
            <Card title="Rendement moyen par cours">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yieldByCourse} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="course" width={110} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v}% (${p.payload.count} essai${p.payload.count > 1 ? 's' : ''})`, p.payload.course]} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]} fill="#66ccff" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      <Card title={`Journal (${labEntries.length})`}>
        {labEntries.length ? (
          <ul className="space-y-2">
            {labEntries.map((e) => (
              <li key={e.id} className="border border-line rounded-lg px-4 py-3 bg-surface">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-mute mt-0.5">{fmtDateShort(e.date)}{e.course ? ` · ${e.course}` : ''}{e.yieldPercent !== '' && e.yieldPercent != null ? ` · rendement ${e.yieldPercent}%` : ''}</div>
                    {e.observations && <p className="text-xs text-mute mt-1.5 whitespace-pre-wrap">{e.observations}</p>}
                    {e.tags && <div className="flex flex-wrap gap-1 mt-1.5">{e.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="text-[11px] bg-panel border border-line rounded-full px-2 py-0.5">{t}</span>)}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => exportLabEntryPDF(e)} title="Exporter en PDF"><FileDown size={14} /></button>
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditing(e)} title="Éditer"><Pencil size={14} /></button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette entrée ?')) deleteLabEntry(e.id); }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState><FlaskConical className="mx-auto mb-2 text-mute" size={26} />Aucune expérience loggée pour l'instant.</EmptyState>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Logger une expérience">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={form.date} max={todayKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Cours / module">
              <Input list="lab-course-options-add" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="ex. Génie des réacteurs" />
              <datalist id="lab-course-options-add">
                {courseNames.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>
          <Field label="Titre de l'expérience"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex. Distillation fractionnée — mélange éthanol/eau" autoFocus /></Field>
          <Field label="Objectif"><Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protocole"><Textarea rows={3} value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} /></Field>
            <Field label="Réactifs / matériel"><Textarea rows={3} value={form.reagents} onChange={(e) => setForm({ ...form, reagents: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rendement (%)"><Input type="number" step="any" value={form.yieldPercent} onChange={(e) => setForm({ ...form, yieldPercent: e.target.value })} /></Field>
            <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="thermo, séparation…" /></Field>
          </div>
          <Field label="Observations"><Textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} /></Field>
          <Field label="Conclusion"><Textarea rows={2} value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Logger</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer l'entrée"
          fields={editFields}
          initial={editing}
          wide
          onSave={(values) => editLabEntry(editing.id, values)}
          onDelete={() => deleteLabEntry(editing.id)}
        />
      )}
    </div>
  );
}

function Projects() {
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

const TABS = [
  { key: 'journal', label: 'Journal de labo', icon: FlaskConical, Component: LabJournal },
  { key: 'projects', label: 'Projets', icon: FolderKanban, Component: Projects },
];

// Same UX as Health's "Ask the Health AI" (Dashboard.jsx) — degrades to a
// plain error message rather than crashing when the backend isn't
// configured on this deployment (api/engineering-coach.js returns 503 if
// OPENROUTER_API_KEY is unset).
function AskEngineeringAI() {
  const buildCoachContext = useEngineeringStore((s) => s.buildCoachContext);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError('');
    setAnswer(null);
    try {
      const text = await askAIEngineeringQuestion(buildCoachContext(), question.trim());
      setAnswer(text);
    } catch {
      setAskError("Le coach IA n'est pas disponible pour l'instant (non configuré ou hors ligne) — réessaie plus tard.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <Card title="Demander au coach Ingénierie">
      <form onSubmit={submitQuestion} className="flex gap-2 mb-3">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ex. Pourquoi mon rendement baisse-t-il ces derniers essais ?" className="flex-1" />
        <Button type="submit" disabled={asking}>{asking ? 'Réflexion…' : <span className="flex items-center gap-1.5"><Send size={13} /> Demander</span>}</Button>
      </form>
      {answer && <div className="text-sm bg-surface border border-line rounded-lg p-3">{answer}</div>}
      {askError && <div className="text-sm text-bad">{askError}</div>}
      {!answer && !askError && !asking && <div className="text-xs text-mute">Pose une question sur tes propres données loggées (labo, projets) — nécessite que le coach IA soit configuré sur ce déploiement.</div>}
    </Card>
  );
}

export default function Engineering() {
  const [tab, setTab] = useState('journal');
  const [portfolioModal, setPortfolioModal] = useState(false);
  // Destructure from the whole store (not a scoped selector) so this
  // re-renders on ANY engineeringStore change — a selector keyed to just
  // `getBadges` would never re-fire since the function reference itself
  // never changes, even though the awardedBadges array it reads does.
  const { getBadges, projects, labEntries } = useEngineeringStore();
  const badges = getBadges();
  const Active = TABS.find((t) => t.key === tab)?.Component || LabJournal;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ingénierie</h1>
          <p className="text-mute text-sm mt-1">Journal de laboratoire et suivi de projets — pour le génie chimique et disciplines proches.</p>
        </div>
        {(projects.length > 0 || labEntries.length > 0) && (
          <Button variant="secondary" onClick={() => setPortfolioModal(true)}>
            <span className="flex items-center gap-2"><BookMarked size={14} /> Exporter le portfolio</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                active ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <Active />

      <AskEngineeringAI />

      <BadgeList badges={badges} />

      <PortfolioExportModal open={portfolioModal} onClose={() => setPortfolioModal(false)} projects={projects} labEntries={labEntries} />
    </div>
  );
}
