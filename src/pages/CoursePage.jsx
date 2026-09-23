import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight, GraduationCap, CalendarPlus, CalendarCheck, ClipboardCheck,
  CalendarDays, ListChecks, Calculator, BookOpen, Sparkles, CheckCircle2, AlertTriangle, RotateCcw, Flag, Play, Clock, Brain, Upload,
} from 'lucide-react';
import { useLearningStore } from '../store/learningStore';
import { useFocusStore } from '../store/focusStore';
import { minutesBetween, weekStart, fmtMinutes } from '../utils/study';
import { todayKey } from '../utils/formatters';
import { ManualSessionModal } from '../components/learning/StudyTimer';
import { useFlashcardStore, buildQueue, deckStats } from '../store/flashcardStore';
import ReviewSession from '../components/learning/ReviewSession';
import { CardModal, BulkCardsModal } from '../components/learning/ReviewView';
import { calculateCourseProgress } from '../utils/course-progress';
import { GRADES, GRADE_XP, SKILL_MAP } from '../utils/constants';
import { uid } from '../utils/formatters';
import {
  isAcademic, subjectResult, requiredGrade, simulateAverage, mentionFor, EVALUATION_TYPES, SLOT_KINDS, WEEKDAYS, fmtGrade, normGrade, letterFor,
} from '../utils/academic';
import { Card, Button, Badge, ProgressBar, Modal, Select, Field } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import ScheduleEventModal from '../components/common/ScheduleEventModal';
import { CourseFormModal } from '../components/learning/CursusModals';
import { useAcademicSettings, GradePill, BigStat, SectionHeader, MentionTag, tint, gradeColor } from '../components/learning/design';
import { courseColor } from '../components/learning/TimetableView';

const cellCls = 'w-full bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-accent';
const parseNum = (v) => (v === '' ? null : Number(String(v).replace(',', '.')));

