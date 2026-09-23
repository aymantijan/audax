import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Archive, ChevronDown, ChevronRight, BookOpen, Flame, GraduationCap, Sparkles, Plus, ListChecks } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useReadingsStore } from '../../store/readingsStore';
import { useFocusStore } from '../../store/focusStore';
import { minutesByCourse, weekStart, fmtMinutes } from '../../utils/study';
import { weightedGPA } from '../../utils/calculations';
import { GRADE_POINTS } from '../../utils/constants';
import { calculateCourseProgress } from '../../utils/course-progress';
import { preview, LEARNING_MOMENTUM_CONFIG } from '../../utils/momentum';
import { subjectResult, isAcademic } from '../../utils/academic';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Modal, ProgressBar } from '../common/ui';
import CourseCsvTools from './CourseCsvTools';
import { TrackFormModal } from './TrackModals';
import { SectionHeader, SegmentedTabs, useAcademicSettings, GradePill, BigStat, tint } from './design';
import { courseColor } from './TimetableView';

const progressOf = (c) => (c.status === 'completed' ? 100 : calculateCourseProgress(c));

function nextTask(c) {
  for (const ch of c.chapters || []) {
    const it = (ch.checklistItems || []).find((x) => !x.completed);
    if (it) return `${ch.title} — ${it.title}`;
  }
  return null;
}

