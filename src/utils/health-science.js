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

// ---- BMR / TDEE (Mifflin-St Jeor — the modern standard, more accurate than
// Harris-Benedict for most adults) ----
export const ACTIVITY_MULTIPLIERS = {
  sedentary: { label: 'Sedentary (little/no exercise)', mult: 1.2 },
  light: { label: 'Light (exercise 1-3x/week)', mult: 1.375 },
  moderate: { label: 'Moderate (exercise 3-5x/week)', mult: 1.55 },
  active: { label: 'Active (exercise 6-7x/week)', mult: 1.725 },
  veryActive: { label: 'Very active (hard exercise + physical job)', mult: 1.9 },
};

export function computeBMR({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'female' ? base - 161 : base + 5);
}

export function computeTDEE(bmr, activityLevel) {
  if (!bmr) return null;
  const mult = ACTIVITY_MULTIPLIERS[activityLevel]?.mult ?? ACTIVITY_MULTIPLIERS.sedentary.mult;
  return Math.round(bmr * mult);
}

// ---- Weight units (all workout/body-comp data is stored in kg; these only
// convert for display/input in the optional lb view) ----
const KG_PER_LB = 0.453592;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;

// Epley formula, the standard estimate for reps under ~12 (beyond that the
// linear model overstates 1RM, but it's still a useful relative signal).
export function estimate1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
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

// ---- Training-load-aware sleep target ----
// General adult guidance is 7-9h/night (NSF's 2015 review of 133 meta-
// analyses across ~3200 studies). Athletes / high training-load individuals
// consistently show a higher real need in the literature — commonly cited
// as 8-10h, with studies on sleep-restricted athletes linking <6h to
// materially higher injury risk. This isn't a fixed "athlete" vs "everyone
// else" split though: what counts as a demanding day is relative to what a
// given person normally does, so the target below compares TODAY's training
// load to that same person's own trailing 14-day average rather than to an
// absolute number.
const CARDIO_ZONE_LOAD_MULT = { zone1: 0.5, zone2: 0.7, zone3: 1, zone4: 1.3, zone5: 1.6, hiit: 1.5, liss: 0.6 };

// A single day's training load — RPE-weighted volume for gym work (a set at
// RPE 9 counts for more than the same reps×weight logged at RPE 5) plus
// zone-weighted cardio minutes. Deliberately unitless: never compared to an
// absolute scale, only ever to this same person's own recent days below.
export function computeDailyTrainingLoad(workouts, dateKey) {
  const dayWorkouts = workouts.filter((w) => w.date === dateKey);
  let gymLoad = 0;
  for (const w of dayWorkouts) {
    if (w.type !== 'strength' || !w.sets) continue;
    for (const s of w.sets) {
      const vol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
      const rpeMult = s.rpe ? Number(s.rpe) / 7 : 1; // 7 treated as a "normal effort" reference point
      gymLoad += vol * rpeMult;
    }
  }
  let cardioLoad = 0;
  for (const w of dayWorkouts) {
    if (w.type !== 'cardio') continue;
    cardioLoad += (w.durationMin || 0) * (CARDIO_ZONE_LOAD_MULT[w.sessionType] ?? 1);
  }
  return gymLoad / 10 + cardioLoad; // gym volume runs an order of magnitude above cardio minutes — this brings the two onto a comparable scale
}