// ── Evaluations (CC, partiel, examen…) ───────────────────────────────────
function EvaluationsCard({ course, settings }) {
  const { addEvaluation, editEvaluation, deleteEvaluation, editCourse } = useLearningStore();
  const evals = course.evaluations || [];
  const r = subjectResult(course, settings);
  const totalW = r.totalWeight;
  const ed = (id, patch) => editEvaluation(course.id, id, patch);

  return (
    <Card>
      <SectionHeader icon={ClipboardCheck} title="Évaluations & notes"
        subtitle={`Poids en % de la note finale · notes sur ${settings.scale} (ou barème propre à l'évaluation)`}
        action={<Button variant="secondary" className="!py-1.5" onClick={() => addEvaluation(course.id, { type: 'cc', name: '', weight: Math.max(0, 100 - totalW) })}><span className="flex items-center gap-1"><Plus size={13} /> Évaluation</span></Button>} />

      {evals.length ? (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[8.5rem_minmax(0,1fr)_4.5rem_9rem_8rem_2rem] gap-2 text-[11px] text-mute px-1">
            <span>Type</span><span>Intitulé</span><span>Poids %</span><span>Date</span><span>Note</span><span />
          </div>
          {evals.map((e) => {
            const g = normGrade(e, settings);
            return (
              <div key={e.id} className="grid grid-cols-2 md:grid-cols-[8.5rem_minmax(0,1fr)_4.5rem_9rem_8rem_2rem] gap-2 items-center rounded-lg md:rounded-none p-2 md:p-1 border md:border-0 border-line">
                <select className={cellCls} value={e.type} onChange={(ev) => ed(e.id, { type: ev.target.value })}>
                  {EVALUATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input className={cellCls} value={e.name || ''} placeholder="ex. Contrôle 1" onChange={(ev) => ed(e.id, { name: ev.target.value })} />
                <input className={cellCls} type="number" min="0" max="100" value={e.weight ?? ''} onChange={(ev) => ed(e.id, { weight: parseNum(ev.target.value) ?? 0 })} title="Poids en %" />
                <input className={cellCls} type="date" value={e.date || ''} onChange={(ev) => ed(e.id, { date: ev.target.value })} />
                <div className="flex items-center gap-1">
                  <input className={`${cellCls} tabular-nums font-semibold`} style={g != null ? { color: gradeColor(g, settings) } : undefined}
                    type="number" step="0.25" min="0" value={e.grade ?? ''} placeholder="—" onChange={(ev) => ed(e.id, { grade: parseNum(ev.target.value) })} />
                  <span className="text-mute text-xs">/</span>
                  <input className={`${cellCls} !w-14 !px-1.5 text-center`} type="number" min="1" value={e.outOf ?? settings.scale} onChange={(ev) => ed(e.id, { outOf: parseNum(ev.target.value) })} title="Noté sur" />
                </div>
                <button className="justify-self-end p-1.5 text-mute hover:text-bad cursor-pointer" title="Supprimer" onClick={() => deleteEvaluation(course.id, e.id)}><Trash2 size={13} /></button>
              </div>
            );
          })}
          <div className="flex items-center justify-between text-xs pt-2 px-1">
            <span className={r.weightsOk ? 'text-mute' : 'text-warning font-medium'}>
              Total des poids : {totalW}%{!r.weightsOk && ' — devrait faire 100 %'}
            </span>
            <span className="text-mute">{r.complete ? 'Toutes les notes sont saisies' : `${r.gradedWeight}% de la note déjà connue`}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-mute py-3">Ajoutez les évaluations de la matière (contrôle continu, partiel, examen…) avec leur poids.</p>
      )}

      {(r.complete || course.retakeGrade != null || course.finalGrade != null) && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-line">
          <Field label="Note de rattrapage" hint={r.final != null && r.final < settings.passMark ? 'Moyenne sous la note de validation : saisissez le rattrapage.' : 'Seulement si vous passez le rattrapage.'}>
            <input className={cellCls} type="number" step="0.25" value={course.retakeGrade ?? ''} placeholder="—" onChange={(ev) => editCourse(course.id, { retakeGrade: parseNum(ev.target.value) })} />
          </Field>
          <Field label="Moyenne officielle (optionnel)" hint="Si l'école publie une moyenne différente, elle remplace le calcul.">
            <input className={cellCls} type="number" step="0.01" value={course.finalGrade ?? ''} placeholder="—" onChange={(ev) => editCourse(course.id, { finalGrade: parseNum(ev.target.value) })} />
          </Field>
        </div>
      )}
    </Card>
  );
}

// ── "What if" simulator ──────────────────────────────────────────────────
function SimulatorCard({ course, settings }) {
  const target = course.targetGrade ?? settings.passMark;
  const req = requiredGrade(course, target, settings);
  const pass = requiredGrade(course, settings.passMark, settings);
  const [x, setX] = useState(() => Math.min(settings.scale, Math.max(0, Math.ceil((req?.needed ?? settings.passMark) * 4) / 4)));
  if (!req) return null;
  const sim = simulateAverage(course, x, settings);
  const mention = mentionFor(sim, settings);
  const names = req.remaining.map((e) => e.name || EVALUATION_TYPES.find((t) => t.value === e.type)?.label).join(', ');

  const line = (label, rq) => (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-surface">
      <span className="text-sm text-mute">{label}</span>
      {rq.status === 'secured' ? <span className="text-sm text-good flex items-center gap-1"><CheckCircle2 size={14} /> déjà assuré</span>
        : rq.status === 'impossible' ? <span className="text-sm text-bad flex items-center gap-1"><AlertTriangle size={14} /> hors d'atteinte ({fmtGrade(rq.needed)})</span>
        : <span className="text-lg font-bold tabular-nums" style={{ color: gradeColor(rq.needed, settings) }}>{fmtGrade(rq.needed)}<span className="text-xs text-mute font-normal">/{settings.scale}</span></span>}
    </div>
  );

  return (
    <Card>
      <SectionHeader icon={Calculator} title="Simulateur" subtitle={`Il reste : ${names}`} />
      <div className="space-y-2">
        {line('Pour valider la matière', pass)}
        {course.targetGrade != null && line(`Pour atteindre ${fmtGrade(target)}`, req)}
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-mute">Si j'obtiens <b className="text-ink tabular-nums">{fmtGrade(x)}</b> à ce qui reste</span>
          <span>→ moyenne <b className="tabular-nums text-lg" style={{ color: gradeColor(sim, settings) }}>{fmtGrade(sim)}</b>
            {mention && <span className="text-xs ml-1.5" style={{ color: mention.color }}>{mention.label}</span>}</span>
        </div>
        <input type="range" min="0" max={settings.scale} step={settings.scale > 20 ? 1 : 0.25} value={x} onChange={(e) => setX(Number(e.target.value))} className="w-full mt-2 accent-[var(--accent-primary)]" />
      </div>
    </Card>
  );
}

