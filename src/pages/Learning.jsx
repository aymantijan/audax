import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, GraduationCap, BookOpen, ChevronDown, ChevronRight, Archive } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useLearningStore } from '../store/learningStore';
import { useReadingsStore } from '../store/readingsStore';
import { useSkillStore } from '../store/skillStore';
import { weightedGPA } from '../utils/calculations';
import { GRADES, GRADE_POINTS, GRADE_XP, SKILL_MAP } from '../utils/constants';
import { COURSE_TEMPLATES } from '../utils/course-templates';
import { calculateCourseProgress, gradeForProgress } from '../utils/course-progress';
import { preview, LEARNING_MOMENTUM_CONFIG } from '../utils/momentum';
import { courseSchema, validate } from '../utils/validators';
import { fmtDate, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, ProgressBar, Badge, EmptyState } from '../components/common/ui';
import SkillPicker from '../components/common/SkillPicker';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const courseProgressOf = (c) => (c.status === 'completed' ? 100 : c.chapters?.length ? calculateCourseProgress(c) : Number(c.progressPercent) || 0);

const READING_TYPES = ['article', 'book', 'paper', 'podcast', 'video'];
const newChapter = () => ({ title: '', coefficient: 1, checklistItems: [{ title: '', coefficient: 1 }] });

const blank = () => ({
  name: '',
  institution: 'ISCAE',
  professor: '',
  credits: 3,
  expectedGrade: 'A',
  progressPercent: 0,
  linkedSkills: [],
  chapters: [newChapter()],
});

