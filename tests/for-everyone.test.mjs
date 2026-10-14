import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENRES, GENRE_FR } from '../src/utils/reading-genres.js';
import { GRADING_PRESETS } from '../src/utils/academic.js';
import { SITUATIONS, AIMS } from '../src/utils/onboarding-plan.js';

test('every book genre has a French name (chantier 6)', () => {
  for (const g of GENRES) assert.ok(GENRE_FR[g], g);
});

test('grading systems beyond Morocco and France, each one coherent', () => {
  for (const k of ['be', 'ch', 'na', 'uk']) assert.ok(GRADING_PRESETS.some((p) => p.key === k), k);
  for (const p of GRADING_PRESETS) assert.ok(p.settings.passMark > 0 && p.settings.passMark < p.settings.scale, p.key);
  assert.equal(new Set(GRADING_PRESETS.map((p) => p.key)).size, GRADING_PRESETS.length);
});

test('situations and aims for older people and carers', () => {
  for (const k of ['retired', 'carer', 'training']) assert.ok(SITUATIONS.some((s) => s.key === k), k);
  for (const k of ['meds', 'fit60', 'people']) assert.ok(AIMS.some((a) => a.key === k), k);
});
