// Risk management (Phase 3): position sizing, R-multiple tracking, and
// same-day correlated-exposure warnings. All functions are pure and work off
// the trade journal the app already has — no "live open position" concept
// exists in this app (trades are logged closed, with entry+exit both
// required), so "exposure" here means "instruments you traded on the same
// day that also move together historically" rather than concurrently open
// positions in the brokerage sense.

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---- Position sizing ----
// pipValuePerLot: $ value of a 1-pip move for 1.0 standard lot of this
// instrument — varies by broker/quote currency, so the user can override it;
// these are just reasonable USD-account defaults to prefill the calculator.
export const DEFAULT_PIP_VALUE_PER_LOT = {
  EURUSD: 10, GBPUSD: 10, USDJPY: 9.1, XAUUSD: 10, BTC: 1,
};

export function computePositionSize({ accountValue, riskPct, stopDistancePips, pipValuePerLot }) {
  const dollarRisk = (Number(accountValue) || 0) * ((Number(riskPct) || 0) / 100);
  const stopPips = Number(stopDistancePips) || 0;
  const pipValue = Number(pipValuePerLot) || 0;
  if (!stopPips || !pipValue) return { dollarRisk: r2(dollarRisk), lots: null };
  const riskPerLot = stopPips * pipValue;
  const lots = riskPerLot > 0 ? dollarRisk / riskPerLot : null;
  return { dollarRisk: r2(dollarRisk), lots: lots != null ? r2(lots) : null, riskPerLot: r2(riskPerLot) };
}

// ---- R-multiples ----
// R = pnl / riskAmount — normalizes every trade to "how many times my planned
// risk did I make or lose", regardless of position size or instrument. Trades
// without a logged riskAmount are excluded (can't compute R without it).
export function tradeRMultiple(trade) {
  const risk = Number(trade.riskAmount) || 0;
  if (!risk) return null;
  return r2(trade.pnl / risk);
}

export function rMultipleStats(trades) {
  const withR = trades.map((t) => ({ t, r: tradeRMultiple(t) })).filter((x) => x.r !== null);
  if (!withR.length) return null;
  const rs = withR.map((x) => x.r);
  const avgR = r2(rs.reduce((a, b) => a + b, 0) / rs.length);
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);
  const avgWinR = wins.length ? r2(wins.reduce((a, b) => a + b, 0) / wins.length) : 0;
  const avgLossR = losses.length ? r2(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  const winRate = r2((wins.length / rs.length) * 100);
  // Expectancy in R: avg R you can expect to make per trade, in units of your own risk.
  const expectancyR = avgR;
  // Distribution buckets for a simple histogram.
  const buckets = { '<-2R': 0, '-2R..-1R': 0, '-1R..0R': 0, '0R..1R': 0, '1R..2R': 0, '>2R': 0 };
  for (const r of rs) {
    if (r < -2) buckets['<-2R']++;
    else if (r < -1) buckets['-2R..-1R']++;
    else if (r < 0) buckets['-1R..0R']++;
    else if (r < 1) buckets['0R..1R']++;
    else if (r < 2) buckets['1R..2R']++;
    else buckets['>2R']++;
  }
  return { count: rs.length, avgR, avgWinR, avgLossR, winRate, expectancyR, buckets, missingRiskCount: trades.length - withR.length };
}

// ---- Same-day correlated exposure ----
// Flags calendar days where the user traded 2+ instruments that historically
// move together (|correlation| >= threshold, from analytics.js#instrumentCorrelation)
// — a proxy for "you may have stacked correlated risk without realizing it".
export function sameDayExposureWarnings(trades, correlationMatrix, threshold = 0.5) {
  const byDate = {};
  for (const t of trades) (byDate[t.date] ||= new Set()).add(t.instrument);
  const warnings = [];
  for (const [date, instrSet] of Object.entries(byDate)) {
    const instruments = [...instrSet];
    if (instruments.length < 2) continue;
    for (let i = 0; i < instruments.length; i++) {
      for (let j = i + 1; j < instruments.length; j++) {
        const a = instruments[i], b = instruments[j];
        const r = correlationMatrix?.[a]?.[b];
        if (r != null && Math.abs(r) >= threshold) {
          warnings.push({ date, pair: [a, b], correlation: r });
        }
      }
    }
  }
  return warnings.sort((a, b) => (a.date < b.date ? 1 : -1));
}
