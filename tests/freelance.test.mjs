import test from 'node:test';
import assert from 'node:assert/strict';
import { overdueInvoices, monthlyRevenue, reminderMessage } from '../src/utils/invoice.js';

const inv = (id, dueDate, status = 'sent') => ({ id, number: `FAC-${id}`, dueDate, status, currency: 'EUR', lines: [{ qty: 2, unitPrice: 50 }], vatRate: 20 });

test('late invoices, most late first; paid ones never', () => {
  const late = overdueInvoices([inv('a', '2026-09-20'), inv('b', '2026-09-01'), inv('c', '2026-09-01', 'paid'), inv('d', '2026-10-01')], '2026-09-27');
  assert.deepEqual(late.map((x) => [x.inv.id, x.daysLate]), [['b', 26], ['a', 7]]);
});

test('revenue per month over the window, converted to the base currency', () => {
  const eng = [{ currency: 'USD', payments: [{ date: '2026-09-02', amount: 100 }, { date: '2025-01-10', amount: 999 }] }, { currency: 'EUR', payments: [{ date: '2026-08-15', amount: 40 }] }];
  const rows = monthlyRevenue(eng, '2026-09-27', 3, (a, c) => (c === 'USD' ? a * 0.9 : a));
  assert.deepEqual(rows, [{ month: '2026-07', amount: 0 }, { month: '2026-08', amount: 40 }, { month: '2026-09', amount: 90 }]);
});

test('the reminder gets firmer after the first one and carries the total', () => {
  const first = reminderMessage(inv('a', '2026-09-20'), {}, { issuerName: 'Sam', bankDetails: 'IBAN X' }, { daysLate: 7, count: 0 });
  assert.match(first, /FAC-a de 120,00 EUR/);
  assert.match(first, /simple oubli/);
  assert.match(first, /IBAN X/);
  assert.match(reminderMessage(inv('a', '2026-09-20'), {}, {}, { daysLate: 20, count: 1 }), /20 jours de retard/);
});
