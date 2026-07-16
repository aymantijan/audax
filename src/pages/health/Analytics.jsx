import { ResponsiveContainer, ComposedChart, Bar, Line, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { correlationStrength } from '../../utils/health-science';
import { Card, Badge, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const CORRELATIONS = [
  { key: 'sleepVsStrength', label: 'Sleep Quality ↔ Strength Volume', desc: 'Does better sleep track with heavier training sessions?' },
  { key: 'sleepVsTradingAccuracy', label: 'Sleep Quality ↔ Trading Win Rate', desc: 'Cross-domain: does better sleep track with a higher win rate? (Trading)' },
  { key: 'stressVsSpending', label: 'Stress ↔ Spending', desc: 'Cross-domain: does stress correlate with discretionary spending? (Finance)' },
  { key: 'energyVsTradingAccuracy', label: 'Energy ↔ Trading Win Rate', desc: 'Cross-domain: does energy level track with trading win rate? (Trading)' },
];

export default function Analytics() {
  const { getCorrelations, getWeightPrediction, getBadges, getHabitEnergyCorrelations, getStressSpendingSeries, getRpeRepsScatter, getAnnualReport } = useHealthStore();
  const correlations = getCorrelations();
  const prediction = getWeightPrediction();
  const badges = getBadges();
  const habitEnergy = getHabitEnergyCorrelations();
  const stressSpending = getStressSpendingSeries();
  const rpeReps = getRpeRepsScatter();
  const annual = getAnnualReport();

  return (
    <div className="space-y-6">
      <Card title="Cross-Domain Correlations">
        <div className="space-y-3">
          {CORRELATIONS.map((c) => {
            const r = correlations[c.key];
            const strength = correlationStrength(r);
            return (
              <div key={c.key} className="bg-surface border border-line rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.label}</span>
                  <Badge color={strength.color}>{r != null ? `r = ${r}` : strength.label}</Badge>
                </div>
                <div className="text-[11px] text-mute mt-1">{c.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Stress ↔ Spending Dashboard">
        {stressSpending.some((d) => d.spend > 0 || d.stress != null) ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={stressSpending}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis yAxisId="stress" domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis yAxisId="spend" orientation="right" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="spend" dataKey="spend" name="Spending (DH)" fill="#ff6b6b" radius={[3, 3, 0, 0]} />
              <Line yAxisId="stress" type="monotone" dataKey="stress" name="Stress /10" stroke="#00d9ff" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log stress check-ins and journal entries to see this dashboard.</EmptyState>
        )}
      </Card>

      <Card title="Habit ↔ Energy Correlations">
        {habitEnergy.length ? (
          <ul className="space-y-1.5">
            {habitEnergy.map((h) => (
              <li key={h.habitId} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>{h.habitName}</span>
                <span className={h.delta > 0 ? 'text-good' : h.delta < 0 ? 'text-bad' : 'text-mute'}>
                  {h.avgEnergyOnDays} vs {h.avgEnergyOffDays} energy ({h.delta > 0 ? '+' : ''}{h.delta})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Complete habits and log energy check-ins for a few weeks to see correlations.</EmptyState>
        )}
      </Card>

      <Card title="RPE vs. Reps (Strength Sets)">
        {rpeReps.length > 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="reps" name="Reps" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis type="number" dataKey="rpe" name="RPE" domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={rpeReps} fill="#7c5cff" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log a few strength sets with reps + RPE to see this.</EmptyState>
        )}
      </Card>

      <Card title="Weight Prediction Summary">
        <div className="grid grid-cols-3 gap-3 text-center">
          {['conservative', 'realistic', 'optimistic'].map((k) => (
            <div key={k} className="bg-surface border border-line rounded-lg p-3">
              <div className="text-xs text-mute capitalize mb-1">{k}</div>
              <div className="text-sm font-semibold">{prediction.projectedChangeKg[k]['12w']} kg / 12wk</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-mute mt-2">Confidence: {prediction.confidence}%</div>
      </Card>

      <Card title="Annual Health Report" action={<Badge>Auto-generated</Badge>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div><div className="text-xs text-mute mb-1">Days logged</div><div className="text-lg font-semibold">{annual.daysLogged}</div></div>
          <div><div className="text-xs text-mute mb-1">Total workouts</div><div className="text-lg font-semibold">{annual.totalWorkouts}</div></div>
          <div><div className="text-xs text-mute mb-1">Cardio / Strength</div><div className="text-lg font-semibold">{annual.cardioSessions} / {annual.strengthSessions}</div></div>
          <div><div className="text-xs text-mute mb-1">Avg sleep quality</div><div className="text-lg font-semibold">{annual.avgSleepQuality ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Avg energy</div><div className="text-lg font-semibold">{annual.avgEnergy ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Avg stress</div><div className="text-lg font-semibold">{annual.avgStress ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Weight change</div><div className="text-lg font-semibold">{annual.weightChangeKg != null ? `${annual.weightChangeKg > 0 ? '+' : ''}${annual.weightChangeKg}kg` : '—'}</div></div>
          <div><div className="text-xs text-mute mb-1">Badges earned</div><div className="text-lg font-semibold">{annual.badgesEarned}</div></div>
        </div>
      </Card>

      <Card title="Badges Earned">
        {badges.some((b) => b.earned) ? (
          <div className="flex flex-wrap gap-2">
            {badges.filter((b) => b.earned).map((b) => (
              <Badge key={b.id}>{b.name}</Badge>
            ))}
          </div>
        ) : (
          <EmptyState>No badges earned yet — keep logging.</EmptyState>
        )}
      </Card>
    </div>
  );
}
