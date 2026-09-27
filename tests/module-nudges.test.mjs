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

test('a trading habit with Trading switched off suggests switching it on', () => {
  const n = moduleNudges({ user: { createdAt: now, enabledModules: { trading: false } }, habitNames: ['Journal de trading quotidien'], now });
  assert.equal(n[0].action.type, 'enable');
  assert.equal(n[0].action.module, 'trading');
});

test('unused modules are offered for hiding only after three weeks', () => {
  const user = { createdAt: now - 10 * DAY, enabledModules: { freelance: true } };
  assert.equal(moduleNudges({ user, now }).some((x) => x.id === 'hide-freelance'), false);
  const older = { ...user, createdAt: now - 30 * DAY };
  assert.equal(moduleNudges({ user: older, now }).some((x) => x.id === 'hide-freelance'), true);
  assert.equal(moduleNudges({ user: older, counts: { engagements: 1 }, now }).some((x) => x.id === 'hide-freelance'), false);
});

test('a dismissed suggestion never comes back', () => {
  const user = { createdAt: now, dismissedNudges: ['try-finance'] };
  assert.equal(moduleNudges({ user, habitNames: ['Suivre mon budget'], now }).length, 0);
});
