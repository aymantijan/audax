/**
 * metric-engine.js — one place that turns raw tracked data (healthStore +
 * habitStore state) into measurable metrics: current value + daily series.
 *
 * Used by BOTH the unified goals (healthStore) and the Programme KPIs, so a
 * "body weight" or "1RM Bench Press" means exactly the same number everywhere.
 * Pure functions — callers pass the store states in.
 */
import { computeKpiValue, getKpiDefinition } from './kpi-library';

const DAY = 86400000;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayOffset = (n) => iso(new Date(Date.now() - n * DAY));
const r2 = (v) => Math.round(v * 100) / 100;
const numOrNull = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

// ─── Source adapter ────────────────────────────────────────────────
// kpi-library's compute() functions expect this shape (gymSessions,
// cardioSessions, sleepLogs, bodyCompositionLogs, habitCompletions…).
export function buildMetricSource(h = {}, hb = {}) {
  const workouts = h.workouts || [];

  const gymMap = {};
  for (const w of workouts) {
    if (w.type !== 'strength') continue;
    const k = w.sessionId || w.id;
    const g = (gymMap[k] ||= { date: w.date, sets: [], duration_min: 0 });
    for (const st of (w.sets || [])) g.sets.push({ reps: Number(st.reps) || 0, weight: Number(st.weight) || 0, rpe: Number(st.rpe) || null });
    g.duration_min += Number(w.durationMin) || 0;
  }
  const cardioSessions = workouts.filter((w) => w.type === 'cardio').map((w) => ({
    date: w.date,
    duration_min: Number(w.durationMin) || 0,
    distance_km: numOrNull(w.cardio?.distance) || 0,
    calories: numOrNull(w.cardio?.calories) || 0,
    avg_heart_rate: numOrNull(w.cardio?.avgHr),
  }));

  const waterByDate = {};
  for (const wl of (h.waterLogs || [])) waterByDate[wl.date] = (waterByDate[wl.date] || 0) + (Number(wl.amountMl) || 0);

  const heightFallback = Number(h.healthProfile?.heightCm) || null;
  const bodyCompositionLogs = (h.bodyComp || []).map((b) => ({
    date: b.date,
    weight: Number(b.weightKg) || null,
    bodyFatPct: numOrNull(b.bodyFatPct),
    waistCm: numOrNull(b.waistCm),
    heightCm: Number(b.heightCm) || heightFallback,
  }));

  const energyLogs = hb.energyLogs || [];
  const sleepLogs = energyLogs.filter((l) => l.sleepData).map((l) => ({
    date: l.date,
    hoursSlept: l.sleepData.sleepHours ?? l.sleepData.hoursSlept ?? null,
    sleepQualityScore: l.sleepData.sleepQualityScore ?? null,
    latencyMin: l.sleepData.latencyMin ?? null,
  }));

  const recMap = {};
  for (const r of (h.recoveryLogs || [])) {
    recMap[r.date] = { ...(recMap[r.date] || {}), date: r.date, score: Math.min(100, Math.round(((r.activities?.length || 0) / 5) * 100)) };
  }
  for (const l of energyLogs) {
    recMap[l.date] = { ...(recMap[l.date] || { date: l.date }), energyLevel: l.energyStartLevel ?? null, stressLevel: l.stressLevel ?? null };
  }

  const activeHabitIds = (hb.habits || []).filter((x) => !x.archived).map((x) => x.id);
  const habitCompletions = {};
  for (const lg of (hb.logs || [])) {
    if (!activeHabitIds.includes(lg.habitId)) continue;
    const day = (habitCompletions[lg.date] ||= Object.fromEntries(activeHabitIds.map((id) => [id, false])));
    if (lg.completed) day[lg.habitId] = true;
  }

  return {
    workouts,
    gymSessions: Object.values(gymMap),
    cardioSessions,
    nutritionLogs: h.nutritionLogs || [],
    waterByDate,
    bodyCompositionLogs,
    sleepLogs,
    recoveryLogs: Object.values(recMap),
    habitCompletions,
  };
}

