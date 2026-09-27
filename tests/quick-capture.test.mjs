import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCapture, normalizeDraft, describeDraft } from '../src/utils/quick-capture.js';

const ctx = {
  today: '2026-09-27',
  habits: [{ id: 'h1', name: 'Méditation' }, { id: 'h2', name: 'Pages lues', kind: 'quantity', target: 20 }],
  courses: [{ id: 'c1', name: 'IFRS' }, { id: 'c2', name: 'Contrôle de gestion' }],
  clients: [{ id: 'e1', name: 'Atlas Distribution' }],
  weightUnit: 'kg',
};
const p = (s) => parseCapture(s, ctx);

test('money: expenses and income, amounts, currencies, dates', () => {
  assert.deepEqual(p('payé 120 courses'), { kind: 'expense', amount: 120, currency: null, label: 'Courses', date: '2026-09-27' });
  assert.deepEqual(p('45,50 € restaurant hier'), { kind: 'expense', amount: 45.5, currency: 'EUR', label: 'Restaurant', date: '2026-09-26' });
  assert.equal(p('reçu 3 000 dh salaire').kind, 'income');
  assert.equal(p('reçu 3 000 dh salaire').amount, 3000);
  assert.equal(p('reçu 3 000 dh salaire').currency, 'MAD');
  assert.equal(p('taxi 2k').amount, 2000);
  assert.equal(p('café 15 le 20/09').date, '2026-09-20');
  assert.equal(p('bonjour'), null);
  assert.equal(p('120'), null, 'an amount alone says nothing about what it is');
});

test('sport: run with distance and time, gym, sport alone', () => {
  assert.deepEqual(p('couru 5 km en 28 min'), { kind: 'workout', type: 'cardio', exercise: 'Course à pied', durationMin: 28, distanceKm: 5, date: '2026-09-27' });
  const g = p('muscu 1h15');
  assert.deepEqual([g.type, g.durationMin], ['strength', 75]);
  assert.equal(p('padel 1 h avant-hier').date, '2026-09-25');
  assert.equal(p('courses 80').kind, 'expense', 'groceries are not a run');
});

test('health: weight (kg, lb), sleep, water', () => {
  assert.deepEqual(p('poids 72,4'), { kind: 'weight', weightKg: 72.4, date: '2026-09-27' });
  assert.equal(p('je pèse 160 lb').weightKg, 72.6);
  assert.equal(parseCapture('poids 160', { ...ctx, weightUnit: 'lb' }).weightKg, 72.6);
  assert.equal(p('dormi 7h30').hours, 7.5);
  assert.equal(p('bu 1,5 l d’eau').ml, 1500);
  assert.equal(p('2 verres d’eau').ml, 500);
});

test('study, habits and a client payment use the person’s own names', () => {
  assert.deepEqual(p('révisé IFRS 45 min'), { kind: 'study', minutes: 45, courseId: 'c1', course: 'IFRS', label: '', date: '2026-09-27' });
  assert.equal(p('travaillé 2 h sur le mémoire').courseId, null);
  assert.deepEqual(p('méditation faite'), { kind: 'habit', habitId: 'h1', habit: 'Méditation', value: null, date: '2026-09-27' });
  assert.equal(p('pages lues 35').value, 35);
  assert.deepEqual(p('reçu 7340 atlas distribution ventes de septembre'), { kind: 'freelance', clientId: 'e1', client: 'Atlas Distribution', amount: 7340, label: 'Ventes de septembre', date: '2026-09-27' });
});

test('drafts from the AI are checked like the others', () => {
  assert.equal(normalizeDraft({ kind: 'delete_everything' }, ctx), null);
  assert.equal(normalizeDraft({ kind: 'expense', amount: -5, label: 'x' }, ctx), null);
  assert.equal(normalizeDraft({ kind: 'habit', habit: 'Inconnue' }, ctx), null);
  assert.equal(normalizeDraft({ kind: 'weight', weightKg: 900 }, ctx), null);
  assert.equal(normalizeDraft({ kind: 'expense', amount: '12,5', label: 'Pain', date: '2030-01-01' }, ctx).date, '2026-09-27', 'no future dates');
  assert.equal(normalizeDraft({ kind: 'study', minutes: 30, course: 'controle de gestion' }, ctx).courseId, 'c2');
  assert.equal(normalizeDraft({ kind: 'freelance', client: 'atlas', amount: 100 }, ctx).clientId, 'e1');
});

test('one readable line per draft', () => {
  assert.equal(describeDraft(p('couru 5 km en 28 min')), 'Course à pied · 5 km · 28 min');
  assert.equal(describeDraft(p('dormi 6h45')), '6 h 45');
  assert.equal(describeDraft(p('bu 1,5 l d’eau')), '1,5 L');
});
