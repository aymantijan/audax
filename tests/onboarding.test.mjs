import test from 'node:test';
import assert from 'node:assert/strict';
import { AIMS, SITUATIONS, COUNTRIES, buildOnboardingPlan, guessCountry } from '../src/utils/onboarding-plan.js';
import { HABIT_TEMPLATES } from '../src/utils/habit-templates.js';
import { CURRENCIES } from '../src/utils/currency.js';

const names = new Set(HABIT_TEMPLATES.flatMap((g) => g.items.map((i) => i.name)));

test('every proposed habit exists in the catalogue', () => {
  for (const a of AIMS) for (const h of a.habits || []) assert.ok(names.has(h), h);
  for (const h of buildOnboardingPlan({}).habits) assert.ok(names.has(h), h);
});

test('every country currency is supported', () => {
  const codes = new Set(CURRENCIES.map((c) => c.code));
  for (const c of COUNTRIES) assert.ok(codes.has(c.currency), c.key);
});

test('the dirham is only proposed in Morocco', () => {
  assert.equal(guessCountry('Africa/Casablanca'), 'MA');
  assert.equal(guessCountry('Europe/Paris'), 'FR');
  assert.equal(guessCountry('Asia/Tokyo'), 'OTHER');
  assert.deepEqual(COUNTRIES.filter((c) => c.currency === 'MAD').map((c) => c.key), ['MA']);
});

test('answers switch on the matching modules only', () => {
  const p = buildOnboardingPlan({ aims: ['job', 'trading'], situation: 'freelancer' });
  assert.equal(p.modules.career, true);
  assert.equal(p.modules.networking, true);
  assert.equal(p.modules.trading, true);
  assert.equal(p.modules.freelance, true);
  assert.equal(p.modules.pe, false);
  assert.equal(p.modules.engineering, false);
  assert.ok(p.goals.includes('job'));
});

test('nobody starts empty, and nobody gets more than 6 habits or 3 goals', () => {
  assert.equal(buildOnboardingPlan({}).habits.length, 2);
  const all = buildOnboardingPlan({ aims: AIMS.map((a) => a.key), situation: SITUATIONS[0].key });
  assert.ok(all.habits.length <= 6);
  assert.ok(all.goals.length <= 3);
});
