// ─────────────────────────────────────────────────────────────────────────────
// HEALTH SCIENCE — pure formulas behind the Health domain. Every function here
// is a genuine equation or a documented heuristic (no external text quoted),
// with the concept it's based on named in a comment so it can be looked up:
//   • Sleep quality: duration + circadian timing bands (Walker, "Why We Sleep";
//     AASM consensus recommendations) — see utils/sleep-quality.js (pre-existing).
//   • Zone-2 / aerobic base training benefits (Achten & Jeukendrup 2003 review;
//     Holloszy's mitochondrial-biogenesis work) — informs the Aerobic Capacity
//     XP curve: frequency over intensity.
//   • Protein intake for body recomposition (Helms et al. 2014 lean-mass
//     guidelines; Tang & Phillips on protein timing) — informs the nutrition
//     quality heuristics.
//   • Energy balance / weight-change prediction (Hall et al. 2011 dynamic body
//     -weight model; the classic ~7700 kcal ≈ 1 kg fat-mass rule of thumb) —
//     informs computeWeightPrediction below (a simplified, transparent variant,
//     not the full NIH Body Weight Planner).
//   • Readiness / training-readiness scoring (Saw, Main & Gastin 2016 review of
//     athlete self-report measures) — informs computeReadiness's component mix.
//   • Stress physiology and chronic-stress costs (Epel et al. telomere/cortisol
//     work; Thau et al. on stress and decision-making) — informs the stress
//     component's inverse weighting and the overtraining triggers.
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r1 = (n) => Math.round(n * 10) / 10;

// ---- Readiness Score (0-100) ----
// sleepQuality/energy/stress are all 0-10 scales already used elsewhere in the
// app (sleep-quality.js, stress-calculator.js) — kept consistent on purpose.
export function computeReadiness({ sleepQuality = 0, energy = 0, stress = 0, recoveryCount = 0, recoveryMax = 5, streak = 0 }) {
  const sleepPts = clamp((sleepQuality / 10) * 30, 0, 30);
  const energyPts = clamp((energy / 10) * 25, 0, 25);
  const stressPts = clamp(((10 - stress) / 10) * 20, 0, 20); // inverted — lower stress is better
  const recoveryPts = clamp((recoveryMax > 0 ? recoveryCount / recoveryMax : 0) * 15, 0, 15);
  const consistencyPts = clamp((Math.min(streak, 10) / 10) * 10, 0, 10);
  const score = Math.round(sleepPts + energyPts + stressPts + recoveryPts + consistencyPts);
  return {
    score: clamp(score, 0, 100),
    breakdown: {
      sleep: r1(sleepPts), energy: r1(energyPts), stress: r1(stressPts),
      recovery: r1(recoveryPts), consistency: r1(consistencyPts),
    },
  };
}

export function readinessBand(score) {
  if (score >= 80) return { label: 'Primed', color: 'var(--success)' };
  if (score >= 60) return { label: 'Ready', color: 'var(--accent-primary)' };
  if (score >= 40) return { label: 'Moderate', color: 'var(--warning)' };
  return { label: 'Compromised', color: 'var(--error)' };
}

// ---- Body fat % — Navy circumference method (US Navy, Hodgdon & Beckett 1984) ----
// Units: cm for all circumferences and height. Returns null if inputs are missing.
export function bodyFatNavyMale({ waistCm, neckCm, heightCm }) {
  if (!waistCm || !neckCm || !heightCm || waistCm <= neckCm) return null;
  const bf = 86.010 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76;
  return Math.round(Math.max(2, Math.min(60, bf)) * 10) / 10;
}
export function bodyFatNavyFemale({ waistCm, hipCm, neckCm, heightCm }) {
  if (!waistCm || !hipCm || !neckCm || !heightCm || waistCm + hipCm <= neckCm) return null;
  const bf = 163.205 * Math.log10(waistCm + hipCm - neckCm) - 97.684 * Math.log10(heightCm) - 78.387;
  return Math.round(Math.max(2, Math.min(60, bf)) * 10) / 10;
}

