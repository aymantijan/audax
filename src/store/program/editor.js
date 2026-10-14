// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';

export const editorSlice = (set, get) => ({
  // === Program CRUD ===

  createProgram: async (name) => {
    set({ loading: true, error: null });
    try {
      const program = await api.createProgram(name);
      set({ draftProgram: program, phases: [], sessionsByPhase: {}, weeklyByPhase: {}, exercisesBySession: {}, loading: false });
      return program;
    } catch (err) {
      set({ loading: false }); // error surfaced by the caller, not the page-level screen
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
      throw err; // surfaced by the calling form — not the page-level error screen
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
      set({ loading: false }); // error surfaced by the caller, not the page-level screen
      throw err;
    }
  },

  // An archived programme comes back as the active one (« rien n'est définitif »).
  reactivateProgram: async (id) => {
    if (get().activeProgram) throw new Error('Archive d’abord le programme en cours : un seul programme peut être actif.');
    set({ loading: true, error: null });
    try {
      const program = await api.updateProgram(id, { status: 'active', archived_at: null });
      set({ activeProgram: program, archivedPrograms: get().archivedPrograms.filter((p) => p.id !== id), loading: false });
      await get().loadProgramDetails(id);
      return program;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  // A new cycle from an existing programme: same phases, sessions, exercises
  // and week, as a draft whose first phase starts on `startDate` (phase lengths
  // and gaps kept). Logs, goals and history are not copied.
  duplicateProgram: async (id, startDate) => {
    if (get().draftProgram) throw new Error('Tu as déjà un brouillon : termine-le ou supprime-le d’abord.');
    const source = [get().activeProgram, ...get().archivedPrograms].find((p) => p?.id === id);
    const phases = [...(await api.fetchPhases(id))].sort((a, b) => a.phase_order - b.phase_order);
    if (!phases.length) throw new Error('Ce programme n’a aucune phase à copier.');
    const day = 86400000;
    const shift = new Date(startDate + 'T12:00:00') - new Date(phases[0].start_date + 'T12:00:00');
    const moved = (d) => new Date(new Date(d + 'T12:00:00').getTime() + Math.round(shift / day) * day).toISOString().slice(0, 10);
    set({ loading: true, error: null });
    try {
      const program = await api.createProgram(`${source?.name || 'Programme'} (nouveau cycle)`);
      for (const ph of phases) {
        const newPhase = await api.createPhase(program.id, { name: ph.name, phase_order: ph.phase_order, start_date: moved(ph.start_date), end_date: moved(ph.end_date), objective: ph.objective });
        const sessionIds = {};
        for (const sess of await api.fetchSessions(ph.id)) {
          const copy = await api.createSession(newPhase.id, { session_key: sess.session_key, label: sess.label, type: sess.type, estimated_duration_min: sess.estimated_duration_min, notes: sess.notes, config: sess.config });
          sessionIds[sess.id] = copy.id;
          for (const ex of await api.fetchExercises(sess.id)) {
            const { id: _id, session_id: _s, user_id: _u, created_at: _c, updated_at: _up, ...fields } = ex;
            await api.upsertExercise(copy.id, fields);
          }
        }
        for (const plan of await api.fetchWeeklyStructure(ph.id)) {
          const slots = Object.fromEntries(Object.entries(plan.session_slots || {}).filter(([k]) => sessionIds[k]).map(([k, v]) => [sessionIds[k], v]));
          await api.upsertDayPlan(newPhase.id, plan.day_of_week, { ...plan, session_ids: (plan.session_ids || []).map((x) => sessionIds[x]).filter(Boolean), session_slots: slots });
        }
      }
      set({ draftProgram: program, loading: false });
      await get().loadProgramDetails(program.id);
      return program;
    } catch (err) {
      set({ loading: false });
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
      set({ loading: false }); // error surfaced by the caller, not the page-level screen
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
      set({ loading: false }); // error surfaced by the caller, not the page-level screen
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
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updatePhase: async (phaseId, updates) => {
    try {
      const updated = await api.updatePhase(phaseId, updates);
      set({ phases: get().phases.map((p) => p.id === phaseId ? updated : p) });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
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
      throw err; // surfaced by the calling form — not the page-level error screen
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
      throw err; // surfaced by the calling form — not the page-level error screen
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
      throw err; // surfaced by the calling form — not the page-level error screen
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
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },
});
