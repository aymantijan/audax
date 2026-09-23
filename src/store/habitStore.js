import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { useHealthStore } from './healthStore';
import { toast } from './uiStore';
import { endRecurringEvent, deleteCalendarEvent } from '../services/google-calendar';
import { evaluateBadges } from '../utils/badges';
import { HABIT_CATEGORIES } from '../utils/constants';

// Same shape/mechanism as healthStore's/engineeringStore's BADGE_DEFS —
// `check` receives this store's state, `awardedBadges` persists which ones
// already fired so re-checking on every toggle never re-toasts one.
const BADGE_DEFS = [
  { id: 'first-habit', name: 'Première habitude', tier: 'bronze', check: (s) => s.habits.length >= 1 },
  { id: 'getting-started', name: 'C’est parti', tier: 'bronze', check: (s) => s.logs.filter((l) => l.completed).length >= 10 },
  { id: 'habit-architect', name: 'Architecte d’habitudes', tier: 'silver', check: (s) => s.habits.filter((h) => !h.archived).length >= 5 },
  { id: 'habit-builder', name: 'Bâtisseur d’habitudes', tier: 'silver', check: (s) => s.logs.filter((l) => l.completed).length >= 50 },
  { id: 'category-explorer', name: 'Explorateur', tier: 'silver', check: (s) => {
      const doneIds = new Set(s.logs.filter((l) => l.completed).map((l) => l.habitId));
      return new Set(s.habits.filter((h) => doneIds.has(h.id)).map((h) => h.category)).size >= 4;
    } },
  { id: 'energy-tracker', name: 'À l’écoute de son énergie', tier: 'silver', check: (s) => s.energyLogs.length >= 30 },
  { id: 'habit-master', name: 'Maître des habitudes', tier: 'gold', check: (s) => s.logs.filter((l) => l.completed).length >= 200 },
  { id: 'all-rounder', name: 'Polyvalent', tier: 'gold', check: (s) => {
      const doneIds = new Set(s.logs.filter((l) => l.completed).map((l) => l.habitId));
      return new Set(s.habits.filter((h) => doneIds.has(h.id)).map((h) => h.category)).size >= HABIT_CATEGORIES.length;
    } },
  { id: 'perfect-day', name: 'Journée parfaite', tier: 'gold', check: (s) => {
      const activeIds = s.habits.filter((h) => !h.archived).map((h) => h.id);
      if (!activeIds.length) return false;
      const byDate = {};
      for (const l of s.logs) if (l.completed) (byDate[l.date] ||= new Set()).add(l.habitId);
      return Object.values(byDate).some((set) => activeIds.every((id) => set.has(id)));
    } },
];

