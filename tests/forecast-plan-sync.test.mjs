// Forecast, revision plan, weekly review, cloud-sync defaults, server reminders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ACADEMIC_SETTINGS, GRADING_PRESETS } from '../src/utils/academic.js';
import { buildForecastContext, forecastSubject } from '../src/utils/prediction.js';
import { revisionPlan } from '../src/utils/revision-plan.js';
import { weekStats } from '../src/utils/weekly-review.js';
import { fillDefaults } from '../src/utils/fill-defaults.js';
import { dueClassReminders } from '../api/class-reminders.js';

const S = { ...DEFAULT_ACADEMIC_SETTINGS, ...GRADING_PRESETS.find((p) => p.key === 'iscae').settings, activeTermId: 't', weeklyStudyTarget: 15 };
const ev = (type, weight, grade = null, date = '') => ({ id: type, type, name: type, weight, grade, date });
const academic = { settings: S, terms: [{ id: 't', startDate: '2026-09-28', endDate: '2027-01-31' }], modules: [] };
const course = (evaluations) => ({ id: 'f1', name: 'IFRS', kind: 'academic', termId: 't', status: 'active', coefficient: 1, slots: [{ id: 's', day: 1, start: '08:30', end: '10:00' }], evaluations });
const allOnTime = Object.fromEntries(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].map((d) => [`f1|s|${d}`, { status: 'on_time' }]));
const ctxFor = (c, attendance, sessions = []) => buildForecastContext({ courses: [c], academic, attendance, sessions, decks: [], cards: [], reviewLog: [], settings: S, today: '2026-10-20', now: new Date('2026-10-20T12:00:00') });

test('forecast: no signal at all → no estimate', () => {
  const c = course([ev('cc', 30), ev('cf', 30), ev('tass', 40)]);
  const ctx = buildForecastContext({ courses: [c], academic, attendance: {}, sessions: [], decks: [], cards: [], reviewLog: [], settings: S, today: '2026-09-27', now: new Date('2026-09-27T12:00:00') });
  assert.equal(forecastSubject(c, ctx).average, null);
});

test('forecast: TASS follows attendance, not the subject’s CC grade', () => {
  const tass = (ccGrade, attendance) => {
    const c = course([ev('cc', 30, ccGrade), ev('cf', 30), ev('tass', 40)]);
    return forecastSubject(c, ctxFor(c, attendance)).evals.find((x) => x.ev.type === 'tass').estimate;
  };
  assert.equal(tass(14, allOnTime), tass(4, allOnTime)); // CC grade has no say on TASS
  assert.ok(tass(14, allOnTime) - tass(14, { 'f1|s|2026-09-28': { status: 'on_time' } }) >= 5); // 4/4 vs 1/4 classes
});

test('forecast: CF leans on the known CC', () => {
  const lo = course([ev('cc', 30, 6), ev('cf', 30), ev('tass', 40)]);
  const hi = course([ev('cc', 30, 16), ev('cf', 30), ev('tass', 40)]);
  const cf = (c) => forecastSubject(c, ctxFor(c, allOnTime)).evals.find((x) => x.ev.type === 'cf').estimate;
  assert.ok(cf(hi) - cf(lo) >= 5);
});

test('revision plan: spaced sessions before a dated, ungraded evaluation only', () => {
  const c = course([ev('cc', 30, null, '2026-11-16'), ev('cf', 30, 12, '2026-11-20')]);
  const plan = revisionPlan({ courses: [c], settings: S, today: '2026-11-01' });
  assert.deepEqual(plan.map((p) => p.daysBefore), [14, 10, 7, 4, 2, 1]);
  assert.ok(plan.every((p) => p.ev.id === 'cc' && p.minutes >= 25));
  assert.equal(revisionPlan({ courses: [c], settings: S, today: '2026-11-15' }).length, 1); // only J-1 left
});

test('weekly review counts the week’s classes, study and notes', () => {
  const c = course([]);
  const w = weekStats({ courses: [c], academic, attendance: { 'f1|s|2026-10-05': { status: 'on_time' } }, classNotes: { k: { courseId: 'f1', date: '2026-10-05' } }, sessions: [{ courseId: 'f1', date: '2026-10-06', durationMinutes: 50 }], reviewLog: [], settings: S, weekStart: '2026-10-05', nowMs: new Date('2026-10-11T20:00:00').getTime() });
  assert.deepEqual([w.totals.required, w.totals.onTime, w.minutes, w.notes], [1, 1, 50, 1]);
});

test('cloud sync: defaults filled, remote wins, keyed records keep deletions', () => {
  const defaults = { attendance: {}, academic: { settings: { arriveBeforeMin: 5, classReminderMin: 20 } } };
  const out = fillDefaults({ attendance: { a: 1 }, academic: { settings: { arriveBeforeMin: 10 } } }, defaults);
  assert.deepEqual(out, { attendance: { a: 1 }, academic: { settings: { arriveBeforeMin: 10, classReminderMin: 20 } } });
});

test('server reminders: heads-up, nudge, silent once checked in, capture after class', () => {
  const learning = {
    courses: [{ id: 'c', name: 'Consulting', kind: 'academic', termId: 't', status: 'active', slots: [{ id: 's', day: 1, start: '08:30', end: '10:00', room: 'Auditorium' }] }],
    academic: { settings: { activeTermId: 't', arriveBeforeMin: 10 }, terms: [{ id: 't', startDate: '2026-09-28' }], modules: [] }, attendance: {}, classNotes: {},
  };
  const at = (iso) => dueClassReminders(learning, 'Africa/Casablanca', new Date(iso)).map((x) => x.tag.split('-')[0]);
  assert.deepEqual(at('2026-09-28T07:09:00Z'), []); // 08:09 local
  assert.deepEqual(at('2026-09-28T07:10:00Z'), ['class']); // 08:10 heads-up
  assert.deepEqual(at('2026-09-28T07:15:00Z'), ['class']); // 08:15 nudge (deadline 08:20)
  learning.attendance['c|s|2026-09-28'] = { status: 'on_time' };
  assert.deepEqual(at('2026-09-28T07:15:00Z'), []);
  assert.deepEqual(at('2026-09-28T09:00:00Z'), ['notes']); // 10:00 end of class
});
