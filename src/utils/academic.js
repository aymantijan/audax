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
  passMark: 10, // validation threshold (of the semester, and of every level when the two below are empty)
  subjectPassMark: null, // a subject is validated from this mark (e.g. ISCAE: 7); null = passMark
  modulePassMark: null, // a module is validated from this mark (e.g. ISCAE: 8); null = passMark
  eliminatoryMark: 5, // null = none; a subject/module under this can't be compensated
  subjectCompensation: true, // subjects compensate each other inside a module
  moduleCompensation: true, // modules compensate each other inside a semester
  retakeRule: 'capped', // 'capped' (max(avg, retake) capped at pass mark) | 'max' | 'replace'
  activeTermId: null,
  weeklyStudyTarget: 15, // hours of personal study per week (outside class)
  arriveBeforeMin: 5, // attendance: "on time" = checked in this many minutes before the class starts
  classReminderMin: 20,
  defaultEvalPreset: 'cc40', // evaluation split given to new subjects (EVALUATION_PRESETS key) // attendance: heads-up notification this many minutes before a class
};

const NO_LEVELS = { subjectPassMark: null, modulePassMark: null };
export const GRADING_PRESETS = [
  { key: 'iscae', label: 'ISCAE — matière 7 · module 8 · semestre 10', settings: { scale: 20, passMark: 10, subjectPassMark: 7, modulePassMark: 8, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: true, retakeRule: 'capped' } },
  { key: 'ma', label: 'Maroc — grande école (/20)', settings: { scale: 20, passMark: 10, ...NO_LEVELS, eliminatoryMark: 5, subjectCompensation: true, moduleCompensation: true, retakeRule: 'capped' } },
  { key: 'fr', label: 'France — LMD (/20)', settings: { scale: 20, passMark: 10, ...NO_LEVELS, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: true, retakeRule: 'max' } },
  { key: 'pct', label: 'Pourcentage (/100)', settings: { scale: 100, passMark: 50, ...NO_LEVELS, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: false, retakeRule: 'max' } },
  { key: 'ten', label: 'Sur 10', settings: { scale: 10, passMark: 5, ...NO_LEVELS, eliminatoryMark: null, subjectCompensation: true, moduleCompensation: false, retakeRule: 'max' } },
];

