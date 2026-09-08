/**
 * discipline-engine.js — Pure computation for the Programme discipline score.
 *
 * 6 weighted components, each 0-100, combined into an overall 0-100 score:
 *   Timing      25% — how close actual start was to planned time
 *   Completion  30% — sessions done vs. planned
 *   Nutrition   15% — adherence to nutrition template targets
 *   Sleep       10% — sleep consistency (hours + timing)
 *   Recovery    10% — recovery log adherence
 *   Habits      10% — linked habit completion rate
 *
 * Design decisions (from user spec):
 *   - ±2 min tolerance before any penalty
 *   - Continuous degradation curve (not discrete buckets)
 *   - 10 min late counts less than a fully skipped session
 *   - Justification reduces penalty but never eliminates it
 *   - "Force majeure" splits: predictable weather 30% reduction, unpredictable 100%
 */

const WEIGHTS = {
  timing: 0.25,
  completion: 0.30,
  nutrition: 0.15,
  sleep: 0.10,
  recovery: 0.10,
  habits: 0.10,
};

// ─────────── Justification barème (% penalty reduction) ───────────
// The reason code → how much the penalty is reduced (not eliminated).
// E.g. 0.70 means "70% of the penalty is forgiven, 30% remains".
const JUSTIFICATION_REDUCTION = {
  // Predictable — you could have planned around it
  transport_public: 0.30,
  embouteillage: 0.20,
  meteo_previsible: 0.30,

  // Unpredictable — less your fault
  reunion_professionnelle: 0.50,
  meteo_imprevisible: 1.00,
  salle_fermee: 0.90,
  equipement_casse: 0.80,
  urgence_personnelle: 0.70,

  // Health — body takes priority
  maladie_legere: 0.60,
  maladie_grave: 1.00,
  blessure: 1.00,
  fatigue_extreme: 0.50,
  sommeil_insuffisant: 0.40,
  douleur_musculaire: 0.50,

  // Personal / academic / travel
  obligation_familiale: 0.50,
  examen_etudes: 0.60,
  voyage: 0.40,

  // Cascade (system-generated)
  cascade: 0.90,

  // Other
  autre: 0.20,
};

/**
 * Get the penalty reduction factor for a reason code.
 * Returns 0-1 where 1 = full forgiveness, 0 = no reduction.
 */
export function getJustificationReduction(reasonCode) {
  return JUSTIFICATION_REDUCTION[reasonCode] ?? 0;
}

// ─────────── Timing score ───────────

/**
 * Compute timing score for a single session.
 * @param {string|null} plannedTime - "HH:MM" or null
 * @param {string|null} actualStart - ISO timestamp or null
 * @param {string|null} reasonCode - justification reason
 * @returns {number} 0-100
 */
export function computeTimingScore(plannedTime, actualStart, reasonCode) {
  if (!plannedTime || !actualStart) return 100; // no planned time → no penalty

  const [ph, pm] = plannedTime.split(':').map(Number);
  const actual = new Date(actualStart);
  const plannedMinutes = ph * 60 + pm;
  const actualMinutes = actual.getHours() * 60 + actual.getMinutes();
  const diffMinutes = Math.abs(actualMinutes - plannedMinutes);

  // ±2 min tolerance — no penalty
  if (diffMinutes <= 2) return 100;

  // Continuous degradation: score = 100 × e^(-k × (diff - 2))
  // k chosen so that at 10 min late → ~75, at 30 min → ~30, at 60 min → ~5
  const k = 0.04;
  const excessMinutes = diffMinutes - 2;
  let rawScore = 100 * Math.exp(-k * excessMinutes);

  // Apply justification reduction (reduces the penalty, not the score)
  if (reasonCode) {
    const penalty = 100 - rawScore;
    const reduction = getJustificationReduction(reasonCode);
    rawScore = 100 - penalty * (1 - reduction);
  }

  return Math.max(0, Math.min(100, Math.round(rawScore * 100) / 100));
}

