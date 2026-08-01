// Pure functions tracking a prop-firm RULE SET (the user's own firm's actual
// terms, or a self-imposed simulation on a Demo account — see below) against
// the trades logged since a given phase-start timestamp. Nothing here is
// specific to any one firm; every threshold is a number the user enters.

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const PROP_FIRM_PHASES = [
  { value: 'phase1', label: 'Phase 1 (Evaluation)' },
  { value: 'phase2', label: 'Phase 2 (Verification)' },
  { value: 'funded', label: 'Funded' },
];

export function nextPhase(phase) {
  const order = PROP_FIRM_PHASES.map((p) => p.value);
  const idx = order.indexOf(phase);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

function dailyPnL(trades) {
  const map = {};
  for (const t of trades) map[t.date] = (map[t.date] || 0) + t.pnl;
  return map;
}

// The shared engine: checks ONE rule set against trades since `phaseStart`.
// Used by both a real Prop Firm account's `propFirmRules` AND a Demo
// account's opt-in phase simulation (`simPhases[i]`) — same math, same
// breach shape, so every downstream consumer (banners, alerts, coach,
// predictions) works for either without knowing which one it's looking at.
//
// `rules.maxTotalDrawdownType`: 'trailing' (default, peak-to-trough — this
// was the ONLY behavior before this field existed, so omitting it changes
// nothing for existing accounts) or 'static' (measured from the phase's
// starting balance only, ignoring any peak reached in between — the other
// convention real prop firms use for "Max Overall Loss").
// `rules.maxDailyProfitAmount`: optional absolute $ cap on a single day's
// profit (some firms flag/disqualify unusually large single-day gains as
// a sign of over-leveraging or exploiting a pricing glitch).
export function computeRulesProgress(rules, phaseStart, initialBalance, trades, today = new Date().toISOString().slice(0, 10)) {
  rules = rules || {};
  // Compare at CALENDAR-DAY granularity, not raw milliseconds: `t.date` is a
  // day-only string ('YYYY-MM-DD', midnight), while `phaseStart` is a precise
  // timestamp (whatever moment the phase/simulation was started/advanced). A
  // phase that starts mid-day would otherwise wrongly exclude every trade
  // logged that SAME day (midnight-of-today < phase-start-later-today) —
  // trades are only ever dated by day, so the phase boundary should be too.
  const phaseStartDay = new Date(phaseStart).toISOString().slice(0, 10);
  const phaseTrades = trades.filter((t) => String(t.date).slice(0, 10) >= phaseStartDay);
  const sorted = [...phaseTrades].sort((a, b) => new Date(a.date) - new Date(b.date));

  const initial = initialBalance || 0;
  let equity = initial;
  let peak = initial;
  let trailingDrawdownPct = 0;
  for (const t of sorted) {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    if (peak > 0) trailingDrawdownPct = Math.max(trailingDrawdownPct, ((peak - equity) / peak) * 100);
  }
  const staticLossPct = initial > 0 ? Math.max(0, ((initial - equity) / initial) * 100) : 0;
  const maxDrawdownPct = rules.maxTotalDrawdownType === 'static' ? staticLossPct : trailingDrawdownPct;

  const totalProfit = equity - initial;
  const profitPct = initial > 0 ? (totalProfit / initial) * 100 : 0;

  const daily = dailyPnL(phaseTrades);
  const todayPnL = daily[today] || 0;
  const dailyLossPct = todayPnL < 0 && initial > 0 ? (Math.abs(todayPnL) / initial) * 100 : 0;
  const todayProfitAmount = todayPnL > 0 ? todayPnL : 0;

  const tradingDays = Object.keys(daily).length;

  // Consistency rule: no single day should represent too large a share of total
  // profit (the classic prop-firm anti-gambling clause) — only meaningful once
  // the phase is net profitable.
  const dailyProfits = Object.values(daily).filter((v) => v > 0);
  const maxDayProfit = dailyProfits.length ? Math.max(...dailyProfits) : 0;
  const consistencyPct = totalProfit > 0 ? (maxDayProfit / totalProfit) * 100 : 0;

  const breaches = [];
  if (rules.maxDailyLossPct != null && dailyLossPct > rules.maxDailyLossPct) {
    breaches.push({ rule: 'dailyLoss', level: 'danger', message: `Today's loss is ${r2(dailyLossPct)}% of the account — over the ${rules.maxDailyLossPct}% max daily loss.` });
  }
  if (rules.maxTotalDrawdownPct != null && maxDrawdownPct > rules.maxTotalDrawdownPct) {
    const kind = rules.maxTotalDrawdownType === 'static' ? 'Overall loss' : 'Max drawdown';
    breaches.push({ rule: 'totalDrawdown', level: 'danger', message: `${kind} this phase is ${r2(maxDrawdownPct)}% — over the ${rules.maxTotalDrawdownPct}% limit.` });
  }
  if (rules.consistencyRulePct != null && consistencyPct > rules.consistencyRulePct) {
    breaches.push({ rule: 'consistency', level: 'warning', message: `Your best day is ${r2(consistencyPct)}% of total profit — over the ${rules.consistencyRulePct}% consistency cap.` });
  }
  if (rules.maxDailyProfitAmount != null && todayProfitAmount > rules.maxDailyProfitAmount) {
    breaches.push({ rule: 'maxDailyProfit', level: 'warning', message: `Today's profit (${r2(todayProfitAmount)}) is over your ${rules.maxDailyProfitAmount} max-daily-profit cap — some firms flag or disqualify outsized single-day gains.` });
  }
  // Soft warning (not a breach) when getting close to the daily loss limit —
  // gives a chance to stop trading for the day before actually breaching it.
  if (rules.maxDailyLossPct != null && dailyLossPct > rules.maxDailyLossPct * 0.7 && dailyLossPct <= rules.maxDailyLossPct) {
    breaches.push({ rule: 'dailyLossWarning', level: 'warning', message: `Today's loss is ${r2(dailyLossPct)}% — approaching the ${rules.maxDailyLossPct}% daily limit.` });
  }

  const profitTargetMet = rules.profitTargetPct != null ? profitPct >= rules.profitTargetPct : true;
  const minDaysMet = rules.minTradingDays != null ? tradingDays >= rules.minTradingDays : true;
  const hardBreaches = breaches.filter((b) => b.level === 'danger');
  const readyToAdvance = profitTargetMet && minDaysMet && !hardBreaches.length;

  return {
    equity: r2(equity), totalProfit: r2(totalProfit), profitPct: r2(profitPct),
    dailyLossPct: r2(dailyLossPct), maxDrawdownPct: r2(maxDrawdownPct), todayProfitAmount: r2(todayProfitAmount),
    tradingDays, consistencyPct: r2(consistencyPct),
    breaches, profitTargetMet, minDaysMet, readyToAdvance, rules,
  };
}

// `account.currentPhaseStartAt` scopes every metric to the CURRENT phase only —
// advancing a phase resets these numbers without touching trade history.
// Thin wrapper over computeRulesProgress for a real Prop Firm account.
export function computePropFirmProgress(account, trades, today = new Date().toISOString().slice(0, 10)) {
  const phaseStart = account.currentPhaseStartAt || account.createdAt;
  return computeRulesProgress(account.propFirmRules, phaseStart, account.initialBalance || 0, trades, today);
}
