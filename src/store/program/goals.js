// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import { create } from 'zustand';
import * as api from '../../services/program-api';

export const goalsSlice = (set, get) => ({
  // --- Goals ---

  loadGoals: async (programId) => {
    try {
      const goals = await api.fetchGoals(programId);
      set({ goals });
      return goals;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  addGoal: async (programId, data) => {
    try {
      const goal = await api.createGoal(programId, data);
      set({ goals: [...get().goals, goal] });
      return goal;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateGoal: async (goalId, updates) => {
    try {
      const updated = await api.updateGoal(goalId, updates);
      set({ goals: get().goals.map((g) => g.id === goalId ? updated : g) });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  removeGoal: async (goalId) => {
    try {
      await api.deleteGoal(goalId);
      set({ goals: get().goals.filter((g) => g.id !== goalId) });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  /**
   * Achieve a goal → create trophy + update goal.
   */
  achieveGoal: async (goalId) => {
    try {
      const s = get();
      const goal = s.goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');
      const program = s.activeProgram;
      const phase = s.phases.find((p) => p.id === goal.phase_id);

      // Mark goal as achieved
      const now = new Date().toISOString();
      const updatedGoal = await api.updateGoal(goalId, {
        achieved: true,
        achieved_at: now,
        progress_pct: 100,
      });

      // Determine trophy tier from discipline
      const trend = get().getDisciplineTrend(30);
      const avgDiscipline = trend.length
        ? trend.reduce((sum, t) => sum + t.overall_score, 0) / trend.length
        : 50;
      let tier = 'bronze';
      if (avgDiscipline >= 90) tier = 'diamond';
      else if (avgDiscipline >= 75) tier = 'gold';
      else if (avgDiscipline >= 60) tier = 'silver';

      // Duration from goal creation
      const durationDays = Math.round((Date.now() - new Date(goal.created_at).getTime()) / 86400000);

      // Create trophy
      const trophy = await api.createTrophy({
        program_id: goal.program_id,
        goal_id: goalId,
        title: goal.title,
        description: goal.description,
        trophy_type: 'goal',
        achieved_value: goal.current_value,
        target_value: goal.target_value,
        discipline_score: Math.round(avgDiscipline * 100) / 100,
        phase_name: phase?.name || null,
        program_name: program?.name || null,
        duration_days: durationDays,
        tier,
      });

      set({
        goals: s.goals.map((g) => g.id === goalId ? updatedGoal : g),
        trophies: [trophy, ...s.trophies],
      });
      return { goal: updatedGoal, trophy };
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // --- Trophies ---

  loadTrophies: async (programId) => {
    try {
      const trophies = await api.fetchTrophies(programId);
      set({ trophies });
      return trophies;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // --- Alerts ---

  loadAlerts: async (programId) => {
    try {
      const alerts = await api.fetchAlerts(programId, true);
      set({ alerts });
      return alerts;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  createAlert: async (programId, data) => {
    try {
      const alert = await api.createAlert(programId, data);
      set({ alerts: [alert, ...get().alerts] });
      return alert;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  acknowledgeAlert: async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      set({ alerts: get().alerts.filter((a) => a.id !== alertId) });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  acknowledgeAllAlerts: async (programId) => {
    try {
      await api.acknowledgeAllAlerts(programId);
      set({ alerts: [] });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // === Clear ===
  clear: () => set({
    initialized: false,
    loading: false,
    error: null,
    activeProgram: null,
    draftProgram: null,
    archivedPrograms: [],
    phases: [],
    sessionsByPhase: {},
    exercisesBySession: {},
    weeklyByPhase: {},
    locations: [],
    overridesByDate: {},
    sessionLogsByDate: {},
    nutritionByPhase: {},
    habitLinks: [],
    disciplineByDate: {},
    kpis: [],
    kpiValuesByKpi: {},
    goals: [],
    trophies: [],
    alerts: [],
  }),
});