// ─────────── Completion score ───────────

/**
 * Compute completion score for a day.
 * @param {Array} scheduledEvents - events from getScheduleForDate()
 * @returns {{ score: number, done: number, planned: number, skipped: number, cancelled: number }}
 */
export function computeCompletionScore(scheduledEvents) {
  if (!scheduledEvents.length) return { score: 100, done: 0, planned: 0, skipped: 0, cancelled: 0 };

  let planned = 0;
  let done = 0;
  let skipped = 0;
  let cancelledJustified = 0;
  let cancelledUnjustified = 0;

  for (const evt of scheduledEvents) {
    if (evt.cancelled) {
      const reduction = evt.override?.reason_code
        ? getJustificationReduction(evt.override.reason_code)
        : 0;
      if (reduction >= 0.8) cancelledJustified++;
      else cancelledUnjustified++;
      continue;
    }
    if (evt.moved) continue; // rescheduled → doesn't count as missed today

    planned++;
    if (evt.logged?.status === 'completed') done++;
    else if (evt.logged?.status === 'partial') done += 0.5;
    else if (!evt.logged) skipped++;
  }

  // Base score: done / planned × 100
  // Unjustified cancels count as missed
  const effectivePlanned = planned + cancelledUnjustified;
  const score = effectivePlanned > 0
    ? Math.round((done / effectivePlanned) * 10000) / 100
    : 100;

  return {
    score: Math.max(0, Math.min(100, score)),
    done,
    planned,
    skipped,
    cancelled: cancelledJustified + cancelledUnjustified,
  };
}

// ─────────── Nutrition score ───────────

/**
 * Compute nutrition adherence for a day.
 * @param {object|null} template - nutrition template with targets
 * @param {Array} nutritionLogs - healthStore nutrition logs for the day
 * @returns {number} 0-100
 */
export function computeNutritionScore(template, nutritionLogs) {
  if (!template || !nutritionLogs.length) return template ? 0 : 100; // no template → no penalty

  const totalKcal = nutritionLogs.reduce((sum, n) => sum + (n.kcal || 0), 0);
  const totalProtein = nutritionLogs.reduce((sum, n) => sum + (n.protein || 0), 0);

  const scores = [];

  // Kcal adherence (±10% tolerance)
  if (template.target_kcal) {
    const ratio = totalKcal / template.target_kcal;
    const deviation = Math.abs(1 - ratio);
    scores.push(deviation <= 0.10 ? 100 : Math.max(0, 100 - (deviation - 0.10) * 300));
  }

  // Protein adherence (±10% tolerance)
  if (template.target_protein_g) {
    const ratio = totalProtein / template.target_protein_g;
    const deviation = Math.abs(1 - ratio);
    scores.push(deviation <= 0.10 ? 100 : Math.max(0, 100 - (deviation - 0.10) * 300));
  }

  return scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length * 100) / 100 : 100;
}

// ─────────── Sleep score ───────────

/**
 * Compute sleep score from energy/sleep logs.
 * @param {object|null} sleepData - { hoursSlept, sleepQualityScore, bedtime }
 * @param {number} targetHours - recommended sleep hours (default 7.5)
 * @returns {number} 0-100
 */
