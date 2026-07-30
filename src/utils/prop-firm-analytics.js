// Pure functions tracking a prop-firm account's OWN rules (set by the user to
// match their firm's actual terms) against the trades logged in its current
// phase. Nothing here is specific to any one firm — every threshold is a
// number the user enters when creating/editing the account.

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

// `account.currentPhaseStartAt` scopes every metric to the CURRENT phase only —
// advancing a phase resets these numbers without touching trade history.
export function computePropFirmProgress(account, trades, today = new Date().toISOString().slice(0, 10)) {
  const rules = account.propFirmRules || {};
  const phaseStart = account.currentPhaseStartAt || account.createdAt;
  const phaseTrades = trades.filter((t) => new Date(t.date).getTime() >= phaseStart);
  const sorted = [...phaseTrades].sort((a, b) => new Date(a.date) - new Date(b.date));

  const initial = account.initialBalance || 0;
  let equity = initial;
  let peak = initial;
  let maxDrawdownPct = 0;
  for (const t of sorted) {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
  }

  const totalProfit = equity - initial;
  const profitPct = initial > 0 ? (totalProfit / initial) * 100 : 0;

  const daily = dailyPnL(phaseTrades);
  const todayPnL = daily[today] || 0;
  const dailyLossPct = todayPnL < 0 && initial > 0 ? (Math.abs(todayPnL) / initial) * 100 : 0;

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
    breaches.push({ rule: 'totalDrawdown', level: 'danger', message: `Max drawdown this phase is ${r2(maxDrawdownPct)}% — over the ${rules.maxTotalDrawdownPct}% limit.` });
  }
  if (rules.consistencyRulePct != null && consistencyPct > rules.consistencyRulePct) {
    breaches.push({ rule: 'consistency', level: 'warning', message: `Your best day is ${r2(consistencyPct)}% of total profit — over the ${rules.consistencyRulePct}% consistency cap.` });
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
    dailyLossPct: r2(dailyLossPct), maxDrawdownPct: r2(maxDrawdownPct),
    tradingDays, consistencyPct: r2(consistencyPct),
    breaches, profitTargetMet, minDaysMet, readyToAdvance, rules,
  };
}
