import { INITIAL_ACCOUNT_VALUE } from './constants';

// ---- Instrument specs (approximate standard pip values, USD account) ----
const PIP_SPECS = {
  EURUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  GBPUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  USDJPY: { pipSize: 0.01, pipValuePerLot: 9 },
  XAUUSD: { pipSize: 0.1, pipValuePerLot: 10 },
};

// Derive pips + suggested USD PnL from prices. BTC positionSize is in coins.
export function computeTradeDerived({ instrument, direction, entryPrice, exitPrice, positionSize }) {
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  const size = Number(positionSize);
  if (!entry || !exit || !size) return { pnlPips: 0, pnl: 0 };

  const sign = direction === 'short' ? -1 : 1;
  const rawMove = (exit - entry) * sign;

  if (instrument === 'BTC') {
    return { pnlPips: Math.round(rawMove), pnl: round2(rawMove * size) };
  }
  const spec = PIP_SPECS[instrument] || PIP_SPECS.EURUSD;
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
// Consecutive-day streak for one habit, counting back from today (today optional).
export function habitStreak(habitId, logs, today) {
  const done = new Set(logs.filter((l) => l.habitId === habitId && l.completed).map((l) => l.date));
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  if (!done.has(isoDay(d))) d.setDate(d.getDate() - 1); // today not done yet → count up to yesterday
  while (done.has(isoDay(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Compliance rate over the last N days. Weekly habits are excluded — a 1x/week
// habit would otherwise count as 6 misses per week.
export function habitCompliance(habits, logs, days = 7, today) {
  const active = habits.filter((h) => !h.archived && h.frequency !== 'weekly');
  if (!active.length) return { completed: 0, total: 0, rate: 0 };
  const doneKeys = new Set(logs.filter((l) => l.completed).map((l) => `${l.habitId}|${l.date}`));
  let completed = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - i);
    const key = isoDay(d);
    for (const h of active) {
      const started = !h.startDate || h.startDate <= key;
      if (!started) continue;
      total++;
      if (doneKeys.has(`${h.id}|${key}`)) completed++;
    }
  }
  return { completed, total, rate: total ? completed / total : 0 };
}
