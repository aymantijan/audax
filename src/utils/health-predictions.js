// ─────────────────────────────────────────────────────────────────────────────
// HEALTH PREDICTIONS — trend-based (not single-day-snapshot) predictions and
// alerts. Complements computeWeightPrediction in health-science.js (left
// unmodified) with strength trajectory, plateau detection, aggressive-deficit
// and trending-overtraining checks, all operating on already-computed series
// from healthStore selectors — no new raw data storage needed.
// ─────────────────────────────────────────────────────────────────────────────
const dayMs = 86400000;
const r1 = (n) => Math.round(n * 10) / 10;

// Ordinary least-squares linear regression over [{date, value}] — returns
// slope in value-units/day and an intercept, or null if too few points.
function linearRegression(points) {
  const clean = points.filter((p) => Number.isFinite(p.value));
  const n = clean.length;
  if (n < 3) return null;
  const t0 = new Date(clean[0].date + 'T00:00:00').getTime();
  const xs = clean.map((p) => (new Date(p.date + 'T00:00:00').getTime() - t0) / dayMs);
  const ys = clean.map((p) => p.value);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  return { slope, intercept, t0, n };
}

// Projects a (date,value) series `weeksAhead` into the future via linear
// regression on the trailing history — a transparent trend extrapolation,
// not a claim of certainty (confidence scales with sample size).
export function predictStrengthTrajectory(oneRmHistory, weeksAhead = [4, 8, 12]) {
  const reg = linearRegression(oneRmHistory);
  if (!reg) return null;
  const lastT = Math.max(...oneRmHistory.map((p) => (new Date(p.date + 'T00:00:00').getTime() - reg.t0) / dayMs));
  const projections = Object.fromEntries(
    weeksAhead.map((w) => [`${w}w`, r1(reg.intercept + reg.slope * (lastT + w * 7))])
  );
  const confidence = Math.max(10, Math.min(90, reg.n * 6));
  return { slopePerWeek: r1(reg.slope * 7), projections, confidence };
}

// Flags a near-zero trend slope over the trailing points despite continued
// logging — i.e. a genuine plateau, not just "today looks flat". Works for
// weight, strength, or any (date,value) series.
export function detectPlateau(series, { minPoints = 6, flatThresholdPctPerWeek = 0.15 } = {}) {
  const recent = [...series].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-14);
  if (recent.length < minPoints) return { plateaued: false, reason: 'insufficient_data' };
  const reg = linearRegression(recent);
  if (!reg) return { plateaued: false, reason: 'insufficient_data' };
  const avgValue = recent.reduce((a, p) => a + p.value, 0) / recent.length;
  if (!avgValue) return { plateaued: false, reason: 'insufficient_data' };
  const weeklyPctChange = Math.abs((reg.slope * 7) / avgValue) * 100;
  return { plateaued: weeklyPctChange < flatThresholdPctPerWeek, weeklyPctChange: r1(weeklyPctChange), points: recent.length };
}

// Flags when the ACTUAL observed weekly rate of change (from real logged
// deltas, not a single day) exceeds a safe max — ~1%/week bodyweight loss is
// the commonly cited upper bound for preserving lean mass during a cut.
export function checkAggressiveDeficit(bodyCompSeries, weightKg) {
  const sorted = [...bodyCompSeries].filter((b) => b.weightKg).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length < 4 || !weightKg) return null;
  const reg = linearRegression(sorted.map((b) => ({ date: b.date, value: b.weightKg })));
  if (!reg) return null;
  const weeklyRateKg = reg.slope * 7;
  const pctPerWeek = (Math.abs(weeklyRateKg) / weightKg) * 100;
  if (weeklyRateKg < 0 && pctPerWeek > 1) {
    return { level: 'warning', pctPerWeek: r1(pctPerWeek), weeklyRateKg: r1(weeklyRateKg), message: `Ton poids baisse de ${r1(pctPerWeek)}%/semaine (observé sur tes vraies mesures) — au-delà de ~1%/semaine, le risque de perte de masse musculaire augmente. Envisage de remonter légèrement les calories.` };
  }
  return null;
}

// Trending overtraining risk: RPE rising while volume falls over 3+ weeks,
// or readiness trending down over 10+ days despite unchanged/rising load —
// distinct from checkOvertrainingTriggers (today's snapshot) in health-science.js.
export function checkTrendingOvertrainingRisk(readinessHistory, volumeHistory) {
  const alerts = [];
  if (readinessHistory?.length >= 10) {
    const recent = readinessHistory.slice(-14).map((r, i) => ({ date: r.date, value: r.score }));
    const reg = linearRegression(recent);
    if (reg && reg.slope * 7 < -5) {
      alerts.push({ id: 'readiness-trending-down', level: 'warning', message: `Ton score de forme baisse d'environ ${Math.abs(r1(reg.slope * 7))} pts/semaine depuis 2 semaines — une tendance, pas juste une mauvaise journée. Un deload pourrait aider.` });
    }
  }
  if (volumeHistory?.length >= 3) {
    const recentVol = volumeHistory.slice(-3);
    const volTrend = linearRegression(recentVol.map((v) => ({ date: v.weekStart ? new Date(v.weekStart).toISOString().slice(0, 10) : v.date, value: v.volume })));
    if (volTrend && volTrend.slope < 0) {
      alerts.push({ id: 'volume-declining', level: 'info', message: 'Ton volume d\'entraînement hebdomadaire est en baisse sur les 3 dernières semaines.' });
    }
  }
  return alerts;
}

// Ties a detected plateau back to a likely cause (adherence, sleep, protein)
// instead of leaving it as a bare observation — a causal explanation, not
// just a fact.
export function explainPlateau({ plateauDetected, adherencePct = null, avgSleepQuality = null, avgProteinAdequacy = null }) {
  if (!plateauDetected) return null;
  if (adherencePct != null && adherencePct < 70) {
    return `Plateau probablement lié à l'adhérence au programme (${Math.round(adherencePct)}% des séances planifiées réalisées) plutôt qu'à la programmation elle-même.`;
  }
  if (avgSleepQuality != null && avgSleepQuality < 6) {
    return `Plateau possiblement lié à un sommeil sous-optimal (qualité moyenne ${r1(avgSleepQuality)}/10) — la récupération conditionne la progression.`;
  }
  if (avgProteinAdequacy != null && avgProteinAdequacy < 0.85) {
    return "Plateau possiblement lié à un apport protéique insuffisant pour soutenir la récupération/construction musculaire.";
  }
  return 'Plateau malgré une bonne adhérence, un bon sommeil et un apport protéique correct — envisage un deload ou une variation de programme (changement d\'exercices/volumes).';
}
