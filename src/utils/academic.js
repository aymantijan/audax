/**
 * Academic grading engine — semesters → modules → subjects (matières) →
 * weighted evaluations. Pure functions, no store access.
 *
 * Everything is configurable through `settings` because users come from very
 * different systems (Moroccan / French /20, percentages, /10…). Defaults follow
 * the common Moroccan grande-école rules: /20, pass at 10, eliminatory mark,
 * compensation between subjects of a module, retake capped at the pass mark.
 */

export const DEFAULT_ACADEMIC_SETTINGS = {
  institution: '',
  program: '',
  scale: 20, // max grade
  passMark: 10, // validation threshold
  eliminatoryMark: 5, // null = none; a subject/module under this can't be compensated
  subjectCompensation: true, // subjects compensate each other inside a module
  moduleCompensation: true, // modules compensate each other inside a semester
  retakeRule: 'capped', // 'capped' (max(avg, retake) capped at pass mark) | 'max' | 'replace'
  activeTermId: null,
};

export const GRADING_PRESETS = [
  { key: 'ma', label: 'Maroc — grande école (/20)', settings: { scale: 20, passMark: 10, eliminatoryMark: 5, subjectCompensation: true, moduleCompensation: true, retakeRule: 'capped' } },
  { key: 'fr', label: 'France — LMD (/20)', settings: { scale: 20, passMark: 10, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: true, retakeRule: 'max' } },
  { key: 'pct', label: 'Pourcentage (/100)', settings: { scale: 100, passMark: 50, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: false, retakeRule: 'max' } },
  { key: 'ten', label: 'Sur 10', settings: { scale: 10, passMark: 5, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: false, retakeRule: 'max' } },
];

export const EVALUATION_TYPES = [
  { value: 'cc', label: 'Contrôle continu', short: 'CC' },
  { value: 'partiel', label: 'Partiel', short: 'Partiel' },
  { value: 'exam', label: 'Examen final', short: 'Examen' },
  { value: 'projet', label: 'Projet', short: 'Projet' },
  { value: 'oral', label: 'Exposé / oral', short: 'Oral' },
  { value: 'tp', label: 'TP / TD', short: 'TP' },
  { value: 'quiz', label: 'Quiz', short: 'Quiz' },
  { value: 'participation', label: 'Participation', short: 'Particip.' },
];
export const evalTypeLabel = (t, short = false) => {
  const m = EVALUATION_TYPES.find((e) => e.value === t);
  return m ? (short ? m.short : m.label) : t || 'Évaluation';
};

// Evaluation splits offered when a subject is created.
export const EVALUATION_PRESETS = [
  { key: 'cc40', label: 'CC 40 % · Examen 60 %', evals: [['cc', 'Contrôle continu', 40], ['exam', 'Examen final', 60]] },
  { key: 'cc30', label: 'CC 30 % · Examen 70 %', evals: [['cc', 'Contrôle continu', 30], ['exam', 'Examen final', 70]] },
  { key: 'part', label: 'Partiel 40 % · Final 60 %', evals: [['partiel', 'Partiel', 40], ['exam', 'Examen final', 60]] },
  { key: 'proj', label: 'CC 30 % · Projet 30 % · Examen 40 %', evals: [['cc', 'Contrôle continu', 30], ['projet', 'Projet', 30], ['exam', 'Examen final', 40]] },
  { key: 'exam', label: 'Examen 100 %', evals: [['exam', 'Examen final', 100]] },
  { key: 'none', label: 'Je les ajouterai plus tard', evals: [] },
];

export const SLOT_KINDS = ['Cours', 'TD', 'TP', 'Séminaire'];
export const WEEKDAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
];

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

export const fmtGrade = (v, digits = 2) => (v == null ? '—' : Number(v).toFixed(digits).replace(/\.?0+$/, '') || '0');

// An evaluation grade normalised onto the grading scale (a quiz may be /10).
export function normGrade(ev, settings) {
  const g = num(ev.grade);
  if (g == null) return null;
  const outOf = num(ev.outOf) || settings.scale;
  return (g / outOf) * settings.scale;
}

export const isAcademic = (course) => course?.kind === 'academic';

/**
 * Subject (matière) result.
 * - current: weighted average of the evaluations graded so far (live standing)
 * - final: definitive average once every evaluation is graded (retake applied)
 */