// Tonight's sleep-duration target, informed by how hard TODAY was relative
// to this person's own recent training. Extension toward the athlete range
// is framed as the research suggests it should be used: an earlier bedtime
// rather than a later wake time (large wake-time shifts disrupt circadian
// regularity per the NSF's 2023 sleep-regularity consensus statement more
// than an earlier bedtime does) — bedtimeSuggestion below is computed that
// way when a known wake-time anchor is available.
export function getSleepLoadTarget(workouts, dateKey, wakeTimeAnchor) {
  const today = computeDailyTrainingLoad(workouts, dateKey);
  const history = [];
  const d = new Date(dateKey + 'T00:00:00');
  for (let i = 1; i <= 14; i++) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - i);
    // Local-date formatting, NOT toISOString() — that converts to UTC, which
    // silently shifts every date back a day (and drops a real day of
    // history) for anyone west of UTC. Matches todayKey()'s own convention.
    const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    history.push(computeDailyTrainingLoad(workouts, key));
  }
  const sampled = history.filter((v) => v > 0);
  const avg = sampled.length ? sampled.reduce((a, v) => a + v, 0) / sampled.length : 0;

  let tier, targetMin, targetMax;
  if (today === 0) {
    tier = 'rest'; targetMin = 7; targetMax = 8;
  } else if (sampled.length < 3) {
    // Not enough of this person's own history yet to say today was
    // unusually big — stick to the general-adult range rather than overclaim.
    tier = 'normal'; targetMin = 7; targetMax = 9;
  } else if (today >= avg * 1.4) {
    tier = 'high'; targetMin = 9; targetMax = 10;
  } else if (today >= avg * 0.7) {
    tier = 'normal'; targetMin = 7; targetMax = 9;
  } else {
    tier = 'light'; targetMin = 7; targetMax = 8;
  }

  let bedtimeSuggestion = null;
  if (wakeTimeAnchor) {
    const [h, m] = wakeTimeAnchor.split(':').map(Number);
    const wakeMin = h * 60 + m;
    const bedMin = ((wakeMin - targetMax * 60) % 1440 + 1440) % 1440;
    bedtimeSuggestion = `${String(Math.floor(bedMin / 60)).padStart(2, '0')}:${String(bedMin % 60).padStart(2, '0')}`;
  }

  return { tier, targetMin, targetMax, todayLoad: r1(today), avgLoad: r1(avg), bedtimeSuggestion };
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

