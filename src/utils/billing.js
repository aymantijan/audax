// Freelance billing for every way of charging (per client "billing profile").
// Pure: tests/billing.test.mjs. Stored on the engagement as `billing`; an old
// client with only `hourlyRate` reads as one hourly rate (nothing to migrate).
//
// billing = {
//   rates: [{ id, label, price, unit: 'h'|'day'|'halfday'|'unit', unitLabel, vatRate|null }],
//   roundingMin: 0|6|15|30|60, minimumHours: 0, dayHours: 8,
//   retainer:   { enabled, amount, every: 1|3|6|12 (months), timing: 'start'|'end',
//                 includedHours, overagePrice },                            // subscription, per period
//   fixed:      { enabled, amount, milestones: [{ id, label, pct, due }] }, // fixed price + schedule
//   block:      { enabled, hours, price },                                 // prepaid hours
//   commission: { enabled, pct },                                          // % of an amount
//   variable:   { enabled },                                               // variable income: no rate, amounts as received
//   discountPct: 0, withholdingPct: 0,
// }
// Work entries (engagement.timeLogs): { id, date, qty, rateId, note, invoiceId }
//   (old entries: { hours } = qty in hours at the default rate). Commission
//   entries: { kind: 'commission', base }. Variable amounts to invoice:
//   { kind: 'variable', amount, note }. Expenses: engagement.expenses.

export const RATE_UNITS = [
  { key: 'h', label: 'heure', short: 'h' },
  { key: 'day', label: 'jour', short: 'j' },
  { key: 'halfday', label: 'demi-journée', short: '½ j' },
  { key: 'unit', label: 'unité', short: 'u' },
];

export const BILLING_MODES = [
  { key: 'rates', label: 'Au temps ou à l’unité', hint: 'Heures, jours, demi-journées ou unités (article, page, séance…), avec autant de tarifs que tu veux.' },
  { key: 'retainer', label: 'Abonnement', hint: 'Un montant fixe par mois, trimestre, semestre ou année, facturé en début ou en fin de période, avec des heures incluses si tu veux.' },
  { key: 'fixed', label: 'Forfait', hint: 'Un prix pour le projet, payé selon un échéancier (acompte, étapes, solde). Le temps passé sert au suivi.' },
  { key: 'block', label: 'Paquet d’heures prépayé', hint: 'Le client achète un paquet d’heures ; le temps passé est décompté, le dépassement facturé.' },
  { key: 'commission', label: 'Commission', hint: 'Un pourcentage d’un montant (vente, contrat).' },
  { key: 'variable', label: 'Revenu variable', hint: 'Pas de taux, pas de calcul : tu notes chaque montant reçu (il va directement dans ta compta), ou un montant à facturer.' },
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => Number(v) || 0;

export function billingOf(e) {
  if (e?.billing?.rates?.length) return e.billing;
  return {
    rates: [{ id: 'default', label: 'Temps passé', price: num(e?.hourlyRate), unit: 'h', unitLabel: '', vatRate: null }],
    roundingMin: 0, minimumHours: 0, dayHours: 8,
    retainer: { enabled: false, amount: 0, every: 1, timing: 'start', includedHours: 0, overagePrice: 0 },
    fixed: { enabled: false, amount: 0, milestones: [] },
    block: { enabled: false, hours: 0, price: 0 },
    commission: { enabled: false, pct: 0 },
    variable: { enabled: false },
    discountPct: 0, withholdingPct: 0,
    ...(e?.billing || {}),
    ...(e?.billing?.rates?.length ? {} : { rates: [{ id: 'default', label: 'Temps passé', price: num(e?.hourlyRate), unit: 'h', unitLabel: '', vatRate: null }] }),
  };
}

export const rateOf = (billing, rateId) => billing.rates.find((r) => r.id === rateId) || billing.rates[0];
export const qtyOf = (t) => (t.qty != null ? num(t.qty) : num(t.hours));
export const unitShort = (rate) => (rate?.unit === 'unit' ? rate.unitLabel || 'u' : RATE_UNITS.find((u) => u.key === rate?.unit)?.short || 'h');

// Hours an entry represents (for retainers, prepaid blocks, statistics).
export function hoursOf(t, billing) {
  if (t.kind === 'commission' || t.kind === 'variable') return 0;
  const rate = rateOf(billing, t.rateId);
  const q = qtyOf(t);
  if (rate.unit === 'h') return q;
  if (rate.unit === 'day') return q * num(billing.dayHours || 8);
  if (rate.unit === 'halfday') return q * num(billing.dayHours || 8) / 2;
  return 0;
}

// Billed quantity for hourly work: rounded up to the step, never under the minimum.
export function billedHours(h, billing) {
  let q = num(h);
  const step = num(billing.roundingMin);
  if (step > 0) q = Math.ceil((q * 60) / step - 1e-9) * step / 60;
  if (num(billing.minimumHours) > 0 && q > 0) q = Math.max(q, num(billing.minimumHours));
  return r2(q);
}

const monthOf = (d) => String(d || '').slice(0, 7);
const monthLabel = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const dmy = (d) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '');

