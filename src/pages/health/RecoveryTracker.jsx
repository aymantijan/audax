import { useState, useMemo } from 'react';
import { AlertTriangle, Plus, X, Droplet, History } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { readinessBand } from '../../utils/health-science';
import { todayKey, fmtDate } from '../../utils/formatters';
import { Card, Button, Badge, Field, Input, ProgressBar } from '../../components/common/ui';

const ACTIVITIES = [
  { key: 'sleep8', label: 'Sleep 8h+' },
  { key: 'meditation', label: 'Meditation' },
  { key: 'stretching', label: 'Stretching' },
  { key: 'cold', label: 'Cold exposure' },
  { key: 'massage', label: 'Massage' },
];

const WATER_QUICK_ADD = [250, 500, 1000];

export default function RecoveryTracker({ pendingPrompt }) {
  const {
    recoveryLogs, logRecovery, getReadiness, getOvertrainingAlerts,
    customRecoveryActivities, addCustomRecoveryActivity, removeCustomRecoveryActivity,
    waterTargetMl, setWaterTarget, logWater, getTodayWaterMl,
  } = useHealthStore();
  const today = todayKey();
  const [logDate, setLogDate] = useState(today);
  const isPastDate = logDate !== today;
  const dateLog = recoveryLogs.find((r) => r.date === logDate);
  const [selected, setSelected] = useState(dateLog?.activities || []);
  const [newActivity, setNewActivity] = useState('');

  const readiness = getReadiness();
  const band = readinessBand(readiness.score);
  const alerts = getOvertrainingAlerts();
  const allActivities = [...ACTIVITIES, ...customRecoveryActivities];
  const dateWater = getTodayWaterMl(logDate);

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((a) => a !== key) : [...s, key]));
  const save = () => logRecovery(selected, pendingPrompt?.id, logDate);

  const changeDate = (d) => {
    setLogDate(d);
    setSelected(recoveryLogs.find((r) => r.date === d)?.activities || []);
  };

  const submitActivity = (e) => {
    e.preventDefault();
    if (!newActivity.trim()) return;
    addCustomRecoveryActivity(newActivity.trim());
    setNewActivity('');
  };

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

      <Card title="Water Intake" action={<Droplet size={16} className="text-mute" />}>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span>{isPastDate ? fmtDate(logDate) : 'Today'}</span>
            <span className="text-mute">{dateWater}ml / {waterTargetMl}ml</span>
          </div>
          <ProgressBar value={dateWater} max={waterTargetMl} color={dateWater >= waterTargetMl ? 'var(--success)' : 'var(--accent-primary)'} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {WATER_QUICK_ADD.map((ml) => (
            <Button key={ml} variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => logWater(ml, logDate)}>+{ml}ml</Button>
          ))}
          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => logWater(-dateWater, logDate)}>Reset</Button>
        </div>
        <Field label="Daily target (ml)">
          <Input type="number" min="0" step="250" value={waterTargetMl} onChange={(e) => setWaterTarget(e.target.value)} className="w-32" />
        </Field>
      </Card>

      <Card
        title={isPastDate ? `Recovery Activities — ${fmtDate(logDate)}` : "Today's Recovery Activities"}
        action={
          <input
            type="date"
            value={logDate}
            max={today}
            onChange={(e) => e.target.value && changeDate(e.target.value)}
            className="bg-surface border border-line rounded px-1.5 py-0.5 text-[11px] text-ink cursor-pointer"
          />
        }
      >
        {isPastDate && (
          <div className="flex items-center gap-2 text-[11px] text-warn bg-warn/10 border border-warn/30 rounded-lg px-3 py-1.5 mb-3">
            <History size={12} /> Logging retroactively for {fmtDate(logDate)}.
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-2">
          {allActivities.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => toggle(a.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${
                selected.includes(a.key) ? 'border-good text-good bg-good/10' : 'border-line text-mute'
              }`}
            >
              {a.label}
              {customRecoveryActivities.some((c) => c.key === a.key) && (
                <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); removeCustomRecoveryActivity(a.key); }} className="hover:text-bad">
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
        </div>
        <form onSubmit={submitActivity} className="flex gap-2 mb-4">
          <Input value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Add a custom activity (e.g. Sauna, Yoga)…" className="flex-1 !py-1.5 text-xs" />
          <Button type="submit" variant="ghost" className="!px-2 !py-1"><Plus size={13} /></Button>
        </form>
        <Button onClick={save}>{dateLog ? 'Update' : 'Save'} recovery log</Button>
      </Card>

      <Card title="Last 14 Days">
        {history.length ? (
          <ul className="space-y-1.5">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span className="text-mute text-xs">{r.date}</span>
                <span className="flex items-center gap-3">
                  <span>{r.activities.length ? r.activities.map((a) => allActivities.find((x) => x.key === a)?.label || a).join(', ') : '—'}</span>
                  {r.waterMl > 0 && <span className="text-xs text-mute flex items-center gap-1"><Droplet size={11} /> {r.waterMl}ml</span>}
                </span>
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
