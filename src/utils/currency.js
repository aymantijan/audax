/**
 * Currencies (Finances n°4).
 *
 * Model: every user keeps ONE base currency (default MAD). The whole
 * double-entry engine stays single-currency — journal amounts are always in
 * the base currency, so no report changes meaning. Foreign-currency
 * operations are converted at entry time and keep their original amount in
 * `entry.fx = { currency, amount, rate }` for display; treasury sub-accounts
 * can carry a currency to show an approximate native balance.
 *
 * `rates[code]` = how many BASE units one unit of `code` is worth.
 */

export const CURRENCIES = [
  { code: 'MAD', label: 'Dirham marocain', short: 'DH', symbolAfter: true },
  { code: 'EUR', label: 'Euro', short: '€', symbolAfter: true },
  { code: 'USD', label: 'Dollar américain', short: '$', symbolAfter: false },
  { code: 'GBP', label: 'Livre sterling', short: '£', symbolAfter: false },
  { code: 'CHF', label: 'Franc suisse', short: 'CHF', symbolAfter: true },
  { code: 'CAD', label: 'Dollar canadien', short: 'CA$', symbolAfter: false },
  { code: 'AED', label: 'Dirham émirati', short: 'AED', symbolAfter: true },
  { code: 'SAR', label: 'Riyal saoudien', short: 'SAR', symbolAfter: true },
  { code: 'XOF', label: 'Franc CFA (BCEAO)', short: 'FCFA', symbolAfter: true },
  { code: 'TND', label: 'Dinar tunisien', short: 'DT', symbolAfter: true },
  { code: 'DZD', label: 'Dinar algérien', short: 'DA', symbolAfter: true },
  { code: 'EGP', label: 'Livre égyptienne', short: 'E£', symbolAfter: true },
  { code: 'TRY', label: 'Livre turque', short: '₺', symbolAfter: true },
  { code: 'JPY', label: 'Yen', short: '¥', symbolAfter: false },
  { code: 'CNY', label: 'Yuan', short: '¥', symbolAfter: false },
  { code: 'BTC', label: 'Bitcoin', short: '₿', symbolAfter: false },
];
export const currencyMeta = (code) => CURRENCIES.find((c) => c.code === code) || { code, label: code, short: code, symbolAfter: true };

// Approximate reference values in MAD (Sept. 2026) — only a starting point:
// users edit them or refresh them online; conversions always show the rate used.
const MAD_VALUE = {
  MAD: 1, EUR: 10.9, USD: 10, GBP: 12.7, CHF: 11.6, CAD: 7.3, AED: 2.72, SAR: 2.67, XOF: 0.0166, TND: 3.2, DZD: 0.074, EGP: 0.2, TRY: 0.29, JPY: 0.067, CNY: 1.4, BTC: 600000,
};

/** Default rate table for a base currency (units of base per unit of code). */
export function defaultRates(base = 'MAD') {
  const b = MAD_VALUE[base] || 1;
  return Object.fromEntries(Object.entries(MAD_VALUE).map(([code, v]) => [code, Math.round((v / b) * 1e6) / 1e6]));
}

export function rateFor(code, base, rates) {
  if (!code || code === base) return 1;
  return Number(rates?.[code]) || defaultRates(base)[code] || 1;
}

export const toBase = (amount, code, base, rates) => Math.round(Number(amount) * rateFor(code, base, rates) * 100) / 100;
export const fromBase = (amount, code, base, rates) => Number(amount) / rateFor(code, base, rates);

export function formatMoney(n, code = 'MAD', digits = 0) {
  const m = currencyMeta(code);
  const v = Math.abs(n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: code === 'BTC' ? 6 : Math.max(digits, 2) });
  const sign = n < 0 ? '-' : '';
  return m.symbolAfter ? `${sign}${v} ${m.short}` : `${sign}${m.short}${v}`;
}

/**
 * Live rates from a free public API (no key). Returns a rate table in the
 * app's convention or throws.
 */
export async function fetchRates(base = 'MAD') {
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error('Service de taux indisponible');
  const data = await res.json();
  if (data.result !== 'success' || !data.rates) throw new Error('Réponse invalide du service de taux');
  const out = {};
  for (const c of CURRENCIES) {
    const perBase = data.rates[c.code]; // units of c per 1 base
    if (perBase) out[c.code] = Math.round((1 / perBase) * 1e6) / 1e6;
  }
  out[base] = 1;
  return out;
}
