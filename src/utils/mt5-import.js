// MetaTrader 5 "Trade History Report" import (Trading n°4).
// Reads the report saved from MT5 (History → right-click → Report → Open XML
// (.xlsx) or HTML), finds its Positions / Orders / Deals sections and turns
// each closed position into an AUDAX trade. Column ORDER is fixed by MT5 in
// every language, so sections are read by position, not by header text.
import { unzipSync } from 'fflate';
import { sessionOf } from './trading-journal';

const SECTION = {
  positions: ['positions'],
  orders: ['orders', 'ordres', 'órdenes', 'ordini', 'aufträge'],
  deals: ['deals', 'transactions', 'transacciones', 'operazioni', 'abschlüsse'],
  results: ['results', 'résultats', 'resultados', 'risultati', 'ergebnisse'],
};

const txt = (v) => (v == null ? '' : String(v).trim());
/** "3 664.00", "0.01 / 0.01", "-2.5" → number (first figure). */
export const num = (v) => {
  const s = txt(v).split('/')[0].replace(/[\s ]/g, '').replace(/,(?=\d{3}\b)/g, '');
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// ── File → rows (array of arrays of strings) ──
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

// MT5 writes the XML parts of its .xlsx (and its HTML reports) in UTF-16 with a BOM.
const decode = (u8) => {
  const enc = u8[0] === 0xff && u8[1] === 0xfe ? 'utf-16le' : u8[0] === 0xfe && u8[1] === 0xff ? 'utf-16be' : 'utf-8';
  return new TextDecoder(enc).decode(u8);
};

export function rowsFromXlsx(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const xml = (path) => (files[path] ? new DOMParser().parseFromString(decode(files[path]), 'application/xml') : null);
  const shared = [];
  const ss = xml('xl/sharedStrings.xml');
  if (ss) for (const si of ss.getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const sheetPath = Object.keys(files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort()[0];
  if (!sheetPath) throw new Error('No worksheet found in this file.');
  const doc = xml(sheetPath);
  const rows = [];
  for (const r of doc.getElementsByTagName('row')) {
    const idx = r.getAttribute('r') ? Number(r.getAttribute('r')) - 1 : rows.length;
    const row = [];
    let next = 0;
    for (const c of r.getElementsByTagName('c')) {
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const value = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : v;
      const col = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : next;
      row[col] = value; next = col + 1;
    }
    rows[idx] = Array.from(row, (x) => x ?? '');
  }
  return Array.from(rows, (r) => r || []);
}

export function rowsFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = [];
  for (const tr of doc.querySelectorAll('tr')) {
    const row = [];
    for (const cell of tr.querySelectorAll('td, th')) {
      if (cell.classList.contains('hidden') || cell.style?.display === 'none') continue;
      row.push(cell.textContent.trim());
      for (let i = 1; i < Number(cell.getAttribute('colspan') || 1); i++) row.push('');
    }
    rows.push(row);
  }
  return rows;
}

export async function readReportFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) return rowsFromXlsx(await file.arrayBuffer());
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return rowsFromHtml(decode(new Uint8Array(await file.arrayBuffer())));
  }
  throw new Error('Use the MT5 report saved as .xlsx (Open XML) or .html.');
}

// ── Rows → report ──
export function parseMt5Report(rows) {
  const meta = {};
  const sections = {};
  let current = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const first = txt(r.find((x) => txt(x)) ?? '');
    const lower = first.toLowerCase();
    const filled = r.filter((x) => txt(x)).length;
    const sec = filled === 1 && Object.entries(SECTION).find(([, names]) => names.includes(lower))?.[0];
    if (sec) { current = sec; sections[sec] = { header: rows[i + 1] || [], rows: [] }; i++; continue; }
    if (!current) {
      // Header block: "Name:", "Account:", "Company:", "Date:" (label + value later on the row)
      const label = lower.replace(/:$/, '');
      const value = r.filter((x) => txt(x)).slice(1).map(txt).join(' ');
      if (value) meta[label] = value;
      continue;
    }
    if (filled) sections[current].rows.push(r);
  }
  const positionsRows = sections.positions?.rows || [];
  if (!positionsRows.length) throw new Error('No “Positions” section found — is this an MT5 Trade History Report?');

  const accountLine = meta.account || meta.compte || meta.cuenta || meta.conto || meta.konto || '';
  const login = (accountLine.match(/\d{4,}/) || [''])[0];
  const currency = (accountLine.match(/\(([A-Z]{3})\b/) || [])[1] || 'USD';
  const initialSL = {};
  for (const o of sections.orders?.rows || []) if (txt(o[1])) initialSL[txt(o[1])] = num(o[6]);
  let deposit = null; let depositTime = null;
  for (const d of sections.deals?.rows || []) {
    if (txt(d[3]).toLowerCase() === 'balance' && num(d[11]) > 0) { deposit = num(d[11]); depositTime = txt(d[0]); break; }
  }
  const positions = positionsRows
    .filter((r) => /^\d{4}\.\d{2}\.\d{2}/.test(txt(r[0])) && txt(r[1]) && txt(r[2]))
    .map((r) => ({
      position: txt(r[1]), symbol: txt(r[2]), type: txt(r[3]).toLowerCase(), volume: num(r[4]),
      openTime: txt(r[0]), openPrice: num(r[5]), sl: num(r[6]), tp: num(r[7]),
      closeTime: txt(r[8]), closePrice: num(r[9]), commission: num(r[10]), swap: num(r[11]), profit: num(r[12]),
      initialSL: initialSL[txt(r[1])] ?? null,
    }));
  return {
    meta: { name: meta.name || meta.nom || '', company: meta.company || meta.société || meta.societe || '', accountLine, login, currency, isDemo: /demo/i.test(accountLine), deposit, depositTime },
    positions,
  };
}

