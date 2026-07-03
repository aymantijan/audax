// Advanced trading metrics. All functions are pure and null-safe on sparse data.
import { INITIAL_ACCOUNT_VALUE } from './constants';
import { equityCurve, maxDrawdown, round2 } from './calculations';

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

// Aggregate PnL per calendar day → sorted [{date, pnl}]
export function dailyPnl(trades) {
  const map = {};
  for (const t of trades) {
    const day = String(t.date).slice(0, 10);
    map[day] = (map[day] || 0) + t.pnl;
  }
  return Object.entries(map).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, pnl]) => ({ date, pnl }));
}

// Daily returns as fraction of starting account (approximation for a fixed-base account)
function dailyReturns(trades, base = INITIAL_ACCOUNT_VALUE) {
  return dailyPnl(trades).map((d) => d.pnl / base);
}

// Annualized Sharpe over trading days with activity (rf = 0). Needs >= 5 active days.
export function sharpeRatio(trades) {
  const r = dailyReturns(trades);
  if (r.length < 5) return null;
  const s = std(r);
  return s ? round2((mean(r) / s) * Math.sqrt(252)) : null;
}

// Sortino: downside deviation only
export function sortinoRatio(trades) {
  const r = dailyReturns(trades);
  if (r.length < 5) return null;
  const downside = r.filter((v) => v < 0);
  if (!downside.length) return Infinity;
  const dd = Math.sqrt(downside.reduce((s, v) => s + v * v, 0) / r.length);
  return dd ? round2((mean(r) / dd) * Math.sqrt(252)) : null;
}

// Calmar: annualized return % / max drawdown %
export function calmarRatio(trades) {
  if (trades.length < 5) return null;
  const curve = equityCurve(trades);
  const dd = maxDrawdown(curve);
  if (!dd) return null;
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const days = Math.max(1, (new Date(sorted[sorted.length - 1].date) - new Date(sorted[0].date)) / 86400000);
  const totalReturn = (curve[curve.length - 1].value - INITIAL_ACCOUNT_VALUE) / INITIAL_ACCOUNT_VALUE;
  const annualized = totalReturn * (365 / days) * 100;
  return round2(annualized / dd);
}

// Recovery factor: total profit / max drawdown in dollars
export function recoveryFactor(trades) {
  if (!trades.length) return null;
  const curve = equityCurve(trades);
  let peak = -Infinity;
  let maxDdUsd = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.value);
    maxDdUsd = Math.max(maxDdUsd, peak - p.value);
  }
  const total = trades.reduce((a, t) => a + t.pnl, 0);
  return maxDdUsd ? round2(total / maxDdUsd) : null;
}

// Longest consecutive win / loss streaks (chronological)
export function streaks(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let maxW = 0, maxL = 0, w = 0, l = 0;
  for (const t of sorted) {
    if (t.pnl > 0) { w++; l = 0; } else if (t.pnl < 0) { l++; w = 0; }
    maxW = Math.max(maxW, w);
    maxL = Math.max(maxL, l);
  }
  return { maxWinStreak: maxW, maxLossStreak: maxL };
}

// Generic breakdown: win rate + PnL grouped by keyFn(trade)
export function winRateBy(trades, keyFn) {
  const groups = {};
  for (const t of trades) {
    const key = keyFn(t);
    if (key === undefined || key === null || key === '') continue;
    groups[key] = groups[key] || { key, count: 0, wins: 0, pnl: 0 };
    groups[key].count++;
    if (t.pnl > 0) groups[key].wins++;
    groups[key].pnl = round2(groups[key].pnl + t.pnl);
  }
  return Object.values(groups).map((g) => ({ ...g, winRate: g.count ? (g.wins / g.count) * 100 : 0 }));
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const byDayOfWeek = (trades) =>
  winRateBy(trades, (t) => DOW[new Date(t.date + 'T12:00:00').getDay()] ?? DOW[new Date(t.date).getDay()])
    .sort((a, b) => DOW.indexOf(a.key) - DOW.indexOf(b.key));

// Per-strategy comparison with avg win/loss and expectancy
export function strategyComparison(trades, strategies) {
  return strategies.map((s) => {
    const ts = trades.filter((t) => t.strategy === s);
    const wins = ts.filter((t) => t.pnl > 0);
    const losses = ts.filter((t) => t.pnl < 0);
    return {
      strategy: s,
      count: ts.length,
      winRate: ts.length ? (wins.length / ts.length) * 100 : 0,
      avgWin: wins.length ? round2(mean(wins.map((t) => t.pnl))) : 0,
      avgLoss: losses.length ? round2(mean(losses.map((t) => t.pnl))) : 0,
      totalPnl: round2(ts.reduce((a, t) => a + t.pnl, 0)),
      expectancy: ts.length ? round2(ts.reduce((a, t) => a + t.pnl, 0) / ts.length) : 0,
    };
  });
}

// Pearson correlation of daily PnL between instrument pairs (shared active days only).
// Needs >= 3 shared days per pair; sparse pairs return null.
export function instrumentCorrelation(trades, instruments) {
  const series = {};
  for (const inst of instruments) {
    series[inst] = Object.fromEntries(dailyPnl(trades.filter((t) => t.instrument === inst)).map((d) => [d.date, d.pnl]));
  }
  const active = instruments.filter((i) => Object.keys(series[i]).length > 0);
  const matrix = {};
  for (const a of active) {
    matrix[a] = {};
    for (const b of active) {
      if (a === b) { matrix[a][b] = 1; continue; }
      const shared = Object.keys(series[a]).filter((d) => series[b][d] !== undefined);
      if (shared.length < 3) { matrix[a][b] = null; continue; }
      const xs = shared.map((d) => series[a][d]);
      const ys = shared.map((d) => series[b][d]);
      const mx = mean(xs), my = mean(ys);
      const cov = shared.reduce((s, _, i) => s + (xs[i] - mx) * (ys[i] - my), 0);
      const denom = Math.sqrt(shared.reduce((s, _, i) => s + (xs[i] - mx) ** 2, 0) * shared.reduce((s, _, i) => s + (ys[i] - my) ** 2, 0));
      matrix[a][b] = denom ? round2(cov / denom) : null;
    }
  }
  return { instruments: active, matrix };
}

// Concentration: % of total positive PnL coming from the top 3 winners
export function concentration(trades) {
  const wins = trades.filter((t) => t.pnl > 0).sort((a, b) => b.pnl - a.pnl);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  if (!grossWin) return null;
  const top3 = wins.slice(0, 3).reduce((a, t) => a + t.pnl, 0);
  return round2((top3 / grossWin) * 100);
}

// Macro edge: for one macro field, win rate per tag value (only tagged trades)
export function macroEdge(trades, fieldKey) {
  return winRateBy(trades.filter((t) => t.macro?.[fieldKey]), (t) => t.macro[fieldKey]);
}
