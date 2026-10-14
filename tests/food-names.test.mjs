import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frenchToFood } from '../src/utils/food-names.js';
import { lookupFood, estimateMacros } from '../src/utils/nutrition-db.js';

test('French food names find the right food (chantier 6)', () => {
  assert.equal(frenchToFood('Riz'), 'White rice (cooked)');
  assert.equal(frenchToFood('riz complet'), 'Brown rice (cooked)');
  assert.equal(frenchToFood('blanc de poulet grillé'), 'Chicken breast');
  assert.equal(frenchToFood('2 œufs'), 'Eggs');
  assert.equal(frenchToFood('pain complet'), 'Whole wheat bread');
  assert.equal(frenchToFood('pommes'), 'Apple', 'plural');
  assert.equal(frenchToFood('xyz'), null);
  assert.equal(lookupFood('Riz').name, 'White rice (cooked)');
  assert.ok(estimateMacros('lentilles', 100, 'g').kcal > 0);
  assert.equal(lookupFood('Chicken breast').name, 'Chicken breast', 'English names still work');
});

test('every French name points to a food that exists', async () => {
  const { FOOD_NAMES_FR } = await import('../src/utils/food-names.js');
  const { FOOD_DB } = await import('../src/utils/nutrition-db.js');
  const names = new Set(FOOD_DB.map((f) => f.name));
  const missing = [...new Set(FOOD_NAMES_FR.map(([, en]) => en))].filter((en) => !names.has(en));
  assert.deepEqual(missing, []);
});
