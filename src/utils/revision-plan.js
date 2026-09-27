/**
 * Revision plan — built backwards from every dated, ungraded evaluation.
 * Pure and deterministic (nothing stored): it is recomputed from the subjects,
 * the forecast and the study sessions, and a session counts as done once
 * enough study time was logged on that subject that day.
 *
 * Volume of an evaluation: 60 min per 10 % of weight, × subject coefficient
 * (relative to the semester mean), × urgency from the forecast (below the
 * subject pass mark + 1 → ×1.5, comfortably above → ×0.8), capped at 10 h.
 * Spread over spaced days before it (J-14, J-10, J-7, J-4, J-2, J-1 — those
 * still ahead), with the content moving from re-reading to exercises to a
 * last flash review.
 */
import { isAcademic, normGrade, subjectPass, evalTypeLabel } from './academic.js';

const OFFSETS = [14, 10, 7, 4, 2, 1];
const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const round5 = (m) => Math.max(25, Math.round(m / 5) * 5);

function contentFor(i, n) {
  if (i === n - 1) return 'Révision éclair : fiches + points clés';
  if (i >= n - 3) return 'Exercices / annales, chronométrés';
  return 'Relire le cours et le journal, faire les fiches';
}

/**
 * @returns [{ id, date, course, ev, minutes, content, daysBefore }] sorted by date.
 * `forecasts` (optional): { courseId: forecastSubject(...) } to scale the effort.
 */
export function revisionPlan({ courses, settings, today, forecasts = {}, horizonDays = 21 }) {
  const acad = courses.filter((c) => isAcademic(c) && c.status === 'active' && (!settings.activeTermId || c.termId === settings.activeTermId));
  const coefMean = acad.length ? acad.reduce((s, c) => s + (Number(c.coefficient) || 1), 0) / acad.length : 1;
  const pass = subjectPass(settings);
  const limit = addDays(today, horizonDays);
  const out = [];
  for (const c of acad) {
    for (const ev of c.evaluations || []) {
      if (!ev.date || ev.date <= today || ev.date > addDays(limit, 14) || normGrade(ev, settings) != null) continue;
      const w = Number(ev.weight) || 0;
      if (!w) continue;
      const est = forecasts[c.id]?.evals?.find((x) => x.ev.id === ev.id)?.estimate ?? forecasts[c.id]?.average ?? null;
      const urgency = est == null ? 1 : est < pass + 1 ? 1.5 : est >= 14 * (settings.scale / 20) ? 0.8 : 1;
      const total = Math.min(600, 60 * (w / 10) * ((Number(c.coefficient) || 1) / coefMean) * urgency);
      const days = OFFSETS.map((o) => ({ o, date: addDays(ev.date, -o) })).filter((x) => x.date >= today);
      if (!days.length) continue;
      const per = round5(total / days.length);
      days.forEach((d, i) => {
        if (d.date > limit) return;
        out.push({
          id: `${c.id}|${ev.id}|${d.date}`, date: d.date, course: c, ev, minutes: per, daysBefore: d.o,
          content: contentFor(i, days.length), label: ev.name || evalTypeLabel(ev.type),
        });
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || b.minutes - a.minutes);
}

/** Minutes studied per `courseId|date` — to tick plan items as done. */
export function studiedByCourseDay(sessions) {
  const m = {};
  for (const s of sessions) if (s.courseId) m[`${s.courseId}|${s.date}`] = (m[`${s.courseId}|${s.date}`] || 0) + (s.durationMinutes || 0);
  return m;
}