// Prepaid block: purchased hours are consumed by work entries in date order.
// Returns { covered: Set(entryId), remaining } — covered entries are never billed.
export function blockAllocation(entries, purchases, billing) {
  let balance = (purchases || []).reduce((a, p) => a + num(p.hours), 0);
  const covered = new Set();
  for (const t of [...entries].filter((x) => x.kind !== 'commission' && x.kind !== 'variable').sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const h = hoursOf(t, billing);
    if (h > 0 && balance >= h - 1e-9) { covered.add(t.id); balance -= h; }
  }
  return { covered, remaining: r2(balance) };
}

// Everything not billed yet, as ready-to-review invoice lines with the
// references to mark once invoiced. Each item: { key, kind, description, qty,
// unit, unitPrice, vatRate, refs: { timeLogIds, expenseIds, milestoneIds, retainerMonths } }.
export function unbilledItems(e, today) {
  const b = billingOf(e);
  const entries = (e.timeLogs || []);
  const open = entries.filter((t) => !t.invoiceId);
  const items = [];
  const refs = (o) => ({ timeLogIds: [], expenseIds: [], milestoneIds: [], retainerMonths: [], ...o });

  if (b.fixed?.enabled) {
    for (const m of b.fixed.milestones || []) {
      if (m.invoiceId) continue;
      items.push({ key: `ms-${m.id}`, kind: 'milestone', description: `${m.label || 'Échéance'} (${num(m.pct)} % du forfait)`, qty: 1, unit: 'forfait', unitPrice: r2(num(b.fixed.amount) * num(m.pct) / 100), vatRate: null, due: m.due || '', refs: refs({ milestoneIds: [m.id] }) });
    }
  }

  const work = open.filter((t) => t.kind !== 'commission' && t.kind !== 'variable');
  if (!b.fixed?.enabled && work.length) {
    let billable = work;
    if (b.block?.enabled) {
      const { covered } = blockAllocation(entries, e.blockPurchases, b);
      billable = work.filter((t) => !covered.has(t.id));
    }
    if (b.retainer?.enabled) {
      const byPeriod = {};
      for (const t of billable) (byPeriod[periodStart(t.date, e.startDate, b.retainer.every)] ||= []).push(t);
      for (const [p, list] of Object.entries(byPeriod).sort()) {
        const hours = list.reduce((a, t) => a + hoursOf(t, b), 0);
        const extra = r2(Math.max(0, hours - num(b.retainer.includedHours)));
        const label = periodLabel(p, b.retainer.every);
        if (extra > 0 && num(b.retainer.overagePrice) > 0) {
          items.push({ key: `over-${p}`, kind: 'overage', description: `Heures au-delà de l’abonnement — ${label}`, qty: extra, unit: 'h', unitPrice: num(b.retainer.overagePrice), vatRate: null, refs: refs({ timeLogIds: list.map((t) => t.id) }) });
        } else {
          // Covered by the subscription: marked as done along with the period's fee.
          items.push({ key: `inc-${p}`, kind: 'included', description: `Travail inclus dans l’abonnement — ${label} (${r2(hours)} h)`, qty: 0, unit: 'h', unitPrice: 0, vatRate: null, hidden: true, refs: refs({ timeLogIds: list.map((t) => t.id) }) });
        }
      }
    } else {
      const byRate = {};
      for (const t of billable) (byRate[rateOf(b, t.rateId).id] ||= []).push(t);
      for (const [rid, list] of Object.entries(byRate)) {
        const rate = rateOf(b, rid);
        const dates = list.map((t) => t.date).sort();
        const qty = rate.unit === 'h' ? r2(list.reduce((a, t) => a + billedHours(qtyOf(t), b), 0)) : r2(list.reduce((a, t) => a + qtyOf(t), 0));
        const period = dates.length > 1 ? `du ${dmy(dates[0])} au ${dmy(dates[dates.length - 1])}` : `le ${dmy(dates[0])}`;
        items.push({ key: `rate-${rid}`, kind: 'work', description: `${rate.label} (${period})`, qty, unit: unitShort(rate), unitPrice: num(rate.price), vatRate: rate.vatRate ?? null, refs: refs({ timeLogIds: list.map((t) => t.id) }) });
      }
    }
  }

  if (b.retainer?.enabled) {
    const billed = new Set(e.retainerBilled || []);
    const every = Math.max(1, num(b.retainer.every) || 1);
    for (let p = monthOf(e.startDate || today); p <= monthOf(today); p = addMonths(p, every)) {
      if (billed.has(p)) continue;
      // 'end': billed once the period is over (its last month is behind us).
      if (b.retainer.timing === 'end' && addMonths(p, every - 1) >= monthOf(today)) continue;
      const incl = num(b.retainer.includedHours);
      items.push({ key: `ret-${p}`, kind: 'retainer', description: `Abonnement — ${periodLabel(p, every)}${incl ? ` (${incl} h incluses)` : ''}`, qty: 1, unit: PERIOD_UNIT[every] || 'période', unitPrice: num(b.retainer.amount), vatRate: null, refs: refs({ retainerMonths: [p] }) });
    }
  }

  for (const t of open.filter((x) => x.kind === 'commission')) {
    const c = commissionOf(t, b);
    items.push({ key: `com-${t.id}`, kind: 'commission', description: c.description, qty: 1, unit: 'forfait', unitPrice: c.amount, vatRate: null, refs: refs({ timeLogIds: [t.id] }) });
  }

  for (const t of open.filter((x) => x.kind === 'variable')) {
    items.push({ key: `var-${t.id}`, kind: 'variable', description: t.note || 'Prestation', qty: 1, unit: 'forfait', unitPrice: r2(t.amount), vatRate: null, refs: refs({ timeLogIds: [t.id] }) });
  }

  for (const x of (e.expenses || []).filter((y) => !y.invoiceId && y.rebill !== false)) {
    const markup = num(x.markupPct);
    items.push({ key: `exp-${x.id}`, kind: 'expense', description: `Frais : ${x.label}${markup ? ` (+${markup} %)` : ''}`, qty: 1, unit: 'forfait', unitPrice: r2(num(x.amount) * (1 + markup / 100)), vatRate: x.vatRate ?? null, refs: refs({ expenseIds: [x.id] }) });
  }
  return items;
}

