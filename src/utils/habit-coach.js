// Habit coach: spots habits that are slipping (→ smaller "mini" version,
// a reminder or an anchor), habits ready to grow back, and links between
// habits and the next day's energy / sleep / stress.
import { habitDayStatus, habitStreak } from './calculations';

const addDays = (key, n) => {
  const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// done / due over days [from, to] counted back from yesterday (today is never a miss).
function windowRate(habit, logs, today, from, to) {
  let done = 0; let due = 0;
  for (let i = from; i <= to; i++) {
    const st = habitDayStatus(habit, logs, addDays(today, -i), today);
    if (st === 'done') { done++; due++; } else if (st === 'missed') due++;
  }
  return { done, due, rate: due ? done / due : null };
}

// Weekly habits: quota met in each of the last `n` full weeks.
function weeksMet(habit, logs, today, n) {
  const d = new Date(today + 'T12:00:00');
  const monday = addDays(today, -((d.getDay() + 6) % 7)); // current (unfinished) week is not judged
  let met = 0;
  for (let w = 1; w <= n; w++) {
    const start = addDays(monday, -7 * w);
    let done = 0;
    for (let i = 0; i < 7; i++) if (logs.some((l) => l.date === addDays(start, i) && l.completed)) done++;
    if (done >= (Number(habit.timesPerWeek) || 1)) met++;
  }
  return met;
}

/** The smaller version proposed for a slipping habit, or null if nothing to shrink. */
export function miniChanges(habit) {
  if (habit.frequency === 'weekly' && (Number(habit.timesPerWeek) || 1) > 1) {
    const n = Number(habit.timesPerWeek) - 1;
    return { changes: { timesPerWeek: n }, text: `${n}×/semaine au lieu de ${habit.timesPerWeek}` };
  }
  if (habit.kind === 'quantity' && habit.direction !== 'atMost' && Number(habit.target) > 1) {
    const t = Math.max(1, Math.round(Number(habit.target) / 2));
    return { changes: { target: t }, text: `${t} ${habit.unit || ''} au lieu de ${habit.target}`.replace(/\s+au/, ' au') };
  }
  if (habit.kind === 'check' && Number(habit.duration) > 2) {
    const m = Math.max(2, Math.round(Number(habit.duration) / 3));
    return { changes: { duration: m }, text: `${m} min au lieu de ${habit.duration} : l’important est de ne pas casser la chaîne` };
  }
  return null;
}

/**
 * Coach advice, most useful first:
 * { type: 'slipping' | 'levelup', habit, recent, prior, mini?, fallback? }
 * fallback: 'reminder' | 'anchor' when there is nothing left to shrink.
 */
export function coachAdvice(habits, logs, today, snooze = {}) {
  const out = [];
  const active = habits.filter((h) => !h.archived && h.kind !== 'quit');
  const solid = active
    .map((h) => ({ h, s: habitStreak(h.id, logs, today, h) }))
    .filter((x) => x.h.frequency !== 'weekly' && x.s >= 7)
    .sort((a, b) => b.s - a.s)[0]?.h || null;
  for (const h of active) {
    if (snooze[h.id] && snooze[h.id] > today) continue;
    if (h.startDate && addDays(h.startDate, 7) > today) continue; // too new to judge
    const own = logs.filter((l) => l.habitId === h.id);
    if (h.frequency === 'weekly') {
      const met = weeksMet(h, own, today, 3);
      if (h.mini && met === 3) out.push({ type: 'levelup', habit: h, recent: met / 3 });
      else if (met <= 1 && addDays(h.startDate || today, 21) <= today) {
        out.push({ type: 'slipping', habit: h, recent: met / 3, weeks: true, mini: h.mini ? null : miniChanges(h), fallback: fallbackFor(h, solid) });
      }
      continue;
    }
    const recent = windowRate(h, own, today, 1, 14);
    const prior = windowRate(h, own, today, 15, 42);
    if (h.mini && recent.due >= 7 && recent.rate >= 0.85) {
      out.push({ type: 'levelup', habit: h, recent: recent.rate, done: recent.done, due: recent.due });
      continue;
    }
    if (recent.due < 5) continue;
    // Already mini: judge only since it was shrunk, and never shrink twice.
    const slipping = h.mini ? recent.rate < 0.5 && (!h.mini.since || addDays(h.mini.since, 7) <= today)
      : recent.rate < 0.5 || (prior.rate != null && prior.due >= 5 && prior.rate >= 0.7 && recent.rate <= prior.rate - 0.25);
    if (slipping) out.push({ type: 'slipping', habit: h, recent: recent.rate, done: recent.done, due: recent.due, prior: prior.due >= 5 ? prior.rate : null, mini: h.mini ? null : miniChanges(h), fallback: fallbackFor(h, solid) });
  }
  return out.sort((a, b) => (a.type === b.type ? a.recent - b.recent : a.type === 'slipping' ? -1 : 1));
}

function fallbackFor(h, solid) {
  if (!h.reminderTime) return { kind: 'reminder' };
  if (!h.after && solid && solid.id !== h.id) return { kind: 'anchor', anchor: solid };
  return null;
}

export const COACH_METRICS = [
  { key: 'energy', label: 'énergie au réveil', get: (l) => l.energyStartLevel, higherIsBetter: true },
  { key: 'sleep', label: 'qualité du sommeil', get: (l) => l.sleepData?.sleepQualityScore, higherIsBetter: true },
  { key: 'stress', label: 'stress', get: (l) => l.stressLevel, higherIsBetter: false },
];

/**
 * For each habit × metric: mean of the NEXT day's check-in when the habit
 * was done vs when it was missed (last 120 days). Needs ≥ 5 days per side
 * and a gap ≥ 0.7 point (0–10 scale). Correlation, not causation.
 * → [{ habit, metric, withMean, withoutMean, diff, nWith, nWithout, good }]
 */
export function habitCorrelations(habits, logs, energyLogs, today, { minN = 5, minDiff = 0.7, max = 4 } = {}) {
  const byDate = new Map(energyLogs.map((l) => [l.date, l]));
  const out = [];
  for (const h of habits) {
    if (h.archived || h.kind === 'quit') continue;
    const own = logs.filter((l) => l.habitId === h.id);
    for (const m of COACH_METRICS) {
      const withV = []; const withoutV = [];
      for (let i = 1; i <= 120; i++) {
        const day = addDays(today, -i);
        const next = byDate.get(addDays(day, 1));
        const v = next ? Number(m.get(next)) : NaN;
        if (!Number.isFinite(v)) continue;
        const st = habitDayStatus(h, own, day, today);
        if (st === 'done') withV.push(v);
        else if (st === 'missed' || (h.frequency === 'weekly' && st === 'off' && (!h.startDate || day >= h.startDate))) withoutV.push(v);
      }
      if (withV.length < minN || withoutV.length < minN) continue;
      const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
      const w = mean(withV); const wo = mean(withoutV); const diff = w - wo;
      if (Math.abs(diff) < minDiff) continue;
      out.push({ habit: h, metric: m, withMean: w, withoutMean: wo, diff, nWith: withV.length, nWithout: withoutV.length, good: m.higherIsBetter ? diff > 0 : diff < 0 });
    }
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, max);
}
