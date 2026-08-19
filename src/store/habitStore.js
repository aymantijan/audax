import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { useHealthStore } from './healthStore';
import { toast } from './uiStore';
import { endRecurringEvent, deleteCalendarEvent } from '../services/google-calendar';

export const useHabitStore = create(
  persist(
    (set, get) => ({
      habits: [],
      logs: [], // { habitId, date: 'YYYY-MM-DD', completed, createdAt }
      energyLogs: [], // one per date, keyed by log.date

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
      },

      saveEnergyLog: (log) => {
        const others = get().energyLogs.filter((l) => l.date !== log.date);
        const existing = get().energyLogs.find((l) => l.date === log.date);
        set({ energyLogs: [...others, { naps: existing?.naps || [], ...log, createdAt: Date.now() }] });
        toast('Energy check-in saved', 'success');
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

      resetAll: () => set({ habits: [], logs: [], energyLogs: [] }),
    }),
    { name: 'audax-habits' }
  )
);
