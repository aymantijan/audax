// On-plan vs off-plan: the single most telling discipline metric.
// A trade is tagged when logged (trade.followedPlan true/false); legacy
// trades without the tag are left out of the comparison.
import { tradeRMultiple } from './risk-management';
import { MISTAKES, mistakesOf } from './trading-journal';

// Rule breaks proposed in the trade form, on top of the checklist's red items.
export const PLAN_BREAKS = MISTAKES;

function groupStats(trades) {
  const count = trades.length;
  const pnl = trades.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const rs = trades.map(tradeRMultiple).filter((r) => r != null);
  return {
    count, pnl,
    winRate: count ? (wins / count) * 100 : null,
    avgPnl: count ? pnl / count : null,
    expR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    rCount: rs.length,
  };
}

/**
 * → { on, off, tagged, untagged, onPlanPct, breaks: [{ label, count, pnl }] }
 */
export function planSplit(trades) {
  const on = trades.filter((t) => t.followedPlan === true);
  const off = trades.filter((t) => t.followedPlan === false);
  const tagged = on.length + off.length;
  const breaks = {};
  for (const t of off) {
    for (const b of mistakesOf(t).length ? mistakesOf(t) : ['Unspecified']) {
      breaks[b] = breaks[b] || { label: b, count: 0, pnl: 0 };
      breaks[b].count++; breaks[b].pnl += Number(t.pnl) || 0;
    }
  }
  return {
    on: groupStats(on), off: groupStats(off), tagged, untagged: trades.length - tagged,
    onPlanPct: tagged ? (on.length / tagged) * 100 : null,
    breaks: Object.values(breaks).sort((a, b) => a.pnl - b.pnl || b.count - a.count),
  };
}
