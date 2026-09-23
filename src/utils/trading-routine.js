// Trading routine (Trading n°3): session plan → limits → end-of-day review →
// weekly review. Plans / reviews are keyed per account and day (or week).
import { tradeRMultiple } from './risk-management';
import { mistakesOf } from './trading-journal';

export const routineKey = (accountId, day) => `${accountId}|${day}`;

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (day, n) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return keyOf(d); };
/** Monday of the week containing `day`. */
export const weekStartOf = (day) => { const d = new Date(`${day}T12:00:00`); return addDays(day, -((d.getDay() + 6) % 7)); };

export const GRADES = [
  { value: 'A', color: 'var(--success)', hint: 'Textbook: plan followed, good execution' },
  { value: 'B', color: '#84cc16', hint: 'Good, minor slips' },
  { value: 'C', color: 'var(--warning)', hint: 'Average: some rules bent' },
  { value: 'D', color: '#f97316', hint: 'Poor: plan mostly ignored' },
  { value: 'F', color: 'var(--error)', hint: 'Tilt / rules broken' },
];
export const gradeColor = (g) => GRADES.find((x) => x.value === g)?.color || 'var(--text-secondary)';
export const BIASES = [{ value: 'long', label: 'Bullish' }, { value: 'short', label: 'Bearish' }, { value: 'neutral', label: 'Neutral / range' }, { value: 'none', label: 'No bias — wait' }];

/**
 * Where the day stands against the plan's own limits.
 * → { tradesUsed, maxTrades, lossUsed, maxLoss, stop, reasons[] }
 */
export function planStatus(plan, todayTrades) {
  const tradesUsed = todayTrades.length;
  const pnl = todayTrades.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const lossUsed = Math.max(0, -pnl);
  const maxTrades = Number(plan?.maxTrades) || null;
  const maxLoss = Number(plan?.maxLoss) || null;
  const reasons = [];
  if (maxTrades && tradesUsed >= maxTrades) reasons.push(`max ${maxTrades} trade${maxTrades > 1 ? 's' : ''} reached`);
  if (maxLoss && lossUsed >= maxLoss) reasons.push('planned max loss reached');
  return { tradesUsed, maxTrades, pnl, lossUsed, maxLoss, stop: reasons.length > 0, reasons };
}

function groupOf(trades) {
  const rs = trades.map(tradeRMultiple).filter((r) => r != null);
  const pnl = trades.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  return {
    count: trades.length, pnl,
    winRate: trades.length ? (trades.filter((t) => t.pnl > 0).length / trades.length) * 100 : null,
    expR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    sumR: rs.reduce((a, b) => a + b, 0),
  };
}

/** Auto summary of a set of trades (a day or a week) for the review forms. */
export function periodSummary(trades) {
  const base = groupOf(trades);
  const tagged = trades.filter((t) => t.followedPlan != null);
  const onPlanPct = tagged.length ? (tagged.filter((t) => t.followedPlan).length / tagged.length) * 100 : null;
  const bySetup = {};
  for (const t of trades) (bySetup[t.strategy] = bySetup[t.strategy] || []).push(t);
  const setups = Object.entries(bySetup).map(([name, ts]) => ({ name, ...groupOf(ts) })).sort((a, b) => b.pnl - a.pnl);
  const mistakes = {};
  for (const t of trades) for (const m of mistakesOf(t)) { mistakes[m] = mistakes[m] || { label: m, count: 0, pnl: 0 }; mistakes[m].count++; mistakes[m].pnl += Number(t.pnl) || 0; }
  const topMistake = Object.values(mistakes).sort((a, b) => a.pnl - b.pnl || b.count - a.count)[0] || null;
  return { ...base, onPlanPct, best: setups[0] || null, worst: setups.length > 1 ? setups[setups.length - 1] : null, topMistake };
}
