/**
 * GanttTimeline — Programme phases and sessions displayed as a Gantt chart.
 * Pure CSS implementation (no extra deps).
 */
import { useMemo } from 'react';
import { Card } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';

const PHASE_COLORS = [
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  '#a78bfa', // violet
  '#f472b6', // pink
  '#34d399', // emerald
];

export default function GanttTimeline() {
  const store = useProgramStore();
  const program = store.activeProgram || store.draftProgram;
  const { phases, sessionsByPhase } = store;

  const ganttData = useMemo(() => {
    if (!program || !phases.length) return null;

    // Find earliest and latest dates
    let minDate = Infinity, maxDate = -Infinity;
    for (const p of phases) {
      if (p.start_date) {
        const s = new Date(p.start_date).getTime();
        const e = new Date(p.end_date || p.start_date).getTime();
        if (s < minDate) minDate = s;
        if (e > maxDate) maxDate = e;
      }
    }
    if (minDate === Infinity) return null;

    const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000));
    const today = new Date().toISOString().slice(0, 10);
    const todayOffset = Math.ceil((new Date(today).getTime() - minDate) / 86400000);

    const rows = phases.map((phase, idx) => {
      const start = new Date(phase.start_date).getTime();
      const end = new Date(phase.end_date || phase.start_date).getTime();
      const startDay = Math.ceil((start - minDate) / 86400000);
      const duration = Math.max(1, Math.ceil((end - start) / 86400000));
      const sessions = sessionsByPhase[phase.id] || [];

      return {
        id: phase.id,
        name: phase.name,
        startDay,
        duration,
        color: PHASE_COLORS[idx % PHASE_COLORS.length],
        isActive: phase.status === 'active',
        sessionCount: sessions.length,
      };
    });

    // Month markers
    const months = [];
    const startDate = new Date(minDate);
    const endDate = new Date(maxDate);
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur <= endDate) {
      const offset = Math.max(0, Math.ceil((cur.getTime() - minDate) / 86400000));
      months.push({
        label: cur.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        offset,
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    return { rows, totalDays, todayOffset, months };
  }, [program, phases, sessionsByPhase]);

  if (!ganttData) {
    return (
      <Card>
        <div className="text-sm text-mute text-center py-6">
          Ajoutez des phases avec dates pour voir le planning Gantt.
        </div>
      </Card>
    );
  }

  const { rows, totalDays, todayOffset, months } = ganttData;

  return (
    <Card title="📅 Timeline Gantt">
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(400, totalDays * 4) }}>
          {/* Month headers */}
          <div className="flex relative h-5 mb-1 border-b border-line">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute text-[9px] text-mute"
                style={{ left: `${(m.offset / totalDays) * 100}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Phase bars */}
          <div className="space-y-2 relative">
            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute top-0 bottom-0 w-px z-10"
                style={{
                  left: `${(todayOffset / totalDays) * 100}%`,
                  background: 'var(--accent)',
                }}
              >
                <div className="absolute -top-5 -translate-x-1/2 text-[8px] text-accent font-semibold">
                  Auj.
                </div>
              </div>
            )}

            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-2 h-8">
                <div className="w-28 text-xs truncate text-right text-mute flex-shrink-0">
                  {row.name}
                </div>
                <div className="flex-1 relative h-full">
                  <div
                    className="absolute h-full rounded-md flex items-center px-2 transition-all"
                    style={{
                      left: `${(row.startDay / totalDays) * 100}%`,
                      width: `${Math.max(2, (row.duration / totalDays) * 100)}%`,
                      background: row.color,
                      opacity: row.isActive ? 1 : 0.5,
                    }}
                  >
                    <span className="text-[9px] text-white font-medium whitespace-nowrap overflow-hidden">
                      {row.duration}j · {row.sessionCount} séance{row.sessionCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
