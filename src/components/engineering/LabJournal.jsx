import { useMemo, useState } from 'react';
import { FlaskConical, Plus, Trash2, Pencil, FileDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useEngineeringStore } from '../../store/engineeringStore';
import { useLearningStore } from '../../store/learningStore';
import { ENGINEERING_PROJECT_TYPES } from '../../utils/constants';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, EmptyState } from '../common/ui';
import EntityFormModal from '../common/EntityFormModal';
import { tooltipStyle } from '../common/chart-theme';
import { exportLabEntryPDF } from './engineering-pdf';

export const blankEntry = () => ({
  date: todayKey(), title: '', course: '', objective: '', protocol: '', reagents: '', yieldPercent: '', observations: '', conclusion: '', tags: '',
});
export const blankProject = () => ({ name: '', type: ENGINEERING_PROJECT_TYPES[0], description: '', deadline: '', notes: '' });

export function LabJournal() {
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
