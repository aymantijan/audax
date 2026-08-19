import { useState, useMemo } from 'react';
import { Trash2, Plus, X, Sparkles, Dumbbell } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { CYCLE_PHASE_LABEL, CYCLE_PHASE_COLOR, estimateCycleLength } from '../../utils/health-science';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Badge, EmptyState } from '../../components/common/ui';

const SYMPTOMS = ['Cramps', 'Fatigue', 'Bloating', 'Headache', 'Mood swings', 'Breast tenderness', 'Acne', 'Cravings'];
const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function CycleTracking() {
  const { cycleLogs, logCycleStart, deleteCycleLog, markPeriodEnd, getCyclePhase, getCyclePhaseCoaching, getActiveProgram, getActiveCuratedProgram, customCycleSymptoms, addCustomSymptom, removeCustomSymptom } = useHealthStore();
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const [flow, setFlow] = useState('medium');
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [newSymptom, setNewSymptom] = useState('');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());

  const phase = getCyclePhase();
  const coaching = getCyclePhaseCoaching();
  const activeProgram = getActiveProgram() || getActiveCuratedProgram();
  const allSymptoms = [...SYMPTOMS, ...customCycleSymptoms];

  // Symptom "severity" proxied by count of symptoms logged per entry — a
  // simple, transparent trend without inventing a 1-10 severity scale nobody
  // asked to fill in.
  const symptomTrend = useMemo(
    () => [...cycleLogs].sort((a, b) => (a.date < b.date ? -1 : 1)).map((c) => ({ date: c.date.slice(5), count: c.symptoms.length })),
    [cycleLogs]
  );
  const toggleSymptom = (s) => setSymptoms((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));

  const save = () => {
    logCycleStart(startDate, flow, symptoms, notes);
    setSymptoms([]);
    setNotes('');
    setStartDate(todayKey());
  };

  const submitCustomSymptom = (e) => {
    e.preventDefault();
    if (!newSymptom.trim()) return;
    addCustomSymptom(newSymptom.trim());
    setNewSymptom('');
  };

  // The most recent period-start log without a recorded end date — surfaces a
  // "mark ended" action instead of forcing a second explicit start-date entry.
  const openPeriod = [...cycleLogs].reverse().find((c) => !c.endDate);

  // Average energy by cycle phase — a light correlation view without needing
  // a full Pearson r (phase is categorical, not continuous). Uses the SAME
  // estimated cycle length as the "Current Phase" card above (previously
  // hardcoded to 28 here, which could silently disagree with that card).
  const { energyByPhase, cycleLen } = useMemo(() => {
    const dates = cycleLogs.map((c) => c.date).sort();
    if (dates.length < 2) return { energyByPhase: null, cycleLen: null };
    const cycleLen = estimateCycleLength(dates) || 28;
    const buckets = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
    for (const log of energyLogs) {
      const cyclesBefore = dates.filter((d) => d <= log.date);
      if (!cyclesBefore.length) continue;
      const lastStart = cyclesBefore[cyclesBefore.length - 1];
      const dayOfCycle = Math.floor((new Date(log.date) - new Date(lastStart)) / 86400000) + 1;
      let p;
      if (dayOfCycle <= 5) p = 'menstrual';
      else if (dayOfCycle <= cycleLen * 0.46) p = 'follicular';
      else if (dayOfCycle <= cycleLen * 0.54) p = 'ovulation';
      else if (dayOfCycle <= cycleLen) p = 'luteal';
      else continue;
      if (log.energyStartLevel != null) buckets[p].push(log.energyStartLevel);
    }
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    return { energyByPhase: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, avg(v)])), cycleLen };
  }, [cycleLogs, energyLogs]);

  // Predicted next period = last start + estimated cycle length. A rough
  // calendar projection, not a fertility/ovulation prediction.
  const predictedNext = useMemo(() => {
    if (!cycleLogs.length) return null;
    const lastStart = [...cycleLogs].map((c) => c.date).sort().at(-1);
    const len = (cycleLogs.length >= 2 ? estimateCycleLength(cycleLogs.map((c) => c.date).sort()) : null) || 28;
    const d = new Date(lastStart + 'T00:00:00');
    d.setDate(d.getDate() + len);
    return d.toISOString().slice(0, 10);
  }, [cycleLogs]);

  return (
    <div className="space-y-6">
      {phase && (
        <Card title="Current Phase">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge color={CYCLE_PHASE_COLOR[phase.phase]}>{CYCLE_PHASE_LABEL[phase.phase]}</Badge>
            {phase.dayOfCycle && <span className="text-sm text-mute">Day {phase.dayOfCycle} of ~{phase.cycleLength}</span>}
            {predictedNext && <span className="text-sm text-mute">· Next period expected ~{fmtDateShort(predictedNext)}</span>}
          </div>
        </Card>
      )}

      {coaching?.note && (
        <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            {coaching.note}
            {activeProgram && coaching.trainingLoadHint && (
              <div className="flex items-center gap-1.5 text-xs text-mute mt-1.5">
                <Dumbbell size={12} />
                {coaching.trainingLoadHint === 'push_ok' && "Ton programme actif peut être suivi tel quel — c'est une fenêtre souvent favorable."}
                {coaching.trainingLoadHint === 'lighter_ok' && 'Si besoin, réduis légèrement charge/volume sur ton programme actif aujourd\'hui — ce n\'est pas une obligation.'}
                {coaching.trainingLoadHint === 'moderate' && 'Ton programme actif reste adapté — reste simplement à l\'écoute si l\'énergie fluctue.'}
              </div>
            )}
          </div>
        </div>
      )}

      {openPeriod && (
        <div className="flex items-center justify-between gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <span className="text-sm">Period started {fmtDateShort(openPeriod.date)} — still open.</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={endDate}
              min={openPeriod.date}
              max={todayKey()}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              className="bg-surface border border-line rounded px-1.5 py-0.5 text-[11px] text-ink cursor-pointer"
            />
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => markPeriodEnd(openPeriod.id, endDate)}>Mark ended</Button>
          </div>
        </div>
      )}

      <Card title="Log Period Start">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Field label="Flow">
            <Select value={flow} onChange={(e) => setFlow(e.target.value)} options={[{ value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }]} />
          </Field>
          <Field label="Start date" hint="Backdate a missed entry">
            <Input type="date" value={startDate} max={todayKey()} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {allSymptoms.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${
                symptoms.includes(s) ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'
              }`}
            >
              {s}
              {customCycleSymptoms.includes(s) && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); removeCustomSymptom(s); }}
                  className="hover:text-bad"
                >
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
        </div>
        <form onSubmit={submitCustomSymptom} className="flex gap-2 mb-3">
          <Input value={newSymptom} onChange={(e) => setNewSymptom(e.target.value)} placeholder="Add a custom symptom…" className="flex-1 !py-1.5 text-xs" />
          <Button type="submit" variant="ghost" className="!px-2 !py-1"><Plus size={13} /></Button>
        </form>
        <Button onClick={save}>{startDate === todayKey() ? 'Log today as period start' : `Log ${startDate} as period start`}</Button>
      </Card>

      {energyByPhase && (
        <Card title="Energy by Phase" action={cycleLen && <span className="text-xs text-mute">est. cycle length: {cycleLen}d</span>}>
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

      {symptomTrend.length > 1 && (
        <Card title="Symptom Trend">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={symptomTrend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v} symptôme(s)`, '']} />
              <Bar dataKey="count" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-mute mt-2">Nombre de symptômes cochés par entrée — une tendance simple, pas une échelle de sévérité clinique.</p>
        </Card>
      )}

      <Card title="History">
        {cycleLogs.length ? (
          <ul className="space-y-1.5">
            {[...cycleLogs].reverse().map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>
                  {c.date}{c.endDate ? ` → ${c.endDate}` : ''} · {c.flow}{c.symptoms.length ? ` · ${c.symptoms.join(', ')}` : ''}
                </span>
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
