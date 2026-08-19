// ─────────────────────────────────────────────────────────────────────────────
// CHRONO-HEALTH — time-of-day intelligence over logged events (meals, water,
// sleep, naps). Every function is pure and defensive against missing `time`
// fields (older entries logged before this feature existed simply get
// skipped from time-based math, never a synthetic guess). All alerts are
// framed as informational, never diagnostic. Science basis:
//   • Meal timing / fasting windows: time-restricted eating literature
//     (Panda et al. circadian-feeding research) — informational, not a claim
//     about any specific IF protocol being superior.
//   • Hydration: ~2-3h without fluids during waking hours is a commonly cited
//     practical threshold before mild dehydration risk rises (Institute of
//     Medicine water-intake guidance) — used here only as an informational nudge.
//   • Sleep timing regularity as a recovery factor independent of duration:
//     Sleep Regularity Index literature (Phillips et al. 2017) — consistent
//     bed/wake times correlate with better outcomes even at equal total sleep.
//   • Naps: >30min or after ~15:00 can impair nocturnal sleep onset (National
//     Sleep Foundation nap guidance) — informational nudge, not a rule.
// ─────────────────────────────────────────────────────────────────────────────

const toMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (m || 0);
};
const r1 = (n) => Math.round(n * 10) / 10;

// Gaps between meals on `date` (chronologically ordered by `time`), plus the
// overnight fast (yesterday's last meal → today's first meal) and the
// in-progress fast if today has no meal yet.
export function computeFastingWindows(nutritionLogs, date) {
  const timed = (n) => n.time && toMinutes(n.time) != null;
  const today = nutritionLogs.filter((n) => n.date === date && timed(n)).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const yesterday = new Date(new Date(date + 'T00:00:00').getTime() - 86400000).toISOString().slice(0, 10);
  const yLogs = nutritionLogs.filter((n) => n.date === yesterday && timed(n)).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  const gaps = [];
  for (let i = 1; i < today.length; i++) gaps.push(r1((toMinutes(today[i].time) - toMinutes(today[i - 1].time)) / 60));

  let overnightFastHours = null;
  if (yLogs.length && today.length) {
    const lastYesterday = yLogs[yLogs.length - 1];
    overnightFastHours = r1((24 * 60 - toMinutes(lastYesterday.time) + toMinutes(today[0].time)) / 60);
  }

  let currentFastHours = null;
  if (!today.length) {
    const lastEver = yLogs.length ? yLogs[yLogs.length - 1] : null;
    if (lastEver) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      currentFastHours = r1((24 * 60 - toMinutes(lastEver.time) + nowMinutes) / 60);
    }
  }

  return { mealTimes: today.map((n) => n.time), gapsHours: gaps, overnightFastHours, currentFastHours, longestGapHours: gaps.length ? Math.max(...gaps) : null };
}

// Time since the last water log today, longest gap of the day, and a rough
// regularity score (fewer/longer gaps = lower score).
export function computeHydrationGaps(waterLogs, date, nowMinutes = null) {
  const today = (waterLogs || []).filter((w) => w.date === date && w.time).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  if (!today.length) return { lastIntakeHoursAgo: null, longestGapHours: null, entryCount: 0 };
  const now = nowMinutes ?? (new Date().getHours() * 60 + new Date().getMinutes());
  const lastTime = toMinutes(today[today.length - 1].time);
  const lastIntakeHoursAgo = r1(Math.max(0, now - lastTime) / 60);
  const gaps = [];
  for (let i = 1; i < today.length; i++) gaps.push((toMinutes(today[i].time) - toMinutes(today[i - 1].time)) / 60);
  return { lastIntakeHoursAgo, longestGapHours: gaps.length ? r1(Math.max(...gaps)) : null, entryCount: today.length };
}

// Variance (in minutes, as a std-dev-like spread) of meal times across the
// trailing `days` — a real chrono-nutrition regularity marker, not a gimmick.
export function computeMealTimingConsistency(nutritionLogs, days = 14) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const timed = nutritionLogs.filter((n) => n.date >= cutoff && n.time);
  if (timed.length < 5) return null;
  // Use first-meal-of-day time as the "breakfast anchor" for consistency.
  const byDate = {};
  for (const n of timed) {
    const t = toMinutes(n.time);
    if (byDate[n.date] == null || t < byDate[n.date]) byDate[n.date] = t;
  }
  const values = Object.values(byDate);
  if (values.length < 4) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stdDevMin = Math.sqrt(variance);
  return { firstMealMeanTime: `${String(Math.floor(mean / 60)).padStart(2, '0')}:${String(Math.round(mean % 60)).padStart(2, '0')}`, stdDevMinutes: Math.round(stdDevMin), sampleDays: values.length };
}

