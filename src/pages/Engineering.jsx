import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, FolderKanban, Plus, Trash2, Pencil, FileDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useEngineeringStore } from '../store/engineeringStore';
import { ENGINEERING_PROJECT_TYPES, ENGINEERING_PROJECT_STAGES } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';

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

const blankEntry = () => ({
  date: todayKey(), title: '', course: '', objective: '', protocol: '', reagents: '', yieldPercent: '', observations: '', conclusion: '', tags: '',
});
const blankProject = () => ({ name: '', type: ENGINEERING_PROJECT_TYPES[0], description: '', deadline: '', notes: '' });

function LabJournal() {
  const { labEntries, addLabEntry, editLabEntry, deleteLabEntry } = useEngineeringStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankEntry());

  const editFields = [
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'title', label: "Titre de l'expérience", type: 'text' },
    { name: 'course', label: 'Cours / module', type: 'text', placeholder: 'ex. Génie des réacteurs' },
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

  const yieldTrend = useMemo(
    () =>
      [...labEntries]
        .filter((e) => e.yieldPercent !== '' && e.yieldPercent != null)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => ({ date: e.date.slice(5), yield: Number(e.yieldPercent), title: e.title })),
    [labEntries]
  );

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

      {yieldTrend.length > 1 && (
        <Card title="Rendement dans le temps">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={yieldTrend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit="%" />
              <Tooltip {...tooltipStyle} formatter={(v, n, p) => [`${v}%`, p.payload.title]} />
              <Line type="monotone" dataKey="yield" stroke="#66ccff" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
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
            <Field label="Cours / module"><Input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="ex. Génie des réacteurs" /></Field>
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
  const { projects, addProject, deleteProject } = useEngineeringStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankProject());

  const byType = useMemo(
    () => ENGINEERING_PROJECT_TYPES.map((t) => ({ name: t, count: projects.filter((p) => p.type === t).length })).filter((p) => p.count > 0),
    [projects]
  );

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Projets" value={projects.length} />
        <Stat label="En cours" value={projects.filter((p) => p.stageStatus !== 'done' || p.stageIndex < ENGINEERING_PROJECT_STAGES.length - 1).length} />
        <Stat label="Terminés" value={projects.filter((p) => p.stageIndex === ENGINEERING_PROJECT_STAGES.length - 1 && p.stageStatus === 'done').length} />
        <Stat label="Types utilisés" value={byType.length} sub={`sur ${ENGINEERING_PROJECT_TYPES.length}`} />
      </div>

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

export default function Engineering() {
  const [tab, setTab] = useState('journal');
  // Destructure from the whole store (not a scoped selector) so this
  // re-renders on ANY engineeringStore change — a selector keyed to just
  // `getBadges` would never re-fire since the function reference itself
  // never changes, even though the awardedBadges array it reads does.
  const { getBadges } = useEngineeringStore();
  const badges = getBadges();
  const Active = TABS.find((t) => t.key === tab)?.Component || LabJournal;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Ingénierie</h1>
        <p className="text-mute text-sm mt-1">Journal de laboratoire et suivi de projets — pour le génie chimique et disciplines proches.</p>
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

      {badges.some((b) => b.earned) && (
        <Card title="Badges obtenus">
          <div className="flex flex-wrap gap-2">
            {badges.filter((b) => b.earned).map((b) => (
              <Badge key={b.id}>{b.name}</Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