export default function Learning() {
  const { courses, addCourse, editCourse, completeCourse, dropCourse, deleteCourse, toggleReading, addReading, toggleChecklistItem } = useLearningStore();
  const readingsStore = useReadingsStore();
  const [openChapters, setOpenChapters] = useState({});
  const [archiveOpen, setArchiveOpen] = useState(false);
  const skills = useSkillStore((s) => s.skills);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(null); // course being graded
  const [grade, setGrade] = useState('A');
  const [readingDrafts, setReadingDrafts] = useState({});
  const [readingTypes, setReadingTypes] = useState({});
  const [template, setTemplate] = useState('');

  const gpa = weightedGPA(courses, GRADE_POINTS);
  const active = courses.filter((c) => c.status === 'active');
  const completed = courses.filter((c) => c.status === 'completed');
  const totalCredits = completed.reduce((a, c) => a + Number(c.credits || 0), 0);

  // ── Two independent scores that combine into overall progress ──
  // Course score is momentum-adjusted: raw checklist progress discounted by
  // how consistently you've actually been studying, so a course cannot be
  // crammed to a top score in one sitting.
  // IMPORTANT: `momentumRaw` selects the persisted state object directly —
  // it only changes reference when the store actually mutates it. Computing
  // the live preview from it with useMemo (rather than calling a store method
  // that returns a fresh object inside the zustand selector itself) avoids an
  // infinite render loop: useSyncExternalStore requires the selector's return
  // value be referentially stable when nothing changed.
  const momentumRaw = useLearningStore((s) => s.momentum);
  const momentum = useMemo(() => preview(momentumRaw, todayKey(), LEARNING_MOMENTUM_CONFIG), [momentumRaw]);
  const getCourseScore = (c) => Math.round(courseProgressOf(c) * momentum.momentum);
  const scored = courses.filter((c) => c.status !== 'dropped');
  const courseScore = scored.length ? Math.round(scored.reduce((a, c) => a + getCourseScore(c), 0) / scored.length) : 0;

  const readingProgress = readingsStore.progress;
  const readingScore = useMemo(() => {
    if (!readingProgress.length) return 0;
    const pcts = readingProgress.map((p) => {
      if (p.status === 'completed') return 100;
      const total = readingsStore.totalPagesFor(p);
      return total > 0 ? Math.min(100, (p.pagesRead / total) * 100) : 0;
    });
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [readingProgress, readingsStore]);

  // Overall = courses when there are no readings, readings when there are no courses,
  // otherwise the mean of the two sub-scores. Each has its own visible score.
  const generalProgress =
    scored.length && readingProgress.length ? Math.round((courseScore + readingScore) / 2)
    : scored.length ? courseScore
    : readingProgress.length ? readingScore : 0;

  // Bar chart: one bar per course (active + completed), y = momentum-adjusted score 0-100.
  const chartData = useMemo(
    () => courses.filter((c) => c.status !== 'dropped').map((c) => ({
      name: c.name.length > 18 ? c.name.slice(0, 17) + '…' : c.name,
      progress: getCourseScore(c),
      rawProgress: courseProgressOf(c),
      status: c.status,
    })),
    [courses, momentum.momentum]
  );

  const applyTemplate = (value) => {
    setTemplate(value);
    if (!value) return;
    const [group, name] = value.split('||');
    const tpl = COURSE_TEMPLATES.find((g) => g.group === group)?.items.find((i) => i.name === name);
    if (tpl) {
      // Only suggest skills that are currently unlocked — locked skills can't receive XP
      const unlockedSuggestions = tpl.skills.filter((id) => skills[id] && !skills[id].locked);
      setForm((f) => ({ ...f, name: tpl.name, linkedSkills: unlockedSuggestions }));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const res = validate(courseSchema, form);
    if (!res.ok) return setError(res.error);
    // Include chapters (dropped by the schema): filter blanks, strip empty chapters.
    const chapters = (form.chapters || [])
      .map((ch) => ({ ...ch, checklistItems: (ch.checklistItems || []).filter((it) => it.title?.trim()) }))
      .filter((ch) => ch.title?.trim() && ch.checklistItems.length > 0);
    addCourse({ ...res.data, chapters });
    setModal(false);
    setForm(blank());
    setError('');
  };

  const toggleSkill = (id) =>
    setForm((f) => ({
      ...f,
      linkedSkills: f.linkedSkills.includes(id) ? f.linkedSkills.filter((s) => s !== id) : [...f.linkedSkills, id],
    }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Learning</h1>
          <p className="text-mute text-sm mt-1">Courses, readings, and GPA.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/learning/readings">
            <Button variant="secondary">
              <span className="flex items-center gap-2"><BookOpen size={15} /> Readings</span>
            </Button>
          </Link>
          <Button onClick={() => setModal(true)}>
            <span className="flex items-center gap-2"><Plus size={16} /> Add Course</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Overall progress" value={`${generalProgress}%`} sub="courses + reading combined" color="var(--accent-primary)" />
        <Stat label="Course score" value={`${courseScore}%`} sub={`${active.length} active · ${completed.length} done`} />
        <Stat label="Reading score" value={`${readingScore}%`} sub={`${readingProgress.length} book(s) tracked`} />
        <Stat label="GPA" value={gpa !== null ? gpa.toFixed(2) : '—'} sub={`${totalCredits} credits earned`} />
      </div>

      {(scored.length > 0 || readingProgress.length > 0) && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card title="Progress breakdown">
            <div className="space-y-4">
              {[
                { label: 'Courses', value: courseScore, color: 'var(--accent-secondary)' },
                { label: 'Reading', value: readingScore, color: 'var(--warning)' },
                { label: 'Overall', value: generalProgress, color: 'var(--accent-primary)' },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={r.label === 'Overall' ? 'font-semibold' : 'text-mute'}>{r.label}</span>
                    <span className="font-medium">{r.value}%</span>
                  </div>
                  <ProgressBar value={r.value} color={r.color} height={r.label === 'Overall' ? 10 : 7} />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
              <span className="text-mute">Learning momentum{momentum.streak > 0 ? ` · ${momentum.streak}d streak` : momentum.missedDays > 0 ? ` · ${momentum.missedDays}d missed` : ''}</span>
              <span className="font-semibold" style={{ color: momentum.momentum >= 0.9 ? 'var(--success)' : momentum.momentum >= 0.65 ? 'var(--warning)' : 'var(--error)' }}>
                ×{momentum.momentum.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-mute mt-2">
              Complete a task today to grow your streak. Course score = checklist progress × momentum — skip a day and you lose part of what each task is worth, so cramming a course in one sitting can't hold a top score.
            </p>
          </Card>

          <Card title="Progression par cours" className="lg:col-span-2">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 40, left: -8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={60} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v, key) => [`${v}%`, key === 'progress' ? 'Score (momentum-adjusted)' : 'Raw progress']} />
                  <Bar dataKey="progress" radius={[4, 4, 0, 0]} maxBarSize={54}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.status === 'completed' ? 'var(--success)' : 'var(--accent-primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>Add a course to see per-course progression.</EmptyState>
            )}
          </Card>
        </div>
      )}

      {courses.length === 0 && (
        <Card>
          <EmptyState>
            <GraduationCap className="mx-auto mb-2 text-mute" size={28} />
            No courses yet. Add your first course — completing it awards XP to its linked skills.
          </EmptyState>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {active.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                <div className="text-xs text-mute mt-0.5">
                  {c.institution}{c.professor ? ` · ${c.professor}` : ''} · {c.credits} credits
                </div>
              </div>
              <Badge
                color={c.status === 'completed' ? 'var(--success)' : c.status === 'dropped' ? 'var(--error)' : 'var(--accent-primary)'}
              >
                {c.status}
              </Badge>
            </div>

            {c.status === 'active' && (() => {
              const autoProgress = c.chapters?.length ? calculateCourseProgress(c) : c.progressPercent;
              return (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-mute mb-1">
                    <span>Progress {c.chapters?.length ? '(auto)' : ''}</span>
                    <span>{autoProgress}%</span>
                  </div>
                  <ProgressBar value={autoProgress} />
                  {!c.chapters?.length && (
                    <input type="range" min="0" max="100" value={c.progressPercent} onChange={(e) => editCourse(c.id, { progressPercent: Number(e.target.value) })} className="w-full mt-1" />
                  )}
                  {c.chapters?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {c.chapters.map((ch) => {
                        const key = `${c.id}:${ch.id}`;
                        const open = openChapters[key] ?? true;
                        const done = ch.checklistItems.filter((it) => it.completed).length;
                        const chW = ch.checklistItems.reduce((s, it) => s + (Number(it.coefficient) || 1), 0);
                        const doneW = ch.checklistItems.reduce((s, it) => s + (it.completed ? Number(it.coefficient) || 1 : 0), 0);
                        const chProg = chW ? Math.round((doneW / chW) * 100) : 0;
                        return (
                          <div key={ch.id} className="border border-line rounded-lg">
                            <button type="button" onClick={() => setOpenChapters((o) => ({ ...o, [key]: !open }))} className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer text-left">
                              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              <span className="text-sm flex-1">{ch.title || <span className="text-mute">Untitled chapter</span>}</span>
                              <span className="text-xs text-mute">{done}/{ch.checklistItems.length} · ×{ch.coefficient}</span>
                              <span className="text-xs font-medium w-10 text-right">{chProg}%</span>
                            </button>
                            {open && (
                              <ul className="border-t border-line/50 divide-y divide-line/40">
                                {ch.checklistItems.map((it) => (
                                  <li key={it.id} className="px-3 py-1.5 flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={it.completed} onChange={() => toggleChecklistItem(c.id, ch.id, it.id)} />
                                    <span className={it.completed ? 'line-through text-mute flex-1' : 'flex-1'}>{it.title}</span>
                                    <span className="text-[10px] text-mute">×{it.coefficient}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="text-xs text-mute mb-2">
              Grade: expected <span className="text-ink">{c.expectedGrade}</span>
              {c.actualGrade && (
                <>
                  {' '}· actual <span className="text-good font-semibold">{c.actualGrade}</span>
                </>
              )}
            </div>

            {c.linkedSkills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.linkedSkills.map((id) => (
                  <Badge key={id} color="var(--accent-secondary)">{SKILL_MAP[id]?.name || id}</Badge>
                ))}
              </div>
            )}

            <div className="border-t border-line pt-3 mt-2">
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <BookOpen size={12} /> Readings ({(c.readings || []).filter((r) => r.completed).length}/{(c.readings || []).length})
              </div>
              <ul className="space-y-1.5 mb-2">
                {(c.readings || []).map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.completed} onChange={() => toggleReading(c.id, i)} />
                    <span className={r.completed ? 'line-through text-mute' : ''}>{r.title}</span>
                    <span className="text-[10px] text-mute">({r.type})</span>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const title = (readingDrafts[c.id] || '').trim();
                  if (!title) return;
                  addReading(c.id, { title, type: readingTypes[c.id] || 'article' });
                  setReadingDrafts((d) => ({ ...d, [c.id]: '' }));
                }}
              >
                <Input
                  placeholder="Add a reading…"
                  value={readingDrafts[c.id] || ''}
                  onChange={(e) => setReadingDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                />
                <select
                  className="bg-surface border border-line rounded-lg px-2 text-xs text-ink"
                  value={readingTypes[c.id] || 'article'}
                  onChange={(e) => setReadingTypes((d) => ({ ...d, [c.id]: e.target.value }))}
                >
                  {READING_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <Button type="submit" variant="secondary">Add</Button>
              </form>
            </div>

            <div className="flex gap-2 mt-4">
              <Link to={`/learning/course/${c.id}`} className="px-4 py-2 rounded-lg text-sm bg-surface border border-line text-ink hover:border-accent transition-colors cursor-pointer">
                Open
              </Link>
              {c.status === 'active' && (
                <>
                  <Button variant="secondary" onClick={() => { setCompleting(c); setGrade(c.expectedGrade); }}>
                    Mark complete
                  </Button>
                  <Button variant="ghost" onClick={() => dropCourse(c.id)}>Drop</Button>
                </>
              )}
              <Button variant="ghost" className="ml-auto" onClick={() => { if (confirm('Delete this course?')) deleteCourse(c.id); }}>
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Professional archive of completed courses ── */}
      {completed.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <button onClick={() => setArchiveOpen((v) => !v)} className="w-full flex items-center gap-2 px-5 py-4 cursor-pointer text-left">
            {archiveOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Archive size={16} className="text-mute" />
            <span className="font-semibold">Archive</span>
            <Badge color="var(--success)">{completed.length} completed</Badge>
            <span className="ml-auto text-xs text-mute">{totalCredits} credits · GPA {gpa !== null ? gpa.toFixed(2) : '—'}</span>
          </button>
          {archiveOpen && (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-mute border-b border-line bg-surface/40">
                    <th className="py-2.5 px-5">Course</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Institution</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                    <th className="py-2.5 px-3 text-center hidden md:table-cell">Credits</th>
                    <th className="py-2.5 px-3 hidden lg:table-cell">Completed</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {[...completed].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).map((c) => (
                    <tr key={c.id} className="border-b border-line/40">
                      <td className="py-2.5 px-5">
                        <div className="font-medium">{c.name}</div>
                        {c.professor && <div className="text-[11px] text-mute">{c.professor}</div>}
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell text-mute">{c.institution}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge color={GRADE_POINTS[c.actualGrade] >= 3.5 ? 'var(--success)' : GRADE_POINTS[c.actualGrade] >= 2.5 ? 'var(--warning)' : 'var(--error)'}>{c.actualGrade || '—'}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center hidden md:table-cell text-mute">{c.credits}</td>
                      <td className="py-2.5 px-3 hidden lg:table-cell text-mute text-xs">{c.completedAt ? fmtDate(c.completedAt) : '—'}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Link to={`/learning/course/${c.id}`} className="text-mute hover:text-accent text-xs mr-3">Open</Link>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this course?')) deleteCourse(c.id); }}>
                          <Trash2 size={13} className="inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Course">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Template (optional)" hint="Picking one prefills the name and suggested linked skills.">
            <Select value={template} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Start from scratch —</option>
              {COURSE_TEMPLATES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((i) => (
                    <option key={i.name} value={`${g.group}||${i.name}`}>{i.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Course name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Institution">
              <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </Field>
            <Field label="Professor">
              <Input value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} />
            </Field>
            <Field label="Credits">
              <Input type="number" min="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} />
            </Field>
            <Field label="Expected grade">
              <Select value={form.expectedGrade} onChange={(e) => setForm({ ...form, expectedGrade: e.target.value })} options={GRADES} />
            </Field>
          </div>
          <Field label="Linked skills (XP awarded on completion)">
            <SkillPicker value={form.linkedSkills} onChange={(ids) => setForm({ ...form, linkedSkills: ids })} />
          </Field>

          <div className="pt-2 border-t border-line">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-mute uppercase tracking-wide">Chapters (auto-progress)</div>
              <button type="button" onClick={() => setForm({ ...form, chapters: [...form.chapters, newChapter()] })} className="text-xs text-accent cursor-pointer flex items-center gap-1">
                <Plus size={12} /> Chapter
              </button>
            </div>
            <div className="space-y-3">
              {form.chapters.map((ch, ci) => (
                <div key={ci} className="border border-line rounded-lg p-3 bg-surface">
                  <div className="grid grid-cols-[1fr_5rem_auto] gap-2 items-end">
                    <Field label={`Chapter ${ci + 1} title`}>
                      <Input value={ch.title} onChange={(e) => {
                        const chapters = [...form.chapters]; chapters[ci] = { ...ch, title: e.target.value }; setForm({ ...form, chapters });
                      }} />
                    </Field>
                    <Field label="Coeff (0.5–2)">
                      <Input type="number" min="0.5" max="2" step="0.1" value={ch.coefficient} onChange={(e) => {
                        const chapters = [...form.chapters]; chapters[ci] = { ...ch, coefficient: Math.max(0.5, Math.min(2, Number(e.target.value) || 1)) }; setForm({ ...form, chapters });
                      }} />
                    </Field>
                    <button type="button" className="text-mute hover:text-bad cursor-pointer pb-2" onClick={() => setForm({ ...form, chapters: form.chapters.filter((_, i) => i !== ci) })}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {ch.checklistItems.map((it, ii) => (
                      <div key={ii} className="grid grid-cols-[1fr_4rem_auto] gap-2">
                        <Input value={it.title} placeholder="Checklist item" onChange={(e) => {
                          const chapters = [...form.chapters]; const items = [...ch.checklistItems]; items[ii] = { ...it, title: e.target.value }; chapters[ci] = { ...ch, checklistItems: items }; setForm({ ...form, chapters });
                        }} />
                        <Input type="number" min="0.5" max="2" step="0.1" value={it.coefficient} title="Item coefficient" onChange={(e) => {
                          const chapters = [...form.chapters]; const items = [...ch.checklistItems]; items[ii] = { ...it, coefficient: Math.max(0.5, Math.min(2, Number(e.target.value) || 1)) }; chapters[ci] = { ...ch, checklistItems: items }; setForm({ ...form, chapters });
                        }} />
                        <button type="button" className="text-mute hover:text-bad cursor-pointer" onClick={() => {
                          const chapters = [...form.chapters]; chapters[ci] = { ...ch, checklistItems: ch.checklistItems.filter((_, i) => i !== ii) }; setForm({ ...form, chapters });
                        }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      const chapters = [...form.chapters]; chapters[ci] = { ...ch, checklistItems: [...ch.checklistItems, { title: '', coefficient: 1 }] }; setForm({ ...form, chapters });
                    }} className="text-xs text-accent cursor-pointer flex items-center gap-1 pt-1">
                      <Plus size={11} /> Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-bad text-sm">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit">Add course</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!completing} onClose={() => setCompleting(null)} title={`Complete: ${completing?.name}`}>
        <div className="space-y-4">
          <Field label="Final grade" hint={`Awards +${GRADE_XP[grade]} XP to each linked skill.`}>
            <Select value={grade} onChange={(e) => setGrade(e.target.value)} options={GRADES} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button
              onClick={() => {
                completeCourse(completing.id, grade);
                setCompleting(null);
              }}
            >
              Complete course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
