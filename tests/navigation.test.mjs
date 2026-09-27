import test from 'node:test';
import assert from 'node:assert/strict';
import { poleOfPath, moduleOfPath, isModuleEnabled, withModule, POLES, MODULES } from '../src/utils/navigation.js';
import { searchIndex } from '../src/utils/global-search.js';

test('every URL lands in the right section', () => {
  assert.equal(poleOfPath('/today').key, 'today');
  assert.equal(poleOfPath('/goals').key, 'today');
  assert.equal(poleOfPath('/learning/course/abc').key, 'etudes');
  assert.equal(poleOfPath('/learning/readings/library').key, 'etudes');
  assert.equal(poleOfPath('/trading/account/1').key, 'patrimoine');
  assert.equal(poleOfPath('/deals/9').key, 'patrimoine');
  assert.equal(poleOfPath('/businesses/x').key, 'carriere');
  assert.equal(poleOfPath('/patrimoine').key, 'patrimoine');
  assert.equal(poleOfPath('/health').key, 'sante');
  assert.equal(poleOfPath('/settings'), null);
});

test('the longest route wins for the current page', () => {
  assert.equal(moduleOfPath('/learning/readings'), 'readings');
  assert.equal(moduleOfPath('/learning'), 'learning');
  assert.equal(moduleOfPath('/learning/course/1'), 'learning');
});

test('module switches: defaults, grouped flags, toggling', () => {
  assert.equal(isModuleEnabled({}, 'trading'), true); // older accounts: on
  assert.equal(isModuleEnabled({}, 'freelance'), false);
  assert.equal(isModuleEnabled({ enabledModules: { networking: true } }, 'career'), true);
  const em = withModule({ enabledModules: { trading: true } }, 'career', true);
  assert.deepEqual(em, { trading: true, career: true, networking: true, content: true });
  assert.equal(isModuleEnabled({}, 'health'), true); // no flag: always on
});

test('every section module exists', () => {
  for (const p of POLES) for (const k of p.modules) assert.ok(MODULES[k], k);
});

test('search ignores accents and puts pages and actions first', () => {
  const index = [
    { id: '1', label: 'Dépenses de septembre', domain: 'Finance' },
    { id: '2', label: 'Noter une dépense ou un revenu', domain: 'Action', kind: 'action' },
  ];
  const res = searchIndex(index, 'depense');
  assert.equal(res.length, 2);
  assert.equal(res[0].id, '2');
  assert.equal(searchIndex(index, '').length, 1); // empty query: quick actions
});