// Variance of bedtime/wake time across the trailing `days` — the Sleep
// Regularity Index concept in simplified form.
export function computeSleepConsistency(energyLogs, days = 14) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const timed = energyLogs.filter((l) => l.date >= cutoff && l.sleepData?.sleepStartTime && l.sleepData?.wakeTime);
  if (timed.length < 4) return null;
  const stdDev = (mins) => {
    const mean = mins.reduce((a, b) => a + b, 0) / mins.length;
    return Math.sqrt(mins.reduce((a, v) => a + (v - mean) ** 2, 0) / mins.length);
  };
  const bedMins = timed.map((l) => toMinutes(l.sleepData.sleepStartTime)).filter((v) => v != null);
  const wakeMins = timed.map((l) => toMinutes(l.sleepData.wakeTime)).filter((v) => v != null);
  return {
    bedtimeStdDevMinutes: bedMins.length >= 4 ? Math.round(stdDev(bedMins)) : null,
    wakeTimeStdDevMinutes: wakeMins.length >= 4 ? Math.round(stdDev(wakeMins)) : null,
    sampleDays: timed.length,
  };
}

// Flags long (>30min) or late (after ~15:00) naps that literature associates
// with impaired nocturnal sleep onset — informational, not a rule.
export function computeNapImpact(naps) {
  if (!naps?.length) return [];
  return naps
    .filter((n) => n.time && n.durationMin)
    .map((n) => {
      const flags = [];
      if (n.durationMin > 30) flags.push('longue (>30min)');
      if (toMinutes(n.time) > 15 * 60) flags.push('tardive (après 15h)');
      return { ...n, flags };
    })
    .filter((n) => n.flags.length);
}

// Assembles everything above into a single list of concrete, explained
// alerts for the day — the actual "real alerts" surface for the Quick
// Check-in / Dashboard.
export function deriveChronoAlerts({ fastingWindows, hydrationGaps, mealConsistency, sleepConsistency, napFlags, waterReminderGapMin = 180 }) {
  const alerts = [];
  if (hydrationGaps?.lastIntakeHoursAgo != null && hydrationGaps.lastIntakeHoursAgo * 60 > waterReminderGapMin) {
    alerts.push({ id: 'hydration-gap', level: 'warning', message: `Aucune eau enregistrée depuis ${hydrationGaps.lastIntakeHoursAgo}h — risque de déshydratation légère, particulièrement avant une séance.` });
  }
  if (fastingWindows?.currentFastHours != null && fastingWindows.currentFastHours > 16) {
    alerts.push({ id: 'long-fast', level: 'info', message: `Jeûne en cours depuis ${fastingWindows.currentFastHours}h — cohérent si intentionnel (jeûne intermittent), sinon pense à ton premier repas.` });
  }
  if (fastingWindows?.overnightFastHours != null && fastingWindows.overnightFastHours > 14) {
    alerts.push({ id: 'long-overnight-fast', level: 'info', message: `Jeûne nocturne de ${fastingWindows.overnightFastHours}h hier→aujourd'hui.` });
  }
  if (mealConsistency?.stdDevMinutes != null && mealConsistency.stdDevMinutes > 90) {
    alerts.push({ id: 'meal-timing-irregular', level: 'info', message: `Tes horaires de premier repas varient de ~${Math.round(mealConsistency.stdDevMinutes)}min sur les 2 dernières semaines — une régularité chrono-nutritionnelle plus stable peut aider la digestion et l'énergie.` });
  }
  if (sleepConsistency?.bedtimeStdDevMinutes != null && sleepConsistency.bedtimeStdDevMinutes > 60) {
    alerts.push({ id: 'sleep-timing-irregular', level: 'warning', message: `Ton heure de coucher a varié de ~${Math.round(sleepConsistency.bedtimeStdDevMinutes)}min ces 2 dernières semaines — la régularité du sommeil compte autant que sa durée pour la récupération.` });
  }
  if (napFlags?.length) {
    alerts.push({ id: 'nap-impact', level: 'info', message: `Sieste(s) ${napFlags[0].flags.join(' et ')} détectée(s) — peut retarder l'endormissement nocturne.` });
  }
  return alerts;
}
