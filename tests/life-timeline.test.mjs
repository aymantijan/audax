import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEvents, dailyValues, lifeLinks, MIN_DAYS } from '../src/utils/life-timeline.js';
import { sleepHoursOf } from '../src/utils/life-review.js';

const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('sleep noted as hours (the + button) counts like bed/wake times', () => {
  assert.equal(sleepHoursOf({ sleepData: { sleepHours: 7.5 } }), 7.5);
  assert.equal(sleepHoursOf({ sleepData: { sleepStartTime: '23:30', wakeTime: '07:00' } }), 7.5);
  assert.equal(sleepHoursOf({ sleepData: {} }), null);
});

test('one timeline, newest first, every section', () => {
  const ev = buildEvents({
    journal: [
      { id: 'j1', date: '2026-09-20', label: 'Courses', lines: [{ account: '621', debit: 120, credit: 0 }, { account: '511', debit: 0, credit: 120 }] },
      { id: 'j2', date: '2026-09-25', label: 'Salaire', lines: [{ account: '511', debit: 3000, credit: 0 }, { account: '711', debit: 0, credit: 3000 }] },
      { id: 'j3', date: '2026-09-25', label: 'Virement épargne', lines: [{ account: '512', debit: 500, credit: 0 }, { account: '511', debit: 0, credit: 500 }] },
    ],
    trades: [{ id: 't1', date: '2026-09-22', instrument: 'EURUSD', pnl: -40 }],
    workouts: [{ id: 'w1', date: '2026-09-26', exercise: 'Course à pied', durationMin: 28, cardio: { distance: 5 } }],
    energyLogs: [{ date: '2026-09-27', sleepData: { sleepHours: 7.5 } }],
    habits: [{ id: 'h1', name: 'Méditation' }],
    habitLogs: [{ habitId: 'h1', date: '2026-09-24', completed: true }, { habitId: 'h1', date: '2026-09-23', completed: false }],
    courses: [{ id: 'c1', name: 'IFRS' }],
    sessions: [{ id: 's1', date: '2026-09-21', durationMinutes: 45, courseId: 'c1' }],
    attendance: { 'c1|sl1|2026-09-21': { status: 'on_time' } },
  });
  assert.deepEqual(ev.map((e) => e.kind), ['sleep', 'workout', 'income', 'habit', 'trade', 'study', 'class', 'expense']);
  assert.equal(ev.find((e) => e.kind === 'workout').detail, '5 km · 28 min');
  assert.equal(ev.find((e) => e.kind === 'class').title, 'Cours · IFRS');
  assert.ok(!ev.some((e) => e.title === 'Virement épargne'), 'a transfer is neither spent nor earned');
});

test('links: a clear difference with enough days is shown, with its days', () => {
  const workouts = []; const sessions = [];
  for (let i = 0; i < 30; i += 1) {
    const date = addDays('2026-08-01', i);
    const sport = i % 2 === 0;
    if (sport) workouts.push({ id: `w${i}`, date, durationMin: 45 });
    sessions.push({ id: `s${i}`, date, durationMinutes: sport ? 60 + (i % 5) : 20 + (i % 7) });
  }
  const { findings } = lifeLinks({ workouts, sessions });
  const f = findings.find((x) => x.key === 'sport:study');
  assert.ok(f, 'sport ↔ study found');
  assert.equal(f.nWith, 15);
  assert.equal(f.nWithout, 15);
  assert.ok(f.better);
  assert.match(f.text, /^Les jours avec sport : 6\d min de travail \/ révision en moyenne, contre 2\d min les jours sans sport\.$/);
  assert.equal(f.days.with.length, 15);
  const cut = lifeLinks({ workouts, sessions }, { today: addDays('2026-08-01', 29) }).findings.find((x) => x.key === 'sport:study');
  assert.equal(cut.nWith + cut.nWithout, 29, 'today is left out');
});

test('links: nothing below the minimum, and no finding from noise', () => {
  const workouts = []; const sessions = [];
  for (let i = 0; i < 2 * MIN_DAYS - 2; i += 1) {
    const date = addDays('2026-08-01', i);
    if (i % 2 === 0) workouts.push({ id: `w${i}`, date, durationMin: 30 });
    sessions.push({ id: `s${i}`, date, durationMinutes: i % 2 === 0 ? 90 : 10 });
  }
  const few = lifeLinks({ workouts, sessions });
  assert.equal(few.findings.length, 0);
  assert.ok(few.waiting.some((w) => w.key === 'sport'));

  const flat = []; const ws = [];
  for (let i = 0; i < 40; i += 1) {
    const date = addDays('2026-08-01', i);
    if (i % 2 === 0) ws.push({ id: `w${i}`, date, durationMin: 30 });
    flat.push({ id: `s${i}`, date, durationMinutes: 40 + ((i * 7) % 11) });
  }
  assert.ok(!lifeLinks({ workouts: ws, sessions: flat }).findings.some((f) => f.key === 'sport:study'));
});

test('daily values only exist where the section is used', () => {
  const d = dailyValues({ sessions: [{ date: '2026-09-01', durationMinutes: 30 }, { date: '2026-09-03', durationMinutes: 10 }] });
  assert.equal(d['2026-09-02'].study, 0, 'a day without study counts as 0 once studying started');
  assert.equal(d['2026-09-02'].pnl, undefined, 'no trading data → no trading value');
});
