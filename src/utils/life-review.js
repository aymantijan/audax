// Weekly review across every section ("Bilan de la semaine", étape 5):
// one set of figures for a Monday→Sunday week, compared with the week before.
// (The studies-only review with saved snapshots is utils/weekly-review.js.)
// Pure: every input is passed in, so it is tested in tests/life-review.test.mjs.
import { habitCompliance } from './calculations.js';
import { classOf } from './chart-of-accounts.js';
import { dayAttendance } from './attendance.js';

const DAY = 86400000;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (key, n) => iso(new Date(new Date(`${key}T12:00:00`).getTime() + n * DAY));

export { mondayOf } from './weekly-review.js';

const inRange = (date, from, to) => date >= from && date <= to;

// Hours between bedtime and wake-up ("23:30" → "07:00" = 7.5).
export function sleepHoursOf(log) {
  const s = log?.sleepData?.sleepStartTime;
  const w = log?.sleepData?.wakeTime;
  if (!s || !w) {
    // Hours noted directly ("dormi 7h30", quick check-in) when no bed/wake times.
    const h = Number(log?.sleepData?.sleepHours ?? log?.sleepData?.hoursSlept);
    return h > 0 && h <= 16 ? h : null;
  }
  const [sh, sm] = s.split(':').map(Number);
  const [wh, wm] = w.split(':').map(Number);
  const mins = ((wh * 60 + wm) - (sh * 60 + sm) + 1440) % 1440;
  return mins ? mins / 60 : null;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// Figures for one week. `today` caps the window so a week in progress is
// judged on the days already lived.
export function weekFigures(data, weekMonday, today) {
  const from = weekMonday;
  const sunday = addDays(weekMonday, 6);
  const to = today < sunday ? today : sunday;
  const days = Math.max(0, Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / DAY) + 1);
  const out = { from, to: sunday, daysCounted: days };
  if (!days) return out;

  const { habits = [], logs = [], energyLogs = [], workouts = [], sessions = [], journal = [], trades = [], readLog = [], courses, academic, attendance } = data;

  const hc = habitCompliance(habits, logs, days, to);
  out.habitsRate = hc.total ? Math.round(hc.rate * 100) : null;

  const sleeps = energyLogs.filter((l) => inRange(l.date, from, to)).map(sleepHoursOf).filter((h) => h != null);
  out.sleepHours = round1(avg(sleeps));
  const energies = energyLogs.filter((l) => inRange(l.date, from, to) && l.energyStartLevel != null).map((l) => Number(l.energyStartLevel));
  out.energy = round1(avg(energies));

  out.workouts = workouts.filter((w) => inRange(w.date, from, to)).length;
  out.focusMinutes = sessions.filter((s) => inRange(s.date, from, to)).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0);
  out.readingDays = new Set(readLog.filter((l) => inRange(l.date, from, to)).map((l) => l.date)).size;

  let spent = 0;
  let hasMoney = false;
  for (const e of journal) {
    if (!inRange(e.date, from, to)) continue;
    for (const l of e.lines || []) {
      if (classOf(l.account) !== 6) continue;
      hasMoney = true;
      spent += (Number(l.debit) || 0) - (Number(l.credit) || 0);
    }
  }
  out.spent = hasMoney ? Math.round(spent) : null;

  const wkTrades = trades.filter((t) => inRange(t.date, from, to));
  out.trades = wkTrades.length;
  out.tradingPnl = wkTrades.length ? Math.round(wkTrades.reduce((a, t) => a + (Number(t.pnl) || 0), 0) * 100) / 100 : null;

  if (courses && academic) {
    let required = 0;
    let onTime = 0;
    for (let i = 0; i < days; i += 1) {
      const d = dayAttendance(courses, academic, attendance || {}, addDays(from, i));
      required += d.required;
      onTime += d.onTime;
    }
    out.attendance = required ? Math.round((onTime / required) * 100) : null;
    out.classes = required;
  }
  return out;
}

// Which way is better for each figure (spending is better when it goes down).
export const REVIEW_METRICS = [
  { key: 'habitsRate', label: 'Habitudes tenues', unit: '%', better: 'up' },
  { key: 'attendance', label: 'Cours à l’heure', unit: '%', better: 'up' },
  { key: 'focusMinutes', label: 'Minutes de concentration', unit: 'min', better: 'up' },
  { key: 'readingDays', label: 'Jours de lecture', unit: 'j', better: 'up' },
  { key: 'workouts', label: 'Séances de sport', unit: '', better: 'up' },
  { key: 'sleepHours', label: 'Sommeil moyen', unit: 'h', better: 'up' },
  { key: 'energy', label: 'Énergie au réveil', unit: '/10', better: 'up' },
  { key: 'spent', label: 'Dépenses', unit: 'money', better: 'down' },
  { key: 'tradingPnl', label: 'Résultat trading', unit: 'pnl', better: 'up' },
];

// Compared figures, keeping only those with data in either week.
export function compareWeeks(current, previous) {
  return REVIEW_METRICS
    .filter((m) => current[m.key] != null || previous[m.key] != null)
    .map((m) => {
      const a = current[m.key];
      const b = previous[m.key];
      const delta = a != null && b != null ? a - b : null;
      const trend = delta == null || delta === 0 ? 'flat' : (delta > 0) === (m.better === 'up') ? 'better' : 'worse';
      return { ...m, value: a, previous: b, delta, trend };
    });
}

// One-line reading of the week: the best progress and the biggest slip.
export function weekHeadline(rows) {
  const better = rows.filter((r) => r.trend === 'better');
  const worse = rows.filter((r) => r.trend === 'worse');
  if (!rows.length) return 'Pas encore assez de données cette semaine.';
  if (!better.length && !worse.length) return 'Semaine stable par rapport à la précédente.';
  const parts = [];
  if (better.length) parts.push(`en progrès : ${better.slice(0, 3).map((r) => r.label.toLowerCase()).join(', ')}`);
  if (worse.length) parts.push(`à surveiller : ${worse.slice(0, 3).map((r) => r.label.toLowerCase()).join(', ')}`);
  return parts.join(' · ').replace(/^./, (c) => c.toUpperCase());
}
