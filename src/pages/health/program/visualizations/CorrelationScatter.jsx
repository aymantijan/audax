/**
 * CorrelationScatter — Scatter plot for a selected correlation pair.
 * Shows the data points + regression line + r value.
 */
import { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Card, Select, Field, Badge } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import {
  CORRELATION_PAIRS,
  CORRELATION_CATEGORIES,
  extractPairData,
  pearson,
  correlationStrength,
  correlationDirection,
} from '../../../../utils/correlation-engine';

export default function CorrelationScatter() {
  const store = useProgramStore();
  const { kpis, kpiValuesByKpi } = store;
  const [selectedPairId, setSelectedPairId] = useState(CORRELATION_PAIRS[0]?.id || '');

  const pair = CORRELATION_PAIRS.find((p) => p.id === selectedPairId);

  const { data, stats, regression } = useMemo(() => {
    if (!pair) return { data: [], stats: null, regression: null };

    const { dates, valuesA, valuesB } = extractPairData(kpiValuesByKpi, kpis, pair, 60);
    if (valuesA.length < 3) return { data: [], stats: null, regression: null };

    const scatterData = dates.map((d, i) => ({
      x: valuesA[i],
      y: valuesB[i],
      date: d,
    }));

    const { r, n, significant } = pearson(valuesA, valuesB);

    // Simple linear regression for trend line
    const meanX = valuesA.reduce((a, b) => a + b, 0) / n;
    const meanY = valuesB.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (valuesA[i] - meanX) * (valuesB[i] - meanY);
      den += (valuesA[i] - meanX) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    const minX = Math.min(...valuesA);
    const maxX = Math.max(...valuesA);

    return {
      data: scatterData,
      stats: { r, n, significant, strength: correlationStrength(r), direction: correlationDirection(r) },
      regression: { slope, intercept, minX, maxX, y1: slope * minX + intercept, y2: slope * maxX + intercept },
    };
  }, [pair, kpiValuesByKpi, kpis]);

  // Group pairs by category for the selector
  const groupedPairs = {};
  for (const p of CORRELATION_PAIRS) {
    (groupedPairs[p.category] ||= []).push(p);
  }

  return (
    <Card title="📍 Scatter Corrélation">
      <Field label="Paire de métriques">
        <Select value={selectedPairId} onChange={(e) => setSelectedPairId(e.target.value)}>
          {CORRELATION_CATEGORIES.map((cat) => {
            const pairs = groupedPairs[cat.key];
            if (!pairs) return null;
            return (
              <optgroup key={cat.key} label={`${cat.icon} ${cat.label}`}>
                {pairs.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            );
          })}
        </Select>
      </Field>

      {pair && stats ? (
        <>
          {/* Stats badges */}
          <div className="flex items-center gap-2 mt-3 mb-2 flex-wrap">
            <Badge color={stats.r > 0 ? 'var(--success)' : 'var(--danger, #ef4444)'}>
              r = {stats.r.toFixed(3)}
            </Badge>
            <Badge>{stats.strength}</Badge>
            <Badge>{stats.direction}</Badge>
            <span className="text-[10px] text-mute">n = {stats.n} points</span>
            {stats.significant && <Badge color="var(--accent)">p &lt; 0.05</Badge>}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-line, #333)" />
              <XAxis
                type="number" dataKey="x" name={pair.metricA.label}
                tick={{ fill: 'var(--text-mute)', fontSize: 10 }}
                label={{ value: pair.metricA.label, position: 'bottom', style: { fill: 'var(--text-mute)', fontSize: 10 } }}
              />
              <YAxis
                type="number" dataKey="y" name={pair.metricB.label}
                tick={{ fill: 'var(--text-mute)', fontSize: 10 }}
                label={{ value: pair.metricB.label, angle: -90, position: 'insideLeft', style: { fill: 'var(--text-mute)', fontSize: 10 } }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-line)',
                  borderRadius: 8, fontSize: 11,
                }}
                formatter={(value, name) => [typeof value === 'number' ? value.toFixed(1) : value, name]}
              />
              <Scatter data={data} fill="var(--accent)" fillOpacity={0.7} r={4} />
              {/* Regression line overlay using reference lines */}
              {regression && (
                <ReferenceLine
                  segment={[
                    { x: regression.minX, y: regression.y1 },
                    { x: regression.maxX, y: regression.y2 },
                  ]}
                  stroke="var(--accent)"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>

          {/* Insight */}
          <div className="mt-2 p-2 bg-surface rounded-lg border border-line">
            <p className="text-xs text-mute italic">{pair.insight}</p>
          </div>
        </>
      ) : (
        <div className="text-sm text-mute text-center py-6 mt-3">
          {pair ? 'Pas assez de données (min. 3 points avec les 2 KPIs suivis).' : 'Sélectionnez une paire.'}
        </div>
      )}
    </Card>
  );
}
