// Sleep quality score (0-10) derived from BOTH bedtime and wake time (per spec fix).
// Same-day sleep (e.g. 07:00 → 14:00) returns 0 — day-sleeping is not restorative
// regardless of duration.

const toMin = (t) => {
  const [h, m] = String(t || '00:00').split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
};

// Duration in minutes; treats wake <= bed as an overnight sleep spanning midnight,
// unless bed is clearly in the daytime (see day-sleep guard below).
function durationMinutes(bedMin, wakeMin) {
  if (wakeMin < bedMin) return 24 * 60 - bedMin + wakeMin; // spans midnight
  return wakeMin - bedMin; // same day
}

export function calculateSleepScore(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null;
  const bedMin = toMin(bedtime);
  const wakeMin = toMin(wakeTime);
  const bedHour = Math.floor(bedMin / 60);
  const wakeHour = Math.floor(wakeMin / 60);

  // DAY SLEEP GUARD: bed between 06:00 and 17:59 on the same day → invalid
  if (wakeMin > bedMin && bedHour >= 6 && bedHour < 18) {
    return { score: 0, durationHours: (wakeMin - bedMin) / 60, durationScore: 0, timingScore: 0, band: 'daySleep' };
  }

  const durationHours = durationMinutes(bedMin, wakeMin) / 60;

  // ---- Duration score (0-5), optimal 7-9h
  let durationScore;
  if (durationHours < 6) durationScore = 2;
  else if (durationHours < 7) durationScore = 3;
  else if (durationHours < 9) durationScore = 5;
  else if (durationHours < 10) durationScore = 4;
  else durationScore = 2;

  // ---- Timing score (0-5): bedtime + wake window
  let timingScore = 0;
  // Bedtime (21:00-23:00 optimal, wider "acceptable" bands)
  if (bedHour >= 21 && bedHour <= 22) timingScore += 2.5; // 21:00–22:59 core window
  else if (bedHour === 23 && bedMin <= 30) timingScore += 2; // 23:00–23:30 still fine
  else if (bedHour === 23) timingScore += 1.5; // 23:31–23:59
  else if (bedHour === 20) timingScore += 1.5; // a bit early
  else if (bedHour === 0) timingScore += 1; // 00:00–00:59 late
  else if (bedHour >= 1 && bedHour <= 4) timingScore += 0.5; // very late
  // else 0 (extreme)

  // Wake time (06:00-08:00 optimal)
  if (wakeHour >= 6 && wakeHour <= 8) timingScore += 2.5;
  else if (wakeHour === 5 || wakeHour === 9) timingScore += 1.5;
  else if (wakeHour === 4 || wakeHour === 10) timingScore += 0.5;
  // else 0 (extreme)

  const total = Math.min(10, durationScore + timingScore);
  return { score: Math.round(total * 10) / 10, durationHours, durationScore, timingScore, band: bandFor(total) };
}

function bandFor(score) {
  if (score >= 9) return 'excellent';
  if (score >= 7) return 'good';
  if (score >= 5) return 'poor';
  return 'critical';
}

export const SLEEP_BAND_COLOR = {
  excellent: 'var(--success)',
  good: 'var(--warning)',
  poor: '#ff9a3d', // orange (poor)
  critical: 'var(--error)',
  daySleep: 'var(--error)',
};

export const SLEEP_BAND_LABEL = {
  excellent: 'Excellent',
  good: 'Good',
  poor: 'Needs improvement',
  critical: 'Critical',
  daySleep: 'Day sleep — invalid',
};

// Back-compat shim: the old signature returned a number and was called with
// (sleepHours, sleepStartTime). We now derive properly from bed + wake times.
// If the caller only has sleepHours, fall back to a duration-only estimate.
export function calculateSleepQualityScore(sleepHours, sleepStartTime, wakeTime) {
  if (wakeTime && sleepStartTime) return calculateSleepScore(sleepStartTime, wakeTime)?.score ?? 0;
  // Legacy path: duration-only
  const h = Number(sleepHours) || 0;
  if (h < 5) return 1;
  if (h < 6) return 4;
  if (h < 7) return 6;
  if (h < 9) return 9;
  if (h < 10) return 7;
  return 4;
}