function CourseCard({ c, settings, selected, onSelect, onDelete, weekMin = 0 }) {
  const p = progressOf(c);
  const acad = isAcademic(c);
  const r = acad ? subjectResult(c, settings) : null;
  const next = nextTask(c);
  const color = courseColor(c.id);
  return (
    <div className="rounded-xl border border-line bg-card p-4 flex flex-col gap-3 hover:border-accent/60 transition-colors">
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1.5" checked={selected} onChange={onSelect} title="Sélectionner" />
        <div className="w-1 self-stretch rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <Link to={`/learning/course/${c.id}`} className="font-semibold text-ink hover:text-accent leading-snug block">{c.name}</Link>
          <div className="text-[11px] text-mute mt-0.5 flex flex-wrap gap-x-2">
            <span className="inline-flex items-center gap-1" style={{ color: acad ? 'var(--accent-primary)' : 'var(--accent-secondary)' }}>
              {acad ? <GraduationCap size={11} /> : <Sparkles size={11} />}{acad ? 'Cursus' : 'Cours libre'}
            </span>
            {c.institution && <span>{c.institution}</span>}
            {c.professor && <span>· {c.professor}</span>}
          </div>
        </div>
        {acad && <GradePill value={r.value} settings={settings} />}
      </div>
      <div>
        <div className="flex justify-between text-[11px] text-mute mb-1">
          <span className="flex items-center gap-1"><ListChecks size={11} /> Programme{c.chapters?.length ? ` · ${c.chapters.length} chapitre(s)` : ''}</span>
          <span className="tabular-nums text-ink">{p}%</span>
        </div>
        <ProgressBar value={p} color={color} height={6} />
        <div className="text-[11px] text-mute mt-1.5 truncate">
          {next ? <>Prochaine étape : <span className="text-ink">{next}</span></> : c.chapters?.length ? 'Programme terminé 🎉' : 'Ajoutez les chapitres pour suivre l’avancement.'}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <Link to={`/learning/course/${c.id}`} className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-line text-ink hover:border-accent">Ouvrir</Link>
        <span className="text-[11px] text-mute">{weekMin ? `${fmtMinutes(weekMin)} cette semaine` : 'pas étudié cette semaine'}</span>
        <button className="ml-auto p-1.5 text-mute hover:text-bad cursor-pointer" title="Supprimer" onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

export default function CoursesView() {
  const { courses, deleteCourse } = useLearningStore();
  const momentumRaw = useLearningStore((s) => s.momentum);
  const settings = useAcademicSettings();
  const readingProgress = useReadingsStore((s) => s.progress);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const sessions = useFocusStore((s) => s.sessions);
  const weekMins = useMemo(() => { const t = todayKey(); return minutesByCourse(sessions, weekStart(t), t); }, [sessions]);

  // See Learning history: the live momentum preview must be memoised on the
  // raw persisted object, never computed inside the zustand selector.
  const momentum = useMemo(() => preview(momentumRaw, todayKey(), LEARNING_MOMENTUM_CONFIG), [momentumRaw]);

  const active = courses.filter((c) => c.status === 'active');
  const completed = courses.filter((c) => c.status === 'completed');
  const shown = active.filter((c) => filter === 'all' || (filter === 'academic' ? isAcademic(c) : !isAcademic(c)));
  const avgProgress = active.length ? Math.round(active.reduce((s, c) => s + progressOf(c), 0) / active.length) : 0;
  const gpa = weightedGPA(courses, GRADE_POINTS);
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const momentumColor = momentum.momentum >= 0.9 ? 'var(--success)' : momentum.momentum >= 0.65 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat label="Cours en cours" value={active.length} sub={`${active.filter(isAcademic).length} du cursus · ${active.filter((c) => !isAcademic(c)).length} libres`} />
        <BigStat label="Avancement moyen" value={`${avgProgress}%`} sub="programmes cochés" />
        <BigStat label="Régularité" value={`×${momentum.momentum.toFixed(2)}`} color={momentumColor}
          sub={momentum.streak > 0 ? `série de ${momentum.streak} j` : momentum.missedDays > 0 ? `${momentum.missedDays} j sans étudier` : 'cochez une tâche aujourd’hui'} />
        <BigStat label="Terminés" value={completed.length} sub={`${readingProgress.length} livre(s) suivis${gpa != null ? ` · GPA ${gpa.toFixed(2)}` : ''}`} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SegmentedTabs value={filter} onChange={setFilter} tabs={[
          { key: 'all', label: 'Tous', count: active.length },
          { key: 'academic', label: 'Cursus', icon: GraduationCap },
          { key: 'free', label: 'Cours libres', icon: Sparkles },
        ]} />
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <Button variant="danger" onClick={() => setDeleting([...selected])}><span className="flex items-center gap-1.5"><Trash2 size={14} /> Supprimer ({selected.size})</span></Button>
          )}
          <Link to="/learning/readings"><Button variant="secondary"><span className="flex items-center gap-1.5"><BookOpen size={14} /> Lectures</span></Button></Link>
          <Button onClick={() => setNewOpen(true)}><span className="flex items-center gap-1.5"><Plus size={15} /> Parcours</span></Button>
        </div>
      </div>

      {shown.length ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((c) => (
            <CourseCard key={c.id} c={c} settings={settings} selected={selected.has(c.id)} onSelect={() => toggle(c.id)} onDelete={() => setDeleting([c.id])} weekMin={weekMins[c.id]} />
          ))}
        </div>
      ) : (
        <Card><div className="text-center py-6 text-sm text-mute">Aucun cours ici. Ajoutez une formation (trading, langues, n'importe quel sujet) ou une matière du cursus.</div></Card>
      )}

      <div className="rounded-xl border border-line px-4 py-3 text-[11px] text-mute flex items-start gap-2" style={{ background: tint('var(--accent-primary)', 5) }}>
        <Flame size={13} className="text-accent shrink-0 mt-0.5" />
        La régularité est séparée de l'avancement : chaque jour où vous cochez une tâche fait monter la série, chaque jour manqué la fait baisser. Le score de chaque cours = avancement × régularité.
      </div>

      {completed.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <button onClick={() => setArchiveOpen((v) => !v)} className="w-full flex items-center gap-2 px-5 py-4 cursor-pointer text-left">
            {archiveOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Archive size={16} className="text-mute" />
            <span className="font-semibold">Archives</span>
            <span className="text-xs text-mute">· {completed.length} terminé(s)</span>
          </button>
          {archiveOpen && (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-mute border-b border-line bg-surface/40">
                    <th className="py-2.5 px-5">Cours</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Établissement</th>
                    <th className="py-2.5 px-3 text-center">Note</th>
                    <th className="py-2.5 px-3 hidden lg:table-cell">Terminé le</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {[...completed].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).map((c) => (
                    <tr key={c.id} className="border-b border-line/40">
                      <td className="py-2.5 px-5"><Link to={`/learning/course/${c.id}`} className="font-medium hover:text-accent">{c.name}</Link></td>
                      <td className="py-2.5 px-3 hidden sm:table-cell text-mute">{c.institution}</td>
                      <td className="py-2.5 px-3 text-center">
                        {isAcademic(c) ? <GradePill value={subjectResult(c, settings).value} settings={settings} size="sm" /> : <span className="text-mute">{c.actualGrade || '—'}</span>}
                      </td>
                      <td className="py-2.5 px-3 hidden lg:table-cell text-mute text-xs">{c.completedAt ? new Date(c.completedAt).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => setDeleting([c.id])}><Trash2 size={13} className="inline" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <CourseCsvTools courses={courses} />

      <TrackFormModal open={newOpen} onClose={() => setNewOpen(false)} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={deleting?.length > 1 ? `Supprimer ${deleting.length} cours ?` : 'Supprimer ce cours ?'}>
        <p className="text-sm text-mute">Le cours, ses chapitres, ses notes et sa progression seront supprimés définitivement.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => {
            deleting.forEach((id) => deleteCourse(id));
            setSelected((s) => { const n = new Set(s); deleting.forEach((id) => n.delete(id)); return n; });
            setDeleting(null);
          }}>Supprimer</Button>
        </div>
      </Modal>
    </div>
  );
}
