import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useFocusStore } from '../../store/focusStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { weekStats, mondayOf } from '../../utils/weekly-review';
import { forecastTerm } from '../../utils/prediction';
import { fmtGrade } from '../../utils/academic';
import { fmtMinutes } from '../../utils/study';
import { todayKey } from '../../utils/formatters';
import { Button, Card, Textarea } from '../common/ui';
import { SectionHeader, tint, gradeColor } from './design';
import { useForecastContext } from './Forecast';

const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Tile({ label, value, sub, color }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="text-lg font-bold tabular-nums" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[10px] text-mute">{sub}</div>}
    </div>
  );
}

/**
 * Bilan de la semaine — on Sunday (the week ending) and still on Monday if it
 * wasn't done. Saving keeps a snapshot so next week shows the trend.
 */
export function WeeklyReviewCard() {
  const today = todayKey();
  const dow = new Date(`${today}T12:00:00`).getDay();
  const weekStart = dow === 0 ? mondayOf(today) : mondayOf(addDays(today, -1));
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const attendance = useLearningStore((s) => s.attendance);
  const classNotes = useLearningStore((s) => s.classNotes);
  const reviews = useLearningStore((s) => s.weeklyReviews);
  const saveWeeklyReview = useLearningStore((s) => s.saveWeeklyReview);
  const sessions = useFocusStore((s) => s.sessions);
  const reviewLog = useFlashcardStore((s) => s.reviewLog);
  const ctx = useForecastContext();
  const [win, setWin] = useState('');
  const [change, setChange] = useState('');

  const stats = useMemo(
    () => weekStats({ courses, academic, attendance, classNotes, sessions, reviewLog, settings: ctx.settings, weekStart }),
    [courses, academic, attendance, classNotes, sessions, reviewLog, ctx.settings, weekStart]
  );
  const forecastAvg = useMemo(() => {
    const term = academic.terms.find((t) => t.id === ctx.settings.activeTermId);
    return term ? forecastTerm(term.id, academic.modules, ctx).avg : null;
  }, [academic, ctx]);

  const termStart = academic.terms.find((t) => t.id === ctx.settings.activeTermId)?.startDate;
  if (!(dow === 0 || dow === 1) || reviews?.[weekStart] || !stats.subjects.length || (termStart && termStart > stats.end)) return null;
  const prev = Object.entries(reviews || {}).filter(([k]) => k < weekStart).sort((a, b) => b[0].localeCompare(a[0]))[0]?.[1];
  const delta = prev?.forecastAvg != null && forecastAvg != null ? forecastAvg - prev.forecastAvg : null;
  const t = stats.totals;
  const onTimeRate = t.required ? t.onTime / t.required : null;
  const weakest = [...stats.subjects].filter((s) => s.required || s.expected)
    .sort((a, b) => (a.onTime / (a.required || 1) + a.minutes / (a.expected || 1)) - (b.onTime / (b.required || 1) + b.minutes / (b.expected || 1)))[0];

  const save = () => saveWeeklyReview(weekStart, {
    forecastAvg, onTimeRate, absences: t.absent, minutes: stats.minutes, notes: stats.notes, reviews: stats.reviews, win: win.trim(), change: change.trim(),
  });

  return (
    <Card>
      <SectionHeader icon={ClipboardCheck} title="Bilan de la semaine"
        subtitle={`Du ${new Date(`${weekStart}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${new Date(`${stats.end}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · 2 minutes pour ajuster la semaine prochaine`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Tile label="Cours à l’heure" value={t.required ? `${t.onTime}/${t.required}` : '—'} sub={`${t.absent} absence(s) · ${t.late} retard(s)`}
          color={onTimeRate == null ? undefined : onTimeRate >= 0.9 ? 'var(--success)' : onTimeRate >= 0.7 ? 'var(--warning)' : 'var(--error)'} />
        <Tile label="Étude personnelle" value={fmtMinutes(stats.minutes)} sub={`objectif ${fmtMinutes(stats.target)}`}
          color={stats.target ? (stats.minutes >= stats.target ? 'var(--success)' : stats.minutes >= stats.target * 0.6 ? 'var(--warning)' : 'var(--error)') : undefined} />
        <Tile label="Cours résumés · fiches révisées" value={`${stats.notes} · ${stats.reviews}`} />
        <Tile label="Moyenne prévue" value={forecastAvg == null ? '—' : `≈ ${fmtGrade(forecastAvg, 1)}`}
          color={forecastAvg == null ? undefined : gradeColor(forecastAvg, ctx.settings)}
          sub={delta == null ? 'tendance dès la semaine prochaine' : <span className="inline-flex items-center gap-1" style={{ color: delta >= 0 ? 'var(--success)' : 'var(--error)' }}>{delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{delta >= 0 ? '+' : ''}{fmtGrade(delta, 1)} vs semaine dernière</span>} />
      </div>

      <div className="rounded-lg border border-line overflow-x-auto mt-3">
        <table className="w-full text-sm min-w-[28rem]">
          <thead className="bg-surface text-[11px] text-mute">
            <tr><th className="text-left px-3 py-1.5 font-medium">Matière</th><th className="px-3 py-1.5 font-medium">À l’heure</th><th className="px-3 py-1.5 font-medium">Étude / visé</th><th className="px-3 py-1.5 font-medium">Résumés</th></tr>
          </thead>
          <tbody>
            {stats.subjects.map((s) => (
              <tr key={s.course.id} className="border-t border-line/60" style={weakest?.course.id === s.course.id ? { background: tint('var(--warning)', 8) } : undefined}>
                <td className="px-3 py-1.5"><Link to={`/learning/course/${s.course.id}`} className="text-ink hover:text-accent">{s.course.name}</Link></td>
                <td className={`px-3 py-1.5 text-center tabular-nums ${s.absent ? 'text-bad' : 'text-mute'}`}>{s.required ? `${s.onTime}/${s.required}` : '—'}</td>
                <td className="px-3 py-1.5 text-center tabular-nums text-mute">{fmtMinutes(s.minutes)} / {fmtMinutes(s.expected)}</td>
                <td className="px-3 py-1.5 text-center tabular-nums text-mute">{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {weakest && <p className="text-[11px] text-mute mt-1.5">Surlignée : la matière la plus en retard cette semaine (assiduité + étude), à prioriser.</p>}

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <Textarea rows={2} value={win} onChange={(e) => setWin(e.target.value)} placeholder="Ce qui a marché cette semaine…" />
        <Textarea rows={2} value={change} onChange={(e) => setChange(e.target.value)} placeholder="Une chose à changer la semaine prochaine…" />
      </div>
      <div className="flex justify-end mt-3">
        <Button onClick={save}>Clore la semaine</Button>
      </div>
    </Card>
  );
}
