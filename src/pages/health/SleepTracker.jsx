import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useHabitStore } from '../../store/habitStore';
import { useHealthStore } from '../../store/healthStore';
import { SLEEP_BAND_COLOR } from '../../utils/sleep-quality';
import { Card, Button, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

// Sleep is entered once per day on the Habits page's morning check-in (bedtime +
// wake time → auto-scored) — reused here rather than duplicated, since burnout.js
// and the synergy score already depend on that single entry point.
export default function SleepTracker() {
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const { getSleepWindow } = useHealthStore();
  const navigate = useNavigate();
  const window_ = getSleepWindow();

  const history = useMemo(
    () =>
      [...energyLogs]
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .slice(-7)
        .map((l) => ({
          date: l.date.slice(5),
          score: l.sleepData?.sleepQualityScore ?? 0,
          hours: l.sleepData?.sleepHours ?? 0,
          band: l.sleepData?.sleepQualityScore >= 9 ? 'excellent' : l.sleepData?.sleepQualityScore >= 7 ? 'good' : l.sleepData?.sleepQualityScore >= 5 ? 'poor' : 'critical',
        })),
    [energyLogs]
  );

  const avg = history.length ? Math.round((history.reduce((a, h) => a + h.score, 0) / history.length) * 10) / 10 : null;

  return (
    <div className="space-y-6">
      {window_ && (
        <Card title="Your Optimal Sleep Window">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-mute mb-1">Bedtime</div>
              <div className="text-xl font-bold">{window_.bedtime}</div>
            </div>
            <div>
              <div className="text-xs text-mute mb-1">Wake time</div>
              <div className="text-xl font-bold">{window_.wakeTime}</div>
            </div>
            <div className="text-xs text-mute">Based on {window_.sampleSize} of your best nights (avg {window_.avgQuality}/10)</div>
          </div>
        </Card>
      )}

      <Card title="7-Day Sleep Quality" action={<Button variant="secondary" onClick={() => navigate('/habits')}>Log tonight's sleep</Button>}>
        {history.length ? (
          <>
            <div className="text-sm text-mute mb-3">7-day average: <span className="text-ink font-semibold">{avg}/10</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={history}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {history.map((h, i) => (
                    <Cell key={i} fill={SLEEP_BAND_COLOR[h.band]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <EmptyState>No sleep data yet — log your bedtime and wake time on the Habits page.</EmptyState>
        )}
      </Card>
    </div>
  );
}
