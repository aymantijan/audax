import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { readinessBand } from '../../utils/health-science';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Badge } from '../../components/common/ui';

const ACTIVITIES = [
  { key: 'sleep8', label: 'Sleep 8h+' },
  { key: 'meditation', label: 'Meditation' },
  { key: 'stretching', label: 'Stretching' },
  { key: 'cold', label: 'Cold exposure' },
  { key: 'massage', label: 'Massage' },
];

export default function RecoveryTracker({ pendingPrompt }) {
  const { recoveryLogs, logRecovery, getReadiness, getOvertrainingAlerts } = useHealthStore();
  const today = todayKey();
  const todayLog = recoveryLogs.find((r) => r.date === today);
  const [selected, setSelected] = useState(todayLog?.activities || []);

  const readiness = getReadiness();
  const band = readinessBand(readiness.score);
  const alerts = getOvertrainingAlerts();

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((a) => a !== key) : [...s, key]));
  const save = () => logRecovery(selected, pendingPrompt?.id);

  const history = useMemo(
    () => [...recoveryLogs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14),
    [recoveryLogs]
  );

  return (
    <div className="space-y-6">
      <Card title="Readiness Breakdown">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl font-bold" style={{ color: band.color }}>{readiness.score}</div>
          <Badge color={band.color}>{band.label}</Badge>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            ['Sleep', readiness.breakdown.sleep, 30],
            ['Energy', readiness.breakdown.energy, 25],
            ['Stress', readiness.breakdown.stress, 20],
            ['Recovery', readiness.breakdown.recovery, 15],
            ['Streak', readiness.breakdown.consistency, 10],
          ].map(([label, v, max]) => (
            <div key={label}>
              <div className="text-xs text-mute mb-1">{label}</div>
              <div className="text-sm font-semibold">{v}/{max}</div>
            </div>
          ))}
        </div>
      </Card>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 ${a.level === 'danger' ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`}>
              <AlertTriangle size={14} /> {a.message}
            </div>
          ))}
        </div>
      )}

      <Card title="Today's Recovery Activities">
        <div className="flex flex-wrap gap-2 mb-4">
          {ACTIVITIES.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => toggle(a.key)}
              className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${
                selected.includes(a.key) ? 'border-good text-good bg-good/10' : 'border-line text-mute'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <Button onClick={save}>{todayLog ? 'Update' : 'Save'} recovery log</Button>
      </Card>

      <Card title="Last 14 Days">
        {history.length ? (
          <ul className="space-y-1.5">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span className="text-mute text-xs">{r.date}</span>
                <span>{r.activities.length ? r.activities.map((a) => ACTIVITIES.find((x) => x.key === a)?.label).join(', ') : '—'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-mute text-sm py-6">No recovery activities logged yet.</div>
        )}
      </Card>
    </div>
  );
}
