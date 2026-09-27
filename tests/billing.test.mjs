import test from 'node:test';
import assert from 'node:assert/strict';
import { billingOf, unbilledItems, billedHours, blockAllocation, periodStart, periodLabel, commissionOf, itemsValue, mergeRefs, effectiveHourlyRate } from '../src/utils/billing.js';
import { invoiceTotals } from '../src/utils/invoice.js';

const base = { id: 'e', startDate: '2026-07-01', timeLogs: [], expenses: [] };
const byKind = (items, kind) => items.filter((i) => i.kind === kind);

test('an old client with one hourly rate keeps working as before', () => {
  const e = { ...base, hourlyRate: 50, timeLogs: [{ id: 't1', date: '2026-09-02', hours: 2 }, { id: 't2', date: '2026-09-05', hours: 1.5 }] };
  const [line] = unbilledItems(e, '2026-09-27');
  assert.equal(line.qty, 3.5);
  assert.equal(line.unitPrice, 50);
  assert.deepEqual(line.refs.timeLogIds, ['t1', 't2']);
});

test('several rates, rounding to the quarter hour and a minimum', () => {
  const b = { ...billingOf({}), rates: [{ id: 'c', label: 'Conseil', price: 80, unit: 'h' }, { id: 'f', label: 'Formation', price: 900, unit: 'day' }], roundingMin: 15, minimumHours: 1 };
  assert.equal(billedHours(0.3, b), 1); // minimum 1 h
  assert.equal(billedHours(1.1, b), 1.25); // rounded up to the quarter
  const e = { ...base, billing: b, timeLogs: [{ id: 'a', date: '2026-09-01', qty: 1.1, rateId: 'c' }, { id: 'b', date: '2026-09-02', qty: 2, rateId: 'f' }] };
  const items = unbilledItems(e, '2026-09-27');
  assert.equal(items.find((i) => i.unitPrice === 80).qty, 1.25);
  assert.deepEqual(items.find((i) => i.unitPrice === 900), { ...items.find((i) => i.unitPrice === 900), qty: 2, unit: 'j' });
});

test('quarterly subscription billed at the END of each quarter (tax filings client)', () => {
  const b = { ...billingOf({}), retainer: { enabled: true, amount: 3000, every: 3, timing: 'end', includedHours: 0, overagePrice: 0 } };
  const e = { ...base, billing: b, startDate: '2026-01-10', retainerBilled: ['2026-01'] };
  const fees = byKind(unbilledItems(e, '2026-09-27'), 'retainer');
  // Q1 already billed, Q2 over → due, Q3 (jul–sep) not over yet on 27 Sept.
  assert.deepEqual(fees.map((f) => f.description), ['Abonnement — 2e trimestre 2026']);
  assert.equal(fees[0].unitPrice, 3000);
  assert.deepEqual(fees[0].refs.retainerMonths, ['2026-04']);
  assert.equal(byKind(unbilledItems(e, '2026-10-01'), 'retainer').length, 2); // Q3 now due too
});

test('monthly subscription billed in advance, with included hours and overage', () => {
  const b = { ...billingOf({ hourlyRate: 60 }), retainer: { enabled: true, amount: 1000, every: 1, timing: 'start', includedHours: 10, overagePrice: 70 } };
  const e = { ...base, billing: b, startDate: '2026-09-01', timeLogs: [{ id: 'x', date: '2026-09-03', qty: 8 }, { id: 'y', date: '2026-09-20', qty: 5 }] };
  const items = unbilledItems(e, '2026-09-27');
  assert.equal(byKind(items, 'retainer')[0].unitPrice, 1000);
  assert.equal(byKind(items, 'overage')[0].qty, 3);
  assert.equal(byKind(items, 'work').length, 0);
  assert.equal(periodStart('2026-11-15', '2026-01-10', 3), '2026-10');
  assert.equal(periodLabel('2026-10', 3), '4e trimestre 2026');
});

test('sales agent: 50 % of the net profit, never negative', () => {
  const b = { ...billingOf({}), commission: { enabled: true, pct: 50 } };
  assert.equal(commissionOf({ revenue: 30000, costs: 18000 }, b).amount, 6000);
  assert.equal(commissionOf({ revenue: 1000, costs: 1500 }, b).amount, 0);
  const e = { ...base, billing: b, timeLogs: [{ id: 'c1', kind: 'commission', date: '2026-09-10', revenue: 30000, costs: 18000, note: 'Lot septembre' }] };
  const [line] = unbilledItems(e, '2026-09-27');
  assert.equal(line.unitPrice, 6000);
  assert.match(line.description, /ventes 30\s000 − coûts 18\s000 = 12\s000/);
});

test('fixed price with a payment schedule; time is tracked, not billed', () => {
  const b = { ...billingOf({ hourlyRate: 50 }), fixed: { enabled: true, amount: 10000, milestones: [{ id: 'm1', label: 'Acompte', pct: 30, invoiceId: 'inv1' }, { id: 'm2', label: 'Livraison', pct: 70 }] } };
  const e = { ...base, billing: b, timeLogs: [{ id: 't', date: '2026-09-01', qty: 40 }] };
  const items = unbilledItems(e, '2026-09-27');
  assert.deepEqual(items.map((i) => [i.kind, i.unitPrice]), [['milestone', 7000]]);
  assert.equal(effectiveHourlyRate(e), 250);
});

test('prepaid block: covered hours are never billed, the rest is', () => {
  const b = { ...billingOf({ hourlyRate: 60 }), block: { enabled: true, hours: 10, price: 500 } };
  const entries = [{ id: 'a', date: '2026-09-01', qty: 6 }, { id: 'b', date: '2026-09-02', qty: 3 }, { id: 'c', date: '2026-09-03', qty: 2 }];
  const alloc = blockAllocation(entries, [{ hours: 10 }], b);
  assert.deepEqual([...alloc.covered], ['a', 'b']);
  assert.equal(alloc.remaining, 1);
  const items = unbilledItems({ ...base, billing: b, timeLogs: entries, blockPurchases: [{ hours: 10 }] }, '2026-09-27');
  assert.deepEqual(items[0].refs.timeLogIds, ['c']);
});

test('expenses with markup; refs merged for marking', () => {
  const e = { ...base, expenses: [{ id: 'x1', label: 'Train', amount: 100, markupPct: 10 }, { id: 'x2', label: 'Perso', amount: 50, rebill: false }] };
  const items = unbilledItems(e, '2026-09-27');
  assert.equal(items.length, 1);
  assert.equal(items[0].unitPrice, 110);
  assert.equal(itemsValue(items), 110);
  assert.deepEqual(mergeRefs(items).expenseIds, ['x1']);
});

test('invoice totals: VAT per line, discount, withholding, deposit', () => {
  const t = invoiceTotals({
    vatRate: 20, discountPct: 10, withholdingPct: 30, deposit: 100,
    lines: [{ qty: 10, unitPrice: 100 }, { qty: 1, unitPrice: 200, vatRate: 0, discountPct: 50 }],
  });
  // lines: 1000 and 100 (after 50 %), then −10 % → 900 + 90 = 990 excl. tax
  assert.equal(t.subtotal, 990);
  assert.equal(t.vat, 180); // 20 % of 900 only
  assert.equal(t.total, 1170);
  assert.equal(t.withholding, 297); // 30 % of 990
  assert.equal(t.due, 1170 - 297 - 100);
  // an old invoice: due equals total
  const old = invoiceTotals({ vatRate: 20, lines: [{ qty: 2, unitPrice: 50 }] });
  assert.equal(old.due, old.total);
  assert.equal(old.total, 120);
});
