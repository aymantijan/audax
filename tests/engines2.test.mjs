// F5 · second batch: trading stats, flashcard spacing, currencies, recurring due dates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tradeStats, equityCurve, maxDrawdown, computeTradeDerived } from '../src/utils/calculations.js';
import { schedule, newCardState, isDue, retrievability } from '../src/utils/fsrs.js';
import { toBase, fromBase, rateFor } from '../src/utils/currency.js';
import { echeanceOccurrences } from '../src/utils/accounting-engine.js';

const trades = [
  { date: '2026-09-01', pnl: 300, pnlPips: 30 },
  { date: '2026-09-02', pnl: -100, pnlPips: -10 },
  { date: '2026-09-03', pnl: -200, pnlPips: -20 },
  { date: '2026-09-04', pnl: 500, pnlPips: 50 },
];

test('trading: win rate, averages, profit factor, expectancy', () => {
  const s = tradeStats(trades);
  assert.equal(s.count, 4); assert.equal(s.wins, 2); assert.equal(s.losses, 2);
  assert.equal(s.winRate, 50);
  assert.equal(s.avgWin, 400); assert.equal(s.avgLoss, -150);
  assert.equal(s.totalPnl, 500);
  assert.equal(Math.round(s.profitFactor * 100) / 100, 2.67); // 800 / 300
  assert.equal(s.expectancyPips, 12.5); assert.equal(s.expectancyUsd, 125);
  assert.equal(tradeStats([{ date: '2026-09-01', pnl: 50 }]).profitFactor, Infinity);
  assert.equal(tradeStats([]).winRate, 0);
});

test('trading: equity curve sorted by date and max drawdown from the peak', () => {
  const curve = equityCurve([...trades].reverse(), 10000);
  assert.deepEqual(curve.map((p) => p.value), [10000, 10300, 10200, 10000, 10500]);
  assert.equal(Math.round(maxDrawdown(curve) * 100) / 100, 2.91); // 300 / 10300
});

test('trading: a long and a short trade have opposite P&L signs for the same move', () => {
  const up = { instrument: 'EURUSD', entryPrice: 1.1, exitPrice: 1.101, positionSize: 1 };
  const long = computeTradeDerived({ ...up, direction: 'long' });
  const short = computeTradeDerived({ ...up, direction: 'short' });
  assert.ok(long.pnl > 0 && short.pnl < 0);
  assert.equal(long.pnl, -short.pnl);
  assert.deepEqual(computeTradeDerived({ ...up, entryPrice: '' }), { pnlPips: 0, pnl: 0 });
});

test('flashcards (FSRS): new card learning steps, then growing intervals', () => {
  const now = Date.UTC(2026, 8, 28, 8);
  const MIN = 60000; const DAY = 86400000;
  const again = schedule(newCardState(), 1, now);
  assert.equal(again.state, 'learning'); assert.equal(again.due, now + MIN);
  const good = schedule(newCardState(), 3, now);
  assert.equal(good.due, now + 10 * MIN);
  const easy = schedule(newCardState(), 4, now);
  assert.equal(easy.state, 'review'); assert.ok(easy.due - now >= DAY);
  // Review "good" at the due date: next interval longer than the previous one.
  const second = schedule(easy, 3, easy.due);
  assert.ok(second.due - easy.due > easy.due - now);
  // A lapse sends the card back to relearning.
  const lapse = schedule(second, 1, second.due);
  assert.equal(lapse.state, 'relearning'); assert.equal(lapse.lapses, 1);
  assert.equal(isDue(second, second.due), true);
  assert.equal(isDue(newCardState(), now), false); // new cards are introduced, not "due"
  assert.ok(Math.abs(retrievability(0, 10) - 1) < 1e-9);
});

test('currencies: conversion to and from the base currency', () => {
  assert.equal(rateFor('MAD', 'MAD'), 1);
  assert.equal(toBase(100, 'EUR', 'MAD'), 1090);
  assert.equal(toBase(100, 'EUR', 'MAD', { EUR: 11 }), 1100); // user rate wins
  assert.equal(Math.round(fromBase(1090, 'EUR', 'MAD') * 100) / 100, 100);
});

test('due dates: monthly recurrence in range, paid months skipped, end date respected', () => {
  const rent = { active: true, recurrence: 'monthly', dueDate: '2026-01-05', paidDates: ['2026-09-05'], endDate: '2026-11-30' };
  assert.deepEqual(echeanceOccurrences(rent, '2026-08-01', '2026-12-31'), ['2026-08-05', '2026-10-05', '2026-11-05']);
  assert.deepEqual(echeanceOccurrences({ active: true, recurrence: 'once', dueDate: '2026-10-01' }, '2026-09-01', '2026-10-31'), ['2026-10-01']);
  assert.deepEqual(echeanceOccurrences({ active: false, recurrence: 'monthly', dueDate: '2026-01-05' }, '2026-01-01', '2026-12-31'), []);
  const weekly = echeanceOccurrences({ active: true, recurrence: 'weekly', weekday: 'mon', dueDate: '2026-09-01' }, '2026-09-01', '2026-09-30');
  assert.deepEqual(weekly, ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
});
