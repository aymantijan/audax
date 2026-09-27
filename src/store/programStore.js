import { create } from 'zustand';
import { isSupabaseConfigured } from '../services/supabase';
import { initSlice } from './program/init';
import { editorSlice } from './program/editor';
import { structureSlice } from './program/structure';
import { dailySlice } from './program/daily';
import { logsSlice } from './program/logs';
import { disciplineSlice } from './program/discipline';
import { kpisSlice } from './program/kpis';
import { goalsSlice } from './program/goals';

// Split into slices under ./program/ (F3): each file holds whole sections of
// the original store, verbatim; they are spread back into one store here.
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

...initSlice(set, get),
...editorSlice(set, get),
...structureSlice(set, get),
...dailySlice(set, get),
...logsSlice(set, get),
...disciplineSlice(set, get),
...kpisSlice(set, get),
...goalsSlice(set, get),
}));

// Unified goals live in healthStore (which can't import this store without a
// cycle); it announces achievements with an event, we award the trophy.
if (typeof window !== 'undefined' && !window.__audaxGoalTrophyListener) {
  window.__audaxGoalTrophyListener = true;
  window.addEventListener('audax:goal-achieved', (e) => { useProgramStore.getState().awardGoalTrophy(e.detail); });
}
