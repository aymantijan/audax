// Prop-firm rule presets (Trading n°4 bis). Checked on the firms' official
// pages on 2026-09-24 — firms change their rules, so the UI always shows the
// source + date and the user can edit every number.
//
// Rule fields = the rules engine (utils/prop-firm-analytics.js):
//  profitTargetPct, maxDailyLossPct, maxTotalDrawdownPct,
//  maxTotalDrawdownType ('static' from the starting balance | 'trailing' from the peak),
//  minTradingDays, minDayProfitPct (a day only counts if it made ≥ this % of the
//  starting balance; 0 = any profitable day; null = any day with a trade),
//  consistencyRulePct (best day / total profit), maxDailyProfitAmount, maxPhaseDurationDays.
// AUDAX measures the daily loss against the STARTING balance; some firms use the
// previous day's balance/equity instead — noted per preset.

export const PRESETS_CHECKED_AT = '2026-09-24';

export const PROP_FIRM_PRESETS = [
  {
    id: 'goat-2step-goat', firm: 'Goat Funded Trader', program: '2-Step GOAT Model',
    source: 'https://help.goatfundedtrader.com/en/articles/13575348-2-step-goat-model',
    phases: [
      { profitTargetPct: 8, maxDailyLossPct: 4, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 3, minDayProfitPct: 0.5 },
      { profitTargetPct: 6, maxDailyLossPct: 4, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 3, minDayProfitPct: 0.5 },
    ],
    funded: { maxDailyLossPct: 4, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 4, minDayProfitPct: 0.5, maxDailyProfitAmount: 3000 },
    notes: 'Daily drawdown checked at 5 PM EST on the higher of balance or equity. A valid day needs ≥ 0.5% profit. Funded: 80% split, bi-weekly payouts, $3,000 daily profit cap, 4 valid days per payout (accounts bought from 25 Jul 2026).',
  },
  {
    id: 'goat-2step-standard', firm: 'Goat Funded Trader', program: '2-Step Standard',
    source: 'https://help.goatfundedtrader.com/en/articles/13575169-2-step-standard',
    phases: [
      { profitTargetPct: 10, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 3, minDayProfitPct: 0.5 },
      { profitTargetPct: 5, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 3, minDayProfitPct: 0.5 },
    ],
    funded: { maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 4, minDayProfitPct: 0.5, maxDailyProfitAmount: 3000 },
    notes: 'A valid day needs ≥ 0.5% profit. Funded: 80% split, $3,000 daily profit cap, 4 valid days per payout (accounts bought from 25 Jul 2026).',
  },
  {
    id: 'ftmo-2step', firm: 'FTMO', program: '2-Step (Challenge + Verification)',
    source: 'https://ftmo.com/en/trading-objectives/',
    phases: [
      { profitTargetPct: 10, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 4 },
      { profitTargetPct: 5, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 4 },
    ],
    funded: { maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static' },
    notes: 'Daily loss = 5% of the initial capital, reset at midnight CE(S)T. No profit target once funded.',
  },
  {
    id: 'ftmo-1step', firm: 'FTMO', program: '1-Step',
    source: 'https://ftmo.com/en/trading-objectives/',
    phases: [
      { profitTargetPct: 10, maxDailyLossPct: 3, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'trailing', consistencyRulePct: 50 },
    ],
    funded: { maxDailyLossPct: 3, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'trailing' },
    notes: 'Max loss trails end-of-day (AUDAX trails trade by trade — slightly stricter). Best Day ≤ 50% of positive days’ profit (AUDAX: of total profit).',
  },
  {
    id: 'fundednext-stellar-2step', firm: 'FundedNext', program: 'Stellar 2-Step',
    source: 'https://help.fundednext.com/en/articles/8021076-what-rules-do-i-need-to-follow-in-the-stellar-2-step-challenge',
    phases: [
      { profitTargetPct: 8, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 5 },
      { profitTargetPct: 5, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 5 },
    ],
    funded: { maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static' },
    notes: 'Daily loss = 5% of the initial balance. No time limit. EAs allowed.',
  },
  {
    id: 'the5ers-high-stakes', firm: 'The5ers', program: 'High Stakes (2-Step)',
    source: 'https://the5ers.com/high-stakes/',
    phases: [
      { profitTargetPct: 10, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 3, minDayProfitPct: 0 },
      { profitTargetPct: 5, maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static', minTradingDays: 3, minDayProfitPct: 0 },
    ],
    funded: { maxDailyLossPct: 5, maxTotalDrawdownPct: 10, maxTotalDrawdownType: 'static' },
    notes: '3 PROFITABLE days per step (check the minimum profit that makes a day count in your dashboard). Daily drawdown is from the previous day’s closing balance/equity. No trading 2 min before/after high-impact news.',
  },
];

export const presetById = (id) => PROP_FIRM_PRESETS.find((p) => p.id === id) || null;
export const presetLabel = (p) => `${p.firm} — ${p.program}`;

/** Rules of a preset for an AUDAX phase ('phase1' | 'phase2' | 'funded'). */
export function presetRulesFor(preset, phase) {
  if (!preset) return null;
  if (phase === 'funded') return { ...preset.funded };
  const idx = phase === 'phase2' ? 1 : 0;
  return preset.phases[idx] ? { ...preset.phases[idx] } : { ...preset.funded };
}
