import { INITIAL_ACCOUNT_VALUE } from './constants';

// ---- Instrument specs (approximate standard pip values, USD account) ----
const PIP_SPECS = {
  EURUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  GBPUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  USDJPY: { pipSize: 0.01, pipValuePerLot: 9 },
  XAUUSD: { pipSize: 0.1, pipValuePerLot: 10 },
};

// Derive pips + suggested USD PnL from prices. BTC positionSize is in coins.
// `customSpecs` (instrument code -> {pipSize, pipValuePerLot, kind}) comes from
// tradingStore.getInstrumentSpecs() — user-added instruments beyond the 4
// built-in PIP_SPECS. A 'direct' kind (or BTC) skips pips entirely: PnL is
// just price move × size, same as a stock/coin quote.
export function computeTradeDerived({ instrument, direction, entryPrice, exitPrice, positionSize }, customSpecs = {}) {
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  const size = Number(positionSize);
  if (!entry || !exit || !size) return { pnlPips: 0, pnl: 0 };

  const sign = direction === 'short' ? -1 : 1;
  const rawMove = (exit - entry) * sign;

  const custom = customSpecs[instrument];
  if (instrument === 'BTC' || custom?.kind === 'direct') {
    return { pnlPips: Math.round(rawMove), pnl: round2(rawMove * size) };
  }
  const spec = custom || PIP_SPECS[instrument] || PIP_SPECS.EURUSD;
  const pips = rawMove / spec.pipSize;
  return { pnlPips: round2(pips), pnl: round2(pips * spec.pipValuePerLot * size) };
}

export const round2 = (n) => Math.round(n * 100) / 100;

// ---- Trade statistics ----
export function tradeStats(trades) {
  const count = trades.length;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const winRate = count ? (wins.length / count) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, t) => a + t.pnl, 0) / losses.length : 0;
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  // Expectancy in pips per trade
  const expectancyPips = count ? trades.reduce((a, t) => a + (t.pnlPips || 0), 0) / count : 0;
  const expectancyUsd = count ? totalPnl / count : 0;
  return { count, wins: wins.length, losses: losses.length, winRate, avgWin, avgLoss, totalPnl, profitFactor, expectancyPips, expectancyUsd };
}

export function equityCurve(trades, initial = INITIAL_ACCOUNT_VALUE) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let value = initial;
  const points = [{ date: null, value }];
  for (const t of sorted) {
    value += t.pnl;
    points.push({ date: t.date, value: round2(value) });
  }
  return points;
}

export function currentAccountValue(trades, initial = INITIAL_ACCOUNT_VALUE) {
  return initial + trades.reduce((a, t) => a + t.pnl, 0);
}

export function maxDrawdown(curve) {
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.value);
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - p.value) / peak) * 100);
  }
  return maxDd;
}

// ---- Burn rate (last 7 days of losses, projected monthly) ----
export function calculateBurnRate(trades, accountValue) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = trades.filter((t) => new Date(t.date).getTime() >= weekAgo);
  const totalLoss = recent.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0); // negative
  const avgDailyLoss = totalLoss / 7;
  const monthlyLossProjection = avgDailyLoss * 30;
  const monthlyLossPct = accountValue > 0 ? (Math.abs(monthlyLossProjection) / accountValue) * 100 : 0;
  const runwayMonths = monthlyLossProjection < 0 ? accountValue / Math.abs(monthlyLossProjection) : Infinity;
  const level = monthlyLossPct > 10 ? 'red' : monthlyLossPct >= 5 ? 'yellow' : 'green';
  return { avgDailyLoss, monthlyLossProjection, monthlyLossPct, runwayMonths, level, tradesInWindow: recent.length };
}

// ---- Learning ----
export function weightedGPA(courses, gradePoints) {
  const graded = courses.filter((c) => c.status === 'completed' && c.actualGrade && gradePoints[c.actualGrade] !== undefined);
  const totalCredits = graded.reduce((a, c) => a + (Number(c.credits) || 0), 0);
  if (!totalCredits) return null;
  const weighted = graded.reduce((a, c) => a + gradePoints[c.actualGrade] * (Number(c.credits) || 0), 0);
  return weighted / totalCredits;
}

