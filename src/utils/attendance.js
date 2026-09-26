/**
 * Class attendance — every weekly slot of a subject becomes a dated class
 * ("occurrence"); the student checks in when they are in the room. Checking in
 * at least `arriveBeforeMin` minutes before the start counts as on time.
 * Pure functions, no store access (records live in learningStore.attendance).
 *
 * A subject can stop before the end of the semester: `course.endRule`
 *   'midterms' → last class the day before the term's `midtermsDate` (runs on
 *                while that date is unknown, flagged so the UI can ask for it)
 *   'date'     → last class on `course.endDate` (inclusive)
 */
import { isAcademic, DEFAULT_ACADEMIC_SETTINGS } from './academic';

const OPEN_BEFORE_MIN = 60; // the check-in button appears 1 h before the class

export const ATTENDANCE_STATUS = {
  on_time: { label: 'À l’heure', tone: 'var(--success)', present: true },
  late: { label: 'En retard', tone: 'var(--warning)', present: true },
  forgot: { label: 'Présent (pointé après)', tone: 'var(--warning)', present: true },
  absent: { label: 'Absent', tone: 'var(--error)', present: false },
  excused: { label: 'Absence justifiée', tone: 'var(--text-secondary)', neutral: true },
  cancelled: { label: 'Cours annulé', tone: 'var(--text-secondary)', neutral: true },
};

// Corrections offered on a class once it has ended (no retroactive "on time").
export const PAST_CORRECTIONS = ['forgot', 'excused', 'cancelled', 'absent'];

const pad = (n) => String(n).padStart(2, '0');
export const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return dateKeyOf(d); };
const at = (date, hhmm) => new Date(`${date}T${hhmm || '00:00'}:00`).getTime();

// Settings with defaults filled in: cloud sync can replace `academic.settings`
// with an older copy that predates the attendance keys.
export const withDefaults = (settings) => ({ ...DEFAULT_ACADEMIC_SETTINGS, ...(settings || {}) });

export const occurrenceKey = (courseId, slotId, date) => `${courseId}|${slotId}|${date}`;

/** When a subject stops: { rule, date, pending } (date = first day WITHOUT class). */
export function courseEnd(course, term) {
  if (course.endRule === 'midterms') return { rule: 'midterms', date: term?.midtermsDate || null, pending: !term?.midtermsDate };
  if (course.endRule === 'date' && course.endDate) return { rule: 'date', date: addDays(course.endDate, 1), pending: false };
  return { rule: 'none', date: null, pending: false };
}

export function courseRunsOn(course, term, date) {
  if (term?.startDate && date < term.startDate) return false;
  if (term?.endDate && date > term.endDate) return false;
  const end = courseEnd(course, term);
  return !(end.date && date >= end.date);
}

const inScope = (c, settings) => c.status === 'active' && !(isAcademic(c) && settings.activeTermId && c.termId && c.termId !== settings.activeTermId);

/** Dated classes of `date`, sorted by start time. */
export function classesOn(courses, academic, date, { courseId } = {}) {
  const settings = academic?.settings || {};
  const dow = new Date(`${date}T12:00:00`).getDay();
  const out = [];
  for (const c of courses) {
    if (courseId ? c.id !== courseId : !inScope(c, settings)) continue;
    const term = (academic?.terms || []).find((t) => t.id === c.termId);
    if (!courseRunsOn(c, term, date)) continue;
    for (const s of c.slots || []) {
      if (Number(s.day) !== dow || !s.start || !s.end) continue;
      out.push({ key: occurrenceKey(c.id, s.id, date), date, course: c, slot: s, start: s.start, end: s.end, startMs: at(date, s.start), endMs: at(date, s.end) });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** 'upcoming' | 'open' (check-in possible) | a recorded status | 'absent' once over. */
export function occurrenceState(occ, records, nowMs = Date.now()) {
  const rec = records?.[occ.key];
  if (rec) return rec.status;
  if (nowMs < occ.startMs - OPEN_BEFORE_MIN * 60000) return 'upcoming';
  if (nowMs < occ.endMs) return 'open';
  return 'absent';
}

export const arriveBy = (occ, settings) => occ.startMs - (Number(withDefaults(settings).arriveBeforeMin) || 0) * 60000;
export const checkInStatus = (occ, settings, nowMs = Date.now()) => (nowMs <= arriveBy(occ, settings) ? 'on_time' : 'late');
export const fmtClock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/**
 * Daily score for the attendance habit: % of the day's classes attended on
 * time (cancelled/excused ones don't count). Rises through the day; 100 when
 * there is nothing to attend.
 */
export function dayAttendance(courses, academic, records, date) {
  const occ = classesOn(courses, academic, date);
  let required = 0; let onTime = 0;
  for (const o of occ) {
    const st = records?.[o.key]?.status;
    if (st && ATTENDANCE_STATUS[st]?.neutral) continue;
    required += 1;
    if (st === 'on_time') onTime += 1;
  }
  return { required, onTime, pct: required ? Math.round((onTime / required) * 100) : 100, classes: occ.length };
}

/** Attendance record of one subject since the start of its semester. */
export function courseAttendance(course, academic, records, now = new Date()) {
  const term = (academic?.terms || []).find((t) => t.id === course.termId);
  const today = dateKeyOf(now);
  const nowMs = now.getTime();
  let day = term?.startDate || (course.createdAt ? dateKeyOf(new Date(course.createdAt)) : today);
  const counts = { on_time: 0, late: 0, forgot: 0, absent: 0, excused: 0, cancelled: 0 };
  const history = [];
  for (let guard = 0; guard < 400 && day <= today; guard++, day = addDays(day, 1)) {
    for (const o of classesOn([course], academic, day, { courseId: course.id })) {
      const st = occurrenceState(o, records, nowMs);
      if (st === 'upcoming' || st === 'open') continue;
      counts[st] = (counts[st] || 0) + 1;
      history.push({ ...o, status: st });
    }
  }
  const required = counts.on_time + counts.late + counts.forgot + counts.absent;
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const st = history[i].status;
    if (ATTENDANCE_STATUS[st]?.neutral) continue;
    if (st !== 'on_time') break;
    streak += 1;
  }
  return {
    counts, required, history, streak,
    onTimeRate: required ? counts.on_time / required : null,
    presenceRate: required ? (counts.on_time + counts.late + counts.forgot) / required : null,
  };
}

/** Weekdays (mon…sun codes used by habits) on which the active timetable has classes. */
const WEEKDAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function classWeekdays(courses, academic) {
  const settings = academic?.settings || {};
  const days = new Set();
  for (const c of courses) if (inScope(c, settings)) for (const s of c.slots || []) days.add(WEEKDAY_CODES[Number(s.day)]);
  return WEEKDAY_CODES.filter((d) => days.has(d));
}
