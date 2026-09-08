/**
 * programStore.js — Zustand store for Programme.
 *
 * NOT persisted to localStorage — all data lives in Supabase.
 * This store is an in-memory cache refreshed on load and after mutations.
 * Without an internet connection, Programme is unavailable.
 */

import { create } from 'zustand';
import * as api from '../services/program-api';
import { isSupabaseConfigured } from '../services/supabase';

export const useProgramStore = create((set, get) => ({

  // === State ===
  initialized: false,
  loading: false,
  error: null,
  available: isSupabaseConfigured,   // false → entire Programme UI shows "config required"

  // Programs
  activeProgram: null,
  draftProgram: null,
  archivedPrograms: [],

  // Phases (of the currently loaded program — draft or active)
  phases: [],

  // Sessions keyed by phaseId
  sessionsByPhase: {},   // { [phaseId]: session[] }

  // Exercises keyed by sessionId
  exercisesBySession: {},  // { [sessionId]: exercise[] }

  // Weekly structure keyed by phaseId
  weeklyByPhase: {},     // { [phaseId]: dayPlan[] (7 entries) }

  // Locations (global, not per-program)
  locations: [],

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
        // Wave 2: load overrides, logs, nutrition, habits for active program
        if (active) {
          const today = new Date().toISOString().slice(0, 10);
          const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
          const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
          await Promise.all([
            // Wave 2
            get().loadOverrides(active.id, weekAgo, weekAhead),
            get().loadSessionLogs(active.id, weekAgo, today),
            get().loadNutritionTemplates(active.id),
            get().loadHabitLinks(active.id),
            // Wave 3
            get().loadDisciplineScores(active.id, monthAgo, today),
            get().loadKpis(active.id),
            get().loadKpiValues(active.id, monthAgo, today),
            get().loadGoals(active.id),
            get().loadTrophies(active.id),
            get().loadAlerts(active.id),
          ]);
        }
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

  // === Program CRUD ===

  createProgram: async (name) => {
    set({ loading: true, error: null });
    try {
      const program = await api.createProgram(name);
      set({ draftProgram: program, phases: [], sessionsByPhase: {}, weeklyByPhase: {}, exercisesBySession: {}, loading: false });
      return program;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateProgram: async (id, updates) => {
    try {
      const updated = await api.updateProgram(id, updates);
      const s = get();
      if (s.draftProgram?.id === id) set({ draftProgram: updated });
      else if (s.activeProgram?.id === id) set({ activeProgram: updated });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  activateProgram: async (id) => {
    set({ loading: true, error: null });
    try {
      // Validate: at least 1 phase with at least 1 session
      const phases = get().phases;
      if (!phases.length) throw new Error('Au moins une phase est requise pour activer');
      const firstPhase = phases[0];
      const sessions = get().sessionsByPhase[firstPhase.id] || [];
      if (!sessions.length) throw new Error('La première phase doit avoir au moins une séance');

      const program = await api.activateProgram(id);

      // Set first phase to active
      const updatedPhase = await api.updatePhase(firstPhase.id, { status: 'active' });
      const updatedPhases = phases.map((p) => p.id === updatedPhase.id ? updatedPhase : p);

      // Update program end_date from last phase
      const lastPhase = phases[phases.length - 1];
      await api.updateProgram(id, { end_date: lastPhase.end_date });

      set({
        activeProgram: { ...program, end_date: lastPhase.end_date },
        draftProgram: null,
        phases: updatedPhases,
        loading: false,
      });
      return program;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  archiveProgram: async (id) => {
    set({ loading: true, error: null });
    try {
      const program = await api.archiveProgram(id);
      const s = get();
      set({
        activeProgram: null,
        archivedPrograms: [program, ...s.archivedPrograms],
        phases: [],
        sessionsByPhase: {},
        weeklyByPhase: {},
        exercisesBySession: {},
        loading: false,
      });
      return program;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteDraft: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteProgram(id);
      set({
        draftProgram: null,
        phases: [],
        sessionsByPhase: {},
        weeklyByPhase: {},
        exercisesBySession: {},
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // === Phases ===

  addPhase: async (programId, data) => {
    try {
      const phase = await api.createPhase(programId, data);
      set({ phases: [...get().phases, phase] });
      return phase;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updatePhase: async (phaseId, updates) => {
    try {
      const updated = await api.updatePhase(phaseId, updates);
      set({ phases: get().phases.map((p) => p.id === phaseId ? updated : p) });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deletePhase: async (phaseId) => {
    try {
      await api.deletePhase(phaseId);
      const phases = get().phases.filter((p) => p.id !== phaseId);
      // Re-number remaining phases
      for (let i = 0; i < phases.length; i++) {
        if (phases[i].phase_order !== i + 1) {
          phases[i] = await api.updatePhase(phases[i].id, { phase_order: i + 1 });
        }
      }
      set({ phases });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // === Sessions ===

  createSession: async (phaseId, data) => {
    try {
      const session = await api.createSession(phaseId, data);
      const s = get();
      const existing = s.sessionsByPhase[phaseId] || [];
      set({ sessionsByPhase: { ...s.sessionsByPhase, [phaseId]: [...existing, session] } });
      return session;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateSession: async (sessionId, updates) => {
    try {
      const updated = await api.updateSession(sessionId, updates);
      const s = get();
      const newMap = { ...s.sessionsByPhase };
      for (const [phaseId, sessions] of Object.entries(newMap)) {
        const idx = sessions.findIndex((sess) => sess.id === sessionId);
        if (idx !== -1) {
          newMap[phaseId] = sessions.map((sess) => sess.id === sessionId ? updated : sess);
          break;
        }
      }
      set({ sessionsByPhase: newMap });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await api.deleteSession(sessionId);
      const s = get();
      const newMap = { ...s.sessionsByPhase };
      for (const [phaseId, sessions] of Object.entries(newMap)) {
        const idx = sessions.findIndex((sess) => sess.id === sessionId);
        if (idx !== -1) {
          newMap[phaseId] = sessions.filter((sess) => sess.id !== sessionId);
          break;
        }
      }
      // Also remove exercises for this session
      const newExMap = { ...s.exercisesBySession };
      delete newExMap[sessionId];
      set({ sessionsByPhase: newMap, exercisesBySession: newExMap });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // === Exercises ===

  addExercise: async (sessionId, data) => {
    try {
      const exercise = await api.upsertExercise(sessionId, data);
      const s = get();
      const existing = s.exercisesBySession[sessionId] || [];
      set({ exercisesBySession: { ...s.exercisesBySession, [sessionId]: [...existing, exercise] } });
      return exercise;
    } catch (err) {
      set({ error: err.message });
      throw err;
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
      set({ error: err.message });
      throw err;
    }
  },

  removeExercise: async (sessionId, exerciseId) => {
    try {
      await api.deleteExercise(exerciseId);
      const s = get();
      const list = (s.exercisesBySession[sessionId] || []).filter((ex) => ex.id !== exerciseId);
      set({ exercisesBySession: { ...s.exercisesBySession, [sessionId]: list } });
    } catch (err) {
      set({ error: err.message });
      throw err;
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
      set({ error: err.message });
      throw err;
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
      set({ error: err.message });
      throw err;
    }
  },

  // === Locations ===

  addLocation: async (data) => {
    try {
      const loc = await api.createLocation(data);
      set({ locations: [...get().locations, loc] });
      return loc;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateLocation: async (id, updates) => {
    try {
      const updated = await api.updateLocation(id, updates);
      set({ locations: get().locations.map((l) => l.id === id ? updated : l) });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteLocation: async (id) => {
    try {
      await api.deleteLocation(id);
      set({ locations: get().locations.filter((l) => l.id !== id) });
    } catch (err) {
      set({ error: err.message });
      throw err;
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
  // Wave 2 — Daily usage, overrides, session logs, nutrition, habits
  // =====================================================================

  // Overrides keyed by 'YYYY-MM-DD' → override[]
  overridesByDate: {},

  // Session logs keyed by 'YYYY-MM-DD' → log[]
  sessionLogsByDate: {},

  // Nutrition templates keyed by phaseId → template[]
  nutritionByPhase: {},

  // Habit links for current program
  habitLinks: [],

  // --- Daily view computation ---

  /**
   * Returns the scheduled events for a given date, taking overrides into account.
   * Computes from weekly_structure + phase dates — no materialized schedule needed.
   * @param {string} dateStr — 'YYYY-MM-DD'
   * @returns {Array<{session, planned_time, location_id, override, logged}>}
   */
  getScheduleForDate: (dateStr) => {
    const s = get();
    const program = s.activeProgram;
    if (!program) return [];

    // Find which phase this date falls in
    const phase = s.phases.find((p) =>
      p.start_date <= dateStr && p.end_date >= dateStr
    );
    if (!phase) return [];

    // Day of week (0=Mon … 6=Sun, matching our weekly_structure)
    const d = new Date(dateStr + 'T12:00:00');
    const jsDay = d.getDay(); // 0=Sun
    const dow = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon

    const weeklyDays = s.weeklyByPhase[phase.id] || [];
    const dayPlan = weeklyDays.find((w) => w.day_of_week === dow);
    if (!dayPlan || dayPlan.is_rest_day) return [];

    const overrides = (s.overridesByDate[dateStr] || []);
    const logs = (s.sessionLogsByDate[dateStr] || []);
    const sessions = s.sessionsByPhase[phase.id] || [];

    // Build scheduled events from session_ids
    return (dayPlan.session_ids || []).map((sessId) => {
      const session = sessions.find((ss) => ss.id === sessId);
      if (!session) return null;

      const override = overrides.find((o) => o.original_session_id === sessId);
      const log = logs.find((l) => l.session_id === sessId);

      // If cancelled, still return with cancelled flag
      if (override?.action === 'cancel') {
        return { session, planned_time: dayPlan.scheduled_time, location_id: dayPlan.location_id, override, logged: log, cancelled: true, phase };
      }

      // If rescheduled to another date, mark as moved
      if (override?.action === 'reschedule' && override.new_date && override.new_date !== dateStr) {
        return { session, planned_time: dayPlan.scheduled_time, location_id: dayPlan.location_id, override, logged: log, moved: true, phase };
      }

      return {
        session,
        planned_time: override?.new_time || dayPlan.scheduled_time,
        location_id: override?.new_location_id || dayPlan.location_id,
        override,
        logged: log,
        cancelled: false,
        moved: false,
        phase,
      };
    }).filter(Boolean);
  },

  /**
   * Get today's schedule (convenience).
   */
  getTodaySchedule: () => {
    const today = new Date().toISOString().slice(0, 10);
    return get().getScheduleForDate(today);
  },

  // --- Overrides ---

  loadOverrides: async (programId, dateFrom, dateTo) => {
    try {
      const overrides = await api.fetchOverrides(programId, dateFrom, dateTo);
      const map = {};
      for (const o of overrides) (map[o.target_date] ||= []).push(o);
      set({ overridesByDate: { ...get().overridesByDate, ...map } });
      return overrides;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  createOverride: async (programId, data) => {
    try {
      const override = await api.createOverride(programId, data);
      const s = get();
      const key = override.target_date;
      const existing = s.overridesByDate[key] || [];
      const idx = existing.findIndex((o) => o.id === override.id);
      const updated = idx >= 0
        ? existing.map((o) => o.id === override.id ? override : o)
        : [...existing, override];
      set({ overridesByDate: { ...s.overridesByDate, [key]: updated } });
      return override;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  /**
   * Cancel a session on a given date with cascade.
   * Cascade: remaining sessions that week shift +1 day, never past Sunday.
   */
  cancelSessionWithCascade: async (programId, dateStr, sessionId, reasonCode, reasonNote) => {
    try {
      // 1. Create the cancel override
      await get().createOverride(programId, {
        target_date: dateStr,
        original_session_id: sessionId,
        action: 'cancel',
        reason_code: reasonCode,
        reason_note: reasonNote,
        cascade_applied: true,
      });

      // 2. Find remaining sessions this week after dateStr and shift +1
      const d = new Date(dateStr + 'T12:00:00');
      const jsDay = d.getDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1;
      // Days left in the week (Mon=0..Sun=6), don't go past Sunday
      for (let dayOffset = 1; dow + dayOffset <= 6; dayOffset++) {
        const checkDate = new Date(d.getTime() + dayOffset * 86400000);
        const checkStr = checkDate.toISOString().slice(0, 10);
        const scheduled = get().getScheduleForDate(checkStr);

        for (const evt of scheduled) {
          if (evt.cancelled || evt.moved) continue;
          // Shift this session +1 day
          const newDate = new Date(checkDate.getTime() + 86400000);
          const newDow = newDate.getDay() === 0 ? 6 : newDate.getDay() - 1;
          if (newDow > 6) continue; // would exceed Sunday — skip
          const newDateStr = newDate.toISOString().slice(0, 10);

          await get().createOverride(programId, {
            target_date: checkStr,
            original_session_id: evt.session.id,
            action: 'reschedule',
            new_date: newDateStr,
            new_time: evt.planned_time,
            reason_code: 'cascade',
            reason_note: `Décalé suite à l'annulation du ${dateStr}`,
            cascade_applied: true,
          });
        }
      }
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  removeOverride: async (overrideId, dateStr) => {
    try {
      await api.deleteOverride(overrideId);
      const s = get();
      const updated = (s.overridesByDate[dateStr] || []).filter((o) => o.id !== overrideId);
      set({ overridesByDate: { ...s.overridesByDate, [dateStr]: updated } });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // --- Session Logs ---

  loadSessionLogs: async (programId, dateFrom, dateTo) => {
    try {
      const logs = await api.fetchSessionLogs(programId, dateFrom, dateTo);
      const map = {};
      for (const l of logs) (map[l.planned_date] ||= []).push(l);
      set({ sessionLogsByDate: { ...get().sessionLogsByDate, ...map } });
      return logs;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  logSession: async (data) => {
    try {
      const log = await api.createSessionLog(data);
      const s = get();
      const key = log.planned_date;
      const existing = s.sessionLogsByDate[key] || [];
      set({ sessionLogsByDate: { ...s.sessionLogsByDate, [key]: [...existing, log] } });
      return log;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateSessionLog: async (logId, dateStr, updates) => {
    try {
      const updated = await api.updateSessionLog(logId, updates);
      const s = get();
      const list = (s.sessionLogsByDate[dateStr] || []).map((l) => l.id === logId ? updated : l);
      set({ sessionLogsByDate: { ...s.sessionLogsByDate, [dateStr]: list } });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  removeSessionLog: async (logId, dateStr) => {
    try {
      await api.deleteSessionLog(logId);
      const s = get();
      const list = (s.sessionLogsByDate[dateStr] || []).filter((l) => l.id !== logId);
      set({ sessionLogsByDate: { ...s.sessionLogsByDate, [dateStr]: list } });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // --- Nutrition Templates ---

  loadNutritionTemplates: async (programId) => {
    try {
      const map = await api.fetchAllNutritionTemplates(programId);
      set({ nutritionByPhase: { ...get().nutritionByPhase, ...map } });
      return map;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  createNutritionTemplate: async (phaseId, data) => {
    try {
      const template = await api.createNutritionTemplate(phaseId, data);
      const s = get();
      const existing = s.nutritionByPhase[phaseId] || [];
      set({ nutritionByPhase: { ...s.nutritionByPhase, [phaseId]: [...existing, template] } });
      return template;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateNutritionTemplate: async (phaseId, templateId, updates) => {
    try {
      const updated = await api.updateNutritionTemplate(templateId, updates);
      const s = get();
      const list = (s.nutritionByPhase[phaseId] || []).map((t) => t.id === templateId ? updated : t);
      set({ nutritionByPhase: { ...s.nutritionByPhase, [phaseId]: list } });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  removeNutritionTemplate: async (phaseId, templateId) => {
    try {
      await api.deleteNutritionTemplate(templateId);
      const s = get();
      const list = (s.nutritionByPhase[phaseId] || []).filter((t) => t.id !== templateId);
      set({ nutritionByPhase: { ...s.nutritionByPhase, [phaseId]: list } });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  getNutritionForPhase: (phaseId) => get().nutritionByPhase[phaseId] || [],

  // --- Habit Links ---

  loadHabitLinks: async (programId) => {
    try {
      const links = await api.fetchHabitLinks(programId);
      set({ habitLinks: links });
      return links;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  createHabitLink: async (programId, data) => {
    try {
      const link = await api.createHabitLink(programId, data);
      const s = get();
      const existing = s.habitLinks.filter((l) => l.id !== link.id);
      set({ habitLinks: [...existing, link] });
      return link;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateHabitLink: async (linkId, updates) => {
    try {
      const updated = await api.updateHabitLink(linkId, updates);
      set({ habitLinks: get().habitLinks.map((l) => l.id === linkId ? updated : l) });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  removeHabitLink: async (linkId) => {
    try {
      await api.deleteHabitLink(linkId);
      set({ habitLinks: get().habitLinks.filter((l) => l.id !== linkId) });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  getHabitLinksForSession: (sessionId) => get().habitLinks.filter((l) => l.session_id === sessionId),

  // =====================================================================
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
      set({ error: err.message });
      throw err;
    }
  },

  saveDisciplineScore: async (programId, data) => {
    try {
      const score = await api.upsertDisciplineScore(programId, data);
      const s = get();
      set({ disciplineByDate: { ...s.disciplineByDate, [score.score_date]: score } });
      return score;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  getDisciplineForDate: (dateStr) => get().disciplineByDate[dateStr] || null,

  /**
   * Get discipline trend (last N days).
   */
  getDisciplineTrend: (days = 7) => {
    const s = get();
    const results = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const score = s.disciplineByDate[d];
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
      set({ error: err.message });
      throw err;
    }
  },

  addKpi: async (programId, data) => {
    try {
      const kpi = await api.createKpi(programId, data);
      set({ kpis: [...get().kpis, kpi] });
      return kpi;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateKpi: async (kpiId, updates) => {
    try {
      const updated = await api.updateKpi(kpiId, updates);
      set({ kpis: get().kpis.map((k) => k.id === kpiId ? updated : k) });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
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
      set({ error: err.message });
      throw err;
    }
  },

  // --- KPI Values ---

  loadKpiValues: async (programId, dateFrom, dateTo) => {
    try {
      const map = await api.fetchAllKpiValues(programId, dateFrom, dateTo);
      set({ kpiValuesByKpi: { ...get().kpiValuesByKpi, ...map } });
      return map;
    } catch (err) {
      set({ error: err.message });
      throw err;
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
      set({ error: err.message });
      throw err;
    }
  },

  getKpiValues: (kpiId) => get().kpiValuesByKpi[kpiId] || [],

  getLatestKpiValue: (kpiId) => {
    const vals = get().kpiValuesByKpi[kpiId] || [];
    return vals.length ? vals[vals.length - 1] : null;
  },

  // --- Goals ---

  loadGoals: async (programId) => {
    try {
      const goals = await api.fetchGoals(programId);
      set({ goals });
      return goals;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  addGoal: async (programId, data) => {
    try {
      const goal = await api.createGoal(programId, data);
      set({ goals: [...get().goals, goal] });
      return goal;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateGoal: async (goalId, updates) => {
    try {
      const updated = await api.updateGoal(goalId, updates);
      set({ goals: get().goals.map((g) => g.id === goalId ? updated : g) });
      return updated;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  removeGoal: async (goalId) => {
    try {
      await api.deleteGoal(goalId);
      set({ goals: get().goals.filter((g) => g.id !== goalId) });
    } catch (err) {
      set({ error: err.message });
      throw err;
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
      set({ error: err.message });
      throw err;
    }
  },

  // --- Trophies ---

  loadTrophies: async (programId) => {
    try {
      const trophies = await api.fetchTrophies(programId);
      set({ trophies });
      return trophies;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // --- Alerts ---

  loadAlerts: async (programId) => {
    try {
      const alerts = await api.fetchAlerts(programId, true);
      set({ alerts });
      return alerts;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  createAlert: async (programId, data) => {
    try {
      const alert = await api.createAlert(programId, data);
      set({ alerts: [alert, ...get().alerts] });
      return alert;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  acknowledgeAlert: async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      set({ alerts: get().alerts.filter((a) => a.id !== alertId) });
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  acknowledgeAllAlerts: async (programId) => {
    try {
      await api.acknowledgeAllAlerts(programId);
      set({ alerts: [] });
    } catch (err) {
      set({ error: err.message });
      throw err;
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
}));
