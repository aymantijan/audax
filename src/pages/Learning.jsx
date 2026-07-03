import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, GraduationCap, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useLearningStore } from '../store/learningStore';
import { useSkillStore } from '../store/skillStore';
import { weightedGPA } from '../utils/calculations';
import { GRADES, GRADE_POINTS, GRADE_XP, SKILL_MAP } from '../utils/constants';
import { COURSE_TEMPLATES } from '../utils/course-templates';
import { calculateCourseProgress, gradeForProgress } from '../utils/course-progress';
import { courseSchema, validate } from '../utils/validators';
import { Card, Stat, Button, Field, Input, Select, Modal, ProgressBar, Badge, EmptyState } from '../components/common/ui';
import SkillPicker from '../components/common/SkillPicker';

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
  const [openChapters, setOpenChapters] = useState({});
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
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Course</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="GPA" value={gpa !== null ? gpa.toFixed(2) : '—'} sub="weighted by credits" />
        <Stat label="Active courses" value={active.length} />
        <Stat label="Completed" value={completed.length} />
        <Stat label="Credits earned" value={totalCredits} />
      </div>

      {courses.length === 0 && (
        <Card>
          <EmptyState>
            <GraduationCap className="mx-auto mb-2 text-mute" size={28} />
            No courses yet. Add your first course — completing it awards XP to its linked skills.
          </EmptyState>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {[...courses].sort((a, b) => (a.status === 'active' ? -1 : 1)).map((c) => (
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
