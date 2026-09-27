// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';
import { isSupabaseConfigured } from '../../services/supabase';

export const initSlice = (set, get) => ({
  // === Initialization ===

  /**
   * Called once when the app loads (after auth).  Fetches the active & draft
   * programs, their phases, and locations.
   */
  initialize: async () => {
    if (!isSupabaseConfigured) return;
    if (get().initialized) return;
    set({ loading: true, error: null });
    try {
      const [active, draft, allPrograms, locations] = await Promise.all([
        api.fetchProgramByStatus('active'),
        api.fetchProgramByStatus('draft'),
        api.fetchPrograms(),
        api.fetchLocations(),
      ]);
      const archived = allPrograms.filter((p) => p.status === 'archived');

      set({ activeProgram: active, draftProgram: draft, archivedPrograms: archived, locations, initialized: true, loading: false });

      // Pre-load phases & sessions for active or draft program
      const target = active || draft;
      if (target) {
        await get().loadProgramDetails(target.id);
        // Load program-scoped data for the target (active OR draft). KPIs,
        // goals, nutrition templates and habit links are set up while the
        // program is still a draft, so they MUST load for a draft too —
        // otherwise a re-init wiped them from cache while the row stayed in the
        // DB, so they "disappeared" and re-creating hit the unique constraint
        // ("déjà créé"). The runtime series (logs, discipline, values,
        // trophies, alerts) simply come back empty for a draft — harmless.
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        await Promise.all([
          get().loadOverrides(target.id, weekAgo, weekAhead),
          get().loadSessionLogs(target.id, weekAgo, today),
          get().loadNutritionTemplates(target.id),
          get().loadHabitLinks(target.id),
          get().loadDisciplineScores(target.id, monthAgo, today),
          get().loadKpis(target.id),
          get().loadKpiValues(target.id, monthAgo, today),
          get().loadGoals(target.id),
          get().loadTrophies(target.id),
          get().loadAlerts(target.id),
        ]);
        // Goals now live in ONE system (healthStore) — bring over program goals.
        get().importProgramGoalsToUnified();
      }
    } catch (err) {
      console.error('[programStore] init failed:', err);
      set({ error: err.message, loading: false });
    }
  },

  /**
   * Load full details (phases, sessions, exercises, weekly) for a program.
   */
  loadProgramDetails: async (programId) => {
    try {
      const phases = await api.fetchPhases(programId);
      set({ phases });

      // Load sessions & weekly structure for each phase in parallel
      const sessionsByPhase = {};
      const weeklyByPhase = {};
      const exercisesBySession = {};

      await Promise.all(phases.map(async (phase) => {
        const [sessions, weekly] = await Promise.all([
          api.fetchSessions(phase.id),
          api.fetchWeeklyStructure(phase.id),
        ]);
        sessionsByPhase[phase.id] = sessions;
        weeklyByPhase[phase.id] = weekly;

        // Load exercises for each session
        await Promise.all(sessions.map(async (sess) => {
          exercisesBySession[sess.id] = await api.fetchExercises(sess.id);
        }));
      }));

      set({ sessionsByPhase, weeklyByPhase, exercisesBySession });
    } catch (err) {
      console.error('[programStore] loadProgramDetails failed:', err);
      set({ error: err.message });
    }
  },
});
