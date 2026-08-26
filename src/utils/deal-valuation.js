// Simplified, indicative LBO / growth-equity returns model for the Deals
// "Modeling" section (added 2026-08-26 per user request) — NOT a full
// 3-statement model with cash sweeps, covenants, or fees. Just the standard
// entry/exit value bridge (EV = EBITDA × multiple, equity = EV − debt) good
// enough to reason about a deal's shape and get a directional IRR/MOIC.
// `entryDebtPct = 0` collapses it into an all-equity calc, which is exactly
// the Growth/VC case (no leverage) — same function, no separate branch needed.
const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

export function computeDealReturns(model) {
  const {
    entryEbitda = 0,
    entryMultiple = 0,
    entryDebtPct = 0, // 0-100, % of entry EV funded with debt
    exitMultiple = entryMultiple,
    ebitdaGrowthPct = 0, // annualized, %
    debtPaydownPct = 0, // total over the hold period, % of entry debt repaid
    holdYears = 1,
  } = model || {};

  const entryEV = entryEbitda * entryMultiple;
  const entryDebt = entryEV * (clampPct(entryDebtPct) / 100);
  const entryEquity = entryEV - entryDebt;

  const years = Math.max(0.25, Number(holdYears) || 1);
  const exitEbitda = entryEbitda * Math.pow(1 + Number(ebitdaGrowthPct || 0) / 100, years);
  const exitEV = exitEbitda * (Number(exitMultiple) || 0);
  const exitDebt = entryDebt * (1 - clampPct(debtPaydownPct) / 100);
  const exitEquity = Math.max(0, exitEV - exitDebt);

  const moic = entryEquity > 0 ? exitEquity / entryEquity : null;
  const irr = moic != null && moic > 0 ? Math.pow(moic, 1 / years) - 1 : null;

  return { entryEV, entryDebt, entryEquity, exitEbitda, exitEV, exitDebt, exitEquity, moic, irr, holdYears: years };
}

export function blankDealModel() {
  return { entryEbitda: '', entryMultiple: '', entryDebtPct: '', exitMultiple: '', ebitdaGrowthPct: '', debtPaydownPct: '', holdYears: '5' };
}
