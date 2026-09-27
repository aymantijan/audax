import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, periodOf, periodRange, objectiveProgress } from '../src/utils/objectives.js';

test('periods: ISO week, quarter, year and their ranges', () => {
  assert.deepEqual(isoWeek('2026-09-27'), { year: 2026, week: 39 });
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53 });
  assert.equal(periodOf('quarter', '2026-11-03'), '2026-T4');
  assert.equal(periodOf('week', '2026-09-28'), '2026-S40');
  assert.deepEqual(periodRange('2026-T4'), { from: '2026-10-01', to: '2026-12-31' });
  assert.deepEqual(periodRange('2026-S40'), { from: '2026-09-28', to: '2026-10-04' });
});

test('progress: children first, then linked habits, then done', () => {
  const all = [
    { id: 'y', horizon: 'year', period: '2026' },
    { id: 'q1', horizon: 'quarter', period: '2026-T3', parentId: 'y', done: true },
    { id: 'q2', horizon: 'quarter', period: '2026-T4', parentId: 'y', habitIds: ['h'] },
  ];
  const habits = [{ id: 'h', name: 'Lire', frequency: 'daily' }];
  const logs = [{ habitId: 'h', date: '2026-10-01', completed: true }];
  const ctx = { habits, logs, today: '2026-10-02' };
  assert.equal(objectiveProgress(all[2], all, ctx), 50); // 1 of 2 days lived in T4
  assert.equal(objectiveProgress(all[0], all, ctx), 75); // mean of 100 and 50
});
