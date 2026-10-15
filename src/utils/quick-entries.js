// « Tes habituelles » (chantier 9): the operations you note again and again
// (café, taxi, courses…), offered as one-tap chips in the quick entry.
// Pure: tests/quick-entries.test.mjs.
import { classOf } from './chart-of-accounts.js';
import { normalizeLabel } from './label-analysis.js';

// → [{ label, amount, category, cash, count }], most frequent first (seen at
// least twice), the amount being the last one used.
export function frequentEntries(journal = [], kind = 'expense', n = 6) {
  const cls = kind === 'income' ? 7 : 6;
  const groups = new Map();
  for (const e of journal) {
    if (!e.lines || e.lines.length !== 2) continue;
    const cat = e.lines.find((l) => classOf(l.account) === cls);
    const cash = e.lines.find((l) => classOf(l.account) === 5);
    if (!cat || !cash) continue;
    const key = `${normalizeLabel(e.label)}|${cat.account}`;
    const amount = (cat.debit || cat.credit) || 0;
    const g = groups.get(key) || { label: e.label, category: cat.account, cash: cash.account, count: 0, last: '', amount };
    g.count += 1;
    if ((e.date || '') >= g.last) Object.assign(g, { last: e.date || '', amount, label: e.label, cash: cash.account });
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, n)
    .map(({ label, amount, category, cash, count }) => ({ label, amount, category, cash, count }));
}

// « Aliments habituels » (chantier 9): foods logged at least twice, with the
// quantity used last, for one-tap logging. Logs: healthStore.nutritionLogs.
export function frequentFoods(logs = [], n = 8) {
  const groups = new Map();
  for (const l of logs) {
    const key = String(l.name || '').trim().toLowerCase();
    if (!key) continue;
    const g = groups.get(key) || { name: l.name, amount: l.amount, unit: l.unit || 'g', count: 0, last: '' };
    g.count += 1;
    const at = `${l.date || ''} ${l.time || ''}`;
    if (at >= g.last) Object.assign(g, { last: at, amount: l.amount ?? l.grams, unit: l.unit || 'g', name: l.name });
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, n)
    .map(({ name, amount, unit, count }) => ({ name, amount, unit, count }));
}
