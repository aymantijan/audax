import { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { CYCLE_PHASE_LABEL, CYCLE_PHASE_COLOR } from '../../utils/health-science';
import { Card, Button, Field, Input, Select, Badge, EmptyState } from '../../components/common/ui';

const SYMPTOMS = ['Cramps', 'Fatigue', 'Bloating', 'Headache', 'Mood swings', 'Breast tenderness', 'Acne', 'Cravings'];

export default function CycleTracking() {
  const { cycleLogs, logCycleStart, deleteCycleLog, getCyclePhase } = useHealthStore();
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const [flow, setFlow] = useState('medium');
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');

  const phase = getCyclePhase();
  const toggleSymptom = (s) => setSymptoms((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));

  const save = () => {
    logCycleStart(undefined, flow, symptoms, notes);
    setSymptoms([]);
    setNotes('');
  };

  // Average energy by cycle phase — a light correlation view without needing
  // a full Pearson r (phase is categorical, not continuous).
  const energyByPhase = useMemo(() => {
    const dates = cycleLogs.map((c) => c.date).sort();
    if (dates.length < 2) return null;
    const buckets = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
    for (const log of energyLogs) {
      const cyclesBefore = dates.filter((d) => d <= log.date);
      if (!cyclesBefore.length) continue;
      const lastStart = cyclesBefore[cyclesBefore.length - 1];
      const dayOfCycle = Math.floor((new Date(log.date) - new Date(lastStart)) / 86400000) + 1;
      const cycleLen = 28;
      let p;
      if (dayOfCycle <= 5) p = 'menstrual';
      else if (dayOfCycle <= cycleLen * 0.46) p = 'follicular';
      else if (dayOfCycle <= cycleLen * 0.54) p = 'ovulation';
      else if (dayOfCycle <= cycleLen) p = 'luteal';
      else continue;
      if (log.energyStartLevel != null) buckets[p].push(log.energyStartLevel);
    }
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, avg(v)]));
  }, [cycleLogs, energyLogs]);

  return (
    <div className="space-y-6">
      {phase && (
        <Card title="Current Phase">
          <div className="flex items-center gap-4">
            <Badge color={CYCLE_PHASE_COLOR[phase.phase]}>{CYCLE_PHASE_LABEL[phase.phase]}</Badge>
            {phase.dayOfCycle && <span className="text-sm text-mute">Day {phase.dayOfCycle} of ~{phase.cycleLength}</span>}
          </div>
        </Card>
      )}

      <Card title="Log Period Start">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Flow">
            <Select value={flow} onChange={(e) => setFlow(e.target.value)} options={[{ value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }]} />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {SYMPTOMS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${
                symptoms.includes(s) ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button onClick={save}>Log today as period start</Button>
      </Card>

      {energyByPhase && (
        <Card title="Energy by Phase">
          <div className="grid grid-cols-4 gap-3 text-center">
            {Object.entries(energyByPhase).map(([phaseKey, val]) => (
              <div key={phaseKey}>
                <div className="text-xs text-mute mb-1">{CYCLE_PHASE_LABEL[phaseKey]}</div>
                <div className="text-lg font-semibold" style={{ color: CYCLE_PHASE_COLOR[phaseKey] }}>{val ?? '—'}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="History">
        {cycleLogs.length ? (
          <ul className="space-y-1.5">
            {[...cycleLogs].reverse().map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>{c.date} · {c.flow}{c.symptoms.length ? ` · ${c.symptoms.join(', ')}` : ''}</span>
                <button onClick={() => deleteCycleLog(c.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No cycle entries yet.</EmptyState>
        )}
      </Card>
    </div>
  );
}
