import test from 'node:test';
import assert from 'node:assert/strict';
import { weekFigures, compareWeeks, weekHeadline, sleepHoursOf, addDays } from '../src/utils/life-review.js';
import { buildBriefing } from '../src/utils/briefing.js';

const monday = '2026-09-21';
const data = {
  habits: [{ id: 'h', name: 'Lire', frequency: 'daily', createdAt: 0 }],
  logs: [{ habitId: 'h', date: '2026-09-21', completed: true }, { habitId: 'h', date: '2026-09-22', completed: true }],
  energyLogs: [{ date: '2026-09-21', energyStartLevel: 7, sleepData: { sleepStartTime: '23:30', wakeTime: '07:00' } }],
  workouts: [{ date: '2026-09-22' }, { date: '2026-09-15' }],
  sessions: [{ date: '2026-09-23', durationMinutes: 50 }],
  journal: [{ date: '2026-09-22', lines: [{ account: '6111', debit: 120, credit: 0 }, { account: '5141', debit: 0, credit: 120 }] }],
  trades: [{ date: '2026-09-24', pnl: 40 }, { date: '2026-09-25', pnl: -15 }],
  readLog: [{ date: '2026-09-21' }, { date: '2026-09-21' }],
};

test('sleep hours cross midnight', () => {
  assert.equal(sleepHoursOf({ sleepData: { sleepStartTime: '23:30', wakeTime: '07:00' } }), 7.5);
  assert.equal(sleepHoursOf({}), null);
});

test('one week of figures across sections', () => {
  const w = weekFigures(data, monday, '2026-09-27');
  assert.equal(w.workouts, 1);
  assert.equal(w.focusMinutes, 50);
  assert.equal(w.spent, 120); // only expense accounts (class 6)
  assert.equal(w.tradingPnl, 25);
  assert.equal(w.readingDays, 1);
  assert.equal(w.sleepHours, 7.5);
});

test('a week in progress only counts the days lived', () => {
  assert.equal(weekFigures(data, monday, '2026-09-23').daysCounted, 3);
});

test('spending going down counts as progress', () => {
  const rows = compareWeeks({ spent: 100, workouts: 1 }, { spent: 200, workouts: 3 });
  assert.equal(rows.find((r) => r.key === 'spent').trend, 'better');
  assert.equal(rows.find((r) => r.key === 'workouts').trend, 'worse');
  assert.match(weekHeadline(rows), /En progrès : dépenses/);
  assert.equal(addDays(monday, -7), '2026-09-14');
});

test('briefing: overdue payments first, then today', () => {
  const items = buildBriefing({ today: '2026-09-27', habitsDue: 3, habitsDone: 1, overdueEcheances: [{}], flashcardsDue: 4, checkinDone: false });
  assert.equal(items[0].key, 'overdue');
  assert.ok(items.some((i) => i.text.startsWith('2 habitudes')));
  assert.equal(items[items.length - 1].key, 'cards');
});

test('briefing: exams within a week are announced', () => {
  const courses = [{ id: 'c', name: 'Finance', kind: 'academic', status: 'active', evaluations: [{ id: 'e', name: 'CC', date: '2026-09-28' }] }];
  const items = buildBriefing({ today: '2026-09-27', courses });
  assert.equal(items[0].text, 'CC de Finance demain.');
  assert.equal(items[0].level, 'urgent');
});
