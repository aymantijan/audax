/**
 * HeatmapCalendar — GitHub-style contribution heatmap for discipline scores.
 * Shows last 3 months of daily scores as colored cells.
 */
import { useMemo } from 'react';
import { Card } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';

const DAY_LABELS = ['L', '', 'M', '', 'V', '', 'D'];

function cellColor(score) {
  if (score == null) return 'var(--bg-surface, #1a1a2e)';
  if (score >= 90) return 'var(--success)';
  if (score >= 75) return '#22c55e80'; // green/50 opacity
  if (score >= 60) return 'var(--warning)';
  if (score >= 40) return '#f59e0b80';
  return 'var(--danger, #ef4444)';
}

export default function HeatmapCalendar() {
  const store = useProgramStore();

  const { weeks, months } = useMemo(() => {
    const days = 91; // ~13 weeks
    const now = new Date();
    const cells = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const score = store.disciplineByDate[dateStr];
      cells.push({
        date: dateStr,
        score: score?.overall_score ?? null,
        dow: d.getDay() === 0 ? 6 : d.getDay() - 1, // 0=Mon
      });
    }

    // Group into weeks (Mon–Sun)
    const wks = [];
    let currentWeek = [];
    for (const cell of cells) {
      if (cell.dow === 0 && currentWeek.length > 0) {
        wks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(cell);
    }
    if (currentWeek.length) wks.push(currentWeek);

    // Month labels at week boundaries
    const monthLabels = [];
    let lastMonth = '';
    wks.forEach((wk, wi) => {
      const firstCell = wk[0];
      const month = new Date(firstCell.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short' });
      if (month !== lastMonth) {
        monthLabels.push({ week: wi, label: month });
        lastMonth = month;
      }
    });

    return { weeks: wks, months: monthLabels };
  }, [store.disciplineByDate]);

  return (
    <Card title="🗓️ Heatmap Discipline">
      <div className="text-xs text-mute mb-3">90 derniers jours — plus c'est vert, plus la discipline est élevée</div>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0.5">
          {/* Month labels */}
          <div className="flex gap-0.5 ml-5 mb-1">
            {months.map((m, i) => (
              <div
                key={i}
                className="text-[9px] text-mute"
                style={{ marginLeft: m.week > 0 ? `${(m.week - (months[i - 1]?.week || 0)) * 14 - 14}px` : 0 }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Grid: 7 rows (Mon–Sun) × N weeks */}
          {Array.from({ length: 7 }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-0.5">
              <span className="text-[8px] text-mute w-4 text-right">{DAY_LABELS[rowIdx]}</span>
              {weeks.map((wk, wi) => {
                const cell = wk.find((c) => c.dow === rowIdx);
                return (
                  <div
                    key={wi}
                    className="w-3 h-3 rounded-[2px] transition-colors"
                    style={{
                      background: cell ? cellColor(cell.score) : 'transparent',
                      opacity: cell ? (cell.score != null ? 1 : 0.2) : 0,
                    }}
                    title={cell ? `${cell.date}: ${cell.score != null ? Math.round(cell.score) + '/100' : 'pas de données'}` : ''}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-[9px] text-mute">
        <span>Moins</span>
        {[null, 40, 60, 75, 90].map((score, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-[2px]"
            style={{ background: cellColor(score) }}
          />
        ))}
        <span>Plus</span>
      </div>
    </Card>
  );
}