// ---- Weight-change prediction ----
// A transparent, simplified energy-balance model: 1 kg of body-fat mass holds
// roughly 7700 kcal. A sustained daily deficit is converted to a weekly rate,
// then nudged by four modifiers backed by the literature cited above:
//   • protein adequacy   → preserves lean mass, so more of the loss is fat (helps rate hold up)
//   • sleep quality      → poor sleep measurably blunts fat-loss efficiency
//   • training volume    → resistance work preserves lean mass under a deficit
//   • stress             → chronically elevated cortisol dampens fat-loss efficiency
// Three scenarios (conservative/realistic/optimistic) bracket the uncertainty;
// confidence reflects how many of the last 30 days actually have logged data.
const KCAL_PER_KG_FAT = 7700;

export function computeWeightPrediction({ avgDailyDeficit = 0, avgProteinAdequacy = 0.7, avgSleepQuality = 6, avgTrainingSessionsPerWeek = 0, avgStress = 5, daysLogged = 0 }) {
  const baseWeeklyKg = (avgDailyDeficit * 7) / KCAL_PER_KG_FAT;

  const proteinMod = 0.85 + clamp(avgProteinAdequacy, 0, 1.3) * 0.2; // 0.85–1.11
  const sleepMod = 0.8 + (clamp(avgSleepQuality, 0, 10) / 10) * 0.3; // 0.8–1.1
  const trainingMod = 0.9 + Math.min(avgTrainingSessionsPerWeek, 5) * 0.03; // up to +15%
  const stressMod = 1.1 - (clamp(avgStress, 0, 10) / 10) * 0.3; // 0.8–1.1

  const efficiency = proteinMod * sleepMod * trainingMod * stressMod; // composite multiplier
  const realisticWeekly = baseWeeklyKg * efficiency;
  const conservativeWeekly = realisticWeekly * 0.65;
  const optimisticWeekly = realisticWeekly * 1.25;

  const horizonsWeeks = [4, 8, 12, 26];
  const project = (weekly) => Object.fromEntries(horizonsWeeks.map((w) => [`${w}w`, r1(weekly * w)]));

  const confidence = clamp(Math.round((daysLogged / 30) * 100), 5, 97);

  return {
    weeklyRateKg: { conservative: r1(conservativeWeekly), realistic: r1(realisticWeekly), optimistic: r1(optimisticWeekly) },
    projectedChangeKg: { conservative: project(conservativeWeekly), realistic: project(realisticWeekly), optimistic: project(optimisticWeekly) },
    confidence,
    efficiency: r1(efficiency * 100),
  };
}