// ── Weekly timetable slots ───────────────────────────────────────────────
function SlotsCard({ course }) {
  const { addSlot, editSlot, deleteSlot } = useLearningStore();
  const slots = course.slots || [];
  return (
    <Card>
      <SectionHeader icon={CalendarDays} title="Emploi du temps"
        action={<Button variant="secondary" className="!py-1.5" onClick={() => addSlot(course.id, {})}><span className="flex items-center gap-1"><Plus size={13} /> Créneau</span></Button>} />
      {slots.length ? (
        <div className="space-y-2">
          {slots.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center rounded-lg border border-line p-2">
              <select className={cellCls} value={s.day} onChange={(e) => editSlot(course.id, s.id, { day: Number(e.target.value) })}>
                {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <input className={cellCls} type="time" value={s.start} onChange={(e) => editSlot(course.id, s.id, { start: e.target.value })} />
              <input className={cellCls} type="time" value={s.end} onChange={(e) => editSlot(course.id, s.id, { end: e.target.value })} />
              <select className={cellCls} value={s.kind} onChange={(e) => editSlot(course.id, s.id, { kind: e.target.value })}>
                {SLOT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input className={`${cellCls} col-span-1`} value={s.room || ''} placeholder="Salle" onChange={(e) => editSlot(course.id, s.id, { room: e.target.value })} />
              <button className="justify-self-end p-1.5 text-mute hover:text-bad cursor-pointer" onClick={() => deleteSlot(course.id, s.id)} title="Supprimer"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-mute">Ajoutez les créneaux hebdomadaires (cours, TD, TP) : ils alimentent l'emploi du temps.</p>
      )}
    </Card>
  );
}

// ── Chapters / checklist (programme) ─────────────────────────────────────
function ProgrammeCard({ course }) {
  const { updateCourse, toggleChecklistItem } = useLearningStore();
  const chapters = course.chapters || [];
  const [open, setOpen] = useState({});
  const [chapterModal, setChapterModal] = useState(null);
  const [itemModal, setItemModal] = useState(null);
  const [confirm, setConfirm] = useState(null); // { label, run }
  const progress = calculateCourseProgress(course);
  const color = courseColor(course.id);

  const saveChapter = (data) => {
    const coefficient = Math.max(0.5, Math.min(2, Number(data.coefficient) || 1));
    if (chapterModal?.isAdd) updateCourse(course.id, { chapters: [...chapters, { id: uid(), title: data.title || 'Sans titre', coefficient, checklistItems: [] }] });
    else updateCourse(course.id, { chapters: chapters.map((ch) => (ch.id === chapterModal.data.id ? { ...ch, title: data.title, coefficient } : ch)) });
  };
  const deleteChapter = (id) => updateCourse(course.id, { chapters: chapters.filter((ch) => ch.id !== id) });
  const saveItem = (data) => {
    const coefficient = Math.max(0.5, Math.min(2, Number(data.coefficient) || 1));
    updateCourse(course.id, {
      chapters: chapters.map((ch) => {
        if (ch.id !== itemModal.chapterId) return ch;
        if (itemModal.isAdd) return { ...ch, checklistItems: [...(ch.checklistItems || []), { id: uid(), title: data.title || '(sans titre)', coefficient, completed: false, completedDate: null }] };
        return { ...ch, checklistItems: ch.checklistItems.map((it) => (it.id === itemModal.data.id ? { ...it, title: data.title, coefficient } : it)) };
      }),
    });
  };
  const deleteItem = (chapterId, itemId) =>
    updateCourse(course.id, { chapters: chapters.map((ch) => (ch.id === chapterId ? { ...ch, checklistItems: ch.checklistItems.filter((it) => it.id !== itemId) } : ch)) });

  return (
    <Card>
      <SectionHeader icon={ListChecks} title="Programme" subtitle="Chapitres et tâches pondérés — cocher une tâche fait avancer la régularité du jour."
        action={<Button variant="secondary" className="!py-1.5" onClick={() => setChapterModal({ data: {}, isAdd: true })}><span className="flex items-center gap-1"><Plus size={13} /> Chapitre</span></Button>} />
      {chapters.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-mute mb-1"><span>Avancement</span><span className="text-ink tabular-nums">{progress}%</span></div>
          <ProgressBar value={progress} color={color} height={7} />
        </div>
      )}
      {chapters.length ? (
        <div className="space-y-2">
          {chapters.map((ch) => {
            const isOpen = open[ch.id] ?? true;
            const items = ch.checklistItems || [];
            const done = items.filter((it) => it.completed).length;
            const chW = items.reduce((s, it) => s + (Number(it.coefficient) || 1), 0);
            const doneW = items.reduce((s, it) => s + (it.completed ? Number(it.coefficient) || 1 : 0), 0);
            const pct = chW ? Math.round((doneW / chW) * 100) : 0;
            return (
              <div key={ch.id} className="rounded-lg border border-line">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button onClick={() => setOpen((o) => ({ ...o, [ch.id]: !isOpen }))} className="text-mute cursor-pointer">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{ch.title}</span>
                  <span className="text-[11px] text-mute whitespace-nowrap">{done}/{items.length} · ×{ch.coefficient}</span>
                  <span className="text-xs font-semibold w-10 text-right tabular-nums" style={{ color: pct === 100 ? 'var(--success)' : undefined }}>{pct}%</span>
                  <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => setChapterModal({ data: ch, isAdd: false })} title="Modifier"><Pencil size={12} /></button>
                  <button className="p-1 text-mute hover:text-bad cursor-pointer" onClick={() => setConfirm({ label: `Supprimer le chapitre « ${ch.title} » et ses tâches ?`, run: () => deleteChapter(ch.id) })} title="Supprimer"><Trash2 size={12} /></button>
                </div>
                {isOpen && (
                  <div className="border-t border-line/50 px-3 py-1.5">
                    {items.map((it) => (
                      <div key={it.id} className="py-1.5 flex items-center gap-2 text-sm group">
                        <input type="checkbox" checked={it.completed} onChange={() => toggleChecklistItem(course.id, ch.id, it.id)} className="cursor-pointer accent-[var(--accent-primary)]" />
                        <span className={`flex-1 min-w-0 ${it.completed ? 'line-through text-mute' : ''}`}>{it.title}</span>
                        <span className="text-[10px] text-mute">×{it.coefficient}</span>
                        <button className="p-1 text-mute hover:text-accent cursor-pointer opacity-60 group-hover:opacity-100" onClick={() => setItemModal({ chapterId: ch.id, data: it, isAdd: false })}><Pencil size={11} /></button>
                        <button className="p-1 text-mute hover:text-bad cursor-pointer opacity-60 group-hover:opacity-100" onClick={() => deleteItem(ch.id, it.id)}><Trash2 size={11} /></button>
                      </div>
                    ))}
                    <button onClick={() => setItemModal({ chapterId: ch.id, data: {}, isAdd: true })} className="my-1.5 text-xs text-accent cursor-pointer flex items-center gap-1"><Plus size={11} /> Tâche</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-mute">Découpez la matière en chapitres (d'après le plan du cours) pour suivre votre avancement.</p>
      )}

      {chapterModal && (
        <EntityFormModal open onClose={() => setChapterModal(null)} title={chapterModal.isAdd ? 'Nouveau chapitre' : 'Modifier le chapitre'}
          fields={[
            { name: 'title', label: 'Titre du chapitre', type: 'text' },
            { name: 'coefficient', label: 'Poids', type: 'number', step: '0.1', min: 0.5, max: 2, hint: '0,5 à 2 (importance par rapport aux autres chapitres)' },
          ]}
          initial={chapterModal.isAdd ? { coefficient: 1 } : chapterModal.data}
          onSave={saveChapter}
          onDelete={chapterModal.isAdd ? null : () => deleteChapter(chapterModal.data.id)} />
      )}
      {itemModal && (
        <EntityFormModal open onClose={() => setItemModal(null)} title={itemModal.isAdd ? 'Nouvelle tâche' : 'Modifier la tâche'}
          fields={[
            { name: 'title', label: 'Tâche', type: 'text' },
            { name: 'coefficient', label: 'Poids', type: 'number', step: '0.1', min: 0.5, max: 2, hint: '0,5 à 2 (importance dans le chapitre)' },
          ]}
          initial={itemModal.isAdd ? { coefficient: 1 } : itemModal.data}
          onSave={saveItem}
          onDelete={itemModal.isAdd ? null : () => deleteItem(itemModal.chapterId, itemModal.data.id)} />
      )}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Confirmer">
        <p className="text-sm text-mute">{confirm?.label}</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setConfirm(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { confirm.run(); setConfirm(null); }}>Supprimer</Button>
        </div>
      </Modal>
    </Card>
  );
}

// ── Flashcards of this subject ───────────────────────────────────────────
function FlashcardsCard({ course }) {
  const fc = useFlashcardStore();
  const deck = fc.decks.find((d) => d.courseId === course.id);
  const [cardOpen, setCardOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const st = deck ? deckStats(deck.id, fc.cards) : null;
  const pending = deck ? buildQueue({ cards: fc.cards, decks: fc.decks, deckIds: [deck.id], reviewLog: fc.reviewLog, settings: fc.settings }).length : 0;
  const ensure = () => fc.ensureCourseDeck(course.id);
  return (
    <Card>
      <SectionHeader icon={Brain} title="Fiches de révision" subtitle={st ? `${st.total} fiche(s) · ${st.due} à revoir · ${st.mature} maîtrisée(s)` : 'Définitions, formules, notions clés : révision espacée.'} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="!py-1.5" onClick={() => { ensure(); setCardOpen(true); }}><span className="flex items-center gap-1"><Plus size={13} /> Fiche</span></Button>
        <Button variant="secondary" className="!py-1.5" onClick={() => { ensure(); setBulkOpen(true); }}><span className="flex items-center gap-1"><Upload size={13} /> Importer</span></Button>
        {deck && <Button className="!py-1.5" disabled={!pending} onClick={() => setReviewing(true)}><span className="flex items-center gap-1"><Play size={13} /> {pending ? `Réviser (${pending})` : 'À jour'}</span></Button>}
      </div>
      {deck && <CardModal open={cardOpen} onClose={() => setCardOpen(false)} deckId={deck.id} />}
      {deck && <BulkCardsModal open={bulkOpen} onClose={() => setBulkOpen(false)} deckId={deck.id} />}
      {reviewing && deck && <ReviewSession deckIds={[deck.id]} title={`Révision — ${course.name}`} onClose={() => setReviewing(false)} />}
    </Card>
  );
}

// ── Course readings ──────────────────────────────────────────────────────
function ReadingsCard({ course }) {
  const { toggleReading, addReading } = useLearningStore();
  const [draft, setDraft] = useState('');
  const readings = course.readings || [];
  return (
    <Card>
      <SectionHeader icon={BookOpen} title="Lectures & ressources" subtitle={`${readings.filter((r) => r.completed).length}/${readings.length} terminée(s)`} />
      <ul className="space-y-1.5 mb-3">
        {readings.map((r, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!r.completed} onChange={() => toggleReading(course.id, i)} className="accent-[var(--accent-primary)]" />
            <span className={r.completed ? 'line-through text-mute' : ''}>{r.title}</span>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; addReading(course.id, { title: draft.trim(), type: 'article' }); setDraft(''); }}>
        <input className={cellCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Polycopié, chapitre de manuel, vidéo…" />
        <Button type="submit" variant="secondary" className="!py-1.5">Ajouter</Button>
      </form>
    </Card>
  );
}

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { courses, deleteCourse, getCourseScore, setCourseCalendarEvent, completeCourse, dropCourse, reopenCourse } = useLearningStore();
  const academic = useLearningStore((s) => s.academic);
  const settings = useAcademicSettings();
  const course = courses.find((c) => c.id === courseId);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [grade, setGrade] = useState('A');
  const [manualOpen, setManualOpen] = useState(false);
  const sessions = useFocusStore((s) => s.sessions);
  const activeTimer = useFocusStore((s) => s.activeTimer);
  const startTimer = useFocusStore((s) => s.startTimer);

  const r = useMemo(() => (course && isAcademic(course) ? subjectResult(course, settings) : null), [course, settings.scale, settings.passMark, settings.retakeRule]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <GraduationCap className="mx-auto mb-3 text-mute" size={30} />
        <h1 className="text-xl font-semibold">Cours introuvable</h1>
        <p className="text-mute text-sm mt-1">Il a peut-être été supprimé.</p>
        <Link to="/learning" className="inline-block mt-4 text-accent text-sm hover:underline">← Retour à Apprentissage</Link>
      </div>
    );
  }

  const acad = isAcademic(course);
  const term = academic.terms.find((t) => t.id === course.termId);
  const module = academic.modules.find((m) => m.id === course.moduleId);
  const progress = calculateCourseProgress(course);
  const color = courseColor(course.id);
  const target = course.targetGrade ?? settings.passMark;
  const req = acad ? requiredGrade(course, target, settings) : null;
  const backTo = acad ? '/learning?tab=cursus' : '/learning?tab=courses';
  const today = todayKey();
  const mySessions = sessions.filter((s) => s.courseId === course.id);
  const weekMin = minutesBetween(mySessions, weekStart(today), today);
  const totalMin = mySessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);
  const timingThis = activeTimer?.courseId === course.id;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Link to={backTo} className="inline-flex items-center gap-1 text-mute hover:text-ink text-sm"><ArrowLeft size={14} /> Apprentissage</Link>

      {/* Hero */}
      <div className="rounded-2xl border border-line p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${tint(color, 14)}, var(--bg-tertiary) 60%)` }}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: tint(color, 18), color }}>
                {acad ? <GraduationCap size={12} /> : <Sparkles size={12} />}{acad ? 'Matière' : 'Cours libre'}
              </span>
              {term && <span className="text-mute">{term.name}{module ? ` · ${module.name}` : ''}</span>}
              {course.status !== 'active' && <Badge color={course.status === 'completed' ? 'var(--success)' : 'var(--error)'}>{course.status === 'completed' ? 'Terminé' : 'Abandonné'}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <h1 className="text-2xl font-bold text-ink leading-tight">{course.name}</h1>
              <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => setEditOpen(true)} title="Modifier"><Pencil size={14} /></button>
            </div>
            <p className="text-sm text-mute mt-1">
              {[course.institution, course.professor, acad ? `coef. ${course.coefficient ?? 1}` : null, Number(course.credits) > 0 ? `${course.credits} crédits` : null].filter(Boolean).join(' · ')}
              {course.updatedAt && <span className="text-xs"> · modifié le {new Date(course.updatedAt).toLocaleDateString('fr-FR')}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {course.status === 'active' && (
              <Button disabled={!!activeTimer} title={activeTimer && !timingThis ? 'Un chrono tourne déjà' : undefined}
                onClick={() => startTimer({ domain: 'Learning', courseId: course.id, targetMin: 50 })}>
                <span className="flex items-center gap-1.5"><Play size={14} /> {timingThis ? 'Chrono en cours' : 'Étudier'}</span>
              </Button>
            )}
            <Button variant="secondary" onClick={() => setScheduleModal(true)}>
              <span className="flex items-center gap-1.5">{course.googleEventLink ? <CalendarCheck size={14} className="text-good" /> : <CalendarPlus size={14} />}{course.googleEventLink ? 'Planifié' : 'Planifier'}</span>
            </Button>
            {course.status === 'active' ? (
              <>
                <Button variant="secondary" onClick={() => { setGrade(course.expectedGrade || 'A'); setCompleting(true); }}><span className="flex items-center gap-1.5"><Flag size={14} /> Terminer</span></Button>
                <Button variant="ghost" onClick={() => dropCourse(course.id)}>Abandonner</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => reopenCourse(course.id)}><span className="flex items-center gap-1.5"><RotateCcw size={14} /> Réactiver</span></Button>
            )}
            <Button variant="ghost" onClick={() => setDeleteOpen(true)} title="Supprimer"><Trash2 size={15} /></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {acad ? (
            <>
              <BigStat label={r.complete ? 'Moyenne finale' : 'Moyenne actuelle'} value={r.value == null ? '—' : `${fmtGrade(r.value)}/${settings.scale}`} color={gradeColor(r.value, settings)}
                sub={r.value == null ? 'aucune note' : r.complete
                  ? <span className="flex gap-1.5"><MentionTag avg={r.value} settings={settings} />{r.retakeApplied && '· après rattrapage'}</span>
                  : `provisoire · ${r.gradedWeight}% de la note connue`} />
              <BigStat label="Note visée" value={course.targetGrade != null ? `${fmtGrade(course.targetGrade)}/${settings.scale}` : '—'} sub={course.targetGrade != null ? 'modifiable via ✎' : `validation à ${settings.passMark}`} />
              <BigStat label="Note nécessaire" color={req?.status === 'impossible' ? 'var(--error)' : req?.status === 'secured' ? 'var(--success)' : req ? gradeColor(req.needed, settings) : undefined}
                value={!req ? '—' : req.status === 'secured' ? 'Assuré' : req.status === 'impossible' ? 'Hors de portée' : fmtGrade(req.needed)}
                sub={!req ? 'plus rien à passer' : `sur ce qui reste, ${course.targetGrade != null ? 'pour l’objectif' : 'pour valider'}`} />
              <BigStat label="Temps d'étude" value={fmtMinutes(weekMin)} sub={`cette semaine · ${fmtMinutes(totalMin)} au total · programme ${progress}%`} />
            </>
          ) : (
            <>
              <BigStat label="Avancement" value={`${progress}%`} sub={`${(course.chapters || []).length} chapitre(s)`} />
              <BigStat label="Score" value={`${getCourseScore(course)}%`} sub="avancement × régularité" color="var(--accent-primary)" />
              <BigStat label="Temps d'étude" value={fmtMinutes(weekMin)} sub={`cette semaine · ${fmtMinutes(totalMin)} au total`} />
              <BigStat label="Statut" value={course.status === 'completed' ? 'Terminé' : course.status === 'dropped' ? 'Abandonné' : 'En cours'} sub={course.actualGrade ? `note ${course.actualGrade}` : ''} />
            </>
          )}
        </div>
      </div>

      {acad ? (
        <>
          <EvaluationsCard course={course} settings={settings} />
          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 space-y-5">
              <ProgrammeCard course={course} />
            </div>
            <div className="lg:col-span-2 space-y-5 order-first lg:order-none">
              <SimulatorCard key={`${course.id}-${course.targetGrade}`} course={course} settings={settings} />
              <FlashcardsCard course={course} />
              <SlotsCard course={course} />
              <ReadingsCard course={course} />
            </div>
          </div>
        </>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3"><ProgrammeCard course={course} /></div>
          <div className="lg:col-span-2 space-y-5">
            <FlashcardsCard course={course} />
            <SlotsCard course={course} />
            <ReadingsCard course={course} />
          </div>
        </div>
      )}

      {course.linkedSkills?.length > 0 && (
        <Card>
          <SectionHeader title="Compétences liées" subtitle="Reçoivent de l'XP quand le cours est terminé." />
          <div className="flex flex-wrap gap-1.5">
            {course.linkedSkills.map((id) => <Badge key={id} color="var(--accent-secondary)">{SKILL_MAP[id]?.name || id}</Badge>)}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader icon={Clock} title="Sessions d'étude" subtitle={`${mySessions.length} session(s) · ${fmtMinutes(totalMin)} au total`}
          action={<Button variant="secondary" className="!py-1.5" onClick={() => setManualOpen(true)}><span className="flex items-center gap-1"><Plus size={13} /> Session</span></Button>} />
        {mySessions.length ? (
          <div className="divide-y divide-line/60">
            {mySessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-mute w-24 shrink-0 text-xs">{new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="flex-1 min-w-0 text-mute truncate">{s.notes || '—'}</span>
                <span className="tabular-nums text-ink">{fmtMinutes(s.durationMinutes)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-mute">Lancez « Étudier » ou ajoutez une session : le temps passé par matière alimente vos priorités du jour.</p>
        )}
      </Card>

      <ManualSessionModal open={manualOpen} onClose={() => setManualOpen(false)} defaultCourseId={course.id} />
      <CourseFormModal open={editOpen} onClose={() => setEditOpen(false)} course={course} />

      <Modal open={completing} onClose={() => setCompleting(false)} title={`Terminer : ${course.name}`}>
        {acad ? (
          <div className="space-y-3">
            <p className="text-sm text-mute">
              {r.value != null
                ? <>Moyenne retenue : <b className="text-ink">{fmtGrade(r.value)}/{settings.scale}</b>{!r.complete && ' (toutes les notes ne sont pas saisies)'}.
                  {' '}Équivalent {letterFor(r.value, settings)} · +{GRADE_XP[letterFor(r.value, settings)] ?? 0} XP par compétence liée.</>
                : 'Aucune note saisie : la matière sera archivée sans moyenne.'}
            </p>
          </div>
        ) : (
          <Field label="Appréciation finale" hint={`+${GRADE_XP[grade]} XP par compétence liée.`}>
            <Select value={grade} onChange={(e) => setGrade(e.target.value)} options={GRADES} />
          </Field>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setCompleting(false)}>Annuler</Button>
          <Button onClick={() => { completeCourse(course.id, grade); setCompleting(false); }}>Terminer</Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer ce cours ?">
        <p className="text-sm text-mute">« {course.name} », ses notes, chapitres et créneaux seront supprimés définitivement.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Annuler</Button>
          <Button variant="danger" onClick={() => { deleteCourse(course.id); navigate(backTo); }}>Supprimer</Button>
        </div>
      </Modal>

      <ScheduleEventModal
        open={scheduleModal}
        onClose={() => setScheduleModal(false)}
        title="les séances de ce cours"
        defaultSummary={`Étude : ${course.name}`}
        recurring
        existingEventId={course.googleEventId || null}
        existingEventLink={course.googleEventLink || null}
        onScheduled={({ eventId, htmlLink }) => setCourseCalendarEvent(courseId, { eventId, htmlLink })}
        onUnschedule={() => setCourseCalendarEvent(courseId, { eventId: null, htmlLink: null })}
      />
    </div>
  );
}
