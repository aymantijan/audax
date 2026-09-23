/**
 * Bank statement import + automatic categorisation (Finances n°2).
 * Pure helpers: delimiter-agnostic CSV parsing, column detection, French /
 * English number and date formats, label → account guessing, duplicates.
 */
import { classOf } from './chart-of-accounts';
import { normalizeLabel } from './label-analysis';

// ── CSV (';' — most Moroccan/French banks — ',' or tab) ────────────────
export function parseDelimited(text) {
  const firstLine = (text.split(/\r?\n/).find((l) => l.trim()) || '');
  const counts = { ';': (firstLine.match(/;/g) || []).length, ',': (firstLine.match(/,/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length };
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ';';
  const rows = [];
  let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()));
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim())); }
  return { delim, rows };
}

// "1 234,56" · "-45,00" · "1,234.56" · "45.5" · "(12,00)" · "12,00 DH"
export function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/\s| | /g, '').replace(/(MAD|DH|DHS|EUR|€|\$|USD)/gi, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(','); const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// dd/mm/yyyy · dd-mm-yy · yyyy-mm-dd · dd.mm.yyyy → 'YYYY-MM-DD'
export function parseDate(raw) {
  const s = String(raw || '').trim().slice(0, 10);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = String(raw || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = Number(m[1]); const mo = Number(m[2]);
    if (mo > 12 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Guess which column is what from the header + first rows.
 * Returns { hasHeader, date, label, amount, debit, credit } (column indexes, -1 = none).
 */
export function detectColumns(rows) {
  const head = (rows[0] || []).map(norm);
  const hasHeader = head.some((h) => /date|libel|label|descr|operation|montant|amount|debit|credit|valeur/.test(h)) && !parseDate(rows[0]?.[0]);
  const find = (re) => head.findIndex((h) => re.test(h));
  const data = rows.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 15);
  const cols = Math.max(...rows.map((r) => r.length));
  const score = (fn) => Array.from({ length: cols }, (_, i) => data.filter((r) => fn(r[i])).length);
  const dateScores = score((v) => !!parseDate(v));
  const numScores = score((v) => v && parseAmount(v) != null && /\d/.test(v));
  const textLen = Array.from({ length: cols }, (_, i) => data.reduce((a, r) => a + ((r[i] && parseAmount(r[i]) == null && !parseDate(r[i])) ? r[i].length : 0), 0));

  let date = hasHeader ? find(/date/) : -1;
  if (date < 0) date = dateScores.indexOf(Math.max(...dateScores));
  let label = hasHeader ? find(/libel|label|descr|operation|detail|narrat|motif/) : -1;
  if (label < 0) label = textLen.indexOf(Math.max(...textLen));
  let debit = hasHeader ? find(/debit|retrait|sortie|withdraw/) : -1;
  let credit = hasHeader ? find(/credit|versement|entree|deposit/) : -1;
  let amount = hasHeader ? find(/montant|amount|somme|valeur/) : -1;
  if (debit >= 0 && credit >= 0) amount = -1;
  if (amount < 0 && (debit < 0 || credit < 0)) {
    // No header hints: take the last mostly-numeric column that isn't the date.
    const candidates = numScores.map((s, i) => ({ s, i })).filter((x) => x.i !== date && x.s >= Math.max(1, data.length / 2));
    amount = candidates.length ? candidates[candidates.length - 1].i : -1;
    debit = -1; credit = -1;
  }
  return { hasHeader, date, label, amount, debit, credit };
}

/** Rows → [{ date, label, amount (signed: <0 money out) }] with the mapping. */
export function extractTransactions(rows, map) {
  const out = [];
  for (const r of rows.slice(map.hasHeader ? 1 : 0)) {
    const date = parseDate(r[map.date]);
    if (!date) continue;
    let amount = null;
    if (map.amount >= 0) amount = parseAmount(r[map.amount]);
    else {
      const d = parseAmount(r[map.debit]); const c = parseAmount(r[map.credit]);
      if (d) amount = -Math.abs(d); else if (c) amount = Math.abs(c);
    }
    if (!amount) continue;
    out.push({ date, label: (r[map.label] || '').replace(/\s+/g, ' ').trim() || 'Opération bancaire', amount });
  }
  return out;
}

// Keyword rules — Moroccan & international merchants / wording.
const EXPENSE_RULES = [
  // Cash withdrawal: not an expense, a transfer to the cash account.
  ['571', /retrait|\bgab\b|\bdab\b|\batm\b|withdrawal/],
  ['611', /loyer|rent\b|syndic/],
  ['613', /inwi|orange|iam\b|maroc ?telecom|lydec|redal|amendis|onee|radeef|internet|fibre|electricite|eau\b|telephone|recharge/],
  ['612', /ikea|kitea|bricoma|mr ?bricolage|electroplanet|meuble/],
  ['621', /marjane|carrefour|bim\b|acima|label ?vie|atacadao|supermarche|epicerie|hanout|boucherie|courses|aswak/],
  ['622', /cafe|coffee|starbucks|restaurant|resto|mcdo|mcdonald|kfc|burger|pizza|glovo|jumia ?food|tacos|snack|patisserie|sushi|food/],
  ['631', /taxi|uber|careem|heetch|indrive|essence|carburant|afriquia|shell|totalenergies|total\b|winxo|petrom|peage|autoroute|adm\b|oncf|tram|bus\b|parking|ctm\b/],
  ['632', /garage|vidange|pneu|mecanique|lavage auto/],
  ['641', /pharmacie|pharma|medecin|docteur|clinique|hopital|dentiste|laboratoire|analyses|opticien/],
  ['642', /gym|fitness|salle de sport|city ?club|basic ?fit|sport|piscine|decathlon/],
  ['651', /iscae|scolarite|inscription|universite|ecole|formation|udemy|coursera|cours\b|tuition/],
  ['652', /librairie|livre|book|kindle|audible|abonnement pro|linkedin|notion|chatgpt|openai|claude|anthropic/],
  ['661', /cinema|megarama|concert|sortie|bar\b|loisir|jeu|playstation|steam|bowling/],
  ['662', /hotel|airbnb|booking|ryanair|royal air maroc|\bram\b|air arabia|easyjet|vol\b|voyage|trip/],
  ['663', /zara|h&m|h ?& ?m|lc ?waikiki|defacto|shein|vetement|chaussure|nike|adidas|shopping|amazon|aliexpress|jumia/],
  ['664', /netflix|spotify|youtube|deezer|apple|icloud|google|disney|shahid|osn|prime video|abonnement/],
  ['672', /frais bancaires|commission|agios|cotisation carte|tenue de compte|frais de gestion|frais sur/],
  ['673', /ftmo|prop ?firm|tradingview|broker|spread/],
  ['681', /impot|taxe|dgi|vignette|timbre/],
  ['682', /assurance|wafa ?assurance|axa|saham|rma\b|allianz/],
  ['691', /don\b|cadeau|zakat|sadaqa|association/],
];
const INCOME_RULES = [
  ['771', /bourse|minhaty|onousc/],
  ['711', /salaire|paie|payroll|virement employeur|prime/],
  ['712', /stage|indemnite/],
  ['721', /freelance|facture|upwork|fiverr|malt|honoraires/],
  ['731', /payout|ftmo|prop ?firm|withdrawal|profit/],
  ['741', /loyer percu|location/],
  ['761', /interets|dividende/],
  ['751', /cadeau|don\b/],
];

/**
 * Best account for a label:
 *  1. the account most used with this exact label in the journal (your own history)
 *  2. a known merchant / keyword rule
 *  3. fallback (698 divers / 798 produits exceptionnels)
 * Returns { account, source: 'history'|'rule'|'default' }.
 */
export function guessCategory(journal, label, kind = 'expense') {
  const key = normalizeLabel(label);
  const cls = kind === 'income' ? 7 : 6;
  if (key) {
    const counts = {};
    for (const e of journal) {
      if (normalizeLabel(e.label) !== key) continue;
      for (const l of e.lines) {
        const side = cls === 6 ? Number(l.debit) : Number(l.credit);
        if (classOf(l.account) === cls && side > 0) counts[l.account] = (counts[l.account] || 0) + 1;
      }
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best) return { account: best[0], source: 'history' };
  }
  const text = norm(label);
  for (const [acc, re] of kind === 'income' ? INCOME_RULES : EXPENSE_RULES) {
    if (re.test(text)) return { account: acc, source: 'rule' };
  }
  return { account: kind === 'income' ? '798' : '698', source: 'default' };
}

// Most recently used cash account (class 5) for a kind — sensible "payé avec".
export function lastCashAccount(journal, kind = 'expense') {
  const sorted = [...journal].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  for (const e of sorted) {
    const l = e.lines.find((x) => classOf(x.account) === 5 && (kind === 'income' ? Number(x.debit) > 0 : Number(x.credit) > 0));
    if (l) return l.account;
  }
  return '511';
}

// Most used categories (for quick chips).
export function topCategories(journal, kind = 'expense', n = 6) {
  const cls = kind === 'income' ? 7 : 6;
  const counts = {};
  for (const e of journal) for (const l of e.lines) {
    const side = cls === 6 ? Number(l.debit) : Number(l.credit);
    if (classOf(l.account) === cls && side > 0) counts[l.account] = (counts[l.account] || 0) + 1;
  }
  const used = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const defaults = cls === 6 ? ['621', '622', '631', '613', '663', '664'] : ['711', '771', '721', '731', '751', '761'];
  return [...new Set([...used, ...defaults])].slice(0, n);
}

/** An entry already in the journal for this bank account, same amount, within ±3 days. */
export function isDuplicate(journal, bankAccount, tx) {
  const t = new Date(tx.date + 'T12:00:00').getTime();
  const amt = Math.abs(tx.amount);
  return journal.some((e) => {
    if (Math.abs(new Date(e.date + 'T12:00:00').getTime() - t) > 3 * 86400000) return false;
    return e.lines.some((l) => l.account === bankAccount && Math.abs((tx.amount < 0 ? Number(l.credit) : Number(l.debit)) - amt) < 0.005);
  });
}

/** Two-line journal entry for a bank movement. */
export function entryFor(tx, bankAccount, category) {
  const amt = Math.round(Math.abs(tx.amount) * 100) / 100;
  return tx.amount < 0
    ? { date: tx.date, label: tx.label, lines: [{ account: category, debit: amt, credit: 0 }, { account: bankAccount, debit: 0, credit: amt }] }
    : { date: tx.date, label: tx.label, lines: [{ account: bankAccount, debit: amt, credit: 0 }, { account: category, debit: 0, credit: amt }] };
}
