import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeek, mondayOf } from '../src/utils/week-view.js';

test('a week from Monday to Sunday, whatever the day asked', () => {
  assert.equal(mondayOf('2026-10-14'), '2026-10-12'); // Wednesday
  assert.equal(mondayOf('2026-10-18'), '2026-10-12'); // Sunday
  const w = buildWeek({ monday: '2026-10-12' });
  assert.deepEqual(w.map((d) => d.key), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
});

test('habits due, with what is done; evaluations, payments and sport on their day', () => {
  const habits = [
    { id: 'h1', name: 'Marcher', kind: 'check', frequency: 'daily', startDate: '2026-10-01' },
    { id: 'h2', name: 'Piano', kind: 'check', frequency: 'custom', weekdays: ['mon', 'wed'], startDate: '2026-10-01' },
    { id: 'h3', name: 'Fumer', kind: 'quit', startDate: '2026-10-01' },
    { id: 'h4', name: 'Nouvelle', kind: 'check', frequency: 'daily', startDate: '2026-10-15' },
  ];
  const logs = [{ habitId: 'h1', date: '2026-10-12', completed: true }];
  const courses = [{ id: 'c1', name: 'IFRS', status: 'active', evaluations: [{ id: 'e1', name: 'Partiel', date: '2026-10-16' }] }];
  const echeances = [{ id: 'x', label: 'Loyer', amount: 500, type: 'charge', active: true, recurrence: 'once', dueDate: '2026-10-15' }];
  const workouts = [{ id: 'w', date: '2026-10-13', exercise: 'Course' }];
  const w = buildWeek({ monday: '2026-10-12', habits, logs, courses, echeances, workouts });
  const mon = w[0];
  assert.deepEqual(mon.habits.map((x) => [x.habit.id, x.done]), [['h1', true], ['h2', false]]);
  assert.deepEqual(w[1].habits.map((x) => x.habit.id), ['h1'], 'no piano on Tuesday, never a habit to quit');
  assert.ok(w[3].habits.some((x) => x.habit.id === 'h4') && !w[2].habits.some((x) => x.habit.id === 'h4'), 'a habit starts on its start day');
  assert.equal(w[4].exams[0].ev.name, 'Partiel');
  assert.equal(w[3].dues[0].label, 'Loyer');
  assert.equal(w[1].workouts.length, 1);
});
