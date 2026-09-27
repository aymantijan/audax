/**
 * Weekly review (bilan du dimanche): what happened Monday→Sunday for the
 * active semester — attendance, study time vs target, class notes, flashcard
 * reviews. Pure; the saved snapshots live in learningStore.weeklyReviews.
 */
import { classesOn, occurrenceState, ATTENDANCE_STATUS } from './attendance.js';
import { isAcademic } from './academic.js';

const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function mondayOf(key) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekStats({ courses, academic, attendance, classNotes, sessions, reviewLog, settings, weekStart, nowMs = Date.now() }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const end = days[6];
  const subjects = courses.filter((c) => isAcademic(c) && c.status === 'active' && (!settings.activeTermId || c.termId === settings.activeTermId));
  const coefSum = subjects.reduce((s, c) => s + (Number(c.coefficient) || 1), 0) || 1;
  const target = (Number(settings.weeklyStudyTarget) || 0) * 60;
  const by = Object.fromEntries(subjects.map((c) => [c.id, { course: c, required: 0, onTime: 0, late: 0, absent: 0, minutes: 0, expected: Math.round(((Number(c.coefficient) || 1) / coefSum) * target), notes: 0 }]));
  const totals = { required: 0, onTime: 0, late: 0, absent: 0 };

  for (const d of days) {
    for (const o of classesOn(courses, academic, d)) {
      const st = occurrenceState(o, attendance, nowMs);
      if (st === 'upcoming' || st === 'open' || ATTENDANCE_STATUS[st]?.neutral) continue;
      const row = by[o.course.id];
      totals.required += 1;
      if (row) row.required += 1;
      const k = st === 'on_time' ? 'onTime' : st === 'absent' ? 'absent' : 'late';
      totals[k] += 1;
      if (row) row[k] += 1;
    }
  }
  let minutes = 0;
  for (const s of sessions) {
    if (s.date < weekStart || s.date > end) continue;
    if (!(s.courseId || s.domain === 'Learning')) continue;
    minutes += s.durationMinutes || 0;
    if (by[s.courseId]) by[s.courseId].minutes += s.durationMinutes || 0;
  }
  let notes = 0;
  for (const n of Object.values(classNotes || {})) {
    if (n.date < weekStart || n.date > end) continue;
    notes += 1;
    if (by[n.courseId]) by[n.courseId].notes += 1;
  }
  const reviews = (reviewLog || []).filter((e) => e.d >= weekStart && e.d <= end).length;
  return { weekStart, end, totals, subjects: Object.values(by), minutes: Math.round(minutes), target, notes, reviews };
}
