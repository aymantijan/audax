import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleNudges } from '../src/utils/module-nudges.js';

const DAY = 86400000;
const now = Date.UTC(2026, 8, 27);

test('a money habit suggests Finances while the ledger is empty', () => {
  const n = moduleNudges({ user: { createdAt: now }, habitNames: ['Noter ses dépenses du jour'], counts: { journal: 0 }, now });
  assert.equal(n[0].id, 'try-finance');
  assert.equal(n[0].action.type, 'open');
  assert.equal(moduleNudges({ user: { createdAt: now }, habitNames: ['Noter ses dépenses du jour'], counts: { journal: 3 }, now }).length, 0);
});

test('a focus habit with the Minuteur switched off suggests switching it on', () => {
  const n = moduleNudges({ user: { createdAt: now, enabledModules: { focus: false } }, habitNames: ['Deep work 2 h'], now });
  assert.equal(n[0].action.type, 'enable');
  assert.equal(n[0].action.module, 'focus');
});

test('removed modules are never suggested', () => {
  const user = { createdAt: now - 30 * DAY, enabledModules: { trading: true, freelance: true } };
  const n = moduleNudges({ user, habitNames: ['Journal de trading quotidien', 'Relancer un client'], now });
  assert.equal(n.some((x) => /trading|freelance|career/.test(x.id)), false);
});

test('unused modules are offered for hiding only after three weeks', () => {
  const user = { createdAt: now - 10 * DAY, enabledModules: { creative: true } };
  assert.equal(moduleNudges({ user, now }).some((x) => x.id === 'hide-creative'), false);
  const older = { ...user, createdAt: now - 30 * DAY };
  assert.equal(moduleNudges({ user: older, now }).some((x) => x.id === 'hide-creative'), true);
  assert.equal(moduleNudges({ user: older, counts: { works: 1 }, now }).some((x) => x.id === 'hide-creative'), false);
});

test('a dismissed suggestion never comes back', () => {
  const user = { createdAt: now, dismissedNudges: ['try-finance'] };
  assert.equal(moduleNudges({ user, habitNames: ['Suivre mon budget'], now }).length, 0);
});
