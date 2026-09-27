/**
 * Grade forecast — an explainable estimate of every evaluation not graded yet.
 * Pure functions, no store access.
 *
 * Signals per subject (each 0..1, null when there is not enough data):
 *   A  assiduité    classes attended (on time 1, late 0.75) — utils/attendance
 *   S  study time   minutes on the subject vs its coefficient share of the
 *                   weekly study target, since the semester started
 *   F  flashcards   recall rate of the subject's deck (last 30 days, ≥ 10 reviews)
 *   P  programme    checklist progress vs the share of the semester elapsed
 *
 * Estimate of an evaluation:
 *   behaviour B  — TASS (travail & assiduité): 0.25 + 0.55·A + 0.20·E
 *                  others (CC, CF, examen…):   0.35 + 0.50·E
 *                  where E = weighted mean of S, F, P (the work put in),
 *                  scaled to the grading scale and shifted by a calibration
 *                  learned from the user's real grades of the same type;
 *   grades G     — the subject's own grades so far, else the user's grades of
 *                  that type (or family: TASS vs exams) this semester;
 *   estimate     = 0.6·G + 0.4·B with the subject's own grades, 0.4·G + 0.6·B
 *                  with other subjects' grades, or whichever exists.
 * These weights are a starting heuristic, not a law: the UI always shows the
 * drivers, and calibration corrects the bias as real grades arrive.
 */
import { isAcademic, normGrade, subjectResult, termResult } from './academic';
import { courseAttendance } from './attendance';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY);
const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const mean = (rows) => { const w = rows.reduce((s, r) => s + r.w, 0); return w ? rows.reduce((s, r) => s + r.v * r.w, 0) / w : null; };

export const isTassType = (t) => t === 'tass' || t === 'participation';

function signals(course, ctx) {
  const { academic, today, sessions, decks, cards, reviewLog, termCourses } = ctx;
  const settings = ctx.settings;
  const term = academic.terms.find((t) => t.id === course.termId);
  const start = term?.startDate || null;
  const elapsed = start ? daysBetween(start, today) + 1 : null;
  const out = { A: null, S: null, F: null, P: null, info: {} };

  // A — attendance
  const att = courseAttendance(course, academic, ctx.attendance, ctx.now);
  if (att.required) {
    out.A = clamp01((att.counts.on_time + 0.75 * (att.counts.late + att.counts.forgot)) / att.required);
    out.info.A = { rate: out.A, classes: att.required, absences: att.counts.absent };
  }

  // S — study time since the start of the semester (from day 3, so day 1 isn't judged)
  const target = (Number(settings.weeklyStudyTarget) || 0) * 60;
  if (start && elapsed >= 3 && target) {
    const coefSum = termCourses.reduce((s, c) => s + (Number(c.coefficient) || 1), 0) || 1;
    const expected = ((Number(course.coefficient) || 1) / coefSum) * target * (elapsed / 7);
    const studied = sessions.filter((s) => s.courseId === course.id && s.date >= start && s.date <= today).reduce((a, s) => a + (s.durationMinutes || 0), 0);
    out.S = clamp01(studied / Math.max(1, expected) / 1.1); // 110 % of the target = full marks
    out.info.S = { studied: Math.round(studied), expected: Math.round(expected) };
  }

  // F — flashcard recall on the subject's decks
  const deckIds = new Set(decks.filter((d) => d.courseId === course.id).map((d) => d.id));
  if (deckIds.size) {
    const cardIds = new Set(cards.filter((c) => deckIds.has(c.deckId)).map((c) => c.id));
    const from = addDays(today, -30);
    const rel = reviewLog.filter((e) => e.d >= from && cardIds.has(e.c) && (e.s ? e.s === 'review' : !e.n));
    if (rel.length >= 10) {
      out.F = rel.filter((e) => e.r > 1).length / rel.length;
      out.info.F = { recall: out.F, reviews: rel.length };
    }
  }

  // P — programme progress vs time
  const items = (course.chapters || []).flatMap((ch) => ch.checklistItems || []);
  if (items.length && start && term?.endDate) {
    const frac = clamp01(elapsed / Math.max(1, daysBetween(start, term.endDate) + 1));
    const done = items.filter((i) => i.completed).length / items.length;
    out.P = clamp01(done / Math.max(0.1, frac));
    out.info.P = { done, frac };
  }

  const effortParts = [[out.S, 0.45], [out.F, 0.3], [out.P, 0.25]].filter(([v]) => v != null);
  out.E = effortParts.length ? mean(effortParts.map(([v, w]) => ({ v, w }))) : null;
  return out;
}

function behaviour(type, sig, scale, calib) {
  let b = null;
  if (isTassType(type)) {
    const parts = [[sig.A, 0.55], [sig.E, 0.2]].filter(([v]) => v != null);
    if (!parts.length) return null;
    const w = parts.reduce((s, [, x]) => s + x, 0);
    b = 0.25 + (parts.reduce((s, [v, x]) => s + v * x, 0) / w) * 0.75;
  } else {
    if (sig.E == null) return null;
    b = 0.35 + 0.5 * sig.E;
  }
  return Math.max(0, Math.min(scale, b * scale + (calib[isTassType(type) ? 'tass' : 'exam'] || 0)));
}

