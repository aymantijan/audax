import { useEffect } from 'react';
import { useLearningStore } from '../store/learningStore';
import { classesOn, arriveBy, fmtClock, dateKeyOf, withDefaults, ATTENDANCE_STATUS } from '../utils/attendance';
import { toast } from '../store/uiStore';
import { getPushSubscription } from '../services/push';

const CHECK_INTERVAL_MS = 30 * 1000;
const SHOWN_KEY = 'audax-class-reminders';

// Which reminders already fired today (per device; lost storage = at worst a repeat).
function readShown(today) {
  try {
    const v = JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}');
    return v.date === today ? v : { date: today, keys: [] };
  } catch { return { date: today, keys: [] }; }
}
function markShown(state, key) {
  state.keys.push(key);
  try { localStorage.setItem(SHOWN_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

// With a push subscription the server (api/class-reminders.js) already sends the
// system notification — in-app we only toast when AUDAX is on screen.
let pushActive = false;

function notify(body, tag) {
  if (pushActive) { if (document.visibilityState === 'visible') toast(`🎓 ${body}`, 'info'); return; }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const n = new Notification('AUDAX · Cours', { body, tag });
    n.onclick = () => { window.focus(); n.close(); };
  } else toast(`🎓 ${body}`, 'info');
}

/**
 * Class reminders (local only, like the other alert hooks — AUDAX must be open):
 *  1. `classReminderMin` before the start: where and when to be in the room;
 *  2. 5 min before the "on time" deadline, if not checked in yet.
 * Nothing fires for classes already checked in, cancelled or excused.
 */
export function useClassReminders() {
  useEffect(() => {
    getPushSubscription().then((s) => { pushActive = !!s; }).catch(() => {});
    // The server evaluates class times in the user's timezone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const st = useLearningStore.getState();
    if (tz && st.academic.settings.timezone !== tz) st.updateAcademicSettings({ timezone: tz });
    const check = () => {
      const { courses, academic, attendance, classNotes } = useLearningStore.getState();
      const lead = Number(withDefaults(academic.settings).classReminderMin);
      if (!lead) return;
      const now = Date.now();
      const today = dateKeyOf(new Date(now));
      const shown = readShown(today);
      for (const o of classesOn(courses, academic, today)) {
        const rec = attendance[o.key];
        if (rec && ATTENDANCE_STATUS[rec.status]?.present && !classNotes?.[o.key] && now >= o.endMs && now < o.endMs + 30 * 60000 && !shown.keys.includes(`${o.key}|notes`)) {
          notify(`Tu sors de ${o.course.name} : 2 min pour noter 3 idées clés.`, `notes-${o.key}`);
          markShown(shown, `${o.key}|notes`);
        }
        if (rec || now >= o.endMs) continue;
        const deadline = arriveBy(o, academic.settings);
        const where = o.slot.room ? ` · ${o.slot.room}` : '';
        if (now >= o.startMs - lead * 60000 && now < deadline - 5 * 60000 && !shown.keys.includes(`${o.key}|heads`)) {
          notify(`${o.course.name} à ${o.start}${where} — en salle avant ${fmtClock(deadline)}.`, `class-${o.key}`);
          markShown(shown, `${o.key}|heads`);
        } else if (now >= deadline - 5 * 60000 && now < deadline && !shown.keys.includes(`${o.key}|checkin`)) {
          notify(`Tu es en salle ? Pointe « En salle » pour ${o.course.name} avant ${fmtClock(deadline)}.`, `class-${o.key}`);
          markShown(shown, `${o.key}|checkin`);
        }
      }
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
