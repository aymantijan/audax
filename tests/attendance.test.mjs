// Attendance: dated classes, check-in rule, partiels end, daily score, stats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classesOn, occurrenceState, checkInStatus, dayAttendance, courseAttendance, courseEnd, pendingCaptures, withDefaults,
} from '../src/utils/attendance.js';

const settings = { activeTermId: 't', arriveBeforeMin: 5 };
const academic = () => ({ settings, terms: [{ id: 't', startDate: '2026-09-28', midtermsDate: '' }], modules: [] });
const course = (extra = {}) => ({
  id: 'c', name: 'Consulting', kind: 'academic', termId: 't', status: 'active',
  slots: [{ id: 's1', day: 1, start: '08:30', end: '10:00' }, { id: 's2', day: 1, start: '10:15', end: '11:45' }], evaluations: [], ...extra,
});
const at = (s) => new Date(s).getTime(); // local time, like the app

test('no class before the semester starts; two slots on Monday', () => {
  assert.equal(classesOn([course()], academic(), '2026-09-21').length, 0);
  assert.equal(classesOn([course()], academic(), '2026-09-28').length, 2);
});

test('check-in: on time up to arriveBeforeMin before the start, late after', () => {
  const [o] = classesOn([course()], academic(), '2026-09-28');
  assert.equal(checkInStatus(o, settings, at('2026-09-28T08:25:00')), 'on_time');
  assert.equal(checkInStatus(o, settings, at('2026-09-28T08:25:01')), 'late');
  assert.equal(checkInStatus(o, { ...settings, arriveBeforeMin: 10 }, at('2026-09-28T08:22:00')), 'late');
});

test('state: upcoming → open 1 h before → absent once over without a record', () => {
  const [o] = classesOn([course()], academic(), '2026-09-28');
  assert.equal(occurrenceState(o, {}, at('2026-09-28T07:00:00')), 'upcoming');
  assert.equal(occurrenceState(o, {}, at('2026-09-28T07:45:00')), 'open');
  assert.equal(occurrenceState(o, {}, at('2026-09-28T10:01:00')), 'absent');
  assert.equal(occurrenceState(o, { [o.key]: { status: 'cancelled' } }, at('2026-09-28T10:01:00')), 'cancelled');
});

test('partiels: own CC date wins, then the term date, else pending', () => {
  const term = { midtermsDate: '2026-11-09' };
  assert.deepEqual(courseEnd(course({ endRule: 'midterms', evaluations: [{ type: 'cc', date: '2026-11-16' }] }), term).date, '2026-11-16');
  assert.equal(courseEnd(course({ endRule: 'midterms' }), term).source, 'term');
  assert.equal(courseEnd(course({ endRule: 'midterms' }), {}).pending, true);
  const a = academic(); a.terms[0].midtermsDate = '2026-10-05';
  assert.equal(classesOn([course({ endRule: 'midterms' })], a, '2026-10-05').length, 0);
  assert.equal(classesOn([course({ endRule: 'midterms' })], a, '2026-09-28').length, 2);
});

test('daily score ignores cancelled/excused classes; 100 when nothing to attend', () => {
  const occ = classesOn([course()], academic(), '2026-09-28');
  assert.equal(dayAttendance([course()], academic(), { [occ[0].key]: { status: 'on_time' } }, '2026-09-28').pct, 50);
  assert.equal(dayAttendance([course()], academic(), { [occ[0].key]: { status: 'on_time' }, [occ[1].key]: { status: 'excused' } }, '2026-09-28').pct, 100);
  assert.equal(dayAttendance([course()], academic(), {}, '2026-09-29').pct, 100);
});

test('course stats: counts and on-time streak skip neutral classes', () => {
  const occ = classesOn([course()], academic(), '2026-09-28');
  const occ2 = classesOn([course()], academic(), '2026-10-05');
  const rec = { [occ[0].key]: { status: 'late' }, [occ[1].key]: { status: 'on_time' }, [occ2[0].key]: { status: 'cancelled' }, [occ2[1].key]: { status: 'on_time' } };
  const a = courseAttendance(course(), academic(), rec, new Date('2026-10-06T12:00:00'));
  assert.equal(a.counts.on_time, 2);
  assert.equal(a.counts.late, 1);
  assert.equal(a.counts.cancelled, 1);
  assert.equal(a.streak, 2);
});

test('pending capture: attended, ended, no notes yet', () => {
  const [o] = classesOn([course()], academic(), '2026-09-28');
  const rec = { [o.key]: { status: 'on_time' } };
  assert.equal(pendingCaptures([course()], academic(), rec, {}, at('2026-09-28T10:05:00')).length, 1);
  assert.equal(pendingCaptures([course()], academic(), rec, { [o.key]: {} }, at('2026-09-28T10:05:00')).length, 0);
});

test('withDefaults fills settings lost by an old cloud copy', () => {
  assert.equal(withDefaults({ scale: 20 }).arriveBeforeMin, 5);
  assert.equal(withDefaults({ arriveBeforeMin: 10 }).arriveBeforeMin, 10);
});