// ---- Overtraining / under-recovery alerts (health-specific; distinct from the
// broader cross-domain burnout.js triggers) ----
export function checkOvertrainingTriggers({ energyLogs = [], workouts = [] }) {
  const alerts = [];
  const recent = [...energyLogs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last3 = recent.slice(0, 3);
  const last5 = recent.slice(0, 5);

  if (last3.length >= 3 && last3.every((l) => l.energyStartLevel < 5)) {
    alerts.push({ id: 'energy-low-3d', level: 'danger', message: 'Energy below 5/10 for 3+ consecutive days — consider a deload.' });
  }
  if (last5.filter((l) => l.stressLevel > 7).length >= 5) {
    alerts.push({ id: 'stress-high-5d', level: 'danger', message: 'Stress above 7/10 for 5 of the last 5 logged days.' });
  }
  if (last5.filter((l) => (l.sleepData?.sleepQualityScore ?? 10) < 5).length >= 5) {
    alerts.push({ id: 'sleep-low-5d', level: 'danger', message: 'Sleep quality below 5/10 for 5 of the last 5 logged days.' });
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekWorkouts = workouts.filter((w) => w.date && new Date(w.date).getTime() >= weekAgo);
  const highRpeCount = weekWorkouts.filter((w) => Number(w.avgRpe) >= 8.5).length;
  if (highRpeCount >= 4) {
    alerts.push({ id: 'high-rpe-week', level: 'warning', message: `${highRpeCount} sessions at RPE 8.5+ this week — recovery may be lagging behind training load.` });
  }
  return alerts;
}

// ---- Rule-based "AI Coach" recommendation ----
// NOTE: this is a deterministic, local heuristic — not a live LLM/OpenRouter
// call (the app is a client-only local-first SPA with no backend to hold an
// API key safely). It reads the same signals a prompt to a model would, and
// returns the single highest-priority, ready-to-read recommendation.
export function generateCoachRecommendation({ sleepQuality = null, energy = null, stress = null, readiness = null, overtrainingAlerts = [], workoutsThisWeek = 0 }) {
  if (overtrainingAlerts.some((a) => a.level === 'danger')) {
    return { text: overtrainingAlerts.find((a) => a.level === 'danger').message + ' Prioritize rest today.', tone: 'danger' };
  }
  if (sleepQuality !== null && sleepQuality < 5) {
    return { text: 'Sleep quality has been poor — protect your wind-down tonight (screens off 30 min before bed) before pushing training intensity.', tone: 'warning' };
  }
  if (stress !== null && stress >= 7) {
    return { text: 'Stress is elevated. A short walk or 10 minutes of breathing work will likely do more for you today than another hard session.', tone: 'warning' };
  }
  if (energy !== null && energy < 5) {
    return { text: 'Energy is low today — an easy Zone-2 session or full rest beats forcing high intensity.', tone: 'warning' };
  }
  if (readiness !== null && readiness >= 80) {
    return { text: `Readiness is strong (${readiness}/100) — a good day to push intensity or attempt a strength PR.`, tone: 'success' };
  }
  if (workoutsThisWeek === 0) {
    return { text: "No training logged yet this week — even a short session keeps momentum and today's recovery systems primed.", tone: 'info' };
  }
  return { text: 'Signals look balanced today — stick to the plan and log honestly, consistency compounds more than any single session.', tone: 'info' };
}

// ---- Pearson correlation coefficient (−1..1) over paired series ----
export function pearsonCorrelation(pairs) {
  const clean = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = clean.length;
  if (n < 3) return null;
  const xs = clean.map((p) => p[0]);
  const ys = clean.map((p) => p[1]);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return Math.round((num / denom) * 100) / 100;
}

// ---- Sleep timing optimization ----
// Among the user's own highest-quality nights (score >= 8), find the most
// common bedtime/wake-time hour — a personalized "best window" instead of a
// generic recommendation, since chronotype varies person to person.
export function bestSleepWindow(energyLogs) {
  const good = energyLogs.filter((l) => (l.sleepData?.sleepQualityScore ?? 0) >= 8 && l.sleepData?.sleepStartTime && l.sleepData?.wakeTime);
  if (good.length < 3) return null;
  const mode = (arr) => {
    const counts = {};
    for (const v of arr) counts[v] = (counts[v] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };
  const bedHours = good.map((l) => l.sleepData.sleepStartTime.slice(0, 2) + ':00');
  const wakeHours = good.map((l) => l.sleepData.wakeTime.slice(0, 2) + ':00');
  const avgQuality = r1(good.reduce((a, l) => a + l.sleepData.sleepQualityScore, 0) / good.length);
  return { bedtime: mode(bedHours), wakeTime: mode(wakeHours), sampleSize: good.length, avgQuality };
}

// ---- Menstrual cycle phase (optional tracker) ----
// Simple calendar-based estimate from logged cycle-start dates — NOT a medical
// prediction, just a phase label to correlate against energy/mood/performance
// (Reed & Carr 2018 endocrine-review phase definitions: menstrual/follicular/
// ovulation/luteal as roughly days 1-5 / 6-13 / 14-15 / 16-28 of a 28-day cycle).
export function computeCyclePhase(cycleStartDates, avgCycleLength, today) {
  if (!cycleStartDates.length) return null;
  const sorted = [...cycleStartDates].sort();
  const lastStart = new Date(sorted[sorted.length - 1] + 'T00:00:00');
  const todayDate = new Date(today + 'T00:00:00');
  const dayOfCycle = Math.floor((todayDate - lastStart) / 86400000) + 1;
  const cycleLen = avgCycleLength || estimateCycleLength(sorted) || 28;
  if (dayOfCycle < 1 || dayOfCycle > cycleLen + 5) return { dayOfCycle: null, phase: 'unknown', cycleLength: cycleLen };

  let phase;
  if (dayOfCycle <= 5) phase = 'menstrual';
  else if (dayOfCycle <= cycleLen * 0.46) phase = 'follicular';
  else if (dayOfCycle <= cycleLen * 0.54) phase = 'ovulation';
  else phase = 'luteal';

  return { dayOfCycle, phase, cycleLength: cycleLen };
}

function estimateCycleLength(sortedDates) {
  if (sortedDates.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const gap = (new Date(sortedDates[i] + 'T00:00:00') - new Date(sortedDates[i - 1] + 'T00:00:00')) / 86400000;
    if (gap > 10 && gap < 60) gaps.push(gap);
  }
  return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
}

export const CYCLE_PHASE_LABEL = { menstrual: 'Menstrual', follicular: 'Follicular', ovulation: 'Ovulation', luteal: 'Luteal', unknown: 'Unknown' };
export const CYCLE_PHASE_COLOR = { menstrual: 'var(--error)', follicular: 'var(--accent-primary)', ovulation: 'var(--success)', luteal: 'var(--warning)', unknown: 'var(--text-secondary)' };

// ---- Health goal progress ----
// Three goal types (weight, strength-PR, sleep-quality), each reusing data the
// app already tracks rather than asking for anything new. `weeklyRateKg` (the
// realistic weekly rate from computeWeightPrediction) lets weight goals project
// an estimated completion date instead of just a static percentage.
export function computeGoalProgress(goal, { startWeightKg, currentWeightKg, currentPRs, sleepLogs, weeklyRateKg } = {}) {
  if (goal.type === 'weight') {
    if (currentWeightKg == null || startWeightKg == null) return { percent: 0, current: currentWeightKg ?? null, label: `${goal.targetKg}kg`, etaWeeks: null };
    const totalDelta = goal.targetKg - startWeightKg;
    const doneDelta = currentWeightKg - startWeightKg;
    const percent = totalDelta === 0 ? 100 : clamp((doneDelta / totalDelta) * 100, 0, 100);
    // Project an ETA only if the current weekly trend actually moves toward the
    // target (e.g. losing weight while the goal is also below current weight).
    const remaining = goal.targetKg - currentWeightKg;
    const movingTowardGoal = weeklyRateKg && Math.abs(weeklyRateKg) > 0.01 && Math.sign(remaining) === -Math.sign(weeklyRateKg);
    const etaWeeks = movingTowardGoal ? Math.round(Math.abs(remaining / weeklyRateKg)) : null;
    return { percent: r1(percent), current: currentWeightKg, label: `${goal.targetKg}kg`, etaWeeks };
  }
  if (goal.type === 'strength') {
    const pr = (currentPRs || []).find((p) => p.exercise?.toLowerCase() === goal.exercise?.toLowerCase());
    const current = pr?.weight ?? 0;
    const percent = clamp((current / goal.targetKg) * 100, 0, 100);
    return { percent: r1(percent), current, label: `${goal.targetKg}kg on ${goal.exercise}`, etaWeeks: null };
  }
  if (goal.type === 'sleep') {
    const recent = (sleepLogs || []).slice(-30).map((l) => l.sleepData?.sleepQualityScore).filter((v) => v != null);
    const current = recent.length ? r1(recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
    const percent = clamp((current / goal.targetScore) * 100, 0, 100);
    return { percent: r1(percent), current, label: `${goal.targetScore}/10 avg sleep quality`, etaWeeks: null };
  }
  return { percent: 0, current: null, label: '', etaWeeks: null };
}

export function correlationStrength(r) {
  if (r === null) return { label: 'Not enough data', color: 'var(--text-secondary)' };
  const abs = Math.abs(r);
  if (abs >= 0.6) return { label: 'Strong', color: r > 0 ? 'var(--success)' : 'var(--error)' };
  if (abs >= 0.3) return { label: 'Moderate', color: 'var(--warning)' };
  return { label: 'Weak', color: 'var(--text-secondary)' };
}
