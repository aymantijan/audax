import { useState, useMemo } from 'react';
import { baseCurrencyShort } from '../../utils/formatters';
import { ResponsiveContainer, ComposedChart, Bar, Line, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { correlationStrength } from '../../utils/health-science';
import { Card, Badge, EmptyState, Field, Select } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const CORRELATIONS = [
  { key: 'sleepVsStrength', label: 'Qualité du sommeil ↔ volume de force', desc: 'Un meilleur sommeil va-t-il de pair avec des séances plus lourdes ?' },
  { key: 'sleepVsTradingAccuracy', label: 'Qualité du sommeil ↔ taux de réussite trading', desc: 'Transversal : un meilleur sommeil va-t-il avec un meilleur taux de réussite ? (Trading)' },
  { key: 'stressVsSpending', label: 'Stress ↔ dépenses', desc: 'Transversal : le stress est-il lié aux dépenses discrétionnaires ? (Finance)' },
  { key: 'energyVsTradingAccuracy', label: 'Énergie ↔ taux de réussite trading', desc: 'Transversal : ton niveau d’énergie suit-il ton taux de réussite ? (Trading)' },
  { key: 'sleepVsTiltRisk', label: 'Qualité du sommeil ↔ jours de tilt / revenge', desc: 'Transversal : un mauvais sommeil coïncide-t-il avec les jours de tilt ou de revenge trading ? (Trading)' },
  { key: 'energyVsTiltRisk', label: 'Énergie ↔ jours de tilt / revenge', desc: 'Transversal : une énergie basse coïncide-t-elle avec les jours de tilt ou de revenge trading ? (Trading)' },
];

export default function Analytics() {
  const {
    getCorrelations, getWeightPrediction, getBadges, getHabitEnergyCorrelations, getStressSpendingSeries, getRpeRepsScatter, getAnnualReport,
    getMetricRegistry, getCustomCorrelation,
  } = useHealthStore();
  const correlations = getCorrelations();
  const prediction = getWeightPrediction();
  const badges = getBadges();
  const habitEnergy = getHabitEnergyCorrelations();
  const stressSpending = getStressSpendingSeries();
  const rpeReps = getRpeRepsScatter();
  const annual = getAnnualReport();
  const registry = getMetricRegistry();
  const [metricA, setMetricA] = useState('sleepQuality');
  const [metricB, setMetricB] = useState('energy');
  const custom = useMemo(() => getCustomCorrelation(metricA, metricB), [metricA, metricB, getCustomCorrelation]);
  const customStrength = correlationStrength(custom.r);
  const labelFor = (key) => registry.find((m) => m.value === key)?.label || key;

  return (
    <div className="space-y-6">
      <Card title="Custom Correlation">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Metric A">
            <Select value={metricA} onChange={(e) => setMetricA(e.target.value)} options={registry} />
          </Field>
          <Field label="Metric B">
            <Select value={metricB} onChange={(e) => setMetricB(e.target.value)} options={registry} />
          </Field>
        </div>
        {custom.points.length > 2 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">{labelFor(metricA)} ↔ {labelFor(metricB)}</span>
              <Badge color={customStrength.color}>{custom.r != null ? `r = ${custom.r}` : customStrength.label}</Badge>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name={labelFor(metricA)} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name={labelFor(metricB)} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={custom.points} fill="#00d9ff" />
              </ScatterChart>
            </ResponsiveContainer>
          </>
        ) : (
          <EmptyState>Pas encore assez de jours communs aux deux mesures — il en faut au moins 3.</EmptyState>
        )}
      </Card>

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

      <Card title="Stress ↔ dépenses">
        {stressSpending.some((d) => d.spend > 0 || d.stress != null) ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={stressSpending}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis yAxisId="stress" domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis yAxisId="spend" orientation="right" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="spend" dataKey="spend" name={`Spending (${baseCurrencyShort()})`} fill="#ff6b6b" radius={[3, 3, 0, 0]} />
              <Line yAxisId="stress" type="monotone" dataKey="stress" name="Stress /10" stroke="#00d9ff" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Enregistre ton stress et des entrées de journal pour voir ce tableau.</EmptyState>
        )}
      </Card>

      <Card title="Corrélations habitudes ↔ énergie">
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
          <EmptyState>Complète tes habitudes et note ton énergie pendant quelques semaines pour voir les corrélations.</EmptyState>
        )}
      </Card>

      <Card title="RPE vs reps (séries de force)">
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
          <EmptyState>Enregistre quelques séries de force avec reps + RPE pour voir ce graphique.</EmptyState>
        )}
      </Card>

      <Card title="Prévision de poids">
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
          <div><div className="text-xs text-mute mb-1">Jours renseignés</div><div className="text-lg font-semibold">{annual.daysLogged}</div></div>
          <div><div className="text-xs text-mute mb-1">Séances au total</div><div className="text-lg font-semibold">{annual.totalWorkouts}</div></div>
          <div><div className="text-xs text-mute mb-1">Cardio / Strength</div><div className="text-lg font-semibold">{annual.cardioSessions} / {annual.strengthSessions}</div></div>
          <div><div className="text-xs text-mute mb-1">Qualité de sommeil moy.</div><div className="text-lg font-semibold">{annual.avgSleepQuality ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Énergie moy.</div><div className="text-lg font-semibold">{annual.avgEnergy ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Stress moy.</div><div className="text-lg font-semibold">{annual.avgStress ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Évolution du poids</div><div className="text-lg font-semibold">{annual.weightChangeKg != null ? `${annual.weightChangeKg > 0 ? '+' : ''}${annual.weightChangeKg}kg` : '—'}</div></div>
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
          <EmptyState>Aucun badge pour l’instant — continue d’enregistrer.</EmptyState>
        )}
      </Card>
    </div>
  );
}
