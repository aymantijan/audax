import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frequentEntries } from '../src/utils/quick-entries.js';

const e = (date, label, cat, amount, cash = '511') => ({ date, label, lines: [{ account: cat, debit: amount, credit: 0 }, { account: cash, debit: 0, credit: amount }] });

test('the operations noted at least twice, most frequent first, with the last amount', () => {
  const journal = [
    e('2026-10-01', 'Café', '621', 12), e('2026-10-03', 'café', '621', 15), e('2026-10-05', 'Café', '621', 15),
    e('2026-10-02', 'Taxi', '613', 30, '571'), e('2026-10-06', 'Taxi', '613', 25, '571'),
    e('2026-10-04', 'Cinéma', '651', 60),
  ];
  const f = frequentEntries(journal, 'expense');
  assert.deepEqual(f.map((x) => [x.label, x.amount, x.count]), [['Café', 15, 3], ['Taxi', 25, 2]]);
  assert.equal(f[1].cash, '571');
  assert.deepEqual(frequentEntries(journal, 'income'), []);
});

test('usual foods: logged twice or more, last quantity kept', async () => {
  const { frequentFoods } = await import('../src/utils/quick-entries.js');
  const logs = [
    { name: 'Eggs', amount: 2, unit: 'œuf', date: '2026-10-01', time: '08:00' },
    { name: 'eggs', amount: 3, unit: 'œuf', date: '2026-10-02', time: '08:00' },
    { name: 'Riz', amount: 150, unit: 'g', date: '2026-10-01' },
  ];
  assert.deepEqual(frequentFoods(logs), [{ name: 'eggs', amount: 3, unit: 'œuf', count: 2 }]);
});