export const EVALUATION_TYPES = [
  { value: 'cc', label: 'Contrôle continu', short: 'CC' },
  { value: 'partiel', label: 'Partiel', short: 'Partiel' },
  { value: 'exam', label: 'Examen final', short: 'Examen' },
  { value: 'cf', label: 'Examen final (CF)', short: 'CF' },
  { value: 'tass', label: 'Travail & assiduité (TASS)', short: 'TASS' },
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
  { key: 'cc_cf_tass', label: 'CC 30 % · CF 30 % · TASS 40 %', evals: [['cc', 'CC — partiels / contrôle continu', 30], ['cf', 'CF — examens finaux', 30], ['tass', 'TASS — participation, TD, TP, oral', 40]] },
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

// Validation mark of each level (falls back to the single pass mark).
export const subjectPass = (s) => num(s?.subjectPassMark) ?? s.passMark;
export const modulePass = (s) => num(s?.modulePassMark) ?? s.passMark;
export const hasLevelMarks = (s) => num(s?.subjectPassMark) != null || num(s?.modulePassMark) != null;

// French display: decimal comma, trailing zeros trimmed (12,5 · 11,33 · 10).
export const fmtGrade = (v, digits = 2) => (v == null ? '—' : (Number(v).toFixed(digits).replace(/\.?0+$/, '') || '0').replace('.', ','));

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
  const sPass = subjectPass(settings);
  if (final != null && retake != null && final < sPass) {
    const before = final;
    if (settings.retakeRule === 'replace') final = retake;
    else if (settings.retakeRule === 'max') final = Math.max(final, retake);
    else final = Math.max(final, Math.min(retake, sPass));
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
  if (p < (subjectPass(settings) / settings.scale) * 100) return { label: 'Non validé', color: 'var(--error)' };
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
// Marks a unit must reach: a module (modulePass) or a lone subject (subjectPass);
// `floor` = mark no subject of the unit may fall under.
function unitMarks(isModule, settings) {
  return {
    pass: isModule ? modulePass(settings) : subjectPass(settings),
    floor: hasLevelMarks(settings) ? (num(settings.subjectPassMark) ?? settings.eliminatoryMark) : settings.eliminatoryMark,
  };
}

function unitStatus({ avg, complete, lowest }, { pass, floor }) {
  if (avg == null) return 'empty';
  const underFloor = floor != null && lowest != null && lowest < floor;
  if (complete) return avg >= pass && !underFloor ? 'validated' : 'failed';
  return avg < pass || underFloor ? 'at-risk' : 'in-progress';
}

export function moduleResult(module, subjects, settings) {
  const res = subjects.map((c) => ({ course: c, r: subjectResult(c, settings) }));
  const withVal = res.filter((x) => x.r.value != null);
  const avg = weighted(withVal.map((x) => ({ v: x.r.value, w: num(x.course.coefficient) || 1 })));
  const complete = res.length > 0 && res.every((x) => x.r.complete);
  const lowest = withVal.length ? Math.min(...withVal.map((x) => x.r.value)) : null;
  const marks = unitMarks(!!module, settings);
  let status = unitStatus({ avg, complete, lowest }, marks);
  // Without compensation, every subject must pass on its own.
  if (!settings.subjectCompensation && withVal.some((x) => x.r.value < subjectPass(settings))) {
    status = complete ? 'failed' : 'at-risk';
  }
  const credits = num(module?.credits) ?? subjects.reduce((s, c) => s + (num(c.credits) || 0), 0);
  return { module, subjects: res, avg: round2(avg), complete, lowest, status, credits, pass: marks.pass, floor: marks.floor };
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
  // Blocking: with level marks (ISCAE) a module under its mark or a subject
  // under the subject mark; otherwise the legacy eliminatory mark.
  const elim = settings.eliminatoryMark;
  const anyUnderElim = hasLevelMarks(settings)
    ? scored.some((u) => u.avg < u.pass || (u.floor != null && u.lowest != null && u.lowest < u.floor))
    // Decision 2026-09-27: a single subject under the eliminatory mark also blocks the semester.
    : elim != null && scored.some((u) => u.avg < elim || (u.lowest != null && u.lowest < elim));
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
  // With level marks, modules at 8–9 are validated yet the semester still needs its own average.
  else if (complete) status = (hasLevelMarks(settings) ? avg >= settings.passMark && !anyUnderElim : all.every((u) => u.status === 'validated') || compensated) ? 'validated' : 'failed';
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

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// "Lundi", "lun", "MARDI", "1"… → 0-6 (Sunday = 0), or null.
export function parseWeekday(raw) {
  const s = stripAccents(String(raw || '').trim().toLowerCase());
  if (!s) return null;
  if (/^[0-6]$/.test(s)) return Number(s);
  const d = WEEKDAYS.find((w) => {
    const label = stripAccents(w.label.toLowerCase());
    return label === s || (s.length >= 3 && label.startsWith(s.slice(0, 3)));
  });
  return d ? d.value : null;
}

// "8h30", "8H", "08:30", "14.45" → "HH:MM", or null.
function parseClock(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})\s*(?:[h:.]\s*(\d{2})?)?$/i);
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// "8h30-10h00", "08:30 – 10:00", "13H00 à 14H30" → { start, end }, or null.
export function parseTimeRange(raw) {
  const parts = String(raw || '').split(/\s*(?:-|–|—|à|a|>)\s*/i).filter(Boolean);
  if (parts.length !== 2) return null;
  const start = parseClock(parts[0]); const end = parseClock(parts[1]);
  return start && end && start < end ? { start, end } : null;
}

/**
 * Timetable import — one weekly slot per line:
 *   Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type
 * Several lines with the same subject become several slots of one subject.
 * Returns { rows, errors } so the modal can flag unreadable lines.
 */
export function parseTimetableLines(text) {
  const rows = []; const errors = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const l = line.trim();
    if (!l) return;
    const [name, day, range, professor, room, kind] = l.split(/\s*[;|\t]\s*/);
    const d = parseWeekday(day);
    const t = parseTimeRange(range);
    if (!name?.trim() || d == null || !t) {
      errors.push({ line: i + 1, text: l, reason: !name?.trim() ? 'matière manquante' : d == null ? 'jour illisible' : 'horaire illisible' });
      return;
    }
    const k = SLOT_KINDS.find((x) => stripAccents(x.toLowerCase()) === stripAccents((kind || '').trim().toLowerCase()));
    rows.push({ name: name.trim(), day: d, ...t, professor: (professor || '').trim(), room: (room || '').trim(), kind: k || 'Cours' });
  });
  return { rows, errors };
}
