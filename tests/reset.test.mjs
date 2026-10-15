import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_STORES } from '../src/store/registry.js';

// « Effacer mes données » (chantier 2) calls resetAll on every section: it must
// empty every list a section holds, including ones added later (chantier 7
// forgot the health care lists at first).
test('resetAll empties every list of every section', () => {
  for (const { name, store } of DATA_STORES) {
    if (name === 'auth' || !store.getState().resetAll) continue;
    const initial = store.getInitialState();
    const lists = Object.keys(initial).filter((k) => Array.isArray(initial[k]));
    store.setState(Object.fromEntries(lists.map((k) => [k, [{ id: 'x', marker: true }]])));
    store.getState().resetAll();
    const left = lists.filter((k) => (store.getState()[k] || []).some((r) => r?.marker));
    assert.deepEqual(left, [], `${name}: ${left.join(', ')}`);
  }
});