export const useHabitStore = create(
  persist(
    (set, get) => ({
      habits: [],
      logs: [], // { habitId, date: 'YYYY-MM-DD', completed, createdAt }
      energyLogs: [], // one per date, keyed by log.date
      awardedBadges: [], // badge ids already toasted, so checkBadges never re-fires one
      pauses: [], // vacation / sick periods: [{ id, from, to, reason }] — covered days are jokers for every habit
      habitSettings: { jokersPerMonth: 2 }, // jokers per habit per calendar month (streak protection)
      // Browser reminders at each habit's reminderTime (local only: the app must be open).
      habitReminders: { enabled: false, lastShown: {} },
      setHabitRemindersEnabled: (enabled) => set({ habitReminders: { ...(get().habitReminders || { lastShown: {} }), enabled } }),
      markHabitReminderShown: (habitId, date) => set({ habitReminders: { ...get().habitReminders, lastShown: { ...(get().habitReminders?.lastShown || {}), [habitId]: date } } }),

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'decision-discipline-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addHabit: (data) => {
        const habit = {
          ...data,
          id: uid(),
          xpReward: Number(data.xpReward) || 5,
          timesPerWeek: data.frequency === 'weekly' ? Math.max(1, Math.min(7, Number(data.timesPerWeek) || 1)) : null,
          moment: data.moment || 'any',
          kind: data.kind || 'check', // 'check' | 'quantity' | 'quit'
          target: data.kind === 'quantity' ? Number(data.target) || 1 : null,
          unit: data.kind === 'quantity' ? data.unit || '' : null,
          direction: data.kind === 'quantity' ? data.direction || 'atLeast' : null, // 'atLeast' | 'atMost'
          source: data.kind === 'quantity' ? data.source || null : null, // auto source (utils/habit-sources.js)
          relapses: [],
          reminderTime: data.reminderTime || null, // 'HH:MM'
          after: data.after || null, // habit stacking: do this right after habit `after`
          archived: false,
          startDate: todayKey(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ habits: [...get().habits, habit] });
        toast(`Habitude ajoutée : ${habit.name}`, 'success');
        get().checkBadges();
      },

      editHabit: (id, updates) =>
        set({
          habits: get().habits.map((h) =>
            h.id === id ? {
              ...h, ...updates, xpReward: Number(updates.xpReward ?? h.xpReward),
              timesPerWeek: (updates.frequency ?? h.frequency) === 'weekly' ? Math.max(1, Math.min(7, Number(updates.timesPerWeek ?? h.timesPerWeek) || 1)) : null,
              ...((updates.kind ?? h.kind) === 'quantity' ? { target: Number(updates.target ?? h.target) || 1 } : {}),
              updatedAt: Date.now(),
            } : h
          ),
        }),

      archiveHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        set({ habits: get().habits.map((h) => (h.id === id ? { ...h, archived: true, updatedAt: Date.now() } : h)) });
        if (habit?.googleEventId) endRecurringEvent(habit.googleEventId);
        toast(`« ${habit?.name} » archivée`, 'info');
      },
      unarchiveHabit: (id) => set({ habits: get().habits.map((h) => (h.id === id ? { ...h, archived: false, updatedAt: Date.now() } : h)) }),

      deleteHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        set({
          // Habits chained after this one lose their anchor rather than dangling.
          habits: get().habits.filter((h) => h.id !== id).map((h) => (h.after === id ? { ...h, after: null } : h)),
          logs: get().logs.filter((l) => l.habitId !== id),
        });
        if (habit?.googleEventId) deleteCalendarEvent(habit.googleEventId);
      },

      toggleHabit: (habitId, date = todayKey()) => {
        const existing = get().logs.find((l) => l.habitId === habitId && l.date === date);
        const habit = get().habits.find((h) => h.id === habitId);
        // Measured habits: a tick means "target reached" (manual ones only).
        if (habit?.kind === 'quantity') {
          if (habit.source) { toast('Suivi automatique : cette habitude se met à jour toute seule', 'info'); return; }
          get().setHabitValue(habitId, date, existing?.completed ? 0 : habit.target);
          return;
        }
        if (habit?.kind === 'quit') return;
        // Ticking a joker day turns it into a real completion.
        if (existing?.joker && !existing.completed) {
          set({ logs: get().logs.map((l) => (l === existing ? { ...l, joker: false, pause: false, completed: true } : l)) });
          if (habit?.linkedSkill) useSkillStore.getState().awardXP(habit.linkedSkill, habit.xpReward, `habit: ${habit.name}`);
          get().checkBadges();
          return;
        }
        if (existing) {
          const nowCompleted = !existing.completed;
          set({ logs: get().logs.map((l) => (l === existing ? { ...l, completed: nowCompleted } : l)) });
          if (nowCompleted && habit?.linkedSkill) useSkillStore.getState().awardXP(habit.linkedSkill, habit.xpReward, `habit: ${habit.name}`);
          if (!nowCompleted && habit?.linkedSkill) useSkillStore.getState().removeXP(habit.linkedSkill, habit.xpReward, `habit unchecked: ${habit.name}`);
        } else {
          set({ logs: [...get().logs, { habitId, date, completed: true, createdAt: Date.now() }] });
          if (habit?.linkedSkill) useSkillStore.getState().awardXP(habit.linkedSkill, habit.xpReward, `habit: ${habit.name}`);
          if (habit?.healthLink && date === todayKey()) useHealthStore.getState().queueHabitPrompt(habit);
        }
        get().checkBadges();
        get().suggestNext(habitId, date);
      },

      // Habit stacking: once an anchor is done, nudge the habits chained after it.
      suggestNext: (habitId, date = todayKey()) => {
        if (date !== todayKey()) return;
        const done = (id) => get().logs.some((l) => l.habitId === id && l.date === date && l.completed);
        if (!done(habitId)) return;
        const next = get().habits.filter((h) => !h.archived && h.after === habitId && !done(h.id));
        if (next.length) toast(`Enchaînez maintenant : ${next.map((h) => h.name).join(', ')}`, 'info');
      },

      // The REVERSE of the flow above — called FROM healthStore when a
      // health action was logged directly (e.g. the curated program's own
      // cardio/gym-session logger), not via checking a habit. Without this,
      // completing today's prescribed Zone 2 run through the program logger
      // never touched a same-day "Zone-2 Cardio" habit at all — the two
      // systems only knew about each other in the habit→health direction
      // (queueHabitPrompt above), so the habit still read as "not done" and
      // kept prompting for something that, from the user's side, was already
      // logged. Marks every active habit whose healthLink matches `linkType`
      // as completed for that date — no queueHabitPrompt call here, since
      // the health log this is reacting to already exists (nothing to
      // prompt "log it?" about).
      // ── Measured habits ──
      // Writes the day's value and derives completion; XP follows completion.
      // 'atMost' habits (≤ 2 cafés…) only count once the day is over.
      setHabitValue: (habitId, date, value, { auto = false } = {}) => {
        const habit = get().habits.find((h) => h.id === habitId);
        if (!habit) return;
        const v = Math.max(0, Math.round(Number(value) * 100) / 100 || 0);
        const target = Number(habit.target) || 1;
        const completed = habit.direction === 'atMost' ? date < todayKey() && v <= target : v >= target;
        const existing = get().logs.find((l) => l.habitId === habitId && l.date === date);
        if (existing && existing.value === v && !!existing.completed === completed) return;
        const wasDone = !!existing?.completed;
        const entry = { ...(existing || { habitId, date, createdAt: Date.now() }), value: v, completed, auto, joker: existing?.joker && !completed ? existing.joker : false };
        set({ logs: existing ? get().logs.map((l) => (l === existing ? entry : l)) : [...get().logs, entry] });
        if (habit.linkedSkill && completed !== wasDone) {
          if (completed) useSkillStore.getState().awardXP(habit.linkedSkill, habit.xpReward, `habitude : ${habit.name}`);
          else useSkillStore.getState().removeXP(habit.linkedSkill, habit.xpReward, `habitude annulée : ${habit.name}`);
        }
        if (completed && !wasDone) { get().checkBadges(); if (!auto) get().suggestNext(habitId, date); }
      },

      // ── Streak protection ──
      jokersLeft: (habitId, date = todayKey()) => {
        const month = date.slice(0, 7);
        const used = get().logs.filter((l) => l.habitId === habitId && l.joker && !l.pause && l.date.startsWith(month)).length;
        return Math.max(0, (get().habitSettings?.jokersPerMonth ?? 2) - used);
      },
      useJoker: (habitId, date = todayKey()) => {
        if (get().jokersLeft(habitId, date) <= 0) { toast('Plus de joker ce mois-ci pour cette habitude', 'error'); return; }
        const existing = get().logs.find((l) => l.habitId === habitId && l.date === date);
        if (existing?.completed) return;
        const entry = { ...(existing || { habitId, date, createdAt: Date.now() }), joker: true, completed: false };
        set({ logs: existing ? get().logs.map((l) => (l === existing ? entry : l)) : [...get().logs, entry] });
        toast('Joker utilisé : la série est protégée', 'success');
      },
      removeJoker: (habitId, date) =>
        set({ logs: get().logs.map((l) => (l.habitId === habitId && l.date === date ? { ...l, joker: false, pause: false } : l)) }),
      setJokersPerMonth: (n) => set({ habitSettings: { ...(get().habitSettings || {}), jokersPerMonth: Math.max(0, Math.min(10, Number(n) || 0)) } }),

      // Vacation / illness: every covered day is a joker for every habit (not
      // counted against the monthly allowance).
      startPause: ({ from, to, reason = '' }) => {
        if (!from || !to || to < from) return { ok: false, error: 'Dates invalides.' };
        const days = [];
        const d = new Date(from + 'T12:00:00');
        for (let i = 0; i < 92; i++) {
          const k = todayKey(d);
          if (k > to) break;
          days.push(k); d.setDate(d.getDate() + 1);
        }
        const pause = { id: uid(), from, to: days[days.length - 1], reason };
        let logs = [...get().logs];
        for (const h of get().habits.filter((x) => !x.archived && x.kind !== 'quit')) {
          for (const k of days) {
            const i = logs.findIndex((l) => l.habitId === h.id && l.date === k);
            // Keep a joker the user already placed as theirs (pause: false), so ending the pause doesn't remove it.
            if (i >= 0) { if (!logs[i].completed && !logs[i].joker) logs[i] = { ...logs[i], joker: true, pause: true }; }
            else logs.push({ habitId: h.id, date: k, completed: false, joker: true, pause: true, createdAt: Date.now() });
          }
        }
        set({ pauses: [...(get().pauses || []), pause], logs });
        toast(`Pause du ${from} au ${pause.to} : vos séries sont protégées`, 'success');
        return { ok: true };
      },
      // Ends a pause now: keeps past pause days, frees today and the future.
      endPause: (id) => {
        const pause = (get().pauses || []).find((p) => p.id === id);
        if (!pause) return;
        const today = todayKey();
        set({
          logs: get().logs.filter((l) => !(l.pause && l.date >= today && l.date >= pause.from && l.date <= pause.to && !l.completed)),
          // Ends yesterday; a pause that started today disappears entirely.
          pauses: get().pauses.map((p) => (p.id === id ? { ...p, to: todayKey(new Date(Date.now() - 86400000)), ended: true } : p)).filter((p) => p.to >= p.from),
        });
        toast('Pause terminée', 'info');
      },

      // ── Habits to quit ──
      logRelapse: (habitId, date = todayKey()) => {
        set({ habits: get().habits.map((h) => (h.id === habitId ? { ...h, relapses: [...new Set([...(h.relapses || []), date])].sort(), updatedAt: Date.now() } : h)) });
        toast('Noté. Une rechute n’efface pas vos progrès : on repart.', 'info');
      },
      undoRelapse: (habitId, date) =>
        set({ habits: get().habits.map((h) => (h.id === habitId ? { ...h, relapses: (h.relapses || []).filter((d) => d !== date), updatedAt: Date.now() } : h)) }),

      completeLinkedHabits: (linkType, date = todayKey()) => {
        const matches = get().habits.filter((h) => !h.archived && h.healthLink === linkType);
        for (const habit of matches) {
          const existing = get().logs.find((l) => l.habitId === habit.id && l.date === date);
          if (existing?.completed) continue;
          if (existing) {
            set({ logs: get().logs.map((l) => (l === existing ? { ...l, completed: true } : l)) });
          } else {
            set({ logs: [...get().logs, { habitId: habit.id, date, completed: true, createdAt: Date.now() }] });
          }
          if (habit.linkedSkill) useSkillStore.getState().awardXP(habit.linkedSkill, habit.xpReward, `habit auto-completed from program log: ${habit.name}`);
        }
        if (matches.length) get().checkBadges();
      },

      saveEnergyLog: (log) => {
        // One shared daily check-in: Santé's quick form and the detailed one
        // here each save a subset — merge instead of replacing, so saving one
        // never wipes what the other recorded (it used to).
        const others = get().energyLogs.filter((l) => l.date !== log.date);
        const existing = get().energyLogs.find((l) => l.date === log.date) || {};
        const merged = {
          ...existing, ...log,
          naps: existing.naps || [],
          sleepData: { ...(existing.sleepData || {}), ...(log.sleepData || {}) },
          createdAt: existing.createdAt || Date.now(), updatedAt: Date.now(),
        };
        set({ energyLogs: [...others, merged] });
        toast('Check-in enregistré', 'success');
        get().checkBadges();
      },

      // Naps live on the same per-date energyLog entry as night sleep (used
      // by health-chrono.js's computeNapImpact) — creates the day's entry if
      // it doesn't exist yet so a nap can be logged before the main check-in.
      logNap: (date, time, durationMin) => {
        const target = date || todayKey();
        const existing = get().energyLogs.find((l) => l.date === target);
        const nap = { time, durationMin: Number(durationMin) || 0 };
        if (existing) {
          set({ energyLogs: get().energyLogs.map((l) => (l.date === target ? { ...l, naps: [...(l.naps || []), nap] } : l)) });
        } else {
          set({ energyLogs: [...get().energyLogs, { date: target, naps: [nap], createdAt: Date.now() }] });
        }
        toast('Sieste enregistrée', 'success');
      },

      resetAll: () => set({ habits: [], logs: [], energyLogs: [], awardedBadges: [], pauses: [], habitSettings: { jokersPerMonth: 2 } }),
    }),
    { name: 'audax-habits' }
  )
);
