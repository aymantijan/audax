// Per-account-type dashboards (Phase 2): each account type gets the analysis
// that actually matters for it — a Demo account is judged on "is this strategy
// ready for real capital?", a Broker account on capital preservation, a Prop
// Firm account on its own time/rule deadlines and payout history.

import { equityCurve, maxDrawdown, tradeStats } from './calculations';

const r1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// ---- Demo: readiness-to-go-live score ----
// Four equally-weighted components (25 pts each): enough trades to trust the
// numbers, positive expectancy, a real profit factor edge, and controlled
// drawdown. Deliberately conservative thresholds — going live is a one-way
// door with real capital or a paid prop-firm challenge.
const MIN_TRADES_FOR_CONFIDENCE = 30;

export function computeDemoReadiness(trades, initialBalance) {
  const stats = tradeStats(trades);
  const dd = maxDrawdown(equityCurve(trades, initialBalance));

  const sampleScore = clamp((stats.count / MIN_TRADES_FOR_CONFIDENCE) * 25);
  const expectancyScore = stats.count ? clamp(((stats.expectancyUsd > 0 ? 1 : 0) + clamp(stats.expectancyUsd / 20, -1, 1)) * 12.5) : 0;
  const profitFactorScore = stats.profitFactor === Infinity ? 25 : clamp((stats.profitFactor / 2) * 25);
  const drawdownScore = clamp(25 - (dd / 30) * 25);

  const score = Math.round(sampleScore + expectancyScore + profitFactorScore + drawdownScore);
  const band =
    score >= 75 ? { label: 'Ready to go live', color: 'var(--success)' }
    : score >= 50 ? { label: 'Getting there', color: 'var(--warning)' }
    : { label: 'Not yet', color: 'var(--error)' };

  const gaps = [];
  if (stats.count < MIN_TRADES_FOR_CONFIDENCE) gaps.push(`Log ${MIN_TRADES_FOR_CONFIDENCE - stats.count} more trades for a statistically meaningful sample.`);
  if (stats.count && stats.expectancyUsd <= 0) gaps.push('Expectancy per trade is not yet positive.');
  if (stats.count && stats.profitFactor < 1.2 && stats.profitFactor !== Infinity) gaps.push('Profit factor is thin — wins barely cover losses.');
  if (dd > 20) gaps.push(`Max drawdown (${r1(dd)}%) is high for a strategy meant to run on real capital.`);

  return {
    score: clamp(score), band, gaps,
    breakdown: { sample: r1(sampleScore), expectancy: r1(expectancyScore), profitFactor: r1(profitFactorScore), drawdown: r1(drawdownScore) },
    stats, maxDrawdownPct: r1(dd),
  };
}

// ---- Broker: capital preservation view ----
export function computeBrokerHealth(account, trades) {
  const initial = account.initialBalance || 0;
  const curve = equityCurve(trades, initial);
  const value = curve[curve.length - 1]?.value ?? initial;
  const dd = maxDrawdown(curve);
  const roiPct = initial > 0 ? ((value - initial) / initial) * 100 : 0;

  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const daysActive = sorted.length > 1 ? Math.max(1, (new Date(sorted[sorted.length - 1].date) - new Date(sorted[0].date)) / 86400000) : null;
  const annualizedPct = daysActive ? roiPct * (365 / daysActive) : null;

  return { roiPct: r1(roiPct), maxDrawdownPct: r1(dd), annualizedPct: annualizedPct != null ? r1(annualizedPct) : null, daysActive };
}

// ---- Prop Firm: phase deadline countdown ----
export function computePropFirmTimeline(account) {
  const maxDays = account.propFirmRules?.maxPhaseDurationDays;
  if (!maxDays) return null;
  const start = account.currentPhaseStartAt || account.createdAt;
  const daysElapsed = (Date.now() - start) / 86400000;
  const daysRemaining = Math.ceil(maxDays - daysElapsed);
  const deadline = new Date(start + maxDays * 86400000);
  return { daysElapsed: Math.floor(daysElapsed), daysRemaining, maxDays, deadline: deadline.toISOString().slice(0, 10), overdue: daysRemaining < 0 };
}
