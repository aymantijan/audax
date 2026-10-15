import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dosesOn, stockStatus, adherence, vitalZone, dueCareReminders, boostersDue, upcomingAppointments, emergencyIsEmpty } from '../src/utils/care.js';
import { dueHealthReminders } from '../api/class-reminders.js';

const meds = [
  { id: 'a', name: 'Metformine', dose: '1 comprimé', times: ['20:00', '08:00'], frequency: 'daily', startDate: '2026-10-01', stock: 30, stockDate: '2026-10-10', perDose: 1 },
  { id: 'b', name: 'Vitamine D', times: ['09:00'], frequency: 'weekdays', weekdays: ['mon'], startDate: '2026-10-01' },
  { id: 'c', name: 'Paracétamol', frequency: 'asNeeded' },
  { id: 'd', name: 'Ancien', times: ['08:00'], frequency: 'daily', active: false },
];

test('doses of the day: in time order, only planned medications, with what was noted', () => {
  const logs = [{ medId: 'a', date: '2026-10-12', time: '08:00', status: 'taken' }];
  const mon = dosesOn(meds, logs, '2026-10-12'); // a Monday
  assert.deepEqual(mon.map((d) => [d.med.id, d.time, d.status]), [['a', '08:00', 'taken'], ['b', '09:00', null], ['a', '20:00', null]]);
  assert.equal(dosesOn(meds, logs, '2026-10-13').length, 2, 'no vitamin D on Tuesday, never as-needed or stopped ones');
  assert.equal(dosesOn(meds, [], '2026-09-30').length, 0, 'nothing before the start date');
});

test('stock: what is left and when the box runs out', () => {
  const logs = Array.from({ length: 24 }, (_, i) => ({ medId: 'a', date: '2026-10-12', time: String(i), status: 'taken' }));
  const s = stockStatus(meds[0], logs);
  assert.deepEqual(s, { left: 6, days: 3, low: true });
  assert.equal(stockStatus(meds[1], []), null, 'no stock entered');
  const before = stockStatus(meds[0], [{ medId: 'a', date: '2026-10-09', status: 'taken' }]);
  assert.equal(before.left, 30, 'doses before the stock date do not count');
});

test('adherence over a period', () => {
  const logs = [{ medId: 'a', date: '2026-10-13', time: '08:00', status: 'taken' }, { medId: 'a', date: '2026-10-13', time: '20:00', status: 'skipped' }];
  assert.deepEqual(adherence(meds, logs, '2026-10-13', '2026-10-13'), { planned: 2, taken: 1, pct: 50 });
  const morning = [{ medId: 'a', date: '2026-10-13', time: '08:00', status: 'taken' }];
  assert.deepEqual(adherence(meds, morning, '2026-10-13', '2026-10-13', '12:00'), { planned: 1, taken: 1, pct: 100 }, 'the evening dose is not due yet');
});

test('measurement zones follow the public references', () => {
  assert.equal(vitalZone('bp', { systolic: 118, diastolic: 76 }).level, 'ok');
  assert.equal(vitalZone('bp', { systolic: 135, diastolic: 82 }).level, 'watch');
  assert.equal(vitalZone('bp', { systolic: 150, diastolic: 85 }).level, 'high');
  assert.equal(vitalZone('bp', { systolic: 190, diastolic: 100 }).level, 'urgent');
  assert.equal(vitalZone('glucose', { value: 95 }).level, 'ok');
  assert.equal(vitalZone('glucose', { value: 110 }).level, 'watch');
  assert.equal(vitalZone('glucose', { value: 130, context: 'after' }).level, 'ok');
  assert.equal(vitalZone('glucose', { value: 60 }).level, 'urgent');
  assert.equal(vitalZone('spo2', { value: 89 }).level, 'urgent');
  assert.equal(vitalZone('temperature', { value: 38.2 }).level, 'watch');
  assert.equal(vitalZone('glucose', { value: '' }), null);
});

test('reminders: a dose at its time unless noted, appointments the evening before and 2 h before', () => {
  const health = {
    medications: meds,
    medLogs: [{ medId: 'a', date: '2026-10-12', time: '08:00', status: 'taken' }],
    appointments: [{ id: 'r', date: '2026-10-13', time: '10:30', title: 'Cardiologue', place: 'Clinique' }, { id: 'old', date: '2026-10-13', time: '10:30', title: 'Fait', done: true }],
  };
  const at = (min) => (t) => t === min;
  assert.deepEqual(dueCareReminders(health, '2026-10-12', at(8 * 60)).map((m) => m.tag), [], 'already taken');
  assert.deepEqual(dueCareReminders(health, '2026-10-12', at(9 * 60)).map((m) => m.tag), ['med-b-09:00']);
  assert.deepEqual(dueCareReminders(health, '2026-10-12', at(18 * 60)).map((m) => m.tag), ['rdv-eve-r']);
  assert.deepEqual(dueCareReminders(health, '2026-10-13', at(8 * 60 + 30)).map((m) => m.tag), ['rdv-2h-r']);
  assert.deepEqual(dueCareReminders(health, '2026-10-13', at(8 * 60)).map((m) => m.tag), ['med-a-08:00'], 'a new day: the dose is due again');
});

test('the push job sends medication reminders in the person’s own time zone', () => {
  const health = { careTimezone: 'Etc/GMT-1', medications: [{ id: 'x', name: 'Insuline', times: ['08:00'], frequency: 'daily' }], medLogs: [] };
  const now = new Date('2026-10-12T07:02:00Z'); // 08:02 at UTC+1
  assert.deepEqual(dueHealthReminders(health, now).map((m) => m.tag), ['med-x-08:00']);
  assert.deepEqual(dueHealthReminders(health, new Date('2026-10-12T08:02:00Z')), []);
});

test('appointments, boosters, emergency card', () => {
  const appts = [{ id: 1, date: '2026-10-20' }, { id: 2, date: '2026-10-15', time: '09:00' }, { id: 3, date: '2026-10-01' }];
  assert.deepEqual(upcomingAppointments(appts, '2026-10-14').map((a) => a.id), [2, 1]);
  const docs = [{ id: 1, kind: 'vaccine', nextDate: '2026-11-01' }, { id: 2, kind: 'vaccine', nextDate: '2027-06-01' }, { id: 3, kind: 'prescription' }];
  assert.deepEqual(boostersDue(docs, '2026-10-14').map((d) => d.id), [1]);
  assert.equal(emergencyIsEmpty({ contacts: [{ name: '', phone: '' }] }), true);
  assert.equal(emergencyIsEmpty({ bloodType: 'O+' }), false);
});

test('gentle sessions: every step explained and timed', async () => {
  const { GENTLE_ROUTINES, routineMinutes } = await import('../src/utils/gentle-routines.js');
  assert.ok(GENTLE_ROUTINES.length >= 5);
  for (const r of GENTLE_ROUTINES) {
    assert.ok(r.steps.length > 0, r.id);
    for (const s of r.steps) assert.ok(s.name && s.how && s.seconds > 0, `${r.id}: ${s.name}`);
    assert.ok(routineMinutes(r) >= 1 && routineMinutes(r) <= 20, r.id);
  }
});

test('Ma semaine shows medical appointments on their day', async () => {
  const { buildWeek } = await import('../src/utils/week-view.js');
  const w = buildWeek({ monday: '2026-10-12', appointments: [{ id: 'r', date: '2026-10-14', time: '10:00', title: 'Dentiste' }, { id: 'x', date: '2026-10-14', title: 'Fait', done: true }] });
  assert.deepEqual(w[2].appointments.map((a) => a.id), ['r']);
});
