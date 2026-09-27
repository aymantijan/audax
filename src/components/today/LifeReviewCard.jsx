import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Sparkles, CalendarRange } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { useHealthStore } from '../../store/healthStore';
import { useFocusStore } from '../../store/focusStore';
import { useAccountingStore } from '../../store/accountingStore';
import { useTradingStore } from '../../store/tradingStore';
import { useReadingsStore } from '../../store/readingsStore';
import { useLearningStore } from '../../store/learningStore';
import { useAuthStore } from '../../store/authStore';
import { weekFigures, compareWeeks, weekHeadline, addDays, mondayOf } from '../../utils/life-review';
import { isModuleEnabled } from '../../utils/navigation';
import { fmtDateShort, fmtMAD, todayKey } from '../../utils/formatters';
import { openAssistant } from '../../services/assistant';
import { Card, Button } from '../common/ui';

const fmtValue = (row, v) => {
  if (v == null) return '—';
  if (row.unit === 'money') return fmtMAD(v);
  if (row.unit === 'pnl') return `${v > 0 ? '+' : ''}${v}`;
  return `${v}${row.unit === '%' ? ' %' : row.unit ? ` ${row.unit}` : ''}`;
};
const TREND = {
  better: { icon: TrendingUp, color: 'var(--success)' },
  worse: { icon: TrendingDown, color: 'var(--error)' },
  flat: { icon: Minus, color: 'var(--text-secondary)' },
};

// "Bilan de la semaine": every section on one card, this week vs the week before.
export default function LifeReviewCard() {
  const today = todayKey();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const user = useAuthStore((s) => s.user);
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const workouts = useHealthStore((s) => s.workouts);
  const sessions = useFocusStore((s) => s.sessions);
  const journal = useAccountingStore((s) => s.journal);
  const allTrades = useTradingStore((s) => s.trades);
  const readLog = useReadingsStore((s) => s.readLog);
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const attendance = useLearningStore((s) => s.attendance);
  const trading = isModuleEnabled(user, 'trading');

  const { rows, headline } = useMemo(() => {
    const data = { habits, logs, energyLogs, workouts, sessions, journal, trades: trading ? allTrades : [], readLog, courses, academic, attendance };
    const cur = weekFigures(data, monday, today);
    const prev = weekFigures(data, addDays(monday, -7), today);
    const r = compareWeeks(cur, prev);
    return { rows: r, headline: weekHeadline(r) };
  }, [monday, today, habits, logs, energyLogs, workouts, sessions, journal, allTrades, trading, readLog, courses, academic, attendance]);

  const isCurrent = monday === mondayOf(today);
  return (
    <Card
      title={<span className="flex items-center gap-2"><CalendarRange size={15} /> Bilan de la semaine</span>}
      action={
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Semaine précédente" onClick={() => setMonday(addDays(monday, -7))} className="ui-icon-btn p-1.5 rounded-lg text-mute hover:text-ink hover:bg-surface cursor-pointer flex items-center justify-center"><ChevronLeft size={16} /></button>
          <span className="text-xs text-mute min-w-[7.5rem] text-center">{isCurrent ? 'Cette semaine' : `Sem. du ${fmtDateShort(monday)}`}</span>
          <button type="button" aria-label="Semaine suivante" disabled={isCurrent} onClick={() => setMonday(addDays(monday, 7))} className="ui-icon-btn p-1.5 rounded-lg text-mute hover:text-ink hover:bg-surface cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"><ChevronRight size={16} /></button>
        </div>
      }
    >
      <p className="text-sm mb-4">{headline}</p>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rows.map((r) => {
            const T = TREND[r.trend];
            return (
              <div key={r.key} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="text-[11px] text-mute">{r.label}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-data font-bold">{fmtValue(r, r.value)}</span>
                  <T.icon size={14} style={{ color: T.color }} aria-label={r.trend === 'better' ? 'en progrès' : r.trend === 'worse' ? 'en baisse' : 'stable'} />
                </div>
                <div className="text-[10px] text-mute">avant : {fmtValue(r, r.previous)}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 mt-4">
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAssistant('Propose-moi 3 ajustements concrets pour la semaine prochaine, à valider : une habitude à alléger ou renforcer, un budget, et la matière ou le sujet prioritaire.')}>
          <span className="flex items-center gap-1.5"><Sparkles size={13} /> 3 ajustements à valider</span>
        </Button>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAssistant('Fais le bilan de ma semaine, section par section, et propose-moi 3 priorités pour la semaine prochaine.')}>
          <span className="flex items-center gap-1.5"><Sparkles size={13} /> Bilan commenté</span>
        </Button>
      </div>
    </Card>
  );
}
