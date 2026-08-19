import { useEffect } from 'react';
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { todayKey } from '../utils/formatters';

const CHECK_INTERVAL_MS = 60 * 1000; // 1 min — tight enough to catch meal/water windows on time
const MORNING_HOUR = 8;
const WORKOUT_HOUR = 17;
const MEAL_WINDOW_MIN = 10; // fire within ±10 min of a scheduled meal time, once

// Tier 1 of the notification scheduler (see program-schedule-generator.js /
// ProgramOnboarding.jsx for where reminderPrefs gets populated): fires while
// the AUDAX tab is open, checked every minute — no backend involved, so this
// is the reliable channel regardless of Vercel Cron plan limits. Tier 2
// (api/reminders-cron.js, best-effort, app-closed) is a separate, coarser
// backstop — see that file's header for why it can't replace this one.
export function useHealthReminders() {
  useEffect(() => {
    const check = () => {
      const state = useHealthStore.getState();
      const { reminders, workouts, healthProfile, markMorningReminderShown, markWorkoutReminderShown, markWaterReminderShown, markMealReminderShown, markBedtimeReminderShown, getChronoSummary } = state;
      if (!reminders.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const now = new Date();
      const today = todayKey();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

      // Water — reuses the chrono module's own gap computation so the
      // reminder and the in-app "dernière eau il y a Xh" display never disagree.
      const prefs = healthProfile.reminderPrefs || {};
      const chrono = getChronoSummary(today);
      const gapMin = prefs.waterReminderGapMin ?? 180;
      const sinceLastWater = reminders.lastWaterReminderAt ? (Date.now() - reminders.lastWaterReminderAt) / 60000 : Infinity;
      if (chrono.hydrationGaps.lastIntakeHoursAgo != null && chrono.hydrationGaps.lastIntakeHoursAgo * 60 > gapMin && sinceLastWater > gapMin) {
        new Notification('AUDAX Health', { body: `Aucune eau depuis ${chrono.hydrationGaps.lastIntakeHoursAgo}h — pense à boire.` });
        markWaterReminderShown();
      }

      // Meals — reminderPrefs.mealWindows holds the onboarding-generated daily
      // meal times (e.g. ['07:30','12:20','17:10','22:00']); fires once per
      // (date, mealIndex) via lastMealReminderKey.
      (prefs.mealWindows || []).forEach((time, i) => {
        const key = `${today}-${i}`;
        if (reminders.lastMealReminderKey === key) return;
        const [h, m] = time.split(':').map(Number);
        const target = h * 60 + m;
        if (Math.abs(nowMinutes - target) <= MEAL_WINDOW_MIN) {
          new Notification('AUDAX Health', { body: `C'est l'heure prévue pour ton repas (${time}).` });
          markMealReminderShown(key);
        }
      });

      // Bedtime — once/day, within the same tight window as meals.
      if (prefs.bedtimeTarget && reminders.lastBedtimeReminderDate !== today) {
        const [h, m] = prefs.bedtimeTarget.split(':').map(Number);
        const target = h * 60 + m;
        if (Math.abs(nowMinutes - target) <= MEAL_WINDOW_MIN) {
          new Notification('AUDAX Health', { body: `Heure de coucher visée (${prefs.bedtimeTarget}) — la régularité du sommeil compte autant que sa durée.` });
          markBedtimeReminderShown();
        }
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