export function addMonths(m, n) {
  const [y, mo] = m.split('-').map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

const PERIOD_UNIT = { 1: 'mois', 3: 'trimestre', 6: 'semestre', 12: 'an' };
export const RETAINER_FREQUENCIES = [
  { every: 1, label: 'Chaque mois' }, { every: 3, label: 'Chaque trimestre' },
  { every: 6, label: 'Chaque semestre' }, { every: 12, label: 'Chaque année' },
];

// First month of the subscription period containing `date` (periods start
// from the client's start month).
export function periodStart(date, startDate, every = 1) {
  const n = Math.max(1, num(every) || 1);
  const start = monthOf(startDate || date);
  const [sy, sm] = start.split('-').map(Number);
  const [y, mo] = monthOf(date).split('-').map(Number);
  const diff = (y * 12 + mo) - (sy * 12 + sm);
  return addMonths(start, Math.floor(diff / n) * n);
}

export function periodLabel(p, every = 1) {
  const n = Math.max(1, num(every) || 1);
  if (n === 1) return monthLabel(p);
  const [y, mo] = p.split('-').map(Number);
  if (n === 3 && (mo - 1) % 3 === 0) return `${(mo - 1) / 3 + 1}${mo === 1 ? 'er' : 'e'} trimestre ${y}`;
  if (n === 6 && (mo === 1 || mo === 7)) return `${mo === 1 ? '1er' : '2e'} semestre ${y}`;
  if (n === 12 && mo === 1) return `année ${y}`;
  const short = (x) => new Date(`${x}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  return `${short(p)} – ${short(addMonths(p, n - 1))}`;
}

// Commission of one entry: a percentage of an amount.
export function commissionOf(t, b) {
  const pct = num(t.pct ?? b.commission?.pct);
  const fr = (n) => r2(n).toLocaleString('fr-FR');
  return { base: num(t.base), amount: r2(num(t.base) * pct / 100), description: `Commission ${pct} % sur ${fr(t.base)}${t.note ? ` — ${t.note}` : ''}` };
}

export const itemsValue = (items) => r2(items.reduce((a, i) => a + num(i.qty) * num(i.unitPrice), 0));

// Merge the refs of chosen items (to mark them invoiced).
export function mergeRefs(items) {
  const out = { timeLogIds: [], expenseIds: [], milestoneIds: [], retainerMonths: [] };
  for (const i of items) for (const k of Object.keys(out)) out[k].push(...(i.refs?.[k] || []));
  return out;
}

// Effective hourly rate of a fixed-price project (price ÷ hours spent).
export function effectiveHourlyRate(e) {
  const b = billingOf(e);
  if (!b.fixed?.enabled) return null;
  const h = (e.timeLogs || []).reduce((a, t) => a + hoursOf(t, b), 0);
  return h > 0 ? r2(num(b.fixed.amount) / h) : null;
}
