// Pro journal helpers: mistakes, sessions, timeframes, asset classes,
// playbook (setup) statistics.
import { tradeRMultiple } from './risk-management';

// Mistakes can be tagged on ANY trade (an on-plan trade can still be exited
// badly); off-plan trades use the same tags as "what broke the plan".
export const MISTAKES = [
  'Not my setup', 'Early entry', 'Late entry / chased', 'Moved my stop', 'Cut winner early', 'Held loser too long',
  'Oversized position', 'Revenge trade', 'FOMO entry', 'Traded the news', 'Over my max trades',
];
// Legacy trades (Trading n°1) stored the reasons as planBreaks.
export const mistakesOf = (t) => t.mistakes ?? t.planBreaks ?? [];

export const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', 'D', 'W'];

export const ASSET_CLASSES = [
  { value: 'forex', label: 'Forex' }, { value: 'index', label: 'Index' }, { value: 'commodity', label: 'Commodity' },
  { value: 'crypto', label: 'Crypto' }, { value: 'stock', label: 'Stock / ETF' }, { value: 'futures', label: 'Futures' },
];
export const BUILTIN_ASSET_CLASS = { EURUSD: 'forex', GBPUSD: 'forex', USDJPY: 'forex', XAUUSD: 'commodity', BTC: 'crypto' };

// One-click presets for Customize → Instruments. CFD / futures contract values
// differ between brokers: the user is told to check them.
export const INSTRUMENT_PRESETS = [
  { code: 'NAS100', assetClass: 'index', kind: 'pip', pipSize: 1, pipValuePerLot: 1 },
  { code: 'US30', assetClass: 'index', kind: 'pip', pipSize: 1, pipValuePerLot: 1 },
  { code: 'SPX500', assetClass: 'index', kind: 'pip', pipSize: 1, pipValuePerLot: 1 },
  { code: 'GER40', assetClass: 'index', kind: 'pip', pipSize: 1, pipValuePerLot: 1 },
  { code: 'XAGUSD', assetClass: 'commodity', kind: 'pip', pipSize: 0.01, pipValuePerLot: 50 },
  { code: 'USOIL', assetClass: 'commodity', kind: 'pip', pipSize: 0.01, pipValuePerLot: 10 },
  { code: 'AUDUSD', assetClass: 'forex', kind: 'pip', pipSize: 0.0001, pipValuePerLot: 10 },
  { code: 'USDCAD', assetClass: 'forex', kind: 'pip', pipSize: 0.0001, pipValuePerLot: 7.3 },
  { code: 'GBPJPY', assetClass: 'forex', kind: 'pip', pipSize: 0.01, pipValuePerLot: 6.7 },
  { code: 'ETH', assetClass: 'crypto', kind: 'direct' },
  { code: 'SOL', assetClass: 'crypto', kind: 'direct' },
  { code: 'ES', assetClass: 'futures', kind: 'pip', pipSize: 1, pipValuePerLot: 50 },
  { code: 'MES', assetClass: 'futures', kind: 'pip', pipSize: 1, pipValuePerLot: 5 },
  { code: 'NQ', assetClass: 'futures', kind: 'pip', pipSize: 1, pipValuePerLot: 20 },
  { code: 'MNQ', assetClass: 'futures', kind: 'pip', pipSize: 1, pipValuePerLot: 2 },
  { code: 'AAPL', assetClass: 'stock', kind: 'direct' },
  { code: 'TSLA', assetClass: 'stock', kind: 'direct' },
];

/**
 * Market session of an entry, from the trade's local date + time (converted
 * to UTC). Asia 00–07, London 07–12, London/NY overlap 12–16, New York 16–21,
 * off-hours 21–24 (UTC, approximate — DST shifts sessions by an hour).
 */
export function sessionOf(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (h < 7) return 'Asia';
  if (h < 12) return 'London';
  if (h < 16) return 'London/NY overlap';
  if (h < 21) return 'New York';
  return 'Off-hours';
}

function groupOf(trades) {
  const rs = trades.map(tradeRMultiple).filter((r) => r != null);
  const pnl = trades.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  return {
    count: trades.length, pnl,
    winRate: trades.length ? (trades.filter((t) => t.pnl > 0).length / trades.length) * 100 : null,
    expR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    avgPnl: trades.length ? pnl / trades.length : null,
  };
}

/** Per-setup stats + "all criteria met" (A+) vs partial, when the setup has criteria. */
export function setupStats(trades, name, criteria = []) {
  const own = trades.filter((t) => t.strategy === name);
  const out = { ...groupOf(own) };
  if (criteria.length) {
    const scored = own.filter((t) => Array.isArray(t.criteriaMet));
    const full = scored.filter((t) => criteria.every((c) => t.criteriaMet.includes(c)));
    const partial = scored.filter((t) => !criteria.every((c) => t.criteriaMet.includes(c)));
    out.full = groupOf(full); out.partial = groupOf(partial);
  }
  return out;
}

/** Cost of each mistake across all trades, most expensive first, + clean vs with-mistake trades. */
export function mistakeStats(trades) {
  const map = {};
  for (const t of trades) for (const m of mistakesOf(t)) (map[m] = map[m] || []).push(t);
  const tags = Object.entries(map).map(([label, ts]) => ({ label, ...groupOf(ts) })).sort((a, b) => a.pnl - b.pnl || b.count - a.count);
  const clean = trades.filter((t) => !mistakesOf(t).length && (t.mistakes || t.followedPlan != null));
  const withM = trades.filter((t) => mistakesOf(t).length);
  return { tags, clean: groupOf(clean), withMistakes: groupOf(withM) };
}
