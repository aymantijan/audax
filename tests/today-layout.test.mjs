import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeCards, moveCard, toggleCard } from '../src/utils/today-layout.js';

const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const ids = cards.map((c) => c.id);

test('default order when nothing is saved', () => {
  assert.deepEqual(arrangeCards(cards, null).map((c) => c.id), ['a', 'b', 'c', 'd']);
});

test('saved order first, new cards keep their default place after', () => {
  assert.deepEqual(arrangeCards(cards, { order: ['c', 'a'] }).map((c) => c.id), ['c', 'a', 'b', 'd']);
});

test('move up/down and hide', () => {
  let layout = moveCard(ids, {}, 'c', -1);
  assert.deepEqual(layout.order, ['a', 'c', 'b', 'd']);
  layout = moveCard(ids, layout, 'a', -1); // already first: unchanged
  assert.deepEqual(layout.order, ['a', 'c', 'b', 'd']);
  layout = toggleCard(layout, 'b');
  assert.deepEqual(arrangeCards(cards, layout).map((c) => c.id), ['a', 'c', 'd']);
  assert.deepEqual(toggleCard(layout, 'b').hidden, []);
});
