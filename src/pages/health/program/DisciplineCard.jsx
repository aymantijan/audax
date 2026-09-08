import { useState, useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, Clock, CheckCircle, Utensils, Moon, Heart, ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Badge } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { WEIGHTS } from '../../../utils/discipline-engine';

const COMPONENT_META = [
  { key: 'timing_score', label: 'Ponctualité', weight: WEIGHTS.timing, icon: Clock, color: 'text-accent' },
  { key: 'completion_score', label: 'Complétion', weight: WEIGHTS.completion, icon: CheckCircle, color: 'text-good' },
  { key: 'nutrition_score', label: 'Nutrition', weight: WEIGHTS.nutrition, icon: Utensils, color: 'text-warning' },
  { key: 'sleep_score', label: 'Sommeil', weight: WEIGHTS.sleep, icon: Moon, color: 'text-accent' },
  { key: 'recovery_score', label: 'Récupération', weight: WEIGHTS.recovery, icon: Heart, color: 'text-bad' },
  { key: 'habits_score', label: 'Habitudes', weight: WEIGHTS.habits, icon: ListChecks, color: 'text-good' },
];

function scoreColor(score) {
  if (score >= 80) return 'text-good';
  if (score >= 60) return 'text-warning';
  return 'text-bad';
}

function ScoreRing({ score, size = 80 }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger, #ef4444)';

  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-line, #333)" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="font-bold" style={{ fontSize: size * 0.28, fill: color }}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

/**
 * Displays the discipline score for today (or selected date)
 * with breakdown by component and 7-day trend.
 */
export default function DisciplineCard() {
  const store = useProgramStore();
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const todayScore = store.getDisciplineForDate(today);
  const trend = store.getDisciplineTrend(7);

  const weekAvg = useMemo(() => {
    if (!trend.length) return null;
    return Math.round(trend.reduce((sum, t) => sum + t.overall_score, 0) / trend.length * 100) / 100;
  }, [trend]);

  // Week-over-week change
  const lastWeekTrend = store.getDisciplineTrend(14).slice(0, 7);
  const lastWeekAvg = lastWeekTrend.length
    ? lastWeekTrend.reduce((sum, t) => sum + t.overall_score, 0) / lastWeekTrend.length
    : null;
  const weekDelta = weekAvg != null && lastWeekAvg != null ? weekAvg - lastWeekAvg : null;

  if (!todayScore && !trend.length) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-mute">
          <Target size={16} />
          <span className="text-sm">Score de discipline — pas encore de données pour aujourd'hui.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-accent" />
          <span className="font-semibold text-sm">Discipline</span>
          {weekAvg != null && (
            <Badge>Sem. {weekAvg.toFixed(0)}/100</Badge>
          )}
          {weekDelta != null && (
            <span className={`text-xs flex items-center gap-0.5 ${weekDelta >= 0 ? 'text-good' : 'text-bad'}`}>
              {weekDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {weekDelta >= 0 ? '+' : ''}{weekDelta.toFixed(1)}
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-mute hover:text-ink cursor-pointer">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Today's score ring + 7-day sparkline */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center">
          <ScoreRing score={todayScore?.overall_score ?? 0} />
          <span className="text-[10px] text-mute mt-1">Aujourd'hui</span>
        </div>

        {/* 7-day mini bars */}
        {trend.length > 0 && (
          <div className="flex-1">
            <div className="flex items-end gap-1 h-12">
              {trend.map((t) => (
                <div key={t.score_date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (t.overall_score / 100) * 48)}px`,
                      background: t.score_date === today
                        ? 'var(--accent)'
                        : t.overall_score >= 80 ? 'var(--success)' : t.overall_score >= 60 ? 'var(--warning)' : 'var(--danger, #ef4444)',
                      opacity: t.score_date === today ? 1 : 0.6,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-0.5">
              {trend.map((t) => (
                <div key={t.score_date} className="flex-1 text-center text-[8px] text-mute">
                  {new Date(t.score_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expanded: component breakdown */}
      {expanded && todayScore && (
        <div className="mt-4 pt-3 border-t border-line space-y-2">
          {COMPONENT_META.map(({ key, label, weight, icon: Icon, color }) => {
            const value = todayScore[key];
            if (value == null) return null;
            return (
              <div key={key} className="flex items-center gap-3">
                <Icon size={12} className={color} />
                <span className="text-xs w-24">{label}</span>
                <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${value}%`,
                      background: value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--danger, #ef4444)',
                    }}
                  />
                </div>
                <span className={`text-xs font-medium w-8 text-right ${scoreColor(value)}`}>
                  {Math.round(value)}
                </span>
                <span className="text-[9px] text-mute w-8 text-right">{(weight * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
