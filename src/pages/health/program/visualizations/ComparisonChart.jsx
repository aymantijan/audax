/**
 * ComparisonChart — Phase-over-phase or period comparison.
 * Shows side-by-side bars for key metrics across two time windows.
 */
import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';
import { Card, Select, Field } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import { getKpiDefinition } from '../../../../utils/kpi-library';

export default function ComparisonChart() {
  const store = useProgramStore();
  const { kpis, kpiValuesByKpi, phases } = store;
  const [periodA, setPeriodA] = useState('last7');
  const [periodB, setPeriodB] = useState('prev7');

  const PERIODS = {
    last7: { label: '7 derniers jours', days: 7, offset: 0 },
    prev7: { label: '7 jours précédents', days: 7, offset: 7 },
    last14: { label: '14 derniers jours', days: 14, offset: 0 },
    last30: { label: '30 derniers jours', days: 30, offset: 0 },
    prev30: { label: '30 jours précédents', days: 30, offset: 30 },
  };

  // Add phase-based periods
  for (const phase of phases) {
    if (phase.start_date && phase.end_date) {
      PERIODS[`phase_${phase.id}`] = {
        label: `Phase: ${phase.name}`,
        start: phase.start_date,
        end: phase.end_date,
      };
    }
  }

  const chartData = useMemo(() => {
    if (!kpis.length) return [];

    const getDateRange = (period) => {
      const p = PERIODS[period];
      if (!p) return { start: '', end: '' };
      if (p.start) return { start: p.start, end: p.end };
      const now = Date.now();
      const end = new Date(now - p.offset * 86400000).toISOString().slice(0, 10);
      const start = new Date(now - (p.offset + p.days) * 86400000).toISOString().slice(0, 10);
      return { start, end };
    };

    const rangeA = getDateRange(periodA);
    const rangeB = getDateRange(periodB);

    // Average each KPI over each period
    return kpis.slice(0, 8).map((kpi) => {
      const def = kpi.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
      const name = def?.name || kpi.custom_name || kpi.kpi_key;
      const values = kpiValuesByKpi[kpi.id] || [];

      const avgA = computeAvg(values, rangeA.start, rangeA.end);
      const avgB = computeAvg(values, rangeB.start, rangeB.end);

      return {
        name: name.length > 18 ? name.slice(0, 16) + '…' : name,
        fullName: name,
        periodA: avgA,
        periodB: avgB,
        change: avgA != null && avgB != null ? avgA - avgB : null,
      };
    }).filter((d) => d.periodA != null || d.periodB != null);
  }, [kpis, kpiValuesByKpi, periodA, periodB, phases]);

  if (!kpis.length) {
    return (
      <Card>
        <div className="text-sm text-mute text-center py-6">
          Ajoutez des KPIs pour comparer des périodes.
        </div>
      </Card>
    );
  }

  return (
    <Card title="⚖️ Comparaison">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Période A">
          <Select value={periodA} onChange={(e) => setPeriodA(e.target.value)}>
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Période B">
          <Select value={periodB} onChange={(e) => setPeriodB(e.target.value)}>
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-line, #333)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-mute)', fontSize: 10 }} />
            <YAxis
              type="category" dataKey="name" width={100}
              tick={{ fill: 'var(--text-mute)', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)', border: '1px solid var(--border-line)',
                borderRadius: 8, fontSize: 11,
              }}
              formatter={(value) => value != null ? value.toFixed(1) : '—'}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="periodA" name={PERIODS[periodA]?.label || 'A'} fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={12} />
            <Bar dataKey="periodB" name={PERIODS[periodB]?.label || 'B'} fill="var(--text-mute)" radius={[0, 4, 4, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-sm text-mute text-center py-6">
          Pas assez de données pour comparer.
        </div>
      )}

      {/* Delta summary */}
      {chartData.some((d) => d.change != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-line">
          {chartData.filter((d) => d.change != null).map((d) => (
            <div key={d.fullName} className="text-center">
              <div className="text-[10px] text-mute truncate">{d.fullName}</div>
              <div className={`text-sm font-bold ${d.change >= 0 ? 'text-good' : 'text-bad'}`}>
                {d.change >= 0 ? '+' : ''}{d.change.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function computeAvg(values, start, end) {
  const inRange = values.filter((v) => v.value_date >= start && v.value_date <= end);
  if (!inRange.length) return null;
  return Math.round((inRange.reduce((sum, v) => sum + v.value, 0) / inRange.length) * 100) / 100;
}
