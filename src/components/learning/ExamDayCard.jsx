import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Check, Brain, ArrowRight } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { upcomingEvaluations, daysUntil, requiredGrade, fmtGrade, evalTypeLabel, DEFAULT_ACADEMIC_SETTINGS } from '../../utils/academic';
import { isDue } from '../../utils/fsrs';
import { todayKey } from '../../utils/formatters';
import { Card } from '../common/ui';

const CHECKLIST = {
  0: ['Convocation ou carte d’étudiant', 'Stylos et matériel', 'Calculatrice (si autorisée)', 'Eau et montre', 'Partir avec de l’avance'],
  1: ['Relire les fiches clés, pas tout le cours', 'Préparer ton sac ce soir', 'Vérifier l’heure et la salle', 'Te coucher tôt'],
};

// Ticks are only a convenience on this device (not synced): a per-exam list.
function useChecklist(key) {
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  });
  const toggle = (item) => setDone((d) => {
    const next = d.includes(item) ? d.filter((x) => x !== item) : [...d, item];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  return [done, toggle];
}

function ExamBlock({ course, ev, days, settings, dueCards }) {
  const [done, toggle] = useChecklist(`vaudax-exam-${ev.id || ev.name}-${ev.date}-${days}`);
  const target = course.targetGrade ?? settings.passMark;
  const req = requiredGrade(course, target, settings);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: days === 0 ? 'var(--error)' : 'var(--warning)' }}>
          {days === 0 ? 'Jour d’examen' : 'Examen demain'}
        </div>
        <div className="text-lg font-bold">{ev.name || evalTypeLabel(ev.type)} · {course.name}</div>
        <div className="text-xs text-mute">
          {ev.weight ? `${ev.weight} % de la note` : 'poids non renseigné'}
          {ev.time ? ` · ${ev.time}` : ''}
          {req?.status === 'possible' && <> · il te faut <b className="font-data">{fmtGrade(req.needed)}/{settings.scale}</b> pour atteindre {fmtGrade(target)}</>}
          {req?.status === 'secured' && ' · ton objectif est déjà assuré'}
        </div>
      </div>
      <ul className="grid sm:grid-cols-2 gap-1.5">
        {CHECKLIST[days].map((item) => (
          <li key={item}>
            <button type="button" onClick={() => toggle(item)} aria-pressed={done.includes(item)}
              className="ui-btn w-full flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-left cursor-pointer hover:border-accent">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${done.includes(item) ? 'bg-good border-good text-on-accent' : 'border-line'}`}>
                {done.includes(item) && <Check size={11} strokeWidth={3} />}
              </span>
              <span className={done.includes(item) ? 'line-through text-mute' : ''}>{item}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 text-sm">
        {dueCards > 0 && (
          <Link to="/learning?tab=review" className="flex items-center gap-1.5 text-accent hover:underline"><Brain size={14} /> {dueCards} fiche{dueCards > 1 ? 's' : ''} de cette matière à revoir</Link>
        )}
        <Link to={`/learning/course/${course.id}`} className="flex items-center gap-1.5 text-accent hover:underline">Ouvrir la matière <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}

// Exam-day mode: shows up only the day before and the day of an evaluation,
// with what to aim for, a short checklist and the cards left to review.
export default function ExamDayCard() {
  const today = todayKey();
  const courses = useLearningStore((s) => s.courses);
  const academicSettings = useLearningStore((s) => s.academic?.settings);
  const decks = useFlashcardStore((s) => s.decks);
  const cards = useFlashcardStore((s) => s.cards);
  const settings = { ...DEFAULT_ACADEMIC_SETTINGS, ...(academicSettings || {}) };

  const exams = useMemo(
    () => upcomingEvaluations(courses, today).filter((x) => !x.past && daysUntil(x.ev.date, today) <= 1),
    [courses, today],
  );
  const dueByCourse = useMemo(() => {
    const deckCourse = Object.fromEntries((decks || []).map((d) => [d.id, d.courseId]));
    const out = {};
    for (const c of cards || []) {
      const courseId = deckCourse[c.deckId];
      if (courseId && isDue(c)) out[courseId] = (out[courseId] || 0) + 1;
    }
    return out;
  }, [decks, cards]);

  if (!exams.length) return null;
  return (
    <Card title={<span className="flex items-center gap-2"><GraduationCap size={15} /> Mode examen</span>}>
      <div className="space-y-6">
        {exams.map(({ course, ev }) => (
          <ExamBlock key={`${course.id}-${ev.id || ev.name}`} course={course} ev={ev} days={daysUntil(ev.date, today)} settings={settings} dueCards={dueByCourse[course.id] || 0} />
        ))}
      </div>
    </Card>
  );
}