// ─── Goal-able metrics ─────────────────────────────────────────────
// agg: how the "current" value is derived from the daily series
//   latest  → last measured value           (weight, body fat)
//   best    → all-time best                  (1RM, max load)
//   avg7/avg30 → rolling average             (sleep quality, protein)
//   week    → sum over the last 7 days       (cardio minutes, sessions)
export const METRIC_CATEGORIES = [
  { key: 'body', label: 'Corps' },
  { key: 'strength', label: 'Force' },
  { key: 'training', label: 'Entraînement' },
  { key: 'sleep', label: 'Sommeil' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'wellbeing', label: 'Bien-être' },
  { key: 'custom', label: 'Personnalisé' },
];

export const GOAL_METRICS = [
  { key: 'body_weight', label: 'Poids corporel', unit: 'kg', category: 'body', agg: 'latest' },
  { key: 'body_fat_pct', label: 'Masse grasse', unit: '%', category: 'body', agg: 'latest', dir: 'lower' },
  { key: 'lean_mass', label: 'Masse maigre', unit: 'kg', category: 'body', agg: 'latest', dir: 'higher' },
  { key: 'waist_circumference', label: 'Tour de taille', unit: 'cm', category: 'body', agg: 'latest', dir: 'lower' },
  { key: 'estimated_1rm', label: '1RM estimé', unit: 'kg', category: 'strength', agg: 'best', exercise: true, dir: 'higher' },
  { key: 'max_weight_lifted', label: 'Charge max', unit: 'kg', category: 'strength', agg: 'best', exercise: true, dir: 'higher' },
  { key: 'total_volume', label: 'Volume par séance', unit: 'kg', category: 'strength', agg: 'latest', exercise: true, dir: 'higher' },
  { key: 'workout_frequency', label: 'Séances par semaine', unit: 'séance(s)', category: 'training', agg: 'week', dir: 'higher' },
  { key: 'cardio_duration', label: 'Minutes de cardio par semaine', unit: 'min', category: 'training', agg: 'week', dir: 'higher' },
  { key: 'sleep_quality', label: 'Qualité du sommeil (moy. 30 j)', unit: '/10', category: 'sleep', agg: 'avg30', dir: 'higher' },
  { key: 'sleep_hours', label: 'Heures de sommeil (moy. 7 j)', unit: 'h', category: 'sleep', agg: 'avg7', dir: 'higher' },
  { key: 'daily_protein', label: 'Protéines par jour (moy. 7 j)', unit: 'g', category: 'nutrition', agg: 'avg7', dir: 'higher' },
  { key: 'daily_kcal', label: 'Calories par jour (moy. 7 j)', unit: 'kcal', category: 'nutrition', agg: 'avg7' },
  { key: 'water_intake', label: 'Eau par jour (moy. 7 j)', unit: 'L', category: 'nutrition', agg: 'avg7', dir: 'higher' },
  { key: 'energy_level', label: 'Énergie (moy. 7 j)', unit: '/10', category: 'wellbeing', agg: 'avg7', dir: 'higher' },
  { key: 'stress_level', label: 'Stress (moy. 7 j)', unit: '/10', category: 'wellbeing', agg: 'avg7', dir: 'lower' },
  { key: 'habits_completion_rate', label: 'Taux d’habitudes (moy. 7 j)', unit: '%', category: 'wellbeing', agg: 'avg7', dir: 'higher' },
  { key: 'manual', label: 'Mesure personnalisée (saisie manuelle)', unit: '', category: 'custom', agg: 'latest' },
];
export const metricDef = (key) => GOAL_METRICS.find((m) => m.key === key) || null;

// Catalogue entry, or a fallback built from the KPI library for any other KPI
// key (e.g. goals imported from Programme KPIs like avg_rpe).
export function metricInfo(key) {
  const m = metricDef(key);
  if (m) return m;
  const k = getKpiDefinition(key);
  return k ? { key, label: k.name, unit: k.unit, category: k.category, agg: 'latest', dir: k.direction === 'lower' ? 'lower' : k.direction === 'higher' ? 'higher' : undefined } : null;
}

