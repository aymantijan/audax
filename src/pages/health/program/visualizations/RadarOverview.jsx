/**
 * RadarOverview — Multi-axis radar chart for discipline components,
 * KPI categories, or phase comparison.
 */
import { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import { WEIGHTS } from '../../../../utils/discipline-engine';

const COMPONENT_LABELS = {
  timing_score: 'Ponctualité',
  completion_score: 'Complétion',
  nutrition_score: 'Nutrition',
  sleep_score: 'Sommeil',
  recovery_score: 'Récupération',
  habits_score: 'Habitudes',
};

export default function RadarOverview() {
  const store = useProgramStore();
  const trend = store.getDisciplineTrend(7);

  const data = useMemo(() => {
    if (!trend.length) return [];

    // Average each component over the last 7 days
    const sums = {};
    const keys = Object.keys(COMPONENT_LABELS);
    for (const k of keys) sums[k] = 0;

    for (const day of trend) {
      for (const k of keys) sums[k] += day[k] ?? 0;
    }

    return keys.map((k) => ({
      component: COMPONENT_LABELS[k],
      score: Math.round((sums[k] / trend.length) * 10) / 10,
      weight: WEIGHTS[k.replace('_score', '')] * 100,
      fullMark: 100,
    }));
  }, [trend]);

  // Also compute "this week vs last week" if enough data
  const trend14 = store.getDisciplineTrend(14);
  const lastWeekData = useMemo(() => {
    const lastWeek = trend14.slice(0, Math.max(0, trend14.length - 7));
    if (lastWeek.length < 3) return null;

    const sums = {};
    const keys = Object.keys(COMPONENT_LABELS);
    for (const k of keys) sums[k] = 0;
    for (const day of lastWeek) {
      for (const k of keys) sums[k] += day[k] ?? 0;
    }
    return keys.map((k) => ({
      component: COMPONENT_LABELS[k],
      lastWeek: Math.round((sums[k] / lastWeek.length) * 10) / 10,
    }));
  }, [trend14]);

  // Merge
  const mergedData = useMemo(() => {
    if (!lastWeekData) return data;
    return data.map((d, i) => ({ ...d, ...lastWeekData[i] }));
  }, [data, lastWeekData]);

  if (!data.length) {
    return (
      <Card>
        <div className="text-sm text-mute text-center py-6">
          Pas assez de données discipline pour le radar.
        </div>
      </Card>
    );
  }

  return (
    <Card title="🎯 Radar Discipline">
      <div className="text-xs text-mute mb-2">Moyenne 7 jours par composante</div>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={mergedData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="var(--border-line, #333)" />
          <PolarAngleAxis
            dataKey="component"
            tick={{ fill: 'var(--text-mute)', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'var(--text-mute)', fontSize: 9 }}
          />
          <Radar
            name="Cette semaine"
            dataKey="score"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          {lastWeekData && (
            <Radar
              name="Semaine précédente"
              dataKey="lastWeek"
              stroke="var(--text-mute)"
              fill="var(--text-mute)"
              fillOpacity={0.1}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)', border: '1px solid var(--border-line)',
              borderRadius: 8, fontSize: 12,
            }}
          />
          {lastWeekData && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
