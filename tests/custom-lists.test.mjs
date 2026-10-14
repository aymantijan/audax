import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addName, renameName, moveAmong, categoryChoices } from '../src/utils/custom-lists.js';

test('own categories: no blank, no duplicate, rename keeps the place', () => {
  let l = addName([], '  Famille ');
  assert.deepEqual(l, ['Famille']);
  assert.equal(addName(l, 'famille'), l, 'same name, any case');
  assert.equal(addName(l, '   '), l);
  l = addName(l, 'Jardin');
  assert.deepEqual(renameName(l, 'famille', 'Proches'), ['Proches', 'Jardin']);
  assert.equal(renameName(l, 'Famille', 'jardin'), l, 'no rename onto another existing name');
});

test('moving a habit skips the hidden (archived) ones', () => {
  const items = [{ id: 'a' }, { id: 'x', archived: true }, { id: 'b' }, { id: 'c' }];
  const visible = (h) => !h.archived;
  assert.deepEqual(moveAmong(items, 'b', -1, visible).map((h) => h.id), ['b', 'x', 'a', 'c']);
  assert.deepEqual(moveAmong(items, 'a', -1, visible), items, 'already first');
  assert.deepEqual(moveAmong(items, 'c', 1, visible), items, 'already last');
});

test('category choices: hidden built-ins out, own ones in, current kept', () => {
  assert.deepEqual(categoryChoices(['health', 'finance'], ['Famille'], ['finance'], 'trading'), ['health', 'Famille', 'trading']);
  assert.deepEqual(categoryChoices(['health'], [], [], 'health'), ['health']);
});
