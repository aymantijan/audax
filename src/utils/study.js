/**
 * Study-time analytics + daily priorities for the Apprentissage "Aujourd'hui"
 * view. Pure functions over learning courses + focus sessions.
 */
import { isAcademic, requiredGrade, normGrade, daysUntil, fmtGrade } from './academic';
import { calculateCourseProgress } from './course-progress';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

// Monday of the week containing `today`.
export function weekStart(today) {
  const d = new Date(today + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return iso(d);
}

export const studySessions = (sessions) => sessions.filter((s) => s.courseId || s.domain === 'Learning');

export function minutesBetween(sessions, from, to, courseId) {
  return sessions
    .filter((s) => s.date >= from && s.date <= to && (courseId ? s.courseId === courseId : true))
    .reduce((a, s) => a + (s.durationMinutes || 0), 0);
}

export function minutesByCourse(sessions, from, to) {
  const out = {};
  for (const s of sessions) {
    if (!s.courseId || s.date < from || s.date > to) continue;
    out[s.courseId] = (out[s.courseId] || 0) + (s.durationMinutes || 0);
  }
  return out;
}

// Last `n` days (oldest first) with study minutes, for the mini bar chart.
export function dailySeries(sessions, today, n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return { date, minutes: minutesBetween(sessions, date, date) };
  });
}

// Consecutive days (ending today, or yesterday if nothing yet today) with study.
export function studyStreak(sessions, today) {
  const days = new Set(sessions.map((s) => s.date));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) { n += 1; d = addDays(d, -1); }
  return n;
}

export const fmtMinutes = (m) => {
  if (!m) return '0 min';
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h} h${r ? ` ${String(r).padStart(2, '0')}` : ''}` : `${r} min`;
};

function nextOpenEval(course, today, settings) {
  return (course.evaluations || [])
    .filter((e) => e.date && e.date >= today && normGrade(e, settings) == null)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function nextTaskOf(course) {
  for (const ch of course.chapters || []) {
    const it = (ch.checklistItems || []).find((x) => !x.completed);
    if (it) return { chapter: ch, item: it };
  }
  return null;
}

/**
 * Ranks active courses by what deserves study time today:
 *  - an evaluation coming up (strongest signal inside 3 weeks)
 *  - a high grade still needed to validate / reach the target
 *  - studied less this week than its coefficient share of the weekly target
 *  - programme far behind while an exam approaches
 * Returns [{ course, score, reasons[], exam, days, weekMin, expectedMin }].
 */
export function studyPriorities({ courses, sessions, settings, today }) {
  const active = courses.filter((c) => c.status === 'active' && (!isAcademic(c) || !settings.activeTermId || !c.termId || c.termId === settings.activeTermId));
  if (!active.length) return [];
  const from = weekStart(today);
  const weekMin = minutesByCourse(sessions, from, today);
  const acad = active.filter(isAcademic);
  const coefSum = acad.reduce((s, c) => s + (Number(c.coefficient) || 1), 0) || 1;
  const targetMin = (Number(settings.weeklyStudyTarget) || 0) * 60;
  // Share of the week already elapsed (Mon = 1/7 … Sun = 7/7) so the
  // "under-studied" signal is fair early in the week.
  const weekFrac = (daysUntil(today, from) + 1) / 7;

  return active.map((c) => {
    let score = 0;
    const reasons = [];
    const exam = isAcademic(c) ? nextOpenEval(c, today, settings) : null;
    const days = exam ? daysUntil(exam.date, today) : null;
    if (exam && days <= 21) {
      score += ((21 - days) / 21) * 50 + 5;
      reasons.push(days === 0 ? `${exam.name || 'Évaluation'} aujourd'hui` : `${exam.name || 'Évaluation'} dans ${days} j`);
    }
    if (isAcademic(c)) {
      const target = c.targetGrade ?? settings.passMark;
      const req = requiredGrade(c, target, settings);
      if (req?.status === 'possible' && req.needed > settings.passMark) {
        score += Math.min(1, (req.needed - settings.passMark) / Math.max(1, settings.scale - settings.passMark)) * 25;
        reasons.push(`il faut ${fmtGrade(req.needed)}/${settings.scale}`);
      } else if (req?.status === 'impossible') {
        score += 8;
      }
    }
    const expected = isAcademic(c) && targetMin ? ((Number(c.coefficient) || 1) / coefSum) * targetMin : 0;
    const studied = weekMin[c.id] || 0;
    if (expected) {
      const due = expected * weekFrac;
      if (studied < due) {
        score += Math.min(1, (due - studied) / Math.max(30, due)) * 20;
        reasons.push(studied ? `${fmtMinutes(studied)} cette semaine (visé ≈ ${fmtMinutes(Math.round(due))})` : 'pas encore étudiée cette semaine');
      }
    } else if (!isAcademic(c) && !studied) {
      score += 6;
      reasons.push('pas de session cette semaine');
    }
    const progress = calculateCourseProgress(c);
    if (c.chapters?.length && exam && days <= 21 && progress < 70) {
      score += ((70 - progress) / 70) * 10;
      reasons.push(`programme à ${progress}%`);
    }
    return { course: c, score: Math.round(score), reasons, exam, days, weekMin: studied, expectedMin: Math.round(expected) };
  }).sort((a, b) => b.score - a.score);
}

// Today's classes from the weekly timetable, with their live state.
export function todaysClasses(courses, settings, now = new Date()) {
  const dow = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const out = [];
  for (const c of courses) {
    if (c.status !== 'active') continue;
    if (isAcademic(c) && settings.activeTermId && c.termId && c.termId !== settings.activeTermId) continue;
    for (const s of c.slots || []) {
      if (Number(s.day) !== dow) continue;
      const a = toMin(s.start); const b = toMin(s.end);
      out.push({ ...s, course: c, state: mins >= b ? 'done' : mins >= a ? 'now' : 'next' });
    }
  }
  return out.sort((x, y) => toMin(x.start) - toMin(y.start));
}
