// Slice of healthStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../healthStore.js.
import { uid, todayKey } from '../../utils/formatters';
import { useSkillStore } from '../skillStore';
import { useHabitStore } from '../habitStore';
import { toast } from '../uiStore';
import { HEALTH_LINK_SKILLS } from './helpers';

export const workoutsSlice = (set, get) => ({
      // ─────────── Workouts ───────────
      // type: 'cardio' | 'strength' | 'sport'. `category`/`sessionType` are
      // optional richer metadata (e.g. category:'cardio', sessionType:'zone2')
      // layered on top of the original type/exercise/sets shape so every
      // existing selector (getPRs, getEstimated1RMs, getWorkoutVolumeSeries,
      // getExerciseLibrary, correlations — all keyed on `type`/`exercise`/`sets`)
      // keeps working unchanged for cardio/strength entries logged either way.
      logWorkout: (data, fulfillsPromptId) => {
        let newPR = null;
        if (data.type === 'strength' && data.exercise && data.sets?.length) {
          const key = data.exercise.trim().toLowerCase();
          const priorBest = Math.max(0, ...get().workouts.filter((w) => w.type === 'strength' && w.exercise?.trim().toLowerCase() === key).flatMap((w) => (w.sets || []).map((s) => Number(s.weight) || 0)));
          const maxW = Math.max(0, ...data.sets.map((s) => Number(s.weight) || 0));
          if (priorBest && maxW > priorBest) newPR = { exercise: data.exercise, weight: maxW };
        }
        const w = {
          id: uid(),
          date: data.date || todayKey(),
          type: data.type, // 'cardio' | 'strength' | 'sport'
          category: data.category || data.type,
          sessionType: data.sessionType || null,
          sessionId: data.sessionId || null,
          exercise: data.exercise || '',
          durationMin: Number(data.durationMin) || 0,
          sets: data.sets || [],
          avgRpe: data.sets?.length ? Number((data.sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / data.sets.length).toFixed(1)) : Number(data.avgRpe) || null,
          quality: Number(data.quality) || null,
          // Optional cardio metric bag (distance, avgHr, zone, strokeRate…) —
          // kept alongside the workout so cardio evolution is trackable.
          cardio: data.cardio || null,
          notes: data.notes || '',
          createdAt: Date.now(),
        };
        set({ workouts: [...get().workouts, w] });
        const award = useSkillStore.getState().awardXP;
        const link = HEALTH_LINK_SKILLS[data.type === 'strength' ? 'strength' : 'cardio']; // sport reuses the cardio/aerobic link
        award(link.skill, link.xp, `workout: ${w.exercise || w.type}`);
        award('health-discipline-lv1', 5, `workout logged: ${w.exercise || w.type}`);
        if (w.quality >= 8 && w.type === 'strength') award('form-mastery-lv1', 5, `great form: ${w.exercise}`);
        if (fulfillsPromptId) get().dismissPrompt(fulfillsPromptId);
        // Reverse of queueHabitPrompt: this workout was logged directly (e.g.
        // the curated program's own logger), not via checking a habit — so
        // any matching "Zone-2 Cardio"/strength habit for today needs to be
        // marked done too, or it keeps reading as "not done" and prompting
        // for something already logged.
        useHabitStore.getState().completeLinkedHabits(w.type === 'strength' ? 'strength' : 'cardio', w.date);
        get().checkBadges();
        toast(`Séance enregistrée : ${w.exercise || w.type}`, 'success');
        if (newPR) toast(`🏆 New PR: ${newPR.exercise} — ${newPR.weight}kg!`, 'success');
      },

      // A gym session = several exercises picked from the library, each with
      // its own sets — logged as N individual `workouts` entries (so every
      // per-exercise selector above keeps working exactly as if each had been
      // logged separately) sharing one `sessionId` for grouped display, but
      // XP is awarded ONCE for the whole session, not once per exercise —
      // otherwise a 6-exercise session would be worth 6x a single-exercise log.
      logGymSession: (data, fulfillsPromptId) => {
        // sessionId can be supplied by the caller (e.g. the Programme logger
        // passes its own session-log id) so the mirrored entries stay keyed to
        // a stable id and can be reconciled later via editGymSession.
        const sessionId = data.sessionId || uid();
        const date = data.date || todayKey();
        const entries = (data.exercises || [])
          .filter((ex) => ex.exercise && (ex.sets || []).some((s) => s.reps || s.weight))
          .map((ex) => ({
            id: uid(),
            date,
            type: 'strength',
            category: 'gym',
            sessionType: data.sessionType || null,
            sessionId,
            exercise: ex.exercise,
            durationMin: 0,
            sets: ex.sets.filter((s) => s.reps || s.weight),
            avgRpe: ex.sets?.length ? Number((ex.sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / ex.sets.length).toFixed(1)) : null,
            quality: Number(data.quality) || null,
            notes: data.notes || '',
            createdAt: Date.now(),
          }));
        if (!entries.length) {
          toast('Ajoute au moins un exercice avec une série avant de terminer la séance.', 'warning');
          return;
        }
        // PR detection BEFORE inserting — only celebrates an exercise that
        // already had a prior best on file (an exercise's very first-ever
        // log isn't a "record", it's just a first log).
        const priorBest = {};
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          const key = w.exercise?.trim().toLowerCase();
          if (!key) continue;
          const maxW = Math.max(0, ...(w.sets || []).map((s) => Number(s.weight) || 0));
          if (!priorBest[key] || maxW > priorBest[key]) priorBest[key] = maxW;
        }
        const newPRs = [];
        for (const e of entries) {
          const key = e.exercise?.trim().toLowerCase();
          const maxW = Math.max(0, ...(e.sets || []).map((s) => Number(s.weight) || 0));
          if (key && priorBest[key] && maxW > priorBest[key]) newPRs.push({ exercise: e.exercise, weight: maxW });
        }

        set({ workouts: [...get().workouts, ...entries] });
        const award = useSkillStore.getState().awardXP;
        const link = HEALTH_LINK_SKILLS.strength;
        award(link.skill, link.xp, `gym session: ${entries.length} exercises`);
        award('health-discipline-lv1', 5, 'gym session logged');
        if (data.quality >= 8) award('form-mastery-lv1', 5, 'great gym session form');
        if (fulfillsPromptId) get().dismissPrompt(fulfillsPromptId);
        // See logWorkout's comment — same reverse-link so a "Strength" habit
        // doesn't keep asking to be logged after the curated gym session
        // logger already did.
        useHabitStore.getState().completeLinkedHabits('strength', date);
        get().checkBadges();
        toast(`Séance enregistrée : ${entries.length} exercice${entries.length !== 1 ? 's' : ''}`, 'success');
        for (const pr of newPRs) toast(`🏆 New PR: ${pr.exercise} — ${pr.weight}kg!`, 'success');
      },

      deleteWorkout: (id) => set({ workouts: get().workouts.filter((w) => w.id !== id) }),
      deleteSession: (sessionId) => set({ workouts: get().workouts.filter((w) => w.sessionId !== sessionId) }),

      // Edits a standalone entry (cardio/sport, or a legacy pre-session-builder
      // strength log with no sessionId) in place. Deliberately does NOT touch
      // XP — that was already awarded at log time; re-awarding on every edit
      // would let someone farm XP by repeatedly tweaking quality/notes.
      editWorkout: (id, data) => {
        set({
          workouts: get().workouts.map((w) => {
            if (w.id !== id) return w;
            const sets = data.sets ?? w.sets;
            return {
              ...w,
              date: data.date || w.date,
              type: data.type || w.type,
              category: data.category ?? w.category,
              sessionType: data.sessionType ?? w.sessionType,
              exercise: data.exercise ?? w.exercise,
              durationMin: data.durationMin !== undefined ? Number(data.durationMin) || 0 : w.durationMin,
              sets,
              avgRpe: sets?.length ? Number((sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / sets.length).toFixed(1)) : w.avgRpe,
              quality: data.quality !== undefined ? Number(data.quality) || null : w.quality,
              cardio: data.cardio !== undefined ? data.cardio : w.cardio,
              notes: data.notes ?? w.notes,
            };
          }),
        });
        toast('Séance modifiée', 'success');
      },

      // Edits a gym session: replaces every `workouts` entry sharing this
      // sessionId with the new exercise/set list (simplest correct way to
      // reconcile exercises added/removed/reordered within the session,
      // rather than diffing). Same no-XP-on-edit rule as editWorkout above.
      editGymSession: (sessionId, data) => {
        const date = data.date || todayKey();
        const others = get().workouts.filter((w) => w.sessionId !== sessionId);
        const original = get().workouts.find((w) => w.sessionId === sessionId);
        const entries = (data.exercises || [])
          .filter((ex) => ex.exercise && (ex.sets || []).some((s) => s.reps || s.weight))
          .map((ex) => ({
            id: uid(),
            date,
            type: 'strength',
            category: 'gym',
            sessionType: data.sessionType || null,
            sessionId,
            exercise: ex.exercise,
            durationMin: 0,
            sets: ex.sets.filter((s) => s.reps || s.weight),
            avgRpe: ex.sets?.length ? Number((ex.sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / ex.sets.length).toFixed(1)) : null,
            quality: data.quality !== undefined ? Number(data.quality) || null : original?.quality ?? null,
            notes: data.notes ?? original?.notes ?? '',
            createdAt: original?.createdAt ?? Date.now(),
          }));
        if (!entries.length) {
          toast('Une séance doit contenir au moins un exercice avec une série.', 'warning');
          return;
        }
        set({ workouts: [...others, ...entries] });
        toast('Séance modifiée', 'success');
      },
});
