/**
 * DistributionChart — Histogram + box plot for a selected metric.
 * Shows the distribution of daily values over the last 30 days.
 */
import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Card, Select, Field } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import { getKpiDefinition } from '../../../../utils/kpi-library';

export default function DistributionChart() {
  const store = useProgramStore();
  const { kpis, kpiValuesByKpi } = store;
  const [selectedKpi, setSelectedKpi] = useState(() => kpis[0]?.id || '');

  const stats = useMemo(() => {
    if (!selectedKpi) return null;
    const values = (kpiValuesByKpi[selectedKpi] || []).map((v) => v.value).filter((v) => v != null);
    if (values.length < 3) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const stddev = Math.sqrt(sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n);

    // Build histogram bins
    const binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(n))));
    const range = max - min || 1;
    const binWidth = range / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      label: `${(min + i * binWidth).toFixed(1)}`,
      rangeStart: min + i * binWidth,
      rangeEnd: min + (i + 1) * binWidth,
      count: 0,
    }));

    for (const v of sorted) {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      bins[idx].count++;
    }

    return { sorted, n, min, max, mean, median, q1, q3, stddev, bins };
  }, [selectedKpi, kpiValuesByKpi]);

  const kpi = kpis.find((k) => k.id === selectedKpi);
  const def = kpi?.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
  const name = def?.name || kpi?.custom_name || 'Métrique';
  const unit = def?.unit || kpi?.custom_unit || '';

  return (
    <Card title="📊 Distribution">
      <Field label="Métrique">
        <Select value={selectedKpi} onChange={(e) => setSelectedKpi(e.target.value)}>
          <option value="">— Choisir —</option>
          {kpis.map((k) => {
            const d = k.kpi_key ? getKpiDefinition(k.kpi_key) : null;
            return <option key={k.id} value={k.id}>{d?.name || k.custom_name || k.kpi_key}</option>;
          })}
        </Select>
      </Field>

      {stats ? (
        <>
          {/* Box plot summary */}
          <div className="my-3">
            <div className="relative h-8 bg-surface rounded-lg overflow-hidden">
              {/* IQR box */}
              <div
                className="absolute h-full bg-accent/20 border-x-2 border-accent"
                style={{
                  left: `${((stats.q1 - stats.min) / (stats.max - stats.min)) * 100}%`,
                  width: `${((stats.q3 - stats.q1) / (stats.max - stats.min)) * 100}%`,
                }}
              />
              {/* Median line */}
              <div
                className="absolute h-full w-0.5 bg-accent z-10"
                style={{ left: `${((stats.median - stats.min) / (stats.max - stats.min)) * 100}%` }}
              />
              {/* Whiskers */}
              <div className="absolute top-1/2 h-px bg-mute w-full" />
            </div>
            <div className="flex justify-between text-[9px] text-mute mt-1">
              <span>{stats.min.toFixed(1)}</span>
              <span>Q1: {stats.q1.toFixed(1)}</span>
              <span>Méd: {stats.median.toFixed(1)}</span>
              <span>Q3: {stats.q3.toFixed(1)}</span>
              <span>{stats.max.toFixed(1)}</span>
            </div>
          </div>

          {/* Histogram */}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.bins}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-line, #333)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-mute)', fontSize: 9 }}
                interval={0}
              />
              <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 9 }} width={30} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-line)',
                  borderRadius: 8, fontSize: 11,
                }}
                formatter={(value) => [`${value} jour(s)`, 'Fréquence']}
                labelFormatter={(label) => `${name}: ${label} ${unit}`}
              />
              <ReferenceLine x={stats.bins.findIndex((b) => b.rangeStart <= stats.mean && b.rangeEnd > stats.mean)} stroke="var(--accent)" strokeDasharray="3 3" />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                {stats.bins.map((_, i) => (
                  <rect key={i} fill="var(--accent)" fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-line">
            {[
              { label: 'Moyenne', value: stats.mean.toFixed(1) },
              { label: 'Médiane', value: stats.median.toFixed(1) },
              { label: 'Écart-type', value: stats.stddev.toFixed(1) },
              { label: 'N jours', value: stats.n },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xs font-bold text-ink">{s.value}</div>
                <div className="text-[9px] text-mute">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-sm text-mute text-center py-6 mt-3">
          {selectedKpi ? 'Pas assez de données (min. 3 points).' : 'Sélectionnez une métrique.'}
        </div>
      )}
    </Card>
  );
}