// ── Report → AUDAX trades ──
/** "XAUUSD.x", "EURUSDm", "US30.cash" → "XAUUSD", "EURUSD", "US30". */
export function baseSymbol(sym, known = []) {
  const up = sym.toUpperCase();
  const cut = up.split(/[._#]/)[0];
  if (known.includes(up)) return up;
  if (known.includes(cut)) return cut;
  const k = known.find((x) => cut.startsWith(x) && cut.length - x.length <= 2);
  return k || cut;
}

/** "2026.08.03 02:43:45" in broker server time (UTC+offset) → local { date, time, ms }. */
export function serverToLocal(stamp, offsetHours) {
  const m = stamp.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - offsetHours * 3600e3;
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return { ms, date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

const round2 = (n) => Math.round(n * 100) / 100;

const localOf = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return { ms, date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};

/**
 * One closed MT5 position → AUDAX trade. `open` / `close` are local
 * { ms, date, time }. P&L = profit + commission + swap (what hit the
 * balance); risk from the INITIAL stop so moved stops don't fake R.
 */
function buildTrade(p, { external, accountId, strategy, instrument, open, close }) {
  const dir = p.type.startsWith('sell') ? 'short' : 'long';
  const sign = dir === 'short' ? -1 : 1;
  const move = (p.closePrice - p.openPrice) * sign;
  // Money per 1.0 price unit for this position size, read from the position itself.
  const perUnit = move ? p.profit / move : null;
  const stop = p.initialSL || (p.sl && (dir === 'long' ? p.sl < p.openPrice : p.sl > p.openPrice) ? p.sl : 0);
  const riskAmount = perUnit && stop ? round2(Math.abs(p.openPrice - stop) * Math.abs(perUnit)) : 0;
  return {
    external, source: 'mt5', accountId,
    date: close?.date, entryTime: open?.time || '', session: open ? sessionOf(open.date, open.time) : null,
    instrument, strategy, direction: dir, timeframe: '',
    entryPrice: p.openPrice, exitPrice: p.closePrice, stopLoss: stop || 0, takeProfit: p.tp || 0,
    positionSize: p.volume, riskAmount, pnl: round2(p.profit + p.commission + p.swap), fees: round2(-(p.commission + p.swap)),
    holdingTime: open && close ? Math.max(0, Math.round((close.ms - open.ms) / 60000)) : 0,
    chartUrl: '', journal: { reasoning: '', emotion: 'neutral', processQuality: 7, exitReason: '' },
    lesson: '', linkedSkills: [], macro: {}, followedPlan: null, mistakes: [],
  };
}

/** Report (file import) → { trades, newSymbols[], duplicates, net } for tradingStore.importTrades. */
export function positionsToTrades(report, { accountId, offsetHours = 3, strategy = 'Trend', knownInstruments = [], existingExternal = new Set() }) {
  const trades = []; const newSymbols = new Set(); let duplicates = 0; let net = 0;
  for (const p of report.positions) {
    const external = `mt5:${report.meta.login || 'x'}:${p.position}`;
    net += round2(p.profit + p.commission + p.swap);
    if (existingExternal.has(external)) { duplicates++; continue; }
    const instrument = baseSymbol(p.symbol, knownInstruments);
    if (!knownInstruments.includes(instrument)) newSymbols.add(instrument);
    const open = serverToLocal(p.openTime, offsetHours);
    const close = serverToLocal(p.closeTime, offsetHours) || open;
    trades.push(buildTrade(p, { external, accountId, strategy, instrument, open, close }));
  }
  return { trades, newSymbols: [...newSymbols], duplicates, net: round2(net) };
}

/**
 * Live sync (AUDAX_Sync EA) → same shape. EA times are already UTC unix
 * seconds and `sl` is the opening order's (initial) stop. Same `external`
 * key as the file import, so file + live sync never duplicate each other.
 */
export function syncPositionsToTrades(login, positions, { accountId, strategy = 'Trend', knownInstruments = [], existingExternal = new Set() }) {
  const trades = []; const newSymbols = new Set();
  for (const p of positions || []) {
    const external = `mt5:${login}:${p.position}`;
    if (existingExternal.has(external)) continue;
    const instrument = baseSymbol(p.symbol, knownInstruments);
    if (!knownInstruments.includes(instrument)) newSymbols.add(instrument);
    trades.push(buildTrade({ ...p, initialSL: p.sl || null }, { external, accountId, strategy, instrument, open: localOf(p.openTime * 1000), close: localOf(p.closeTime * 1000) }));
  }
  return { trades, newSymbols: [...newSymbols] };
}

/** Instrument definitions for symbols AUDAX doesn't know yet. */
export function newInstrumentDefs(codes, presets) {
  const guessClass = (code) => (/^(US|NAS|SPX|GER|UK|JP|DE|FR|HK|AUS)\d/.test(code) ? 'index' : /^(XAU|XAG|XPT|USOIL|UKOIL|WTI|BRENT)/.test(code) ? 'commodity' : /^(BTC|ETH|SOL|XRP|LTC|DOGE)/.test(code) ? 'crypto' : /^[A-Z]{6}$/.test(code) ? 'forex' : 'stock');
  return codes.map((code) => presets.find((p) => p.code === code) || { code, kind: 'direct', assetClass: guessClass(code) });
}
