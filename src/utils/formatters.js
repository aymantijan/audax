import { format } from 'date-fns';
import { CURRENCY_SYMBOL } from './constants';

// ---- Currency ----
// Trading is denominated per-account (each Demo/Broker/Prop Firm account picks
// its own currency — see tradingStore.js `accounts[].currency`, default 'USD').
// Everything else (personal finance: net worth, budgets, transactions, goals)
// is in Moroccan dirhams (DH). USD_TO_MAD is a fixed peg used only for cross-
// domain figures (e.g. a USD trading account counted toward MAD net worth) —
// it does NOT convert between trading account currencies themselves.
export const USD_TO_MAD = 10;
export const usdToMad = (usd) => (usd ?? 0) * USD_TO_MAD;

// Trading money, symbol per account currency (defaults to USD for callers that
// don't pass one — i.e. anywhere not yet scoped to a specific account).
export const fmtMoney = (n, digits = 0, currency = 'USD') => {
  const sym = CURRENCY_SYMBOL[currency] || currency;
  return (n < 0 ? `-${sym}` : sym) + Math.abs(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
};

export const fmtSignedMoney = (n, currency = 'USD') => {
  const sym = CURRENCY_SYMBOL[currency] || currency;
  return (n >= 0 ? '+' : '-') + sym + Math.abs(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
};

// MAD (personal finance) — dirham shown as a "DH" suffix
export const fmtMAD = (n, digits = 0) =>
  (n < 0 ? '-' : '') + Math.abs(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }) + ' DH';

export const fmtSignedMAD = (n) => (n >= 0 ? '+' : '-') + Math.abs(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' DH';

export const fmtPct = (n, digits = 0) => `${(n ?? 0).toFixed(digits)}%`;

export const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');

export const fmtDateShort = (d) => (d ? format(new Date(d), 'MMM d') : '—');

// Optional `d` lets callers format an arbitrary date the same way (e.g. a
// streak loop walking backwards day-by-day) — omitted, it's today's date.
export const todayKey = (d) => format(d || new Date(), 'yyyy-MM-dd');

export const dateKey = (d) => format(new Date(d), 'yyyy-MM-dd');

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
