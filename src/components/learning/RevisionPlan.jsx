import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Play, CheckCircle2 } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useFocusStore } from '../../store/focusStore';
import { revisionPlan, studiedByCourseDay } from '../../utils/revision-plan';
import { forecastSubject } from '../../utils/prediction';
import { fmtMinutes } from '../../utils/study';
import { todayKey } from '../../utils/formatters';
import { Button, Card } from '../common/ui';
import { SectionHeader, tint } from './design';
import { courseColor } from './TimetableView';
import { useForecastContext } from './Forecast';

function usePlan(horizonDays) {
  const courses = useLearningStore((s) => s.courses);
  const sessions = useFocusStore((s) => s.sessions);
  const ctx = useForecastContext();
  const today = todayKey();
  const plan = useMemo(() => {
    const forecasts = Object.fromEntries(ctx.termCourses.map((c) => [c.id, forecastSubject(c, ctx)]));
    return revisionPlan({ courses, settings: ctx.settings, today, forecasts, horizonDays });
  }, [courses, ctx, today, horizonDays]);
  const studied = useMemo(() => studiedByCourseDay(sessions), [sessions]);
  return { plan, studied, today };
}

const dayLabel = (d, today) => {
  if (d === today) return 'Aujourd’hui';
  const s = new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function PlanItem({ it, studied, today }) {
  const startTimer = useFocusStore((s) => s.startTimer);
  const running = useFocusStore((s) => !!s.activeTimer);
  const done = (studied[`${it.course.id}|${it.date}`] || 0) >= it.minutes * 0.8;
  const color = courseColor(it.course.id);
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 border-l-[3px] ${done ? 'opacity-60' : ''}`} style={{ background: tint(color, 8), borderColor: color }}>
      <span className="flex-1 min-w-0">
        <Link to={`/learning/course/${it.course.id}`} className="block text-sm font-medium text-ink truncate hover:text-accent">{it.course.name}</Link>
        <span className="text-[11px] text-mute">{it.label} J-{it.daysBefore} · {it.content}</span>
      </span>
      <span className="text-xs tabular-nums text-mute whitespace-nowrap">{fmtMinutes(it.minutes)}</span>
      {done ? <CheckCircle2 size={16} className="text-good shrink-0" />
        : it.date === today && (
          <Button variant="secondary" className="!py-1 !px-2 text-xs" disabled={running} onClick={() => startTimer({ domain: 'Learning', courseId: it.course.id, targetMin: it.minutes })}>
            <span className="flex items-center gap-1"><Play size={11} /> Go</span>
          </Button>
        )}
    </div>
  );
}

/** Aujourd'hui: today's revision sessions (+ what's next). */
export function TodayRevisionCard() {
  const { plan, studied, today } = usePlan(7);
  const todays = plan.filter((x) => x.date === today);
  const next = plan.find((x) => x.date > today);
  if (!plan.length) return null;
  return (
    <Card>
      <SectionHeader icon={CalendarRange} title="Plan de révision"
        subtitle={todays.length ? `${fmtMinutes(todays.reduce((s, x) => s + x.minutes, 0))} prévues aujourd’hui` : 'Rien de prévu aujourd’hui'}
        action={<Link to="/learning?tab=exams" className="text-xs text-accent hover:underline">Tout le plan</Link>} />
      {todays.length ? (
        <div className="space-y-2">{todays.map((it) => <PlanItem key={it.id} it={it} studied={studied} today={today} />)}</div>
      ) : next && <p className="text-sm text-mute">Prochaine séance : {dayLabel(next.date, today).toLowerCase()} · {next.course.name} ({fmtMinutes(next.minutes)}).</p>}
    </Card>
  );
}

/** Évaluations tab: the 3-week plan, day by day. */
export function RevisionPlanCard() {
  const { plan, studied, today } = usePlan(21);
  const days = useMemo(() => {
    const m = new Map();
    for (const it of plan) { if (!m.has(it.date)) m.set(it.date, []); m.get(it.date).push(it); }
    return [...m.entries()];
  }, [plan]);
  return (
    <Card>
      <SectionHeader icon={CalendarRange} title="Plan de révision (3 semaines)"
        subtitle="Calculé à rebours depuis chaque évaluation datée : poids, coefficient et note prévue. Une séance se coche seule avec le minuteur d’étude." />
      {days.length ? (
        <div className="space-y-4">
          {days.map(([d, items]) => (
            <div key={d}>
              <div className={`text-xs font-semibold mb-1.5 ${d === today ? 'text-accent' : 'text-ink'}`}>
                {dayLabel(d, today)} <span className="text-mute font-normal">· {fmtMinutes(items.reduce((s, x) => s + x.minutes, 0))}</span>
              </div>
              <div className="space-y-1.5">{items.map((it) => <PlanItem key={it.id} it={it} studied={studied} today={today} />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-mute">Datez vos évaluations (CC, CF…) sur la page de chaque matière : le plan de révision se construit tout seul.</p>
      )}
    </Card>
  );
}
