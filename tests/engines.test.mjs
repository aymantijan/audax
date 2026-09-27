// F5 · guards on the money, habits and prop-firm engines before any refactor (F3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, balanceSheet, cpc, treasuryBalance, accountBalances } from '../src/utils/accounting-engine.js';
import { isHabitDueOn, habitStreak, weeklyProgress, quitStreak, habitDayStatus } from '../src/utils/calculations.js';
import { computeRulesProgress, nextPhase } from '../src/utils/prop-firm-analytics.js';
import { computePositionSize } from '../src/utils/risk-management.js';

// ── Accounting (double entry) ──
const e = (date, label, lines) => ({ date, label, lines });
const journal = [
  e('2026-09-01', 'Apport', [{ account: '511', debit: 1000 }, { account: '111', credit: 1000 }]),
  e('2026-09-05', 'Loyer', [{ account: '611', debit: 200 }, { account: '511', credit: 200 }]),
  e('2026-09-20', 'Mission freelance', [{ account: '511', debit: 500 }, { account: '721', credit: 500 }]),
];

test('accounting: entries must be balanced double entries on known accounts', () => {
  assert.equal(validateEntry(journal[0]).ok, true);
  assert.equal(validateEntry(e('2026-09-01', 'Déséquilibrée', [{ account: '511', debit: 100 }, { account: '111', credit: 90 }])).ok, false);
  assert.equal(validateEntry(e('2026-09-01', 'Une ligne', [{ account: '511', debit: 100 }])).ok, false);
  assert.equal(validateEntry(e('2026-09-01', 'Compte inconnu', [{ account: '999', debit: 100 }, { account: '111', credit: 100 }])).ok, false);
  assert.equal(validateEntry(e('2026-09-01', 'Débit et crédit', [{ account: '511', debit: 100, credit: 100 }, { account: '111', credit: 100 }])).ok, false);
});

test('accounting: the balance sheet balances and the result flows from the income statement', () => {
  const bs = balanceSheet(journal);
  assert.equal(bs.equilibre, true);
  assert.equal(bs.actif.total, bs.passif.total);
  assert.equal(bs.actif.tresorerie, 1300);
  assert.equal(bs.passif.resultat, 300);
  assert.equal(cpc(journal).resultatNet, 300);
  assert.equal(treasuryBalance(journal), 1300);
  assert.equal(treasuryBalance(journal, '2026-09-10'), 800); // before the freelance income
  assert.deepEqual(accountBalances(journal)['511'], { debit: 1500, credit: 200, balance: 1300 });
});

// ── Habits ──
const day = (d) => `2026-09-${String(d).padStart(2, '0')}`; // 2026-09-28 is a Monday
const done = (habitId, days) => days.map((d) => ({ habitId, date: day(d), completed: true }));

test('habits: custom weekdays, streaks across off days, jokers protect the streak', () => {
  const mwf = { id: 'h', frequency: 'custom', weekdays: ['mon', 'wed', 'fri'] };
  assert.equal(isHabitDueOn(mwf, day(28)), true); // Monday
  assert.equal(isHabitDueOn(mwf, day(29)), false); // Tuesday
  // Done Mon 21, Wed 23, Fri 25 and Mon 28: 4 in a row, off days skipped.
  assert.equal(habitStreak('h', done('h', [21, 23, 25, 28]), day(28), mwf), 4);
  // Wed 23 missed → the streak restarts after it.
  assert.equal(habitStreak('h', done('h', [21, 25, 28]), day(28), mwf), 2);
  // …unless a joker covers it.
  const withJoker = [...done('h', [21, 25, 28]), { habitId: 'h', date: day(23), completed: false, joker: true }];
  assert.equal(habitStreak('h', withJoker, day(28), mwf), 3);
  assert.equal(habitDayStatus({ ...mwf, startDate: day(1) }, done('h', [21]), day(23), day(28)), 'missed');
});

test('habits: daily streak counts from yesterday while today is not done yet', () => {
  const daily = { id: 'd', frequency: 'daily' };
  assert.equal(habitStreak('d', done('d', [25, 26, 27]), day(28), daily), 3);
  assert.equal(habitStreak('d', done('d', [25, 26, 27, 28]), day(28), daily), 4);
});

test('habits: weekly quota and "days without" streak', () => {
  const weekly = { id: 'w', frequency: 'weekly', timesPerWeek: 3 };
  assert.deepEqual(weeklyProgress(weekly, done('w', [28, 29]), day(30)), { done: 2, target: 3, met: false });
  assert.equal(weeklyProgress(weekly, done('w', [28, 29, 30]), day(30)).met, true);
  assert.equal(weeklyProgress(weekly, done('w', [27]), day(30)).done, 0); // Sunday 27 belongs to the previous week
  assert.equal(quitStreak({ startDate: day(1), relapses: [day(20)] }, day(28)), 8);
});

// ── Prop firm rules ──
const trade = (date, pnl) => ({ date, pnl });
const phaseStart = new Date('2026-09-01T10:00:00').getTime();

test('prop firm: daily loss limit breached on the day it happens', () => {
  const p = computeRulesProgress({ maxDailyLossPct: 2 }, phaseStart, 10000, [trade('2026-09-01', 500), trade('2026-09-02', -300)], '2026-09-02');
  assert.equal(p.dailyLossPct, 3);
  assert.ok(p.breaches.some((b) => b.rule === 'dailyLoss' && b.level === 'danger'));
  assert.equal(p.readyToAdvance, false);
});

test('prop firm: trailing vs static drawdown', () => {
  const trades = [trade('2026-09-01', 1000), trade('2026-09-02', -1500)];
  assert.equal(computeRulesProgress({}, phaseStart, 10000, trades, '2026-09-03').maxDrawdownPct, 13.64); // 1500 / 11000 peak
  assert.equal(computeRulesProgress({ maxTotalDrawdownType: 'static' }, phaseStart, 10000, trades, '2026-09-03').maxDrawdownPct, 5); // 9500 vs 10000
});

test('prop firm: consistency rule, target reached, trades before the phase ignored', () => {
  const trades = [trade('2026-08-20', 5000), trade('2026-09-01', 900), trade('2026-09-02', 100)];
  const p = computeRulesProgress({ profitTargetPct: 8, minTradingDays: 2, consistencyRulePct: 40 }, phaseStart, 10000, trades, '2026-09-03');
  assert.equal(p.totalProfit, 1000); // the August trade is before the phase
  assert.equal(p.consistencyPct, 90);
  assert.ok(p.breaches.some((b) => b.rule === 'consistency' && b.level === 'warning'));
  assert.equal(p.profitTargetMet, true);
  assert.equal(p.readyToAdvance, true); // warnings don't block, only hard breaches do
  assert.equal(nextPhase('phase1'), 'phase2');
  assert.equal(nextPhase('funded'), null);
});

test('risk: position size from risk % and stop distance', () => {
  const s = computePositionSize({ accountValue: 10000, riskPct: 1, stopDistancePips: 20, pipValuePerLot: 10 });
  const lots = typeof s === 'number' ? s : s.lots;
  assert.equal(lots, 0.5); // 100 risked / (20 pips × 10 per lot)
});
