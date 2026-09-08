/**
 * EvolutionChart — Line chart showing KPI evolution over time.
 * Users can select which KPIs to overlay.
 */
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, Button, Badge } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import { getKpiDefinition } from '../../../../utils/kpi-library';

const COLORS = [
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fb923c',
  '#38bdf8',
];

export default function EvolutionChart() {
  const store = useProgramStore();
  const { kpis, kpiValuesByKpi } = store;
  const [selected, setSelected] = useState(() => {
    // Default: first 2 pinned or first 2
    const pinned = kpis.filter((k) => k.is_pinned);
    const defaults = pinned.length >= 2 ? pinned.slice(0, 2) : kpis.slice(0, 2);
    return defaults.map((k) => k.id);
  });

  const toggleKpi = (kpiId) => {
    setSelected((prev) =>
      prev.includes(kpiId)
        ? prev.filter((id) => id !== kpiId)
        : prev.length < 6
          ? [...prev, kpiId]
          : prev
    );
  };

  // Build merged time-series data
  const chartData = useMemo(() => {
    if (!selected.length) return [];

    // Collect all dates
    const dateSet = new Set();
    for (const kpiId of selected) {
      for (const v of (kpiValuesByKpi[kpiId] || [])) {
        dateSet.add(v.value_date);
      }
    }

    const dates = [...dateSet].sort();

    return dates.map((date) => {
      const row = { date, dateLabel: new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) };
      for (const kpiId of selected) {
        const val = (kpiValuesByKpi[kpiId] || []).find((v) => v.value_date === date);
        row[kpiId] = val?.value ?? null;
      }
      return row;
    });
  }, [selected, kpiValuesByKpi]);

  if (!kpis.length) {
    return (
      <Card>
        <div className="text-sm text-mute text-center py-6">
          Ajoutez des KPIs pour voir leur évolution dans le temps.
        </div>
      </Card>
    );
  }

  return (
    <Card title="📈 Évolution KPIs">
      {/* KPI selector chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {kpis.map((kpi, idx) => {
          const def = kpi.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
          const name = def?.name || kpi.custom_name || kpi.kpi_key;
          const isSelected = selected.includes(kpi.id);
          const colorIdx = selected.indexOf(kpi.id);
          return (
            <button
              key={kpi.id}
              onClick={() => toggleKpi(kpi.id)}
              className={`px-2 py-1 rounded-full text-[10px] cursor-pointer transition-all border ${
                isSelected
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-line text-mute hover:border-accent/30'
              }`}
            >
              {isSelected && (
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ background: COLORS[colorIdx % COLORS.length] }}
                />
              )}
              {name}
            </button>
          );
        })}
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-line, #333)" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: 'var(--text-mute)', fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fill: 'var(--text-mute)', fontSize: 10 }} width={45} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)', border: '1px solid var(--border-line)',
                borderRadius: 8, fontSize: 11,
              }}
            />
            {selected.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {selected.map((kpiId, idx) => {
              const kpi = kpis.find((k) => k.id === kpiId);
              const def = kpi?.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
              const name = def?.name || kpi?.custom_name || kpi?.kpi_key || kpiId;
              return (
                <Line
                  key={kpiId}
                  type="monotone"
                  dataKey={kpiId}
                  name={name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-sm text-mute text-center py-8">
          Sélectionnez des KPIs avec des données pour afficher le graphique.
        </div>
      )}
    </Card>
  );
}
