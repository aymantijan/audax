/**
 * CardioTrend — cardio evolution over time from logged Programme (and manual)
 * cardio sessions. Pick a metric (duration / distance / avg HR) and optionally
 * filter by modality; see the trend plus a per-modality summary.
 */
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, Badge, EmptyState } from '../../../../components/common/ui';
import { useHealthStore } from '../../../../store/healthStore';

const METRICS = [
  { key: 'durationMin', label: 'Durée (min)', unit: 'min' },
  { key: 'distance', label: 'Distance', unit: '' },
  { key: 'avgHr', label: 'FC moyenne (bpm)', unit: 'bpm' },
];

export default function CardioTrend() {
  // Subscribe to workouts so the trend re-renders when a session is logged.
  const workouts = useHealthStore((s) => s.workouts);
  const getCardioSessions = useHealthStore((s) => s.getCardioSessions);
  const sessions = useMemo(() => getCardioSessions(), [workouts]); // eslint-disable-line react-hooks/exhaustive-deps

  const [metric, setMetric] = useState('durationMin');
  const [modality, setModality] = useState('all');

  // Distinct modalities present in the data
  const modalities = useMemo(() => {
    const seen = new Map();
    for (const s of sessions) if (s.modality) seen.set(s.modality, (seen.get(s.modality) || 0) + 1);
    return [...seen.entries()].map(([name, count]) => ({ name, count }));
  }, [sessions]);

  const filtered = modality === 'all' ? sessions : sessions.filter((s) => s.modality === modality);

  const chartData = useMemo(
    () =>
      filtered
        .filter((s) => s[metric] != null)
        .map((s) => ({
          date: s.date,
          dateLabel: new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          value: s[metric],
          modality: s.modality,
        })),
    [filtered, metric]
  );

  // Per-modality summary
  const summary = useMemo(() => {
    const by = {};
    for (const s of sessions) {
      const m = (by[s.modality] ||= { modality: s.modality, sessions: 0, totalMin: 0, totalDist: 0, hrSum: 0, hrN: 0 });
      m.sessions += 1;
      m.totalMin += s.durationMin || 0;
      if (s.distance != null) m.totalDist += s.distance;
      if (s.avgHr != null) { m.hrSum += s.avgHr; m.hrN += 1; }
    }
    return Object.values(by).sort((a, b) => b.sessions - a.sessions);
  }, [sessions]);

  if (!sessions.length) {
    return (
      <Card title="🫀 Tendance cardio">
        <EmptyState>
          Aucune séance cardio loggée. Loguez une séance cardio depuis la vue quotidienne du Programme
          pour suivre l'évolution (durée, distance, FC).
        </EmptyState>
      </Card>
    );
  }

  const activeMetric = METRICS.find((m) => m.key === metric);

  return (
    <Card title="🫀 Tendance cardio">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                metric === m.key ? 'bg-accent text-white' : 'bg-surface border border-line text-mute hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {modalities.length > 1 && (
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="ml-auto bg-surface border border-line rounded-md px-2 py-1 text-xs text-ink"
          >
            <option value="all">Toutes modalités</option>
            {modalities.map((m) => (
              <option key={m.name} value={m.name}>{m.name} ({m.count})</option>
            ))}
          </select>
        )}
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-line, #333)" />
            <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-mute)', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 10 }} width={45} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-line)', borderRadius: 8, fontSize: 11 }}
              formatter={(v) => [`${v} ${activeMetric?.unit || ''}`.trim(), activeMetric?.label]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={activeMetric?.label}
              stroke="var(--success)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-sm text-mute text-center py-8">
          Aucune donnée « {activeMetric?.label} » pour cette sélection. Renseignez cette métrique en loggant vos séances.
        </div>
      )}

      {/* Per-modality summary */}
      <div className="mt-4 space-y-1.5">
        <div className="text-[10px] text-mute uppercase tracking-wide font-semibold">Par modalité</div>
        {summary.map((m) => (
          <div key={m.modality} className="flex items-center gap-2 text-xs">
            <Badge color="var(--success)">{m.modality}</Badge>
            <span className="text-mute">{m.sessions} séance{m.sessions > 1 ? 's' : ''}</span>
            <span className="text-mute">· {Math.round(m.totalMin)} min</span>
            {m.totalDist > 0 && <span className="text-mute">· {m.totalDist.toFixed(1)} dist.</span>}
            {m.hrN > 0 && <span className="text-mute">· {Math.round(m.hrSum / m.hrN)} bpm moy</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
