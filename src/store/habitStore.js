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
  { id: 'first-habit', name: 'First Habit', tier: 'bronze', check: (s) => s.habits.length >= 1 },
  { id: 'getting-started', name: 'Getting Started', tier: 'bronze', check: (s) => s.logs.filter((l) => l.completed).length >= 10 },
  { id: 'habit-architect', name: 'Habit Architect', tier: 'silver', check: (s) => s.habits.filter((h) => !h.archived).length >= 5 },
  { id: 'habit-builder', name: 'Habit Builder', tier: 'silver', check: (s) => s.logs.filter((l) => l.completed).length >= 50 },
  { id: 'category-explorer', name: 'Category Explorer', tier: 'silver', check: (s) => {
      const doneIds = new Set(s.logs.filter((l) => l.completed).map((l) => l.habitId));
      return new Set(s.habits.filter((h) => doneIds.has(h.id)).map((h) => h.category)).size >= 4;
    } },
  { id: 'energy-tracker', name: 'Energy Tracker', tier: 'silver', check: (s) => s.energyLogs.length >= 30 },
  { id: 'habit-master', name: 'Habit Master', tier: 'gold', check: (s) => s.logs.filter((l) => l.completed).length >= 200 },
  { id: 'all-rounder', name: 'All-Rounder', tier: 'gold', check: (s) => {
      const doneIds = new Set(s.logs.filter((l) => l.completed).map((l) => l.habitId));
      return new Set(s.habits.filter((h) => doneIds.has(h.id)).map((h) => h.category)).size >= HABIT_CATEGORIES.length;
    } },
  { id: 'perfect-day', name: 'Perfect Day', tier: 'gold', check: (s) => {
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
          archived: false,
          startDate: todayKey(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ habits: [...get().habits, habit] });
        toast(`Habit added: ${habit.name}`, 'success');
        get().checkBadges();
      },

      editHabit: (id, updates) =>
        set({
          habits: get().habits.map((h) =>
            h.id === id ? { ...h, ...updates, xpReward: Number(updates.xpReward ?? h.xpReward), updatedAt: Date.now() } : h
          ),
        }),

      archiveHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        set({ habits: get().habits.map((h) => (h.id === id ? { ...h, archived: true, updatedAt: Date.now() } : h)) });
        if (habit?.googleEventId) endRecurringEvent(habit.googleEventId);
      },

      deleteHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        set({
          habits: get().habits.filter((h) => h.id !== id),
          logs: get().logs.filter((l) => l.habitId !== id),
        });
        if (habit?.googleEventId) deleteCalendarEvent(habit.googleEventId);
      },

      toggleHabit: (habitId, date = todayKey()) => {
        const existing = get().logs.find((l) => l.habitId === habitId && l.date === date);
        const habit = get().habits.find((h) => h.id === habitId);
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
      },

      saveEnergyLog: (log) => {
        const others = get().energyLogs.filter((l) => l.date !== log.date);
        const existing = get().energyLogs.find((l) => l.date === log.date);
        set({ energyLogs: [...others, { naps: existing?.naps || [], ...log, createdAt: Date.now() }] });
        toast('Energy check-in saved', 'success');
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

      resetAll: () => set({ habits: [], logs: [], energyLogs: [], awardedBadges: [] }),
    }),
    { name: 'audax-habits' }
  )
);
