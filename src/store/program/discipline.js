// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';
import { useHealthStore } from '../healthStore';
import { useHabitStore } from '../habitStore';
import { computeTimingScore, computeCompletionScore, computeNutritionScore, computeSleepScore, computeRecoveryScore, computeHabitsScore, computeDailyDiscipline } from '../../utils/discipline-engine';

export const disciplineSlice = (set, get) => ({
  // Wave 3 — Discipline, KPIs, Goals, Trophies, Alerts
  // =====================================================================

  // Discipline scores keyed by 'YYYY-MM-DD'
  disciplineByDate: {},

  // KPIs for current program
  kpis: [],

  // KPI values keyed by kpiId → value[]
  kpiValuesByKpi: {},

  // Goals for current program
  goals: [],

  // Trophies
  trophies: [],

  // Alerts (unacknowledged)
  alerts: [],

  // --- Discipline ---

  loadDisciplineScores: async (programId, dateFrom, dateTo) => {
    try {
      const scores = await api.fetchDisciplineScores(programId, dateFrom, dateTo);
      const map = {};
      for (const s of scores) map[s.score_date] = s;
      set({ disciplineByDate: { ...get().disciplineByDate, ...map } });
      return scores;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  saveDisciplineScore: async (programId, data) => {
    try {
      const score = await api.upsertDisciplineScore(programId, data);
      const s = get();
      set({ disciplineByDate: { ...s.disciplineByDate, [score.score_date]: score } });
      return score;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  /**
   * Compute the discipline score for a date LIVE from real data across stores
   * (schedule + logs, nutrition, sleep, recovery, linked habits). This is what
   * makes the DisciplineCard show real numbers — the DB row (if any) is just a
   * persisted snapshot; when absent we compute on the fly.
   * Returns null on non-program days (no scheduled sessions) so the trend only
   * plots meaningful days.
   */
  computeDisciplineForDate: (dateStr) => {
    const s = get();
    if (!s.activeProgram) return null;
    const schedule = s.getScheduleForDate(dateStr);
    if (!schedule.length) return null; // rest day / outside program

    // Timing — average over sessions that were actually started
    const timingScores = [];
    for (const evt of schedule) {
      if (evt.logged?.actual_start) {
        timingScores.push(computeTimingScore(evt.planned_time, evt.logged.actual_start, evt.override?.reason_code));
      }
    }
    const timing = timingScores.length
      ? Math.round((timingScores.reduce((a, b) => a + b, 0) / timingScores.length) * 100) / 100
      : null;

    // Completion
    const completion = computeCompletionScore(schedule).score;
    const isTrainingDay = schedule.some((e) => !e.cancelled && !e.moved);

    // Nutrition — active phase default template vs the day's meals
    let nutrition = null;
    try {
      const health = useHealthStore.getState();
      const dayMeals = (health.nutritionLogs || []).filter((n) => n.date === dateStr);
      const phase = s.getActivePhase();
      const templates = phase ? (s.nutritionByPhase[phase.id] || []) : [];
      const template = templates.find((t) => t.is_default) || templates[0] || null;
      nutrition = computeNutritionScore(template, dayMeals);
    } catch { nutrition = null; }

    // Sleep — from the day's energy/sleep check-in
    let sleep = null;
    try {
      const energyLogs = useHabitStore.getState().energyLogs || [];
      const log = energyLogs.find((l) => l.date === dateStr);
      const sleepData = log?.sleepData
        ? {
            // QuickCheckin stores hours as sleepData.sleepHours
            hoursSlept: log.sleepData.sleepHours ?? log.sleepData.hoursSlept ?? null,
            sleepQualityScore: log.sleepData.sleepQualityScore ?? null,
          }
        : null;
      sleep = computeSleepScore(sleepData);
    } catch { sleep = null; }

    // Recovery — a recovery log, or a recovery/mobility workout that day
    let recovery = null;
    try {
      const health = useHealthStore.getState();
      const hasRecovery =
        (health.recoveryLogs || []).some((r) => r.date === dateStr) ||
        (health.workouts || []).some((w) => w.date === dateStr && (w.type === 'recovery' || w.category === 'mobility'));
      recovery = computeRecoveryScore(hasRecovery, isTrainingDay);
    } catch { recovery = null; }

    // Habits — linked program habits completed that day
    let habits = null;
    try {
      const habitStore = useHabitStore.getState();
      const dayDone = {};
      for (const l of (habitStore.logs || [])) if (l.date === dateStr && l.completed) dayDone[l.habitId] = true;
      habits = computeHabitsScore(s.habitLinks || [], dayDone);
    } catch { habits = null; }

    const result = computeDailyDiscipline({ timing, completion, nutrition, sleep, recovery, habits });
    return {
      score_date: dateStr,
      overall_score: result.overall,
      timing_score: timing,
      completion_score: completion,
      nutrition_score: nutrition,
      sleep_score: sleep,
      recovery_score: recovery,
      habits_score: habits,
      computed: true,
    };
  },

  // DB snapshot first, else live computation.
  getDisciplineForDate: (dateStr) => get().disciplineByDate[dateStr] || get().computeDisciplineForDate(dateStr),

  /**
   * Get discipline trend (last N days) — DB rows where present, else computed
   * live so the sparkline reflects real activity even before any persistence.
   */
  getDisciplineTrend: (days = 7) => {
    const s = get();
    const results = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const score = s.disciplineByDate[d] || s.computeDisciplineForDate(d);
      if (score) results.push(score);
    }
    return results;
  },

  // --- KPIs ---

  loadKpis: async (programId) => {
    try {
      const kpis = await api.fetchKpis(programId);
      set({ kpis });
      return kpis;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  addKpi: async (programId, data) => {
    try {
      const kpi = await api.createKpi(programId, data);
      set({ kpis: [...get().kpis, kpi] });
      return kpi;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateKpi: async (kpiId, updates) => {
    try {
      const updated = await api.updateKpi(kpiId, updates);
      set({ kpis: get().kpis.map((k) => k.id === kpiId ? updated : k) });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  removeKpi: async (kpiId) => {
    try {
      await api.deleteKpi(kpiId);
      set({ kpis: get().kpis.filter((k) => k.id !== kpiId) });
      const newVals = { ...get().kpiValuesByKpi };
      delete newVals[kpiId];
      set({ kpiValuesByKpi: newVals });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },
});
