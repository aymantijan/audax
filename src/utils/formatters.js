import { format } from 'date-fns';

// ---- Currency ----
// Trading is denominated in USD ($). Everything else (personal finance: net worth,
// budgets, transactions, goals) is in Moroccan dirhams (DH). Fixed peg for any
// cross-domain figure (e.g. the trading account counted toward net worth).
export const USD_TO_MAD = 10;
export const usdToMad = (usd) => (usd ?? 0) * USD_TO_MAD;

// USD (trading)
export const fmtMoney = (n, digits = 0) =>
  (n < 0 ? '-$' : '$') + Math.abs(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });

export const fmtSignedMoney = (n) => (n >= 0 ? '+' : '-') + '$' + Math.abs(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

// MAD (personal finance) — dirham shown as a "DH" suffix
export const fmtMAD = (n, digits = 0) =>
  (n < 0 ? '-' : '') + Math.abs(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }) + ' DH';

export const fmtSignedMAD = (n) => (n >= 0 ? '+' : '-') + Math.abs(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' DH';

export const fmtPct = (n, digits = 0) => `${(n ?? 0).toFixed(digits)}%`;

export const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');

export const fmtDateShort = (d) => (d ? format(new Date(d), 'MMM d') : '—');

export const todayKey = () => format(new Date(), 'yyyy-MM-dd');

export const dateKey = (d) => format(new Date(d), 'yyyy-MM-dd');

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
