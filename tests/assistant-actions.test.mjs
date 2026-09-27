import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAnswer, normalizeAction, normalizeActions, ACTIONS_START, ACTIONS_END } from '../src/utils/assistant-actions.js';

const ctx = {
  today: '2026-09-27',
  habits: [{ id: 'h1', name: 'Lecture' }],
  courses: [{ id: 'c1', name: 'IFRS' }, { id: 'c2', name: 'Contrôle de gestion' }],
  clients: [{ id: 'e1', name: 'Atlas Distribution' }],
  accounts: [{ code: '621', name: 'Alimentation & courses', cls: 6 }, { code: '721', name: 'Revenus freelance', cls: 7 }],
};

test('the action block never shows in the text, even half-streamed', () => {
  const full = `Voici ton plan.\n${ACTIONS_START}\n[{"type":"objective","title":"Finir le chapitre 3"}]\n${ACTIONS_END}`;
  assert.deepEqual(splitAnswer(full), { text: 'Voici ton plan.', actions: [{ type: 'objective', title: 'Finir le chapitre 3' }] });
  assert.equal(splitAnswer('Voici ton plan.\n<<<ACT').text, 'Voici ton plan.');
  assert.equal(splitAnswer(`Voici.\n${ACTIONS_START}\n[{"type":`).text, 'Voici.');
  assert.equal(splitAnswer(`Voici.\n${ACTIONS_START}\n[{"type":`).pending, true);
  assert.deepEqual(splitAnswer(`Ok.\n${ACTIONS_START}\npas du json\n${ACTIONS_END}`).actions, []);
  assert.equal(splitAnswer('Réponse simple, 3 < 4.').text, 'Réponse simple, 3 < 4.');
});

test('actions are checked against the person’s own data', () => {
  assert.deepEqual(normalizeAction({ type: 'study', course: 'ifrs', date: '2026-09-29', minutes: 45, focus: 'Exercices' }, ctx),
    { type: 'study', courseId: 'c1', course: 'IFRS', date: '2026-09-29', minutes: 45, focus: 'Exercices' });
  assert.equal(normalizeAction({ type: 'study', course: 'Physique', date: '2026-09-29', minutes: 45 }, ctx), null, 'unknown subject');
  assert.equal(normalizeAction({ type: 'study', course: 'IFRS', date: '2026-09-01', minutes: 45 }, ctx).date, '2026-09-27', 'never in the past');
  assert.equal(normalizeAction({ type: 'budget', category: 'alimentation & courses', amount: '1500', period: 'monthly' }, ctx).account, '621');
  assert.equal(normalizeAction({ type: 'budget', category: 'Revenus freelance', amount: 100 }, ctx), null, 'a budget is on an expense category');
  assert.equal(normalizeAction({ type: 'invoice', client: 'atlas' }, ctx).clientId, 'e1');
  assert.equal(normalizeAction({ type: 'habit_mini', habit: 'Sport' }, ctx), null);
  assert.equal(normalizeAction({ type: 'delete_all' }, ctx), null);
  assert.equal(normalizeAction({ type: 'capture', draft: { kind: 'expense', amount: 50, label: 'Taxi' } }, ctx).draft.amount, 50);
  const f = normalizeAction({ type: 'flashcards', course: 'IFRS', cards: [{ front: 'IAS 16 ?', back: 'Immobilisations corporelles' }, { front: '', back: 'x' }] }, ctx);
  assert.equal(f.cards.length, 1);
});

test('at most 6 actions, invalid ones dropped', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ type: 'objective', title: `Objectif ${i}` }));
  assert.equal(normalizeActions([{ type: 'nope' }, ...many], ctx).length, 6);
});
