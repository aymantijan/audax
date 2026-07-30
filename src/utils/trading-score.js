// Phase 8: the 3-tier score system (user-approved design):
//   1. Score-1 (per account): a single 0-100 number comparable across
//      demo/broker/prop-firm accounts, so they can be combined below.
//   2. Score-2 (per type): each account TYPE's score, weighted by account
//      VALUE within that type — a $100k prop account should outweigh a
//      $10k one, not count the same as it would in a simple average.
//   3. Score-3 (Trading-page score): the user picks which types to include,
//      then a weighted average across four capital-at-risk classes — Demo,
//      Broker, Prop Firm (funded), Prop Firm (evaluation) — reflecting how
//      much is actually on the line. Prop-firm accounts split into a funded
//      vs. evaluation sub-group here because their weights differ even
//      though they share the same account "type". Two weighting modes:
//      'fixed' (the configurable constants below) or 'capital' (weight =
//      literal $ value of the group instead of a fixed multiplier).

import { tradeStats, equityCurve, maxDrawdown, round2 } from './calculations';
import { computeDisciplineScore } from './trading-psychology';
import { concentration } from './analytics';

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export const DEFAULT_SCORE_WEIGHTS = { demo: 0.5, broker: 3, propfirmFunded: 2.5, propfirmEvaluation: 1.5 };

export function scoreBand(score) {
  if (score == null) return { label: '—', color: 'var(--text-secondary)' };
  if (score >= 75) return { label: 'Strong', color: 'var(--success)' };
  if (score >= 50) return { label: 'Developing', color: 'var(--warning)' };
  return { label: 'Weak', color: 'var(--error)' };
}

// ---- Score-1: per-account (0-100) ----
// Four components: profitability (30: profit factor + expectancy sign/size),
// risk control (25: max drawdown), discipline (25: reuses Phase-4's
// computeDisciplineScore, already 0-100, scaled down), consistency (20:
// reuses the existing top-3-win concentration metric — less reliant on a
// few outsized wins scores higher).
export function computeAccountScore(trades, initialBalance) {
  if (!trades.length) return { insufficientData: true, score: null };

  const stats = tradeStats(trades);
  const dd = maxDrawdown(equityCurve(trades, initialBalance));
  const disc = computeDisciplineScore(trades);
  const conc = concentration(trades); // % of gross wins from the top-3 winning trades, or null if no wins

  const profitFactorScore = stats.profitFactor === Infinity ? 15 : clamp((stats.profitFactor / 2) * 15, 0, 15);
  const expectancyScore = clamp(((stats.expectancyUsd > 0 ? 1 : 0) + clamp(stats.expectancyUsd / 20, -1, 1)) * 7.5, 0, 15);
  const profitability = profitFactorScore + expectancyScore;

  const riskControl = clamp(25 - (dd / 30) * 25, 0, 25);
  const discipline = clamp((disc.score / 100) * 25, 0, 25);
  const consistency = conc == null ? 0 : clamp(20 - clamp((conc - 30) / 70, 0, 1) * 20, 0, 20);

  const score = Math.round(clamp(profitability + riskControl + discipline + consistency));

  return {
    insufficientData: false,
    score,
    band: scoreBand(score),
    breakdown: { profitability: round2(profitability), riskControl: round2(riskControl), discipline: round2(discipline), consistency: round2(consistency) },
  };
}

// ---- Score-2: per group (type, or a type sub-class like propfirm-funded) ----
// Weighted by each account's current VALUE within the group — not a simple
// average — so a larger account's score counts for more.
export function computeGroupScore(accounts, getTrades, getValue) {
  const scored = accounts
    .map((a) => ({ account: a, value: getValue(a.id), result: computeAccountScore(getTrades(a.id), a.initialBalance) }))
    .filter((x) => !x.result.insufficientData && x.value > 0);
  if (!scored.length) return null;

  const totalValue = scored.reduce((s, x) => s + x.value, 0);
  const score = Math.round(scored.reduce((s, x) => s + x.result.score * x.value, 0) / totalValue);
  return { score, band: scoreBand(score), accountCount: scored.length, totalValue: round2(totalValue) };
}

// ---- Score-3: the overall Trading-page score ----
// `included`: {demo,broker,propfirm} booleans (the user's checkboxes).
// `mode`: 'fixed' uses `weights` as constant multipliers; 'capital' uses each
// group's own $ value as its weight instead (bigger accounts dominate more).
export function computeOverallScore({ accounts, getTrades, getValue, included = {}, weights = DEFAULT_SCORE_WEIGHTS, mode = 'fixed' }) {
  const active = accounts.filter((a) => a.status !== 'archived');
  const groups = [];

  const addGroup = (key, label, weightKey, accts) => {
    const g = computeGroupScore(accts, getTrades, getValue);
    if (!g) return;
    const weight = mode === 'capital' ? g.totalValue : weights[weightKey];
    if (weight > 0) groups.push({ key, label, ...g, weight });
  };

  if (included.demo) addGroup('demo', 'Demo', 'demo', active.filter((a) => a.type === 'demo'));
  if (included.broker) addGroup('broker', 'Broker', 'broker', active.filter((a) => a.type === 'broker'));
  if (included.propfirm) {
    addGroup('propfirmFunded', 'Prop Firm (funded)', 'propfirmFunded', active.filter((a) => a.type === 'propfirm' && a.status === 'funded'));
    addGroup('propfirmEvaluation', 'Prop Firm (evaluation)', 'propfirmEvaluation', active.filter((a) => a.type === 'propfirm' && a.status !== 'funded'));
  }

  if (!groups.length) return { insufficientData: true, overallScore: null, groups: [] };

  const totalWeight = groups.reduce((s, g) => s + g.weight, 0);
  const overallScore = totalWeight > 0 ? Math.round(groups.reduce((s, g) => s + g.score * g.weight, 0) / totalWeight) : null;
  return { insufficientData: false, overallScore, band: scoreBand(overallScore), groups };
}
