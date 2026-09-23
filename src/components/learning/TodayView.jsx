import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun, Flame, Clock, MapPin, CalendarClock, ListChecks, Play, Plus, Trash2, Sparkles, History, Target, Pencil, Check, Brain,
} from 'lucide-react';
import { useFlashcardStore, buildQueue } from '../../store/flashcardStore';
import ReviewSession from './ReviewSession';
import { useLearningStore } from '../../store/learningStore';
import { useFocusStore } from '../../store/focusStore';
import { upcomingEvaluations, daysUntil, evalTypeLabel, normGrade, requiredGrade, fmtGrade, isAcademic } from '../../utils/academic';
import {
  studySessions, minutesBetween, dailySeries, studyStreak, fmtMinutes, weekStart, studyPriorities, todaysClasses, nextTaskOf,
} from '../../utils/study';
import { todayKey } from '../../utils/formatters';
import { Card, Button } from '../common/ui';
import { SectionHeader, useAcademicSettings, tint, gradeColor, countdownLabel } from './design';
import { courseColor } from './TimetableView';
import { StudyTimerCard, ManualSessionModal } from './StudyTimer';

const DAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function WeekCard({ sessions, today, settings }) {
  const update = useLearningStore((s) => s.updateAcademicSettings);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(settings.weeklyStudyTarget);
  const todayMin = minutesBetween(sessions, today, today);
  const weekMin = minutesBetween(sessions, weekStart(today), today);
  const target = (Number(settings.weeklyStudyTarget) || 0) * 60;
  const series = dailySeries(sessions, today, 7);
  const max = Math.max(60, ...series.map((d) => d.minutes));
  const streak = studyStreak(sessions, today);
  const pct = target ? Math.min(100, Math.round((weekMin / target) * 100)) : 0;

  return (
    <Card className="h-full">
      <SectionHeader icon={Clock} title="Temps d'étude" />
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[11px] text-mute">Aujourd'hui</div>
          <div className="text-xl font-bold tabular-nums text-ink">{fmtMinutes(todayMin)}</div>
        </div>
        <div>
          <div className="text-[11px] text-mute">Cette semaine</div>
          <div className="text-xl font-bold tabular-nums text-ink">{fmtMinutes(weekMin)}</div>
        </div>
        <div>
          <div className="text-[11px] text-mute">Série</div>
          <div className="text-xl font-bold tabular-nums flex items-center gap-1" style={{ color: streak ? 'var(--warning)' : 'var(--text-secondary)' }}>
            <Flame size={16} />{streak} j
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-mute flex items-center gap-1"><Target size={12} /> Objectif hebdo</span>
          {editing ? (
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); update({ weeklyStudyTarget: Math.max(0, Number(draft) || 0) }); setEditing(false); }}>
              <input autoFocus type="number" min="0" className="w-14 bg-surface border border-line rounded px-1.5 py-0.5 text-xs text-ink" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <span className="text-mute">h</span>
              <button className="text-accent cursor-pointer p-0.5"><Check size={13} /></button>
            </form>
          ) : (
            <button onClick={() => { setDraft(settings.weeklyStudyTarget); setEditing(true); }} className="text-ink hover:text-accent cursor-pointer flex items-center gap-1">
              {fmtMinutes(weekMin)} / {settings.weeklyStudyTarget} h <Pencil size={10} className="text-mute" />
            </button>
          )}
        </div>
        <div className="h-2 rounded-full bg-surface overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-1.5 h-20 mt-4">
        {series.map((d) => {
          const isToday = d.date === today;
          const h = d.minutes ? Math.max(6, (d.minutes / max) * 64) : 3;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date} · ${fmtMinutes(d.minutes)}`}>
              <div className="w-full rounded-md" style={{ height: h, background: d.minutes ? (isToday ? 'var(--accent-primary)' : tint('var(--accent-primary)', 55)) : 'var(--border)' }} />
              <span className={`text-[10px] ${isToday ? 'text-accent font-semibold' : 'text-mute'}`}>{DAY_LETTER[new Date(d.date + 'T12:00:00').getDay()]}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PriorityCard({ p, index, settings, onStart, running }) {
  const c = p.course;
  const color = courseColor(c.id);
  return (
    <div className="rounded-xl border border-line bg-card p-4 flex flex-col gap-2 min-w-0" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-mute">Priorité {index + 1}</div>
          <Link to={`/learning/course/${c.id}`} className="font-semibold text-sm text-ink hover:text-accent leading-snug block truncate">{c.name}</Link>
        </div>
        {isAcademic(c) && p.exam && p.days <= 21 && (
          <span className="text-[11px] rounded-md px-1.5 py-0.5 font-semibold whitespace-nowrap" style={{ background: tint(p.days <= 3 ? 'var(--error)' : 'var(--warning)', 15), color: p.days <= 3 ? 'var(--error)' : 'var(--warning)' }}>
            J-{p.days}
          </span>
        )}
      </div>
      <ul className="text-[11px] text-mute space-y-0.5 flex-1">
        {(p.reasons.length ? p.reasons : ['à entretenir']).slice(0, 3).map((r) => <li key={r}>• {r}</li>)}
      </ul>
      <Button variant="secondary" className="!py-1.5 text-xs" disabled={running} onClick={() => onStart(c.id)}>
        <span className="flex items-center justify-center gap-1.5"><Play size={12} /> Étudier 50 min</span>
      </Button>
    </div>
  );
}

export default function TodayView() {
  const courses = useLearningStore((s) => s.courses);
  const toggleChecklistItem = useLearningStore((s) => s.toggleChecklistItem);
  const allSessions = useFocusStore((s) => s.sessions);
  const activeTimer = useFocusStore((s) => s.activeTimer);
  const { startTimer, deleteSession } = useFocusStore();
  const settings = useAcademicSettings();
  const today = todayKey();
  const [manualOpen, setManualOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const fc = useFlashcardStore();
  const reviewQueue = useMemo(() => buildQueue({ cards: fc.cards, decks: fc.decks, reviewLog: fc.reviewLog, settings: fc.settings }), [fc.cards, fc.decks, fc.reviewLog, fc.settings]);

  const sessions = useMemo(() => studySessions(allSessions), [allSessions]);
  const priorities = useMemo(
    () => studyPriorities({ courses, sessions, settings, today }).filter((p) => p.score > 0).slice(0, 3),
    [courses, sessions, settings.weeklyStudyTarget, settings.activeTermId, settings.passMark, settings.scale, today] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const classes = todaysClasses(courses, settings);
  const deadlines = useMemo(
    () => upcomingEvaluations(courses, today).filter((x) => !x.past && normGrade(x.ev, settings) == null && daysUntil(x.ev.date, today) <= 21).slice(0, 5),
    [courses, today] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Next checklist steps: follow the priority order, then the rest.
  const tasks = useMemo(() => {
    const order = [...priorities.map((p) => p.course), ...courses.filter((c) => c.status === 'active')];
    const seen = new Set();
    const out = [];
    for (const c of order) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const t = nextTaskOf(c);
      if (t) out.push({ course: c, ...t });
      if (out.length >= 5) break;
    }
    return out;
  }, [priorities, courses]);
  const todaySessions = sessions.filter((s) => s.date === today);
  const courseName = (id) => courses.find((c) => c.id === id)?.name || 'Étude libre';
  const start = (courseId) => startTimer({ domain: 'Learning', courseId, targetMin: 50 });
  const hasCourses = courses.some((c) => c.status === 'active');
  const rawDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-mute">
        <Sun size={15} className="text-accent" />
        <span>{dateLabel}</span>
        {classes.length > 0 && <span>· {classes.length} cours aujourd'hui</span>}
        {deadlines[0] && <span>· prochaine évaluation {countdownLabel(daysUntil(deadlines[0].ev.date, today))}</span>}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3"><StudyTimerCard /></div>
        <div className="lg:col-span-2"><WeekCard sessions={sessions} today={today} settings={settings} /></div>
      </div>

      {/* Flashcards due */}
      {fc.cards.length > 0 && (
        <div className="rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ borderColor: tint('var(--accent-secondary)', reviewQueue.length ? 45 : 20), background: tint('var(--accent-secondary)', reviewQueue.length ? 10 : 4) }}>
          <Brain size={18} style={{ color: 'var(--accent-secondary)' }} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink">{reviewQueue.length ? `${reviewQueue.length} fiche(s) à réviser` : 'Révisions à jour ✓'}</div>
            <div className="text-[11px] text-mute">{reviewQueue.length ? `≈ ${Math.max(1, Math.round((reviewQueue.length * 10) / 60))} min · à faire avant d'apprendre du nouveau` : 'Les prochaines fiches reviendront au bon moment.'}</div>
          </div>
          {reviewQueue.length > 0 && <Button className="!py-1.5" onClick={() => setReviewing(true)}><span className="flex items-center gap-1.5"><Play size={13} /> Réviser</span></Button>}
        </div>
      )}

      {/* Priorities */}
      <div>
        <SectionHeader icon={Sparkles} title="À étudier en priorité"
          subtitle="Calculé à partir des examens proches, des notes à rattraper et du temps déjà passé cette semaine (au prorata des coefficients)." />
        {priorities.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorities.map((p, i) => <PriorityCard key={p.course.id} p={p} index={i} settings={settings} onStart={start} running={!!activeTimer} />)}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-mute text-center py-3">
              {hasCourses ? 'Rien d’urgent : vous êtes à jour. Profitez-en pour avancer le programme ou réviser.' : <>Ajoutez vos matières dans <Link className="text-accent underline" to="/learning?tab=cursus">Cursus</Link> pour obtenir vos priorités du jour.</>}
            </p>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Today's classes */}
        <Card>
          <SectionHeader icon={Clock} title="Cours d'aujourd'hui" action={<Link to="/learning?tab=timetable" className="text-xs text-accent hover:underline">Emploi du temps</Link>} />
          {classes.length ? (
            <div className="space-y-2">
              {classes.map((s) => {
                const color = courseColor(s.course.id);
                return (
                  <Link key={s.id} to={`/learning/course/${s.course.id}`} className={`flex items-center gap-3 rounded-lg px-3 py-2 border-l-[3px] transition ${s.state === 'done' ? 'opacity-50' : ''}`}
                    style={{ background: tint(color, s.state === 'now' ? 18 : 8), borderColor: color }}>
                    <span className="text-xs tabular-nums text-mute w-24 shrink-0">{s.start}–{s.end}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">{s.course.name}</span>
                      <span className="text-[11px] text-mute">{s.kind}{s.room && <> · <MapPin size={9} className="inline" /> {s.room}</>}</span>
                    </span>
                    {s.state === 'now' && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: tint(color, 25), color }}>En cours</span>}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-mute py-2">Pas de cours aujourd'hui{courses.some((c) => c.slots?.length) ? '.' : ' — ajoutez vos créneaux dans chaque matière.'}</p>
          )}
        </Card>

        {/* Deadlines */}
        <Card>
          <SectionHeader icon={CalendarClock} title="Échéances (3 semaines)" action={<Link to="/learning?tab=exams" className="text-xs text-accent hover:underline">Toutes</Link>} />
          {deadlines.length ? (
            <div className="space-y-2">
              {deadlines.map(({ course, ev }) => {
                const d = daysUntil(ev.date, today);
                const req = requiredGrade(course, course.targetGrade ?? settings.passMark, settings);
                const urg = d <= 3 ? 'var(--error)' : d <= 10 ? 'var(--warning)' : 'var(--accent-primary)';
                return (
                  <Link key={ev.id} to={`/learning/course/${course.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface transition-colors">
                    <span className="text-xs font-semibold w-16 shrink-0" style={{ color: urg }}>{countdownLabel(d)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink truncate">{course.name}</span>
                      <span className="text-[11px] text-mute">{ev.name || evalTypeLabel(ev.type)} · {ev.weight}%</span>
                    </span>
                    {req?.status === 'possible' && (
                      <span className="text-xs text-mute whitespace-nowrap">viser <b className="tabular-nums" style={{ color: gradeColor(req.needed, settings) }}>{fmtGrade(req.needed)}</b></span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-mute py-2">Aucune évaluation datée dans les 3 prochaines semaines.</p>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Next steps */}
        <Card>
          <SectionHeader icon={ListChecks} title="Prochaines étapes du programme" subtitle="Cocher une étape fait monter votre régularité." />
          {tasks.length ? (
            <div className="space-y-1">
              {tasks.map((t) => (
                <label key={t.item.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-[var(--accent-primary)]" checked={false}
                    onChange={() => toggleChecklistItem(t.course.id, t.chapter.id, t.item.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{t.item.title}</span>
                    <span className="text-[11px] text-mute"><span style={{ color: courseColor(t.course.id) }}>●</span> {t.course.name} · {t.chapter.title}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute py-2">Ajoutez des chapitres et étapes dans vos matières pour les retrouver ici.</p>
          )}
        </Card>

        {/* Today's sessions */}
        <Card>
          <SectionHeader icon={History} title="Sessions du jour"
            action={<Button variant="secondary" className="!py-1.5 text-xs" onClick={() => setManualOpen(true)}><span className="flex items-center gap-1"><Plus size={12} /> Ajouter</span></Button>} />
          {todaySessions.length ? (
            <div className="divide-y divide-line/60">
              {todaySessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.courseId ? courseColor(s.courseId) : 'var(--text-secondary)' }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink truncate">{courseName(s.courseId)}</span>
                    {s.notes && <span className="text-[11px] text-mute truncate block">{s.notes}</span>}
                  </span>
                  <span className="text-sm tabular-nums text-ink">{fmtMinutes(s.durationMinutes)}</span>
                  <button className="p-1 text-mute hover:text-bad cursor-pointer" title="Supprimer" onClick={() => deleteSession(s.id)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute py-2">Aucune session aujourd'hui. Lancez le chrono ou ajoutez une session faite sans chrono.</p>
          )}
        </Card>
      </div>

      <ManualSessionModal open={manualOpen} onClose={() => setManualOpen(false)} />
      {reviewing && <ReviewSession title="Révisions du jour" onClose={() => setReviewing(false)} />}
    </div>
  );
}
