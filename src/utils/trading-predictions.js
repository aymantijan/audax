// Predictions (Phase 6): Monte Carlo prop-firm pass probability, days-to-target
// projection, and equity confidence bands. Everything here resamples WITH
// REPLACEMENT from the trader's own historical trade P&Ls (bootstrap method) —
// it assumes future trades are drawn from the same distribution as past ones,
// which is never guaranteed (strategy drift, changing market regime, small
// samples). Treat outputs as a rough probability range, not a forecast.

const MIN_TRADES_FOR_SIM = 10;

function r1(n) {
  return Math.round(n * 10) / 10;
}

// Uniform pick from an array using Math.random — fine here since simulation
// output is inherently probabilistic and never persisted/replayed.
function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tradesPerDay(trades) {
  const days = new Set(trades.map((t) => t.date)).size;
  return days ? trades.length / days : 0;
}

// Simulates the rest of the current phase by resampling historical trade
// P&Ls, at the trader's own historical trades/day pace, until either the
// deadline (maxPhaseDurationDays) or a 200-day cap is hit. A run "passes" if
// equity reaches the profit target without breaching daily-loss or
// total-drawdown limits along the way. Works for a real Prop Firm account's
// `propFirmRules` OR a Demo account's current simulated phase — both are
// just a `{rules, phaseStartAt, initialBalance}` triple to this function, it
// doesn't know or care which one it's looking at.
export function monteCarloPropFirmPass(rules, phaseStartAt, initialBalance, trades, { simulations = 1000 } = {}) {
  if (!rules || rules.profitTargetPct == null) return { insufficientData: true, reason: 'No profit target set on this account.' };
  if (trades.length < MIN_TRADES_FOR_SIM) return { insufficientData: true, reason: `Need at least ${MIN_TRADES_FOR_SIM} trades this phase for a meaningful simulation.` };

  const initial = initialBalance || 0;
  const pnlPool = trades.map((t) => t.pnl);
  const pace = Math.max(tradesPerDay(trades), 0.2); // trades per calendar day, floored to avoid runaway sim length

  const maxDays = rules.maxPhaseDurationDays;
  const daysElapsed = phaseStartAt ? (Date.now() - phaseStartAt) / 86400000 : 0;
  const daysRemaining = maxDays ? Math.max(0, Math.ceil(maxDays - daysElapsed)) : 200;
  const simDayCap = Math.min(daysRemaining || 200, 200);

  let passes = 0;
  let fails = 0;
  const daysToTargetSamples = [];

  for (let s = 0; s < simulations; s++) {
    let equity = initial;
    let peak = initial;
    let dayEquityStart = initial;
    let passed = false;
    let breached = false;
    let dayCount = 0;

    for (let day = 0; day < simDayCap && !passed && !breached; day++) {
      dayCount++;
      dayEquityStart = equity;
      const tradesToday = Math.max(0, Math.round(pace + (Math.random() - 0.5)));
      for (let k = 0; k < tradesToday; k++) {
        equity += sample(pnlPool);
        peak = Math.max(peak, equity);
      }
      const ddPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      const dailyLossPct = initial > 0 && equity < dayEquityStart ? ((dayEquityStart - equity) / initial) * 100 : 0;

      if (rules.maxTotalDrawdownPct != null && ddPct > rules.maxTotalDrawdownPct) breached = true;
      if (rules.maxDailyLossPct != null && dailyLossPct > rules.maxDailyLossPct) breached = true;

      const profitPct = initial > 0 ? ((equity - initial) / initial) * 100 : 0;
      if (!breached && profitPct >= rules.profitTargetPct) passed = true;
    }

    if (passed) {
      passes++;
      daysToTargetSamples.push(dayCount);
    } else {
      fails++;
    }
  }

  daysToTargetSamples.sort((a, b) => a - b);
  const medianDaysToTarget = daysToTargetSamples.length ? daysToTargetSamples[Math.floor(daysToTargetSamples.length / 2)] : null;

  return {
    insufficientData: false,
    passProbability: r1((passes / simulations) * 100),
    failProbability: r1((fails / simulations) * 100),
    simulations,
    medianDaysToTarget,
    daysRemaining: maxDays ? daysRemaining : null,
  };
}

// Simple linear projection (no simulation): at the trader's average $/trading-day
// pace over the current phase, how many more calendar days to close the gap to
// the profit target. Returns null when there's no target, no pace, or the pace
// is negative (target already unreachable at this rate). Same generalization
// as monteCarloPropFirmPass above — works off any {rules, initialBalance} pair.
export function daysToTargetProjection(rules, initialBalance, trades) {
  if (!rules || rules.profitTargetPct == null) return null;
  if (trades.length < 3) return { insufficientData: true };

  const initial = initialBalance || 0;
  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const targetAmount = (rules.profitTargetPct / 100) * initial;
  const remaining = targetAmount - totalPnl;
  if (remaining <= 0) return { insufficientData: false, daysRemaining: 0, alreadyMet: true };

  const days = new Set(trades.map((t) => t.date)).size;
  const avgPerDay = days ? totalPnl / days : 0;
  if (avgPerDay <= 0) return { insufficientData: false, daysRemaining: null, alreadyMet: false, avgPerDay: r1(avgPerDay) };

  return { insufficientData: false, daysRemaining: Math.ceil(remaining / avgPerDay), alreadyMet: false, avgPerDay: r1(avgPerDay), remainingAmount: r1(remaining) };
}

// Bootstrap equity confidence bands: resamples historical trade P&Ls to project
// the next `horizonTrades` trades `simulations` times, then reads off the
// 10th/50th/90th percentile equity value at each step. Purely a spread-of-
// outcomes view given the PAST distribution — not a directional forecast.
export function equityConfidenceBands(trades, initialBalance, { horizonTrades = 20, simulations = 500 } = {}) {
  if (trades.length < MIN_TRADES_FOR_SIM) return { insufficientData: true };
  const pnlPool = trades.map((t) => t.pnl);
  const runs = [];
  for (let s = 0; s < simulations; s++) {
    let equity = initialBalance;
    const path = [equity];
    for (let i = 0; i < horizonTrades; i++) {
      equity += sample(pnlPool);
      path.push(equity);
    }
    runs.push(path);
  }

  const bands = [];
  for (let step = 0; step <= horizonTrades; step++) {
    const values = runs.map((r) => r[step]).sort((a, b) => a - b);
    const pick = (pct) => values[Math.min(values.length - 1, Math.floor(pct * values.length))];
    bands.push({ step, p10: r1(pick(0.1)), p50: r1(pick(0.5)), p90: r1(pick(0.9)) });
  }
  return { insufficientData: false, bands };
}
