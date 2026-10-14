import { useEffect } from 'react';
import { useHabitStore } from '../store/habitStore';
import { isHabitShownOn } from '../utils/calculations';
import { todayKey } from '../utils/formatters';
import { toast } from '../store/uiStore';

const CHECK_INTERVAL_MS = 60 * 1000;
const WINDOW_MIN = 180; // a reminder still fires up to 3 h after its time (app opened late)

const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

/**
 * Habit reminders at each habit's `reminderTime` and `extraReminders`. Local-only, like the other
 * alert hooks: fires while AUDAX is open (tab or installed PWA). Uses a
 * browser notification when allowed, otherwise an in-app toast. One per
 * habit per day; skipped once the habit is done or covered by a joker.
 */
export function useHabitReminders() {
  useEffect(() => {
    const check = () => {
      const st = useHabitStore.getState();
      if (!st.habitReminders?.enabled) return;
      const today = todayKey();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const h of st.habits) {
        if (h.archived || !h.reminderTime || h.kind === 'quit') continue;
        if (!isHabitShownOn(h, st.logs, today)) continue;
        const log = st.logs.find((l) => l.habitId === h.id && l.date === today);
        if (log?.completed || log?.joker) continue;
        // Several times a day (H3): each time fires once; when the app opens
        // late only the latest due time shows, never a burst of old ones.
        const times = [h.reminderTime, ...(h.extraReminders || [])].filter(Boolean).sort();
        const due = times.filter((t) => nowMin >= minutesOf(t) && nowMin <= minutesOf(t) + WINDOW_MIN).pop();
        if (!due) continue;
        const key = times.length > 1 ? `${h.id}|${due}` : h.id;
        if (st.habitReminders.lastShown?.[key] === today) continue;
        const body = `C’est l’heure : ${h.name}${h.duration ? ` (${h.duration} min)` : ''}`;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('VAUDAX · Habitudes', { body, tag: `habit-${key}` });
        else toast(`⏰ ${body}`, 'info');
        st.markHabitReminderShown(key, today);
      }
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
