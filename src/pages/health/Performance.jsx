import { useState } from 'react';
import { Trash2, HeartPulse, Gauge, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Stat, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

// Performance & Recovery — the men's-track expansion. Deliberately scoped to
// lifestyle/performance metrics that are directly measurable from what the
// user logs (strength PRs, training volume, resting HR, self-reported
// vitality/mobility) — no hormonal or biomarker claims, framed as
// informational fitness tracking, not diagnostic.
export default function Performance() {
  const { performanceLogs, logPerformance, deletePerformance, getVO2maxEstimate, getPerformanceTrend, getEstimated1RMs, getWorkoutVolumeSeries, getReadiness } = useHealthStore();
  const today = todayKey();
  const todayLog = performanceLogs.find((p) => p.date === today);

  const [restingHr, setRestingHr] = useState(todayLog?.restingHr ?? '');
  const [vitality, setVitality] = useState(todayLog?.vitality ?? 6);
  const [mobility, setMobility] = useState(todayLog?.mobility ?? 6);
  const [notes, setNotes] = useState(todayLog?.notes ?? '');

  const save = () => {
    logPerformance({ restingHr, vitality, mobility, notes }, today);
  };

  const vo2max = getVO2maxEstimate();
  const trend = getPerformanceTrend();
  const oneRMs = getEstimated1RMs().slice(0, 5);
  const volume = getWorkoutVolumeSeries();
  const readiness = getReadiness();

  return (
    <div className="space-y-6">
      <Card title="Check-in Performance & Récupération">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="FC au repos (bpm, matin)" hint="Optionnel — marqueur de récupération cardiovasculaire">
            <Input type="number" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} placeholder="ex: 58" />
          </Field>
          <Field label={`Vitalité ressentie: ${vitality}/10`} hint="Énergie/motivation subjective — pas un proxy hormonal">
            <input type="range" min="1" max="10" value={vitality} onChange={(e) => setVitality(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label={`Mobilité ressentie: ${mobility}/10`} hint="Amplitude articulaire générale auto-évaluée">
            <input type="range" min="1" max="10" value={mobility} onChange={(e) => setMobility(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Note (optionnel)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <Button className="mt-3" onClick={save}>Enregistrer</Button>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="FC au repos" value={todayLog?.restingHr ? `${todayLog.restingHr} bpm` : '—'} />
        <Stat label="VO2max estimé" value={vo2max ? `${vo2max.value}` : '—'} sub={vo2max ? `via FC repos du ${vo2max.date}` : 'Log FC repos + année de naissance dans le profil'} />
        <Stat label="Capacité de récupération" value={`${readiness.breakdown.recovery}/15`} sub="Composante readiness" />
        <Stat label="Volume 12 sem." value={`${volume.reduce((a, v) => a + v.volume, 0).toLocaleString()} kg`} />
      </div>

      {trend.length > 1 && (
        <Card title="Tendance FC repos / vitalité / mobilité">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="restingHr" name="FC repos" stroke="#ff6b6b" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="vitality" name="Vitalité" stroke="#00d9ff" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="mobility" name="Mobilité" stroke="#00d97f" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="Force — meilleurs 1RM estimés">
        {oneRMs.length ? (
          <ul className="space-y-1.5">
            {oneRMs.map((r) => (
              <li key={r.exercise} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span className="flex items-center gap-2"><Gauge size={13} className="text-mute" /> {r.exercise}</span>
                <span className="font-semibold">{r.oneRM} kg</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Log des séances de force pour voir tes 1RM estimés.</EmptyState>
        )}
      </Card>

      <Card title="Volume d'entraînement — 12 dernières semaines">
        {volume.some((v) => v.volume > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volume}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="volume" fill="#00d9ff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log des séances de force pour voir ton volume hebdomadaire.</EmptyState>
        )}
      </Card>

      {performanceLogs.length > 0 && (
        <Card title="Historique">
          <ul className="space-y-1.5">
            {[...performanceLogs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span className="flex items-center gap-2"><HeartPulse size={13} className="text-mute" /> {p.date} · FC {p.restingHr ?? '—'} · Vitalité {p.vitality ?? '—'}/10 · Mobilité {p.mobility ?? '—'}/10</span>
                <button onClick={() => deletePerformance(p.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
