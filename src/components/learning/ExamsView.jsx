import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, History, AlertTriangle } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { upcomingEvaluations, daysUntil, evalTypeLabel, normGrade, requiredGrade, fmtGrade } from '../../utils/academic';
import { todayKey } from '../../utils/formatters';
import { Card } from '../common/ui';
import { SectionHeader, SegmentedTabs, useAcademicSettings, GradePill, tint, gradeColor, frDate, countdownLabel } from './design';

function urgency(days) {
  if (days <= 3) return 'var(--error)';
  if (days <= 10) return 'var(--warning)';
  return 'var(--accent-primary)';
}

export default function ExamsView() {
  const courses = useLearningStore((s) => s.courses);
  const settings = useAcademicSettings();
  const today = todayKey();
  const [view, setView] = useState('upcoming');

  const all = useMemo(() => upcomingEvaluations(courses, today), [courses, today]);
  const upcoming = all.filter((x) => !x.past && normGrade(x.ev, settings) == null);
  const pastUngraded = all.filter((x) => x.past && normGrade(x.ev, settings) == null);
  const graded = all.filter((x) => normGrade(x.ev, settings) != null).reverse();
  const undated = courses.filter((c) => c.kind === 'academic' && c.status === 'active')
    .flatMap((c) => (c.evaluations || []).filter((e) => !e.date && normGrade(e, settings) == null).map((ev) => ({ course: c, ev })));

  const list = view === 'upcoming' ? upcoming : graded;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <SectionHeader icon={CalendarClock} title="Évaluations" subtitle="Contrôles, partiels, examens et rendus, avec la note qu'il vous faut." />
        <SegmentedTabs value={view} onChange={setView} tabs={[
          { key: 'upcoming', label: 'À venir', icon: CalendarClock, count: upcoming.length },
          { key: 'graded', label: 'Notées', icon: History, count: graded.length },
        ]} />
      </div>

      {view === 'upcoming' && pastUngraded.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm flex items-start gap-2" style={{ borderColor: tint('var(--warning)', 40), background: tint('var(--warning)', 8) }}>
          <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
          <div>
            <span className="text-ink font-medium">{pastUngraded.length} évaluation(s) passée(s) sans note : </span>
            <span className="text-mute">
              {pastUngraded.slice(0, 4).map((x, i) => (
                <span key={x.ev.id}>{i > 0 && ', '}<Link className="underline hover:text-ink" to={`/learning/course/${x.course.id}`}>{evalTypeLabel(x.ev.type, true)} {x.course.name}</Link></span>
              ))}
            </span>
          </div>
        </div>
      )}

      {list.length ? (
        <div className="space-y-2">
          {list.map(({ course, ev }) => {
            const days = daysUntil(ev.date, today);
            const g = normGrade(ev, settings);
            const target = course.targetGrade ?? settings.passMark;
            const req = g == null ? requiredGrade(course, target, settings) : null;
            const color = g == null ? urgency(days) : gradeColor(g, settings);
            return (
              <Link key={ev.id} to={`/learning/course/${course.id}`}
                className="flex items-center gap-4 rounded-xl border border-line bg-card px-4 py-3 hover:border-accent transition-colors">
                <div className="w-14 shrink-0 text-center rounded-lg py-1.5" style={{ background: tint(color, 12) }}>
                  <div className="text-[10px] uppercase font-semibold" style={{ color }}>{frDate(ev.date, { month: 'short' })}</div>
                  <div className="text-lg font-bold leading-none text-ink">{new Date(ev.date + 'T12:00:00').getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{course.name}</div>
                  <div className="text-xs text-mute mt-0.5">
                    {ev.name || evalTypeLabel(ev.type)} · {ev.weight}% de la note
                    {g == null && <span style={{ color }}> · {countdownLabel(days)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {g != null ? (
                    <GradePill value={g} settings={settings} />
                  ) : req ? (
                    <div className="text-xs">
                      {req.status === 'secured' ? <span className="text-good">Validation assurée</span>
                        : req.status === 'impossible' ? <span className="text-bad">Objectif hors d'atteinte</span>
                        : <>Viser <b className="text-sm tabular-nums" style={{ color: gradeColor(req.needed, settings) }}>{fmtGrade(req.needed)}</b><span className="text-mute">/{settings.scale}</span></>}
                      <div className="text-[10px] text-mute">{course.targetGrade != null ? `objectif ${fmtGrade(target)}` : 'pour valider'}</div>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="text-center py-6 text-sm text-mute">
            {view === 'upcoming' ? 'Aucune évaluation datée à venir. Ajoutez les dates dans chaque matière.' : 'Aucune note saisie pour le moment.'}
          </div>
        </Card>
      )}

      {view === 'upcoming' && undated.length > 0 && (
        <div className="text-xs text-mute">
          {undated.length} évaluation(s) sans date : {undated.slice(0, 6).map((x, i) => (
            <span key={x.ev.id}>{i > 0 && ' · '}<Link className="hover:text-ink underline" to={`/learning/course/${x.course.id}`}>{evalTypeLabel(x.ev.type, true)} {x.course.name}</Link></span>
          ))}{undated.length > 6 && ' …'}
        </div>
      )}
    </div>
  );
}
