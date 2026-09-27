import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeScore, rankMembers, makeCode } from '../src/utils/challenges.js';

const win = { starts: '2026-09-21', ends: '2026-09-30', today: '2026-09-27' };

test('focus minutes and reading days are counted inside the dates only', () => {
  const data = { sessions: [{ date: '2026-09-20', durationMinutes: 99 }, { date: '2026-09-22', durationMinutes: 50 }, { date: '2026-09-27', durationMinutes: 75 }] };
  assert.deepEqual(challengeScore('focus', data, win), { score: 125, detail: '2 h 5' });
  const r = challengeScore('reading', { readLog: [{ date: '2026-09-22' }, { date: '2026-09-22' }, { date: '2026-10-01' }] }, win);
  assert.equal(r.score, 1);
});

test('habits kept as a percentage over the days lived', () => {
  const habits = [{ id: 'h', name: 'Lire', frequency: 'daily' }];
  const logs = ['2026-09-21', '2026-09-22', '2026-09-23'].map((date) => ({ habitId: 'h', date, completed: true }));
  const r = challengeScore('habits', { habits, logs }, win);
  assert.equal(r.score, 43); // 3 of 7 days
});

test('a challenge not started yet scores 0', () => {
  assert.equal(challengeScore('workouts', { workouts: [{ date: '2026-09-20' }] }, { starts: '2026-10-01', ends: '2026-10-31', today: '2026-09-27' }).score, 0);
});

test('ranking shares places on ties; codes are 6 readable characters', () => {
  const r = rankMembers([{ n: 'A', score: 50 }, { n: 'B', score: 80 }, { n: 'C', score: 50 }]);
  assert.deepEqual(r.map((m) => [m.n, m.place]), [['B', 1], ['A', 2], ['C', 2]]);
  assert.match(makeCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});
