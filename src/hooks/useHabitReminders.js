import { useEffect } from 'react';
import { useHabitStore } from '../store/habitStore';
import { isHabitShownOn } from '../utils/calculations';
import { todayKey } from '../utils/formatters';
import { toast } from '../store/uiStore';

const CHECK_INTERVAL_MS = 60 * 1000;
const WINDOW_MIN = 180; // a reminder still fires up to 3 h after its time (app opened late)

const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

/**
 * Habit reminders at each habit's `reminderTime`. Local-only, like the other
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
        if (st.habitReminders.lastShown?.[h.id] === today) continue;
        const t = minutesOf(h.reminderTime);
        if (nowMin < t || nowMin > t + WINDOW_MIN) continue;
        if (!isHabitShownOn(h, st.logs, today)) continue;
        const log = st.logs.find((l) => l.habitId === h.id && l.date === today);
        if (log?.completed || log?.joker) continue;
        const body = `C’est l’heure : ${h.name}${h.duration ? ` (${h.duration} min)` : ''}`;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('AUDAX · Habitudes', { body, tag: `habit-${h.id}` });
        else toast(`⏰ ${body}`, 'info');
        st.markHabitReminderShown(h.id, today);
      }
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