// ─── Daily raw values ──────────────────────────────────────────────
function exerciseDaily(metric, source) {
  const target = (metric.exercise || '').trim().toLowerCase();
  const byDate = {};
  for (const w of source.workouts || []) {
    if (w.type !== 'strength' || (w.exercise || '').trim().toLowerCase() !== target) continue;
    for (const st of (w.sets || [])) {
      const weight = Number(st.weight) || 0;
      const reps = Number(st.reps) || 0;
      let v = 0;
      if (metric.key === 'estimated_1rm') v = weight && reps ? weight * (1 + reps / 30) : 0;
      else if (metric.key === 'max_weight_lifted') v = weight;
      else v = weight * reps; // total_volume
      byDate[w.date] = metric.key === 'total_volume' ? (byDate[w.date] || 0) + v : Math.max(byDate[w.date] || 0, v);
    }
  }
  return Object.entries(byDate).filter(([, v]) => v > 0).map(([date, v]) => ({ date, value: r2(v) }));
}

function rawDaily(metric, source, days, manualValues) {
  if (metric.key === 'manual') return (manualValues || []).map((v) => ({ date: v.date, value: Number(v.value) }));
  if (metric.exercise || ['estimated_1rm', 'max_weight_lifted', 'total_volume'].includes(metric.key)) return exerciseDaily(metric, source);
  if (metric.key === 'workout_frequency') {
    const byDate = {};
    for (const w of source.workouts || []) {
      if (!['strength', 'cardio', 'sport'].includes(w.type)) continue;
      (byDate[w.date] ||= new Set()).add(w.sessionId || w.id);
    }
    return Object.entries(byDate).map(([date, set]) => ({ date, value: set.size }));
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayOffset(i);
    let v = null;
    try { v = computeKpiValue(metric.key, source, date); } catch { v = null; }
    if (v != null && Number.isFinite(Number(v))) out.push({ date, value: r2(Number(v)) });
  }
  return out;
}

/**
 * Series + current value of a metric.
 * @param {{key:string, exercise?:string}} metric
 * @returns {{ series: {date,value}[], current: number|null, unit: string }}
 */
export function evaluateMetric(metric, source, { days = 180, manualValues } = {}) {
  const def = metricInfo(metric?.key) || { agg: 'latest', unit: '' };
  const raw = rawDaily(metric || {}, source, days, manualValues).sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = Object.fromEntries(raw.map((p) => [p.date, p.value]));

  let series = raw;
  if (def.agg === 'best') {
    let best = -Infinity;
    series = raw.map((p) => { best = Math.max(best, p.value); return { date: p.date, value: best }; });
  } else if (def.agg === 'avg7' || def.agg === 'avg30' || def.agg === 'week') {
    const win = def.agg === 'avg30' ? 30 : 7;
    series = [];
    for (let i = Math.min(days, 180) - 1; i >= 0; i--) {
      const date = dayOffset(i);
      const vals = [];
      for (let j = 0; j < win; j++) { const v = byDate[dayOffset(i + j)]; if (v != null) vals.push(v); }
      if (!vals.length) continue;
      const v = def.agg === 'week' ? vals.reduce((a, b) => a + b, 0) : vals.reduce((a, b) => a + b, 0) / vals.length;
      series.push({ date, value: r2(v) });
    }
  }
  let current = series.length ? series[series.length - 1].value : null;
  // A rolling window that has emptied out means "0 this week", not "no data".
  if (def.agg === 'week' && series.length && series[series.length - 1].date !== dayOffset(0)) current = 0;
  return { series, current, unit: def.unit };
}

/** Least-squares slope of the last `days` of a series, in units per week. */
export function weeklySlope(series, days = 28) {
  const cutoff = dayOffset(days);
  const pts = series.filter((p) => p.date >= cutoff).map((p) => ({ x: new Date(p.date + 'T12:00:00').getTime() / (7 * DAY), y: p.value }));
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den ? pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den : null;
}