// ---- Habits ----

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Indexed by Date#getDay() (0=Sun..6=Sat).
const WEEKDAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Is a habit scheduled to happen on this date? Only 'custom' habits with a
// `weekdays` list (e.g. ['mon','wed','fri']) are restricted — 'daily'/'weekly'
// (or a 'custom' habit with no days picked, as a safety fallback) are due every day.
export function isHabitDueOn(habit, dateKey) {
  if (!habit || habit.frequency !== 'custom' || !habit.weekdays?.length) return true;
  return habit.weekdays.includes(WEEKDAY_CODES[new Date(dateKey + 'T00:00:00').getDay()]);
}

// Consecutive SCHEDULED-day streak for one habit, counting back from today.
// Days the habit isn't due on are skipped rather than breaking the streak, so a
// Mon/Wed/Fri habit's streak counts consecutive Mon/Wed/Fri completions, not
// consecutive calendar days. Passing `habit` is optional for backward compat —
// omitting it (or a daily/weekly habit) behaves exactly as before.
// Monday (YYYY-MM-DD) of the week containing `dateKey`.
export function weekStartKey(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDay(d);
}

// Weekly habits ("X fois par semaine"): completions in the week of `dateKey`.
export function weeklyProgress(habit, logs, dateKey) {
  const target = Math.max(1, Number(habit?.timesPerWeek) || 1);
  const from = weekStartKey(dateKey);
  const end = new Date(from + 'T12:00:00'); end.setDate(end.getDate() + 6);
  const to = isoDay(end);
  const done = logs.filter((l) => l.habitId === habit.id && (l.completed || l.joker) && l.date >= from && l.date <= to).length;
  return { done, target, met: done >= target };
}

// Should a habit appear on the checklist of `dateKey`? Weekly habits stay
// listed until their weekly quota is met (and on the days they were done).
export function isHabitShownOn(habit, logs, dateKey) {
  if (habit.kind === 'quit') return false;
  if (habit.startDate && habit.startDate > dateKey) return false;
  if (habit.frequency === 'weekly') {
    const doneThatDay = logs.some((l) => l.habitId === habit.id && l.date === dateKey && l.completed);
    return doneThatDay || !weeklyProgress(habit, logs, dateKey).met;
  }
  return isHabitDueOn(habit, dateKey);
}

// Unit of habitStreak(): weeks for weekly habits, days otherwise.
export const streakUnit = (habit) => (habit?.frequency === 'weekly' ? 'sem.' : 'j');