export function subjectResult(course, settings) {
  const evals = course.evaluations || [];
  const totalW = evals.reduce((s, e) => s + (num(e.weight) || 0), 0);
  let gradedW = 0;
  let points = 0;
  for (const e of evals) {
    const g = normGrade(e, settings);
    const w = num(e.weight) || 0;
    if (g == null || !w) continue;
    gradedW += w;
    points += g * w;
  }
  const current = gradedW ? points / gradedW : null;
  const complete = evals.length > 0 && gradedW === totalW && totalW > 0;
  let final = complete ? points / totalW : null;
  let retakeApplied = false;
  const retake = num(course.retakeGrade);
  if (final != null && retake != null && final < settings.passMark) {
    const before = final;
    if (settings.retakeRule === 'replace') final = retake;
    else if (settings.retakeRule === 'max') final = Math.max(final, retake);
    else final = Math.max(final, Math.min(retake, settings.passMark));
    retakeApplied = final !== before;
  }
  // Manual override (e.g. the school only publishes the final average).
  const manual = num(course.finalGrade);
  if (manual != null) final = manual;
  const value = final ?? current;
  return {
    current: round2(current),
    final: round2(final),
    value: round2(value),
    complete: complete || manual != null,
    gradedWeight: gradedW,
    totalWeight: totalW,
    retakeApplied,
    weightsOk: evals.length === 0 || Math.abs(totalW - 100) < 0.01,
  };
}

/**
 * Grade needed on the remaining (ungraded) evaluations to reach `target`.
 * Returns null when nothing is left to sit.
 */
export function requiredGrade(course, target, settings) {
  const evals = course.evaluations || [];
  const totalW = evals.reduce((s, e) => s + (num(e.weight) || 0), 0);
  const remaining = evals.filter((e) => normGrade(e, settings) == null && (num(e.weight) || 0) > 0);
  const remW = remaining.reduce((s, e) => s + num(e.weight), 0);
  if (!remW || !totalW) return null;
  const points = evals.reduce((s, e) => {
    const g = normGrade(e, settings);
    return g == null ? s : s + g * (num(e.weight) || 0);
  }, 0);
  const needed = (target * totalW - points) / remW;
  return {
    needed: round2(needed),
    status: needed <= 0 ? 'secured' : needed > settings.scale ? 'impossible' : 'possible',
    remaining,
  };
}

// Average that a hypothetical grade `x` on every remaining evaluation would give.
export function simulateAverage(course, x, settings) {
  const evals = course.evaluations || [];
  const totalW = evals.reduce((s, e) => s + (num(e.weight) || 0), 0);
  if (!totalW) return null;
  const pts = evals.reduce((s, e) => {
    const g = normGrade(e, settings);
    return s + (g == null ? x : g) * (num(e.weight) || 0);
  }, 0);
  return round2(pts / totalW);
}

export function mentionFor(avg, settings) {
  if (avg == null) return null;
  const p = (avg / settings.scale) * 100;
  if (p < (settings.passMark / settings.scale) * 100) return { label: 'Non validé', color: 'var(--error)' };
  if (p >= 80) return { label: 'Très bien', color: 'var(--success)' };
  if (p >= 70) return { label: 'Bien', color: 'var(--success)' };
  if (p >= 60) return { label: 'Assez bien', color: 'var(--accent-primary)' };
  return { label: 'Passable', color: 'var(--warning)' };
}

// Letter equivalent — keeps the legacy GPA/XP (GRADE_XP, weightedGPA) working
// for numerically graded subjects.
export function letterFor(avg, settings) {
  if (avg == null) return null;
  const p = (avg / settings.scale) * 100;
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 55) return 'C+';
  if (p >= settings.passMark / settings.scale * 100) return 'C';
  if (p >= 40) return 'D';
  return 'F';
}

const weighted = (rows) => {
  const w = rows.reduce((s, r) => s + r.w, 0);
  return w ? rows.reduce((s, r) => s + r.v * r.w, 0) / w : null;
};

/**
 * One unit of a semester: a module (with its subjects) or a subject that
 * isn't filed under a module. Status:
 *   validated | failed | at-risk | in-progress | empty
 */
function unitStatus({ avg, complete, lowest }, settings) {
  if (avg == null) return 'empty';
  const elim = settings.eliminatoryMark;
  const underElim = elim != null && lowest != null && lowest < elim;
  if (complete) return avg >= settings.passMark && !underElim ? 'validated' : 'failed';
  return avg < settings.passMark || underElim ? 'at-risk' : 'in-progress';
}

