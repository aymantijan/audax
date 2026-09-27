import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, DoorOpen, UserCheck, CalendarX2, Repeat, AlertTriangle, Flame, BellRing, NotebookPen, Check } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useHabitStore } from '../../store/habitStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import {
  ATTENDANCE_STATUS, PAST_CORRECTIONS, classesOn, occurrenceState, arriveBy, fmtClock, dayAttendance,
  courseAttendance, courseEnd, classWeekdays, dateKeyOf, withDefaults, pendingCaptures,
} from '../../utils/attendance';
import { isAcademic } from '../../utils/academic';
import { Button, Card, Modal, Textarea, Field } from '../common/ui';
import { SectionHeader, tint, useAcademicSettings } from './design';
import { isPushSupported, getPushSubscription, subscribeToPush } from '../../services/push';
import { toast } from '../../store/uiStore';
import { courseColor } from './TimetableView';

export const ATTENDANCE_SOURCE = 'class_attendance';

/** Re-renders every `ms` so check-in windows open and close on their own. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

const minutesLabel = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

function StatusChip({ status }) {
  const meta = ATTENDANCE_STATUS[status];
  if (!meta) return null;
  return (
    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap" style={{ background: tint(meta.tone, 16), color: meta.tone }}>
      {meta.label}
    </span>
  );
}

// Small native select: corrections that make sense at this point of the class.
function CorrectionMenu({ occ, state }) {
  const setAttendance = useLearningStore((s) => s.setAttendance);
  const recorded = useLearningStore((s) => !!s.attendance[occ.key]);
  const ended = Date.now() >= occ.endMs;
  const options = ended ? PAST_CORRECTIONS.filter((s) => s !== state) : ['cancelled', 'excused'].filter((s) => s !== state);
  return (
    <select
      value=""
      aria-label="Corriger la présence"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setAttendance(occ.key, e.target.value === 'reset' ? null : e.target.value)}
      className="text-[11px] bg-transparent border border-line rounded-md px-1 py-0.5 text-mute cursor-pointer max-w-[6.5rem] focus:outline-none focus:border-accent">
      <option value="" disabled>Corriger…</option>
      {options.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS[s].label}</option>)}
      {recorded && <option value="reset">Réinitialiser</option>}
    </select>
  );
}

// "Question ; réponse" (or "question ? réponse") per line → flashcards.
export function parseCardLines(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(';');
    if (i > 0) return { front: l.slice(0, i).trim(), back: l.slice(i + 1).trim() };
    const q = l.indexOf('?');
    return q > 0 && q < l.length - 1 ? { front: l.slice(0, q + 1).trim(), back: l.slice(q + 1).trim() } : null;
  }).filter((r) => r && r.front && r.back);
}

/** Right after class: 3 key ideas + optional flashcards into the subject's deck. */
export function ClassCaptureModal({ occ, onClose }) {
  const saveClassNotes = useLearningStore((s) => s.saveClassNotes);
  const existing = useLearningStore((s) => (occ ? s.classNotes[occ.key] : null));
  const ensureCourseDeck = useFlashcardStore((s) => s.ensureCourseDeck);
  const addCards = useFlashcardStore((s) => s.addCards);
  const [points, setPoints] = useState('');
  const [cardsText, setCardsText] = useState('');
  useEffect(() => { if (occ) { setPoints((existing?.points || []).join('\n')); setCardsText(''); } }, [occ?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = parseCardLines(cardsText);
  const save = () => {
    let n = 0;
    if (cards.length) n = addCards(ensureCourseDeck(occ.course.id), cards);
    saveClassNotes(occ, points.split(/\r?\n/), n);
    onClose();
  };
  return (
    <Modal open={!!occ} onClose={onClose} title={occ ? `${occ.course.name} · ${occ.start}–${occ.end}` : ''}>
      {occ && (
        <div className="space-y-4">
          <p className="text-sm text-mute">Deux minutes maintenant valent une heure de relecture avant le CC.</p>
          <Field label="Idées clés du cours" hint="Une par ligne : ce qu’il faut retenir, en tes mots.">
            <Textarea rows={4} value={points} onChange={(e) => setPoints(e.target.value)} autoFocus
              placeholder={'La VAN actualise les flux au coût du capital\nUn projet est retenu si VAN > 0\n…'} />
          </Field>
          <Field label="Fiches de révision (facultatif)" hint="Une par ligne : « question ; réponse ». Elles rejoignent le paquet de la matière.">
            <Textarea rows={3} value={cardsText} onChange={(e) => setCardsText(e.target.value)}
              placeholder={'Formule de la VAN ; Σ flux actualisés − investissement initial'} />
          </Field>
          <div className="flex items-center justify-end gap-2">
            {cards.length > 0 && <span className="mr-auto text-xs text-mute">{cards.length} fiche{cards.length > 1 ? 's' : ''}</span>}
            <Button variant="secondary" onClick={onClose}>Plus tard</Button>
            <Button disabled={!points.trim() && !cards.length} onClick={save}>Enregistrer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** One class of the day with its check-in state. */
export function ClassRow({ occ, now }) {
  const records = useLearningStore((s) => s.attendance);
  const hasNotes = useLearningStore((s) => !!s.classNotes[occ.key]);
  const checkIn = useLearningStore((s) => s.checkInClass);
  const [capture, setCapture] = useState(null);
  const settings = useAcademicSettings();
  const state = occurrenceState(occ, records, now);
  const color = courseColor(occ.course.id);
  const deadline = arriveBy(occ, settings);
  const live = now >= occ.startMs && now < occ.endMs;
  const faded = now >= occ.endMs || ATTENDANCE_STATUS[state]?.neutral;

  let hint = null;
  if (state === 'upcoming') hint = <>En salle à <b className="text-ink">{fmtClock(deadline)}</b></>;
  else if (state === 'open') hint = now <= deadline
    ? <>À l’heure encore <b className="text-ink">{minutesLabel(deadline - now)}</b> (avant {fmtClock(deadline)})</>
    : <span className="text-warning">Il fallait être là à {fmtClock(deadline)}</span>;

  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 border-l-[3px] transition ${faded ? 'opacity-60' : ''}`}
      style={{ background: tint(color, live ? 18 : 8), borderColor: color }}>
      <span className="text-xs tabular-nums text-mute w-[4.6rem] shrink-0 leading-tight">{occ.start}<br />{occ.end}</span>
      <span className="flex-1 min-w-0">
        <Link to={`/learning/course/${occ.course.id}`} className="block text-sm font-medium text-ink truncate hover:text-accent">{occ.course.name}</Link>
        <span className="text-[11px] text-mute flex items-center gap-1 flex-wrap">
          {occ.slot.kind}{occ.slot.room && <> · <MapPin size={9} /> {occ.slot.room}</>}
          {hint && <> · {hint}</>}
        </span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {state === 'open' ? (
          <Button className="!py-1.5 !px-2.5 text-xs" onClick={() => checkIn(occ)}>
            <span className="flex items-center gap-1"><DoorOpen size={13} /> En salle</span>
          </Button>
        ) : state !== 'upcoming' && <StatusChip status={state} />}
        {ATTENDANCE_STATUS[state]?.present && now >= occ.endMs - 10 * 60000 && (hasNotes
          ? <button onClick={() => setCapture(occ)} className="text-good cursor-pointer" title="Notes du cours"><Check size={14} /></button>
          : <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => setCapture(occ)}><span className="flex items-center gap-1"><NotebookPen size={12} /> Retenir</span></Button>)}
        <CorrectionMenu occ={occ} state={state} />
      </span>
      <ClassCaptureModal occ={capture} onClose={() => setCapture(null)} />
    </div>
  );
}

/** "Cours d'aujourd'hui" with check-in (Apprentissage › Aujourd'hui). */
export function ClassesTodayCard() {
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const records = useLearningStore((s) => s.attendance);
  const now = useNow();
  const today = dateKeyOf(new Date(now));
  const classes = useMemo(() => classesOn(courses, academic, today), [courses, academic, today]);
  const score = dayAttendance(courses, academic, records, today);

  return (
    <Card>
      <SectionHeader icon={Clock} title="Cours d'aujourd'hui"
        subtitle={classes.length ? `${score.onTime}/${score.required} à l’heure · pointe « En salle » dès que tu arrives` : undefined}
        action={<Link to="/learning?tab=timetable" className="text-xs text-accent hover:underline">Emploi du temps</Link>} />
      {classes.length ? (
        <div className="space-y-2">{classes.map((o) => <ClassRow key={o.key} occ={o} now={now} />)}</div>
      ) : (
        <p className="text-sm text-mute py-2">Pas de cours aujourd'hui{courses.some((c) => c.slots?.length) ? '.' : ' : ajoute tes créneaux dans chaque matière.'}</p>
      )}
    </Card>
  );
}

/** Home (/today): the class to check in to right now, if any. */
export function NextClassBanner() {
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const records = useLearningStore((s) => s.attendance);
  const notes = useLearningStore((s) => s.classNotes);
  const [capture, setCapture] = useState(null);
  const now = useNow();
  const today = dateKeyOf(new Date(now));
  const classes = useMemo(() => classesOn(courses, academic, today), [courses, academic, today]);
  const pending = classes.filter((o) => ['open', 'upcoming'].includes(occurrenceState(o, records, now)));
  if (!classes.length) return null;
  const score = dayAttendance(courses, academic, records, today);
  const next = pending[0];
  const toCapture = pendingCaptures(courses, academic, records, notes, now);
  return (
    <Card title="Cours" action={<span className="text-xs text-mute">{score.onTime}/{score.required} à l’heure</span>}>
      {toCapture[0] && (
        <button onClick={() => setCapture(toCapture[0])}
          className="w-full mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left cursor-pointer border transition hover:brightness-110"
          style={{ borderColor: tint('var(--accent-secondary)', 45), background: tint('var(--accent-secondary)', 10) }}>
          <NotebookPen size={16} style={{ color: 'var(--accent-secondary)' }} className="shrink-0" />
          <span className="flex-1 text-sm"><b className="text-ink">Tu sors de {toCapture[0].course.name}</b> <span className="text-mute">· 2 min pour noter 3 idées clés</span></span>
        </button>
      )}
      <ClassCaptureModal occ={capture} onClose={() => setCapture(null)} />
      {next ? (
        <div className="space-y-2">
          <ClassRow occ={next} now={now} />
          {pending.length > 1 && <p className="text-[11px] text-mute">Ensuite : {pending.slice(1).map((o) => `${o.start} ${o.course.name}`).join(' · ')}</p>}
        </div>
      ) : (
        <p className="text-sm text-mute">
          {classes.some((o) => now < o.endMs) ? 'Tous les cours du jour sont pointés ✓' : 'Journée de cours terminée.'}{' '}
          <Link to="/learning" className="text-accent hover:underline">Voir le bilan</Link>
        </p>
      )}
    </Card>
  );
}

// ── Subject end (Consulting stops after the partiels…) ──────────────────
export function CourseEndControl({ course }) {
  const editCourse = useLearningStore((s) => s.editCourse);
  const terms = useLearningStore((s) => s.academic.terms);
  const term = terms.find((t) => t.id === course.termId);
  const end = courseEnd(course, term);
  const cls = 'bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-accent';
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm mt-3 pt-3 border-t border-line">
      <span className="text-mute">Les cours durent</span>
      <select className={cls} value={course.endRule || 'none'} onChange={(e) => editCourse(course.id, { endRule: e.target.value === 'none' ? null : e.target.value })}>
        <option value="none">tout le semestre</option>
        {isAcademic(course) && <option value="midterms">jusqu’aux partiels</option>}
        <option value="date">jusqu’au…</option>
      </select>
      {course.endRule === 'date' && <input type="date" className={cls} value={course.endDate || ''} onChange={(e) => editCourse(course.id, { endDate: e.target.value })} />}
      {end.rule === 'midterms' && (end.pending
        ? <span className="text-[11px] text-warning flex items-center gap-1"><AlertTriangle size={11} /> date inconnue : saisis la date du CC ci-dessous (Évaluations) ; les créneaux continuent en attendant</span>
        : <span className="text-[11px] text-mute">dernier cours avant le {new Date(`${end.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} ({end.source === 'eval' ? 'date du CC' : 'début des partiels du semestre'})</span>)}
    </div>
  );
}

function pct(v) { return v == null ? '—' : `${Math.round(v * 100)} %`; }
const rateColor = (v) => (v == null ? 'var(--text-secondary)' : v >= 0.9 ? 'var(--success)' : v >= 0.7 ? 'var(--warning)' : 'var(--error)');

/** Compact attendance line for a subject page. */
export function CourseAttendanceSummary({ course }) {
  const academic = useLearningStore((s) => s.academic);
  const records = useLearningStore((s) => s.attendance);
  const a = useMemo(() => courseAttendance(course, academic, records), [course, academic, records]);
  if (!a.history.length) return <p className="text-[11px] text-mute mt-3">Assiduité : aucun cours passé pour l’instant.</p>;
  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-mute">
      <span className="flex items-center gap-1"><UserCheck size={12} /> À l’heure <b className="tabular-nums" style={{ color: rateColor(a.onTimeRate) }}>{pct(a.onTimeRate)}</b></span>
      <span>{a.counts.on_time} à l’heure · {a.counts.late + a.counts.forgot} en retard · <span className={a.counts.absent ? 'text-bad' : ''}>{a.counts.absent} absence{a.counts.absent > 1 ? 's' : ''}</span></span>
      {a.streak > 0 && <span className="flex items-center gap-1 text-warning"><Flame size={12} /> {a.streak} d’affilée</span>}
    </div>
  );
}

// Reminders with the app closed need a Web Push subscription on this device.
function PushCta() {
  const [state, setState] = useState('checking'); // checking | on | off | unsupported
  useEffect(() => {
    if (!isPushSupported()) { setState('unsupported'); return; }
    getPushSubscription().then((s) => setState(s ? 'on' : 'off')).catch(() => setState('off'));
  }, []);
  if (state === 'checking' || state === 'on') return null;
  const enable = async () => {
    try { await subscribeToPush(); setState('on'); toast('Rappels de cours activés sur cet appareil, même app fermée', 'success'); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className="rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderColor: tint('var(--accent-primary)', 40), background: tint('var(--accent-primary)', 8) }}>
      <BellRing size={17} className="text-accent shrink-0" />
      <div className="flex-1 min-w-[12rem] text-sm">
        <b className="text-ink">Rappels de cours, même app fermée.</b>{' '}
        <span className="text-mute">{state === 'unsupported' ? 'Ce navigateur ne gère pas les notifications push : installe VAUDAX sur l’écran d’accueil (PWA).' : 'Active-les sur chaque appareil (téléphone surtout).'}</span>
      </div>
      {state === 'off' && <Button className="!py-1.5" onClick={enable}>Activer</Button>}
    </div>
  );
}

// ── Emploi du temps: partiels date, habit, per-subject record ─────────────
export function AttendanceOverview() {
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const records = useLearningStore((s) => s.attendance);
  const editTerm = useLearningStore((s) => s.editTerm);
  const habits = useHabitStore((s) => s.habits);
  const addHabit = useHabitStore((s) => s.addHabit);
  const editHabit = useHabitStore((s) => s.editHabit);
  const settings = withDefaults(academic.settings);
  const term = academic.terms.find((t) => t.id === settings.activeTermId) || null;

  const subjects = useMemo(
    () => courses.filter((c) => c.status === 'active' && c.slots?.length && (!isAcademic(c) || !settings.activeTermId || !c.termId || c.termId === settings.activeTermId)),
    [courses, settings.activeTermId]
  );
  const rows = useMemo(() => subjects.map((c) => ({ course: c, a: courseAttendance(c, academic, records) })), [subjects, academic, records]);
  const waitingMidterms = subjects.filter((c) => c.endRule === 'midterms' && courseEnd(c, academic.terms.find((t) => t.id === c.termId)).pending);
  const habit = habits.find((h) => !h.archived && h.source === ATTENDANCE_SOURCE);
  const totals = rows.reduce((t, r) => ({ onTime: t.onTime + r.a.counts.on_time, req: t.req + r.a.required, absent: t.absent + r.a.counts.absent }), { onTime: 0, req: 0, absent: 0 });
  const before = Number(settings.arriveBeforeMin) || 0;

  // Keep the habit in step: its days follow the timetable (a class moved to
  // Thursday…) and its default name follows the "minutes before" setting.
  const days = classWeekdays(courses, academic).join(',');
  const autoName = `Être en cours ${before} min avant le début`;
  useEffect(() => {
    if (!habit) return;
    const patch = {};
    if (habit.frequency === 'custom' && days && (habit.weekdays || []).join(',') !== days) patch.weekdays = days.split(',');
    if (/^Être en cours \d+ min avant le début$/.test(habit.name) && habit.name !== autoName) patch.name = autoName;
    if (Object.keys(patch).length) editHabit(habit.id, patch);
  }, [habit?.id, habit?.name, days, autoName]); // eslint-disable-line react-hooks/exhaustive-deps

  const createHabit = () => addHabit({
    name: `Être en cours ${before} min avant le début`,
    category: 'learning', kind: 'quantity', source: ATTENDANCE_SOURCE, target: 100, unit: '%', direction: 'atLeast',
    frequency: 'custom', weekdays: classWeekdays(courses, academic), moment: 'day', mandatory: true,
    xpReward: 10, linkedSkill: 'learning-discipline-lv1', duration: 0, targetStreak: 30,
  });

  if (!subjects.length) return null;
  return (
    <div className="space-y-3">
      <PushCta />
      {waitingMidterms.length > 0 && term && (
        <div className="rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderColor: tint('var(--warning)', 45), background: tint('var(--warning)', 8) }}>
          <CalendarX2 size={17} className="text-warning shrink-0" />
          <div className="flex-1 min-w-[12rem] text-sm">
            <b className="text-ink">Date des partiels inconnue.</b>{' '}
            <span className="text-mute">{waitingMidterms.map((c) => c.name).join(', ')} s’arrête{waitingMidterms.length > 1 ? 'nt' : ''} aux partiels. Dès qu’elle est annoncée, saisis la date du CC sur la page de la matière, ou ici le début des partiels du semestre.</span>
          </div>
          <input type="date" className="bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-accent"
            value={term.midtermsDate || ''} onChange={(e) => editTerm(term.id, { midtermsDate: e.target.value })} aria-label="Début des partiels" />
        </div>
      )}

      <Card>
        <SectionHeader icon={UserCheck} title="Assiduité"
          subtitle={`À l’heure = pointé « En salle » au moins ${before} min avant le début. ${totals.req ? `${totals.onTime}/${totals.req} cours à l’heure · ${totals.absent} absence${totals.absent > 1 ? 's' : ''}` : 'Le suivi commence au premier cours.'}`}
          action={habit
            ? <Link to="/habits" className="text-xs text-accent hover:underline flex items-center gap-1"><Repeat size={12} /> Habitude liée</Link>
            : <Button variant="secondary" className="!py-1.5" onClick={createHabit}><span className="flex items-center gap-1.5"><Repeat size={13} /> Créer l’habitude</span></Button>} />
        {!habit && (
          <p className="text-xs text-mute mb-3">
            L’habitude « Être en cours {before} min avant » se coche toute seule quand tous les cours du jour sont pointés à l’heure, et casse la série sinon.
          </p>
        )}
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full text-sm min-w-[32rem]">
            <thead className="bg-surface text-[11px] text-mute">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Matière</th>
                <th className="px-3 py-2 font-medium">À l’heure</th>
                <th className="px-3 py-2 font-medium">Retards</th>
                <th className="px-3 py-2 font-medium">Absences</th>
                <th className="px-3 py-2 font-medium">Série</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ course, a }) => {
                const end = courseEnd(course, academic.terms.find((t) => t.id === course.termId));
                return (
                  <tr key={course.id} className="border-t border-line/60">
                    <td className="px-3 py-1.5">
                      <Link to={`/learning/course/${course.id}`} className="text-ink hover:text-accent">{course.name}</Link>
                      {end.rule === 'midterms' && <span className="ml-1.5 text-[10px] text-mute">· jusqu’aux partiels</span>}
                    </td>
                    <td className="px-3 py-1.5 text-center tabular-nums font-semibold" style={{ color: rateColor(a.onTimeRate) }}>{pct(a.onTimeRate)}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums text-mute">{a.counts.late + a.counts.forgot}</td>
                    <td className={`px-3 py-1.5 text-center tabular-nums ${a.counts.absent ? 'text-bad font-semibold' : 'text-mute'}`}>{a.counts.absent}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums">{a.streak ? <span className="text-warning">{a.streak}</span> : <span className="text-mute">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Subject page: the notes taken after each class, newest first. */
export function ClassNotesCard({ course }) {
  const notes = useLearningStore((s) => s.classNotes);
  const entries = useMemo(() => Object.entries(notes).filter(([, n]) => n.courseId === course.id).sort((a, b) => b[1].date.localeCompare(a[1].date) || b[1].at - a[1].at), [notes, course.id]);
  if (!entries.length) return null;
  return (
    <Card>
      <SectionHeader icon={NotebookPen} title="Journal des cours" subtitle={`${entries.length} cours résumé${entries.length > 1 ? 's' : ''}`} />
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {entries.map(([key, n]) => (
          <div key={key}>
            <div className="text-[11px] text-mute mb-1">
              {new Date(`${n.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              {n.cards ? ` · ${n.cards} fiche${n.cards > 1 ? 's' : ''}` : ''}
            </div>
            <ul className="text-sm text-ink space-y-0.5 list-disc pl-4">{n.points.map((pt, i) => <li key={i}>{pt}</li>)}</ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