// Habits to quit ("jours sans…"): days since the last relapse (or since the
// habit started), today included.
export function quitStreak(habit, today) {
  const relapses = (habit.relapses || []).filter((d) => d <= today).sort();
  const last = relapses[relapses.length - 1];
  let from = habit.startDate || today;
  if (last) {
    const d = new Date(last + 'T12:00:00'); d.setDate(d.getDate() + 1); from = isoDay(d);
  }
  if (from > today) return 0;
  return Math.round((new Date(today + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000) + 1;
}

// Longest clean run ever for a quit habit.
export function quitBest(habit, today) {
  const start = habit.startDate || today;
  const cuts = [...new Set((habit.relapses || []).filter((d) => d >= start && d <= today))].sort();
  let best = 0; let from = start;
  const days = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  for (const r of cuts) { best = Math.max(best, days(from, r)); const d = new Date(r + 'T12:00:00'); d.setDate(d.getDate() + 1); from = isoDay(d); }
  return Math.max(best, from <= today ? days(from, today) + 1 : 0);
}

// Weekly habits: consecutive weeks that met their quota. The running week
// counts once met; until then the streak is carried by the previous weeks.
function weeklyStreak(habit, logs, today) {
  let wk = weekStartKey(today);
  if (!weeklyProgress(habit, logs, wk).met) {
    const d = new Date(wk + 'T12:00:00'); d.setDate(d.getDate() - 7); wk = isoDay(d);
  }
  let streak = 0;
  for (let guard = 0; guard < 520; guard++) {
    if (!weeklyProgress(habit, logs, wk).met) break;
    streak++;
    const d = new Date(wk + 'T12:00:00'); d.setDate(d.getDate() - 7); wk = isoDay(d);
  }
  return streak;
}

export function habitStreak(habitId, logs, today, habit) {
  if (habit?.kind === 'quit') return quitStreak(habit, today);
  if (habit?.frequency === 'weekly') return weeklyStreak(habit, logs, today);
  const done = new Set(logs.filter((l) => l.habitId === habitId && l.completed).map((l) => l.date));
  const joker = new Set(logs.filter((l) => l.habitId === habitId && l.joker && !l.completed).map((l) => l.date));
  const d = new Date(today + 'T00:00:00');
  if (isHabitDueOn(habit, isoDay(d)) && !done.has(isoDay(d))) d.setDate(d.getDate() - 1); // today not done yet → count from yesterday
  let streak = 0;
  for (let guard = 0; guard < 3660; guard++) {
    const key = isoDay(d);
    if (!isHabitDueOn(habit, key) || joker.has(key)) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    if (habit?.startDate && key < habit.startDate) break;
    if (!done.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Per-habit history (heatmap, records) ──
// Status of one day for a habit: 'done' | 'joker' | 'missed' | 'off' (not
// due / before start / week quota already met) | 'future'.
export function habitDayStatus(habit, logs, key, today) {
  if (key > today) return 'future';
  if (habit.startDate && key < habit.startDate) return 'off';
  if (habit.kind === 'quit') return (habit.relapses || []).includes(key) ? 'missed' : 'done';
  const log = logs.find((l) => l.habitId === habit.id && l.date === key);
  if (log?.completed) return 'done';
  if (log?.joker) return 'joker';
  if (habit.frequency === 'weekly') return 'off'; // judged per week, not per day
  if (!isHabitDueOn(habit, key)) return 'off';
  return key === today ? 'off' : 'missed';
}

// Longest run ever: days for daily/custom habits (off & joker days skipped),
// weeks for weekly habits, clean days for habits to quit.
export function habitBestStreak(habit, logs, today) {
  if (habit.kind === 'quit') return quitBest(habit, today);
  const start = habit.startDate || (logs.filter((l) => l.habitId === habit.id).map((l) => l.date).sort()[0]) || today;
  let best = 0; let run = 0;
  if (habit.frequency === 'weekly') {
    let wk = weekStartKey(start);
    for (let guard = 0; guard < 600 && wk <= today; guard++) {
      if (weeklyProgress(habit, logs, wk).met) { run++; best = Math.max(best, run); } else if (wk !== weekStartKey(today)) run = 0;
      const d = new Date(wk + 'T12:00:00'); d.setDate(d.getDate() + 7); wk = isoDay(d);
    }
    return best;
  }
  const d = new Date(start + 'T12:00:00');
  for (let guard = 0; guard < 4000; guard++) {
    const key = isoDay(d);
    if (key > today) break;
    const st = habitDayStatus(habit, logs, key, today);
    if (st === 'done') { run++; best = Math.max(best, run); } else if (st === 'missed') run = 0;
    d.setDate(d.getDate() + 1);
  }
  return best;
}

// Success rate over the last `days` days (due days only; jokers excluded).
export function habitSuccessRate(habit, logs, today, days = 30) {
  let done = 0; let due = 0;
  const d = new Date(today + 'T12:00:00');
  for (let i = 0; i < days; i++) {
    const st = habitDayStatus(habit, logs, isoDay(d), today);
    if (st === 'done') { done++; due++; } else if (st === 'missed') due++;
    d.setDate(d.getDate() - 1);
  }
  return due ? done / due : null;
}

// Compliance rate over the last N days. Weekly habits are excluded — a 1x/week
// habit would otherwise count as 6 misses per week. Custom (specific-weekday)
// habits only count on the days they're actually scheduled.
export function habitCompliance(habits, logs, days = 7, today) {
  const active = habits.filter((h) => !h.archived && h.frequency !== 'weekly' && h.kind !== 'quit');
  if (!active.length) return { completed: 0, total: 0, rate: 0 };
  const doneKeys = new Set(logs.filter((l) => l.completed).map((l) => `${l.habitId}|${l.date}`));
  const jokerKeys = new Set(logs.filter((l) => l.joker && !l.completed).map((l) => `${l.habitId}|${l.date}`));
  let completed = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - i);
    const key = isoDay(d);
    for (const h of active) {
      const started = !h.startDate || h.startDate <= key;
      if (!started) continue;
      if (!isHabitDueOn(h, key)) continue;
      if (jokerKeys.has(`${h.id}|${key}`)) continue;
      total++;
      if (doneKeys.has(`${h.id}|${key}`)) completed++;
    }
  }
  return { completed, total, rate: total ? completed / total : 0 };
}
