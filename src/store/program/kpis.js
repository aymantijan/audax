// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';
import { useHealthStore } from '../healthStore';
import { getKpiDefinition, computeKpiValue } from '../../utils/kpi-library';
import { metricInfo } from '../../utils/metric-engine';
import { buildKpiSource, isoDay, summarize } from './helpers';

export const kpisSlice = (set, get) => ({
  // --- KPI Values ---

  loadKpiValues: async (programId, dateFrom, dateTo) => {
    try {
      const map = await api.fetchAllKpiValues(programId, dateFrom, dateTo);
      set({ kpiValuesByKpi: { ...get().kpiValuesByKpi, ...map } });
      return map;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  saveKpiValue: async (kpiId, data) => {
    try {
      const value = await api.upsertKpiValue(kpiId, data);
      const s = get();
      const existing = s.kpiValuesByKpi[kpiId] || [];
      const idx = existing.findIndex((v) => v.value_date === value.value_date);
      const updated = idx >= 0
        ? existing.map((v) => v.value_date === value.value_date ? value : v)
        : [...existing, value].sort((a, b) => a.value_date.localeCompare(b.value_date));
      set({ kpiValuesByKpi: { ...s.kpiValuesByKpi, [kpiId]: updated } });
      return value;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  getKpiValues: (kpiId) => get().kpiValuesByKpi[kpiId] || [],

  getLatestKpiValue: (kpiId) => {
    const vals = get().kpiValuesByKpi[kpiId] || [];
    return vals.length ? vals[vals.length - 1] : null;
  },

  /**
   * One time-series for ANY KPI, from the right source:
   *  - exercise-bound gym KPI (custom_source "metric::Exercise") -> logged workouts
   *  - discipline_* library KPIs -> live discipline engine
   *  - other library KPIs -> kpi-library compute() over real store data
   *  - manual/custom KPIs -> values saved by the user
   * A stored value for a date always wins (manual correction).
   */
  getKpiSeries: (kpi, days = 90) => {
    if (!kpi) return summarize([]);
    const s = get();
    const src = kpi.custom_source || '';
    const sep = src.indexOf('::');
    if (sep !== -1) return s.getExerciseKpiSeries(src.slice(0, sep), src.slice(sep + 2));

    const byDate = {};
    if (kpi.kpi_key && getKpiDefinition(kpi.kpi_key)) {
      const disc = { discipline_overall: 'overall_score', discipline_timing: 'timing_score', discipline_completion: 'completion_score' }[kpi.kpi_key];
      const source = disc ? null : buildKpiSource();
      for (let i = days - 1; i >= 0; i--) {
        const date = isoDay(i);
        let v = null;
        if (disc) v = s.getDisciplineForDate(date)?.[disc] ?? null;
        else { try { v = computeKpiValue(kpi.kpi_key, source, date); } catch { v = null; } }
        if (v != null && Number.isFinite(Number(v))) byDate[date] = Math.round(Number(v) * 100) / 100;
      }
    }
    for (const v of (s.kpiValuesByKpi[kpi.id] || [])) byDate[v.value_date] = Number(v.value);
    const series = Object.entries(byDate).map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1));
    return summarize(series);
  },

  /** Live progress of a goal from its linked KPI (baseline = first value in the series). */
  getGoalProgress: (goal) => {
    const s = get();
    const kpi = s.kpis.find((k) => k.id === goal.kpi_id);
    if (!kpi || goal.target_value == null) return { current: goal.current_value ?? null, pct: goal.progress_pct ?? 0, reached: false };
    const { series, latest } = s.getKpiSeries(kpi);
    if (!latest) return { current: null, pct: 0, reached: false };
    const target = Number(goal.target_value);
    const current = latest.value;
    const dir = goal.target_direction || kpi.target_direction || 'higher';
    const base = series[0].value;
    let pct;
    if (dir === 'lower') pct = base === target ? (current <= target ? 100 : 0) : ((base - current) / (base - target)) * 100;
    else if (dir === 'exact' || dir === 'range') pct = target ? 100 - (Math.abs(current - target) / Math.abs(target)) * 100 : 0;
    else pct = target ? (current / target) * 100 : 0;
    pct = Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
    const reached = dir === 'lower' ? current <= target : dir === 'higher' ? current >= target : pct >= 99;
    return { current, pct, reached };
  },

  /**
   * Push live goal progress to the DB and auto-achieve goals whose KPI reached
   * the target (which awards the trophy). Guarded against concurrent runs.
   */
  // Superseded by the unified goals (healthStore.getGoalsWithProgress), which
  // track progress live and fire the trophy event — kept as a no-op so an old
  // caller can't validate a program goal a second time.
  syncGoals: async () => {},

  /**
   * Copy this program's goals (Supabase program_goals) into the unified goal
   * system (healthStore). Idempotent via sourceProgramGoalId; Supabase rows
   * are left untouched. KPI links become metrics: exercise-bound gym KPIs keep
   * their exercise, library KPIs keep their key, custom KPIs carry their saved
   * values as a manual measure.
   */
  importProgramGoalsToUnified: () => {
    const s = get();
    if (!s.goals.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const list = s.goals.map((pg) => {
      const kpi = s.kpis.find((k) => k.id === pg.kpi_id);
      let metric = { key: 'manual' };
      let manualValues = [];
      if (kpi) {
        const src = kpi.custom_source || '';
        const i = src.indexOf('::');
        if (i !== -1) metric = { key: src.slice(0, i), exercise: src.slice(i + 2) };
        else if (kpi.kpi_key && metricInfo(kpi.kpi_key) && !kpi.kpi_key.startsWith('discipline_')) metric = { key: kpi.kpi_key };
        else manualValues = (s.kpiValuesByKpi[kpi.id] || []).map((v) => ({ date: v.value_date, value: Number(v.value) }));
      } else if (pg.current_value != null) {
        manualValues = [{ date: today, value: Number(pg.current_value) }];
      }
      return {
        sourceProgramGoalId: pg.id,
        title: pg.title,
        metric,
        manualValues,
        target: pg.target_value,
        direction: pg.target_direction === 'lower' || pg.target_direction === 'higher' ? pg.target_direction : null,
        priority: pg.priority || 'medium',
        programId: pg.program_id,
        phaseId: pg.phase_id || null,
        achieved: !!pg.achieved,
        achievedAt: pg.achieved_at ? Date.parse(pg.achieved_at) : null,
        createdAt: pg.created_at ? Date.parse(pg.created_at) : Date.now(),
      };
    });
    try { return useHealthStore.getState().importGoals(list); } catch { return 0; }
  },

  /** Trophy for a unified goal linked to a program (fired on 'audax:goal-achieved'). */
  awardGoalTrophy: async (goal) => {
    const s = get();
    const program = [s.activeProgram, s.draftProgram].find((p) => p && p.id === goal.programId);
    if (!program) return null;
    try {
      const trend = s.getDisciplineTrend(30);
      const avg = trend.length ? trend.reduce((a, t) => a + t.overall_score, 0) / trend.length : 50;
      const tier = avg >= 90 ? 'diamond' : avg >= 75 ? 'gold' : avg >= 60 ? 'silver' : 'bronze';
      const phase = s.phases.find((p) => p.id === goal.phaseId);
      if (goal.sourceProgramGoalId) {
        try { await api.updateGoal(goal.sourceProgramGoalId, { achieved: true, achieved_at: new Date().toISOString(), progress_pct: 100, current_value: goal.current }); } catch { /* row may be gone */ }
      }
      const trophy = await api.createTrophy({
        program_id: program.id,
        goal_id: goal.sourceProgramGoalId || null,
        title: goal.label,
        description: goal.what || null,
        trophy_type: 'goal',
        achieved_value: goal.current,
        target_value: goal.target,
        discipline_score: Math.round(avg * 100) / 100,
        phase_name: phase?.name || null,
        program_name: program.name,
        duration_days: Math.max(0, Math.round((Date.now() - (goal.createdAt || Date.now())) / 86400000)),
        tier,
      });
      set({ trophies: [trophy, ...get().trophies] });
      return trophy;
    } catch (err) {
      console.error('[programStore] awardGoalTrophy failed:', err);
      return null;
    }
  },

  /** Distinct exercises used across the program's sessions (for KPI binding). */
  getProgramExercises: () => {
    const s = get();
    const seen = new Map();
    for (const list of Object.values(s.exercisesBySession || {})) {
      for (const ex of (list || [])) {
        const name = (ex.exercise_name || '').trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.set(name.toLowerCase(), { name, key: ex.exercise_key || null });
        }
      }
    }
    return [...seen.values()];
  },

  /**
   * Live per-session series for an exercise-bound gym KPI, computed from the
   * logged workouts in healthStore (which Programme sessions mirror into). This
   * is what makes a "1RM estimé — Bench Press" KPI show a real, per-exercise
   * number and trend — the generic library KPIs aggregated every exercise
   * together, which the user (rightly) found pointless.
   * @param {string} metricKey 'estimated_1rm' | 'max_weight_lifted' | 'total_volume'
   * @param {string} exerciseName
   */
  getExerciseKpiSeries: (metricKey, exerciseName) => {
    if (!exerciseName) return { series: [], latest: null, previous: null, trend: null };
    let workouts = [];
    try { workouts = useHealthStore.getState().workouts || []; } catch { workouts = []; }
    const target = exerciseName.trim().toLowerCase();
    const byDate = {};
    for (const w of workouts) {
      if (w.type !== 'strength') continue;
      if ((w.exercise || '').trim().toLowerCase() !== target) continue;
      const sets = w.sets || [];
      for (const set of sets) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        let v = 0;
        if (metricKey === 'estimated_1rm') v = weight && reps ? weight * (1 + reps / 30) : 0;
        else if (metricKey === 'max_weight_lifted') v = weight;
        else if (metricKey === 'total_volume') v = weight * reps;
        if (metricKey === 'total_volume') byDate[w.date] = (byDate[w.date] || 0) + v;
        else byDate[w.date] = Math.max(byDate[w.date] || 0, v);
      }
    }
    const series = Object.entries(byDate)
      .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const latest = series.length ? series[series.length - 1] : null;
    const previous = series.length >= 2 ? series[series.length - 2] : null;
    const trend = latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : null;
    return { series, latest, previous, trend };
  },
});
