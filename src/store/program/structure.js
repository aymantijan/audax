// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';

export const structureSlice = (set, get) => ({
  // === Exercises ===

  addExercise: async (sessionId, data) => {
    try {
      const exercise = await api.upsertExercise(sessionId, data);
      const s = get();
      const existing = s.exercisesBySession[sessionId] || [];
      set({ exercisesBySession: { ...s.exercisesBySession, [sessionId]: [...existing, exercise] } });
      return exercise;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateExercise: async (sessionId, exerciseId, updates) => {
    try {
      const updated = await api.upsertExercise(sessionId, { ...updates, id: exerciseId });
      const s = get();
      const list = (s.exercisesBySession[sessionId] || []).map((ex) => ex.id === exerciseId ? updated : ex);
      set({ exercisesBySession: { ...s.exercisesBySession, [sessionId]: list } });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  removeExercise: async (sessionId, exerciseId) => {
    try {
      await api.deleteExercise(exerciseId);
      const s = get();
      const list = (s.exercisesBySession[sessionId] || []).filter((ex) => ex.id !== exerciseId);
      set({ exercisesBySession: { ...s.exercisesBySession, [sessionId]: list } });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  reorderExercises: async (sessionId, orderedIds) => {
    try {
      await api.reorderExercises(sessionId, orderedIds);
      // Re-fetch to get correct order
      const exercises = await api.fetchExercises(sessionId);
      const s = get();
      set({ exercisesBySession: { ...s.exercisesBySession, [sessionId]: exercises } });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // === Weekly Structure ===

  setDayPlan: async (phaseId, dayOfWeek, data) => {
    try {
      const day = await api.upsertDayPlan(phaseId, dayOfWeek, data);
      const s = get();
      const existing = s.weeklyByPhase[phaseId] || [];
      const idx = existing.findIndex((d) => d.day_of_week === dayOfWeek);
      const updated = idx >= 0
        ? existing.map((d) => d.day_of_week === dayOfWeek ? day : d)
        : [...existing, day].sort((a, b) => a.day_of_week - b.day_of_week);
      set({ weeklyByPhase: { ...s.weeklyByPhase, [phaseId]: updated } });
      return day;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // === Locations ===

  addLocation: async (data) => {
    try {
      const loc = await api.createLocation(data);
      set({ locations: [...get().locations, loc] });
      return loc;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateLocation: async (id, updates) => {
    try {
      const updated = await api.updateLocation(id, updates);
      set({ locations: get().locations.map((l) => l.id === id ? updated : l) });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  deleteLocation: async (id) => {
    try {
      await api.deleteLocation(id);
      set({ locations: get().locations.filter((l) => l.id !== id) });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // === Getters ===

  /** The program currently being edited or running (draft or active). */
  getCurrentProgram: () => get().activeProgram || get().draftProgram,

  /** Active phase of the active program. */
  getActivePhase: () => get().phases.find((p) => p.status === 'active') || null,

  /** Sessions for a specific phase. */
  getSessionsForPhase: (phaseId) => get().sessionsByPhase[phaseId] || [],

  /** Exercises for a specific session. */
  getExercisesForSession: (sessionId) => get().exercisesBySession[sessionId] || [],

  /** Weekly structure for a specific phase. */
  getWeeklyForPhase: (phaseId) => get().weeklyByPhase[phaseId] || [],

  /** Check if program can be activated. */
  canActivate: () => {
    const phases = get().phases;
    if (!phases.length) return false;
    const firstPhase = phases[0];
    const sessions = get().sessionsByPhase[firstPhase.id] || [];
    return sessions.length > 0;
  },

  // =====================================================================
});