/** Everything a forecast needs, computed once per render. */
export function buildForecastContext({ courses, academic, attendance, sessions, decks, cards, reviewLog, settings, today, now = new Date() }) {
  const termId = settings.activeTermId;
  const termCourses = courses.filter((c) => isAcademic(c) && c.status !== 'dropped' && (!termId || c.termId === termId));
  const ctx = { courses, academic, attendance, sessions, decks, cards, reviewLog, settings, today, now, termCourses, calib: {}, sig: {} };
  for (const c of termCourses) ctx.sig[c.id] = signals(c, ctx);

  // Calibration: how far the user's real grades sit from the behaviour model,
  // per family (TASS vs exams), shrunk towards 0 while there are few grades.
  const res = { tass: [], exam: [] };
  const levels = { byType: {}, byFamily: { tass: [], exam: [] } };
  for (const c of termCourses) {
    for (const e of c.evaluations || []) {
      const g = normGrade(e, settings);
      if (g == null) continue;
      levels.byFamily[isTassType(e.type) ? 'tass' : 'exam'].push(g);
      (levels.byType[e.type] ||= []).push(g);
      const b = behaviour(e.type, ctx.sig[c.id], settings.scale, {});
      if (b != null) res[isTassType(e.type) ? 'tass' : 'exam'].push(g - b);
    }
  }
  for (const k of Object.keys(res)) ctx.calib[k] = res[k].reduce((a, x) => a + x, 0) / (res[k].length + 2);
  ctx.levels = levels;
  return ctx;
}

/**
 * Forecast of one subject: estimate of each ungraded evaluation + the
 * predicted final average. { evals: [{ ev, estimate, basis }], average,
 * complete, confidence, sig }
 */
export function forecastSubject(course, ctx) {
  const { settings } = ctx;
  const sig = ctx.sig[course.id] || signals(course, ctx);
  const own = subjectResult(course, settings);
  const avgOf = (arr) => (arr?.length ? arr.reduce((a, x) => a + x, 0) / arr.length : null);
  const evals = (course.evaluations || []).map((ev) => {
    if (normGrade(ev, settings) != null) return { ev, estimate: null, graded: true };
    const b = behaviour(ev.type, sig, settings.scale, ctx.calib);
    let g = null; let wG = 0;
    // The subject's own grades of the same family (a CC says little about TASS).
    const fam = isTassType(ev.type);
    const same = (course.evaluations || []).filter((e) => isTassType(e.type) === fam && normGrade(e, settings) != null);
    const sameW = same.reduce((a, e) => a + (Number(e.weight) || 1), 0);
    const ownFam = sameW ? same.reduce((a, e) => a + normGrade(e, settings) * (Number(e.weight) || 1), 0) / sameW : null;
    if (ownFam != null) { g = ownFam; wG = 0.6; } else {
      // Other subjects' grades of the same type, else of the same family (TASS vs exams).
      const lvl = avgOf(ctx.levels.byType[ev.type]) ?? avgOf(ctx.levels.byFamily[isTassType(ev.type) ? 'tass' : 'exam']);
      if (lvl != null) { g = lvl; wG = 0.4; }
    }
    let estimate = null;
    if (b != null && g != null) estimate = wG * g + (1 - wG) * b;
    else estimate = b ?? g;
    return { ev, estimate: estimate == null ? null : Math.round(estimate * 4) / 4, basis: { b, g, fromOwn: ownFam != null } };
  });

  const signalsCount = ['A', 'S', 'F', 'P'].filter((k) => sig[k] != null).length;
  const missing = evals.filter((x) => !x.graded && x.estimate == null && (Number(x.ev.weight) || 0) > 0);
  const predicted = { ...course, evaluations: (course.evaluations || []).map((ev) => {
    const x = evals.find((y) => y.ev === ev);
    return x?.estimate != null ? { ...ev, grade: x.estimate, outOf: settings.scale } : ev;
  }) };
  const r = subjectResult(predicted, settings);
  return {
    evals,
    predictedCourse: predicted,
    average: missing.length ? null : r.final ?? r.current,
    partialAverage: r.current,
    missing,
    confidence: own.gradedWeight >= 30 && signalsCount >= 2 ? 'bonne' : own.gradedWeight > 0 || signalsCount >= 2 ? 'moyenne' : 'faible',
    sig,
  };
}

/** What the forecast would be with perfect attendance and the study target met. */
export function forecastPotential(course, ctx) {
  const sig = ctx.sig[course.id];
  if (!sig) return null;
  const ideal = { ...sig, A: sig.A == null ? null : 1, S: sig.S == null ? null : 1 };
  const effortParts = [[ideal.S, 0.45], [ideal.F, 0.3], [ideal.P, 0.25]].filter(([v]) => v != null);
  ideal.E = effortParts.length ? mean(effortParts.map(([v, w]) => ({ v, w }))) : null;
  return forecastSubject(course, { ...ctx, sig: { ...ctx.sig, [course.id]: ideal } }).average;
}

/** Semester forecast: termResult over the subjects with estimates filled in. */
export function forecastTerm(termId, modules, ctx) {
  const predicted = ctx.courses.map((c) => (ctx.termCourses.includes(c) ? forecastSubject(c, ctx).predictedCourse : c));
  return termResult(termId, modules, predicted, ctx.settings);
}
