import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRemovals, restoreRemoval, restoreAll, recordLabel } from '../src/utils/removals.js';

test('a record taken out of a list is found, with its place', () => {
  const before = { workouts: [{ id: 'a', exercise: 'Course' }, { id: 'b', exercise: 'Muscu' }, { id: 'c', exercise: 'Vélo' }] };
  const after = { workouts: [before.workouts[0], before.workouts[2]] };
  const r = findRemovals(before, after);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { path: ['workouts'], kind: 'item', item: { id: 'b', exercise: 'Muscu' }, index: 1 });
  assert.equal(recordLabel(r[0]), 'Muscu');
  assert.deepEqual(restoreRemoval(after, r[0]), before);
});

test('nested records, keyed records and untouched data', () => {
  const course = { id: 'c1', name: 'IFRS', evaluations: [{ id: 'e1', name: 'Partiel' }, { id: 'e2', name: 'Examen' }] };
  const before = { courses: [course], attendance: { 'c1|s|2026-10-01': { status: 'on_time' }, 'c1|s|2026-10-02': { status: 'late' } }, version: 3, tags: ['a', 'b'] };
  const after = {
    courses: [{ ...course, evaluations: [course.evaluations[0]] }],
    attendance: { 'c1|s|2026-10-02': before.attendance['c1|s|2026-10-02'] },
    version: 3,
    tags: ['a'], // a plain value list: an edit, never a "deletion"
  };
  const r = findRemovals(before, after);
  assert.deepEqual(r.map((x) => [x.kind, JSON.stringify(x.path)]), [['item', '["courses",{"id":"c1"},"evaluations"]'], ['key', '["attendance"]']]);
  assert.deepEqual(restoreAll(after, r), { ...before, tags: ['a'] });
});

test('a value removed from a keyed list (a food price) comes back', () => {
  const before = { foodPrices: { Riz: 0.012, Pain: 0.03 } };
  const after = { foodPrices: { Pain: 0.03 } };
  const r = findRemovals(before, after);
  assert.deepEqual(r, [{ path: ['foodPrices'], kind: 'key', key: 'Riz', value: 0.012 }]);
  assert.deepEqual(restoreRemoval(after, r[0]), { foodPrices: { Pain: 0.03, Riz: 0.012 } });
});

test('restoring is safe: no duplicate, nothing when the parent is gone, other edits kept', () => {
  const before = { notes: [{ id: 'n1', title: 'A' }, { id: 'n2', title: 'B' }] };
  const after = { notes: [before.notes[0]] };
  const [rem] = findRemovals(before, after);
  assert.equal(restoreRemoval(before, rem), before, 'already there: unchanged');
  const edited = { notes: [{ id: 'n1', title: 'A modifié' }, { id: 'n3', title: 'C' }] };
  assert.deepEqual(restoreRemoval(edited, rem).notes.map((n) => n.title), ['A modifié', 'B', 'C']);
  const nested = findRemovals({ list: [{ id: 'p', items: [{ id: 'x' }] }] }, { list: [{ id: 'p', items: [] }] });
  assert.deepEqual(restoreRemoval({ list: [] }, nested[0]), { list: [] }, 'parent deleted since: nothing to do');
});

test('a whole record and what was inside it both come back', () => {
  const before = { courses: [{ id: 'c1', name: 'IFRS', evaluations: [{ id: 'e1' }] }], decks: [{ id: 'd1', courseId: 'c1' }] };
  const after = { courses: [], decks: [] };
  const r = findRemovals(before, after);
  assert.equal(r.length, 2);
  assert.deepEqual(restoreAll(after, r), before);
});