export function moduleResult(module, subjects, settings) {
  const res = subjects.map((c) => ({ course: c, r: subjectResult(c, settings) }));
  const withVal = res.filter((x) => x.r.value != null);
  const avg = weighted(withVal.map((x) => ({ v: x.r.value, w: num(x.course.coefficient) || 1 })));
  const complete = res.length > 0 && res.every((x) => x.r.complete);
  const lowest = withVal.length ? Math.min(...withVal.map((x) => x.r.value)) : null;
  let status = unitStatus({ avg, complete, lowest }, settings);
  // Without compensation, every subject must pass on its own.
  if (!settings.subjectCompensation && withVal.some((x) => x.r.value < settings.passMark)) {
    status = complete ? 'failed' : 'at-risk';
  }
  const credits = num(module?.credits) ?? subjects.reduce((s, c) => s + (num(c.credits) || 0), 0);
  return { module, subjects: res, avg: round2(avg), complete, lowest, status, credits };
}

export function termResult(termId, modules, courses, settings) {
  const termCourses = courses.filter((c) => isAcademic(c) && c.termId === termId && c.status !== 'dropped');
  const termModules = modules.filter((m) => m.termId === termId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const units = termModules.map((m) => ({
    ...moduleResult(m, termCourses.filter((c) => c.moduleId === m.id), settings),
    coefficient: num(m.coefficient) || 1,
  }));
  const loose = termCourses.filter((c) => !c.moduleId || !termModules.some((m) => m.id === c.moduleId));
  const looseUnits = loose.map((c) => ({
    ...moduleResult(null, [c], settings),
    coefficient: num(c.coefficient) || 1,
  }));
  const all = [...units, ...looseUnits];
  const scored = all.filter((u) => u.avg != null);
  const avg = weighted(scored.map((u) => ({ v: u.avg, w: u.coefficient })));
  const complete = all.length > 0 && all.every((u) => u.complete);
  const elim = settings.eliminatoryMark;
  const anyUnderElim = elim != null && scored.some((u) => u.avg < elim);
  // Semester-level compensation: failed modules become validated when the
  // semester average passes and nothing is under the eliminatory mark.
  const compensated = settings.moduleCompensation && avg != null && avg >= settings.passMark && !anyUnderElim;
  const creditsTotal = all.reduce((s, u) => s + (u.credits || 0), 0);
  const creditsEarned = all.reduce((s, u) => {
    if (u.status === 'validated' || (compensated && complete && u.status === 'failed')) return s + (u.credits || 0);
    return s;
  }, 0);
  let status = 'in-progress';
  if (avg == null) status = 'empty';
  else if (complete) status = all.every((u) => u.status === 'validated') || compensated ? 'validated' : 'failed';
  else if (avg < settings.passMark || anyUnderElim) status = 'at-risk';
  return {
    units,
    looseUnits,
    courses: termCourses,
    avg: round2(avg),
    complete,
    status,
    compensated,
    creditsTotal,
    creditsEarned,
  };
}

export const STATUS_META = {
  validated: { label: 'Validé', color: 'var(--success)' },
  failed: { label: 'Non validé', color: 'var(--error)' },
  'at-risk': { label: 'À risque', color: 'var(--warning)' },
  'in-progress': { label: 'En cours', color: 'var(--accent-primary)' },
  empty: { label: 'Pas encore noté', color: 'var(--text-secondary)' },
};

// Upcoming dated evaluations across all academic subjects, soonest first.
export function upcomingEvaluations(courses, today) {
  const out = [];
  for (const c of courses) {
    if (!isAcademic(c) || c.status === 'dropped') continue;
    for (const e of c.evaluations || []) {
      if (!e.date) continue;
      out.push({ course: c, ev: e, past: e.date < today });
    }
  }
  return out.sort((a, b) => a.ev.date.localeCompare(b.ev.date));
}

export const daysUntil = (dateStr, today) =>
  Math.round((new Date(dateStr + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);

/**
 * Bulk subject import — one subject per line:
 *   Matière ; coefficient ; module ; crédits
 * Separators ; | or tab. Only the name is required.
 */
export function parseSubjectLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, coef, module, credits] = line.split(/\s*[;|\t]\s*/);
      return {
        name: (name || '').trim(),
        coefficient: num((coef || '').replace(',', '.')) || 1,
        module: (module || '').trim(),
        credits: num((credits || '').replace(',', '.')),
      };
    })
    .filter((r) => r.name);
}