export function computeSleepScore(sleepData, targetHours = 7.5) {
  if (!sleepData) return 50; // no data → neutral

  let score = 100;

  // Hours slept (±0.5h tolerance)
  if (sleepData.hoursSlept != null) {
    const diff = Math.abs(sleepData.hoursSlept - targetHours);
    if (diff > 0.5) score -= Math.min(40, (diff - 0.5) * 20);
  }

  // Sleep quality (if available, 1-10 scale)
  if (sleepData.sleepQualityScore != null) {
    score = score * 0.6 + (sleepData.sleepQualityScore / 10) * 100 * 0.4;
  }

  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

// ─────────── Recovery score ───────────

/**
 * Compute recovery score from recovery logs.
 * @param {boolean} hasRecoveryLog - whether a recovery activity was logged today
 * @param {boolean} isTrainingDay - whether today had planned sessions
 * @returns {number} 0-100
 */
export function computeRecoveryScore(hasRecoveryLog, isTrainingDay) {
  // On training days, recovery after is expected
  if (isTrainingDay) return hasRecoveryLog ? 100 : 50;
  // On rest days, recovery is a bonus but not required
  return hasRecoveryLog ? 100 : 80;
}

// ─────────── Habits score ───────────

/**
 * Compute habit adherence score from linked habits.
 * @param {Array} habitLinks - program_habit_links for today's sessions
 * @param {object} habitCompletions - { [habitId]: boolean } from habitStore
 * @returns {number} 0-100
 */
export function computeHabitsScore(habitLinks, habitCompletions) {
  if (!habitLinks.length) return 100; // no linked habits → no penalty

  let total = 0;
  let fulfilled = 0;

  for (const link of habitLinks) {
    total++;
    const done = habitCompletions[link.habit_id];
    if (done) {
      fulfilled += link.fulfilment_percent / 100;
    }
  }

  return total > 0
    ? Math.max(0, Math.min(100, Math.round((fulfilled / total) * 10000) / 100))
    : 100;
}

// ─────────── Overall daily discipline ───────────

/**
 * Compute the full daily discipline score.
 * @param {object} components - { timing, completion, nutrition, sleep, recovery, habits }
 *                              each is 0-100
 * @returns {{ overall: number, components: object, weights: object }}
 */
export function computeDailyDiscipline(components) {
  const c = {
    timing: components.timing ?? 100,
    completion: components.completion ?? 100,
    nutrition: components.nutrition ?? 100,
    sleep: components.sleep ?? 100,
    recovery: components.recovery ?? 100,
    habits: components.habits ?? 100,
  };

  const overall = Math.round((
    c.timing * WEIGHTS.timing +
    c.completion * WEIGHTS.completion +
    c.nutrition * WEIGHTS.nutrition +
    c.sleep * WEIGHTS.sleep +
    c.recovery * WEIGHTS.recovery +
    c.habits * WEIGHTS.habits
  ) * 100) / 100;

  return { overall, components: c, weights: WEIGHTS };
}

// ─────────── Alert detection ───────────

/**
 * Detect repeated-delay pattern.
 * @param {Array<{date, timingScore}>} recentScores - last 7 days
 * @returns {{ triggered: boolean, count: number, avgScore: number }}
 */
export function detectRepeatedDelay(recentScores) {
  const lateCount = recentScores.filter((s) => s.timingScore < 80).length;
  const avgScore = recentScores.length
    ? recentScores.reduce((sum, s) => sum + s.timingScore, 0) / recentScores.length
    : 100;
  return {
    triggered: lateCount >= 3,
    count: lateCount,
    avgScore: Math.round(avgScore * 100) / 100,
  };
}

/**
 * Detect missed-session streak.
 * @param {Array<{date, completionScore}>} recentScores - last 7 days
 * @returns {{ triggered: boolean, streak: number }}
 */
export function detectMissedStreak(recentScores) {
  let streak = 0;
  // Walk backwards
  for (let i = recentScores.length - 1; i >= 0; i--) {
    if (recentScores[i].completionScore < 50) streak++;
    else break;
  }
  return { triggered: streak >= 3, streak };
}

/**
 * Detect discipline drop (week-over-week).
 * @param {number} thisWeekAvg - this week's average overall score
 * @param {number} lastWeekAvg - last week's average overall score
 * @returns {{ triggered: boolean, drop: number }}
 */
export function detectDisciplineDrop(thisWeekAvg, lastWeekAvg) {
  const drop = lastWeekAvg - thisWeekAvg;
  return { triggered: drop >= 15, drop: Math.round(drop * 100) / 100 };
}

export { WEIGHTS, JUSTIFICATION_REDUCTION };
