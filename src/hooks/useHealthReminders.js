import { useEffect } from 'react';
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { todayKey } from '../utils/formatters';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MORNING_HOUR = 8;
const WORKOUT_HOUR = 17;

// Local-only reminders: no backend/push, so this only fires while the AUDAX
// tab is open (checked on an interval) — a real push notification would need
// a service worker + server, which this client-only SPA doesn't have.
export function useHealthReminders() {
  useEffect(() => {
    const check = () => {
      const { reminders, workouts, markMorningReminderShown, markWorkoutReminderShown } = useHealthStore.getState();
      if (!reminders.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const now = new Date();
      const today = todayKey();
      const hasMorningLog = useHabitStore.getState().energyLogs.some((l) => l.date === today);
      const hasWorkout = workouts.some((w) => w.date === today);

      if (now.getHours() >= MORNING_HOUR && !hasMorningLog && reminders.lastMorningReminderDate !== today) {
        new Notification('AUDAX Health', { body: "You haven't logged your morning check-in yet." });
        markMorningReminderShown();
      }
      if (now.getHours() >= WORKOUT_HOUR && !hasWorkout && reminders.lastWorkoutReminderDate !== today) {
        new Notification('AUDAX Health', { body: 'No workout logged today yet — even a short session keeps momentum.' });
        markWorkoutReminderShown();
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
