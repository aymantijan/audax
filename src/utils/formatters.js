import { format } from 'date-fns';
import { CURRENCY_SYMBOL } from './constants';
import { currencyMeta, formatMoney, toBase } from './currency';

// ---- Currency ----
// Trading is denominated per-account (each Demo/Broker/Prop Firm account picks
// its own currency — see tradingStore.js `accounts[].currency`, default 'USD').
// Personal finance (net worth, budgets, journal, goals) is kept in the user's
// BASE currency (accountingStore.baseCurrency, default MAD — see
// utils/currency.js). The accounting store pushes its base + rate table here
// so these plain formatters stay synchronous and dependency-free.
let FX = { base: 'MAD', rates: null };
export const setFxContext = (base, rates) => { FX = { base: base || 'MAD', rates: rates || null }; };
export const getBaseCurrency = () => FX.base;
export const baseCurrencyShort = () => currencyMeta(FX.base).short;

export const USD_TO_MAD = 10; // legacy fixed peg — kept for old imports
// USD → base currency at the user's rate (name kept for existing callers).
export const usdToMad = (usd) => toBase(usd ?? 0, 'USD', FX.base, FX.rates);

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

// Personal-finance money in the user's base currency ("3 000 DH", "3 000 €",
// "$3,000"…). Name kept from when everything was MAD.
export const fmtMAD = (n, digits = 0) => formatMoney(n, FX.base, digits);

export const fmtSignedMAD = (n) => (n >= 0 ? '+' : '') + formatMoney(n, FX.base, 0);

export const fmtPct = (n, digits = 0) => `${(n ?? 0).toFixed(digits)}%`;

export const fmtDate = (d) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');

export const fmtDateShort = (d) => (d ? format(new Date(d), 'MMM d') : '—');

// Optional `d` lets callers format an arbitrary date the same way (e.g. a
// streak loop walking backwards day-by-day) — omitted, it's today's date.
export const todayKey = (d) => format(d || new Date(), 'yyyy-MM-dd');

export const dateKey = (d) => format(new Date(d), 'yyyy-MM-dd');

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