export function estimateCycleLength(sortedDates) {
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

// ---- Cycle-phase-aware coaching notes ----
// Informational framing only (Reed & Carr 2018 phase definitions, same as
// computeCyclePhase above) — never prescriptive, never a claim about what any
// individual "should" do. Training-load note is a suggestion to consider, not
// an instruction to alter a program.
export const CYCLE_PHASE_COACHING = {
  menstrual: { note: "Phase menstruelle : l'énergie et la tolérance à l'effort peuvent être plus basses pour certaines personnes — ajuste l'intensité si tu en ressens le besoin, ce n'est pas un manque de discipline.", trainingLoadHint: 'lighter_ok' },
  follicular: { note: "Phase folliculaire : l'énergie et la récupération tendent à être plus favorables — souvent une bonne fenêtre pour pousser l'intensité si le reste des signaux (sommeil, stress) est bon.", trainingLoadHint: 'push_ok' },
  ovulation: { note: 'Phase ovulatoire : pic de performance rapporté chez certaines personnes — reste à l\'écoute de tes propres signaux plutôt que de la généralité.', trainingLoadHint: 'push_ok' },
  luteal: { note: 'Phase lutéale : besoin calorique légèrement plus élevé et fluctuations d\'humeur/énergie sont normaux — ce n\'est pas un signal d\'échec si les performances varient.', trainingLoadHint: 'moderate' },
  unknown: { note: null, trainingLoadHint: null },
};

export function cyclePhaseCoachingNote(phase) {
  return CYCLE_PHASE_COACHING[phase] || CYCLE_PHASE_COACHING.unknown;
}

// ---- Health goal progress ----
// Three goal types (weight, strength-PR, sleep-quality), each reusing data the
// app already tracks rather than asking for anything new. `weeklyRateKg` (the
// realistic weekly rate from computeWeightPrediction) lets weight goals project
// an estimated completion date instead of just a static percentage.
export function computeGoalProgress(goal, { startWeightKg, currentWeightKg, currentPRs, sleepLogs, weeklyRateKg, currentBodyFatPct, workoutsPerWeek } = {}) {
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
  if (goal.type === 'bodyfat') {
    // Body fat is a REDUCTION goal (target < start, typically) — percent moved
    // is measured the same directional way as the weight goal above.
    if (currentBodyFatPct == null || goal.startBodyFatPct == null) return { percent: 0, current: currentBodyFatPct ?? null, label: `${goal.targetBodyFatPct}% body fat`, etaWeeks: null };
    const totalDelta = goal.targetBodyFatPct - goal.startBodyFatPct;
    const doneDelta = currentBodyFatPct - goal.startBodyFatPct;
    const percent = totalDelta === 0 ? 100 : clamp((doneDelta / totalDelta) * 100, 0, 100);
    return { percent: r1(percent), current: currentBodyFatPct, label: `${goal.targetBodyFatPct}% body fat`, etaWeeks: null };
  }
  if (goal.type === 'workoutFrequency') {
    const current = workoutsPerWeek ?? 0;
    const percent = clamp((current / goal.targetPerWeek) * 100, 0, 100);
    return { percent: r1(percent), current: r1(current), label: `${goal.targetPerWeek} workouts/week`, etaWeeks: null };
  }
  return { percent: 0, current: null, label: '', etaWeeks: null };
}

// ---- Additional body-fat % estimation methods (shown alongside Navy, not
// instead of it — each has different required inputs, so the UI can show
// whichever subset the user has actually measured) ----

// YMCA method (weight + waist only, no tape-around-neck needed) — coarser
// than Navy but useful as a quick cross-check or when neck wasn't measured.
export function bodyFatYMCA({ weightKg, waistCm, sex }) {
  if (!weightKg || !waistCm) return null;
  const weightLb = weightKg / 0.453592;
  const waistIn = waistCm / 2.54;
  const bf = sex === 'female'
    ? ((waistIn * 4.15) - (weightLb * 0.082) - 76.76) / weightLb * 100 // approximation for female, same family of formula
    : ((waistIn * 4.15) - (weightLb * 0.082) - 98.42) / weightLb * 100;
  if (!Number.isFinite(bf)) return null;
  return Math.round(Math.max(2, Math.min(60, bf)) * 10) / 10;
}

// Deurenberg et al. 1991 — BMI-based estimate, needs only weight/height/age/
// sex (no tape measure at all). Systematically less precise than circumference
// methods but a useful "at least something" fallback when no measurements exist.
export function bodyFatDeurenberg({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age) return null;
  const bmi = weightKg / ((heightCm / 100) ** 2);
  const sexFactor = sex === 'female' ? 0 : 1;
  const bf = 1.20 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  return Math.round(Math.max(2, Math.min(60, bf)) * 10) / 10;
}

// Fat-Free Mass Index (Kouri et al. 1995) — height-normalized lean mass, the
// standard natural-lifter muscularity index. A rising FFMI at stable/falling
// body-fat % is the real "am I building muscle" signal — more meaningful than
// watching total bodyweight alone, which conflates fat and muscle changes.
export function estimateFFMI({ weightKg, heightCm, bodyFatPct }) {
  if (!weightKg || !heightCm || bodyFatPct == null) return null;
  const leanKg = weightKg * (1 - bodyFatPct / 100);
  const heightM = heightCm / 100;
  const ffmi = leanKg / (heightM * heightM);
  // Normalized FFMI adjusts for height so a taller/shorter lifter compares fairly.
  const normalizedFfmi = ffmi + 6.1 * (1.8 - heightM);
  return { ffmi: r1(ffmi), normalizedFfmi: r1(normalizedFfmi), leanMassKg: r1(leanKg) };
}

export function estimateLeanMassKg({ weightKg, bodyFatPct }) {
  if (!weightKg || bodyFatPct == null) return null;
  return r1(weightKg * (1 - bodyFatPct / 100));
}

// Simple trailing moving average over a date-sorted array of {date, [key]}
// entries — smooths day-to-day noise (water retention, gut content, timing)
// out of weight/body-fat/waist trend lines so the underlying trend reads
// clearly. Returns entries augmented with a `${key}MA` field; entries with
// no value for `key` are skipped from the average (no synthetic zero-fill).
export function smoothedTrend(entries, key, windowDays = 7) {
  const sorted = [...entries]
    .filter((e) => e[key] != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((entry, i) => {
    const window = sorted.slice(Math.max(0, i - windowDays + 1), i + 1);
    const avg = window.reduce((a, e) => a + e[key], 0) / window.length;
    return { ...entry, [`${key}MA`]: r1(avg) };
  });
}

// ---- Cardiovascular fitness estimate from a logged cardio session ----
// Uth–Sørensen–Overgaard–Pedersen (2004) non-exercise-test estimate:
// VO2max ≈ 15.3 × (HRmax / HRrest). Needs a resting HR and either a known/
// estimated max HR (220 - age is the standard field estimate, not clinical).
export function estimateVO2max({ age, restingHr }) {
  if (!age || !restingHr) return null;
  const hrMax = 220 - age;
  const vo2max = 15.3 * (hrMax / restingHr);
  return Math.round(vo2max * 10) / 10;
}

export function correlationStrength(r) {
  if (r === null) return { label: 'Not enough data', color: 'var(--text-secondary)' };
  const abs = Math.abs(r);
  if (abs >= 0.6) return { label: 'Strong', color: r > 0 ? 'var(--success)' : 'var(--error)' };
  if (abs >= 0.3) return { label: 'Moderate', color: 'var(--warning)' };
  return { label: 'Weak', color: 'var(--text-secondary)' };
}
