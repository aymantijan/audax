// « Ma semaine » (chantier 5, J3): everything of a week, day by day — classes,
// habits due, evaluations, due payments, sport done. Read-only gathering of
// what the other sections already hold. Pure: tests/week-view.test.mjs.
import { classesOn } from './attendance.js';
import { isHabitShownOn } from './calculations.js';
import { echeanceOccurrences } from './accounting-engine.js';

export const addDaysKey = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function mondayOf(key) { const dow = new Date(`${key}T12:00:00`).getDay(); return addDaysKey(key, dow === 0 ? -6 : 1 - dow); }

export function buildWeek({ monday, courses = [], academic = null, habits = [], logs = [], echeances = [], workouts = [] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
  const sunday = days[6];
  const dues = [];
  for (const e of echeances) {
    if (!e.active) continue;
    for (const date of echeanceOccurrences(e, monday, sunday)) dues.push({ id: `${e.id}|${date}`, date, label: e.label, amount: e.amount, type: e.type });
  }
  return days.map((key) => ({
    key,
    classes: classesOn(courses, academic, key).sort((a, b) => a.start.localeCompare(b.start)),
    habits: habits
      .filter((h) => !h.archived && h.kind !== 'quit' && isHabitShownOn(h, logs, key) && (!h.startDate || h.startDate <= key))
      .map((h) => ({ habit: h, done: logs.some((l) => l.habitId === h.id && l.date === key && l.completed) })),
    exams: courses.flatMap((c) => (c.status === 'dropped' ? [] : (c.evaluations || []).filter((ev) => ev.date === key).map((ev) => ({ course: c, ev })))),
    dues: dues.filter((d) => d.date === key),
    workouts: workouts.filter((w) => w.date === key),
  }));
}
