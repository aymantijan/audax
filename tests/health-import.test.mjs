import test from 'node:test';
import assert from 'node:assert/strict';
import { AppleHealthParser, parseGoogleFitDaily, mergeHealthImport } from '../src/utils/health-import.js';

const XML = `<?xml version="1.0"?><HealthData>
<Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" startDate="2026-09-20 07:30:00 +0100" endDate="2026-09-20 07:30:00 +0100" value="72.4"/>
<Record type="HKQuantityTypeIdentifierBodyMass" unit="lb" startDate="2026-09-21 07:30:00 +0100" endDate="2026-09-21 07:30:00 +0100" value="160"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-09-20 23:40:00 +0100" endDate="2026-09-21 03:10:00 +0100" value="HKCategoryValueSleepAnalysisAsleepCore"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-09-21 03:20:00 +0100" endDate="2026-09-21 07:05:00 +0100" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-09-20 23:00:00 +0100" endDate="2026-09-21 07:30:00 +0100" value="HKCategoryValueSleepAnalysisInBed"/>
<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-09-21 10:00:00 +0100" endDate="2026-09-21 10:30:00 +0100" value="3000"/>
<Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-09-21 18:00:00 +0100" endDate="2026-09-21 18:30:00 +0100" value="4500"/>
<Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2026-09-21 18:00:00 +0100" endDate="2026-09-21 18:00:00 +0100" value="80"/>
<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="31.5" durationUnit="min" totalDistance="5.2" totalDistanceUnit="km" startDate="2026-09-21 18:00:00 +0100" endDate="2026-09-21 18:31:30 +0100">
  <WorkoutEvent type="HKWorkoutEventTypePause"/>
</Workout>
</HealthData>`;

test('Apple export read in small chunks gives the same result', () => {
  const p = new AppleHealthParser();
  for (let i = 0; i < XML.length; i += 37) p.feed(XML.slice(i, i + 37)); // tags cut in half on purpose
  const r = p.result();
  assert.deepEqual(r.weights, [{ date: '2026-09-20', weightKg: 72.4 }, { date: '2026-09-21', weightKg: 72.6 }]);
  assert.deepEqual(r.sleep, [{ date: '2026-09-21', sleepStartTime: '23:40', wakeTime: '07:05' }]); // asleep, not in-bed
  assert.deepEqual(r.activity, [{ date: '2026-09-21', steps: 7500, distanceKm: 0, activeKcal: 0 }]);
  assert.equal(r.workouts.length, 1);
  assert.deepEqual({ ...r.workouts[0], importId: undefined }, { importId: undefined, date: '2026-09-21', type: 'cardio', exercise: 'Course à pied', durationMin: 32, distanceKm: 5.2 });
});

test('Google Fit daily CSV', () => {
  const csv = 'Date,Move Minutes count,Calories (kcal),Distance (m),Step count,Average weight (kg)\n2026-09-20,40,2100.5,4200,6543,71.9\n2026-09-21,10,1800,,1200,\n';
  const r = parseGoogleFitDaily(csv);
  assert.deepEqual(r.activity[0], { date: '2026-09-20', steps: 6543, distanceKm: 4.2, activeKcal: 2101 });
  assert.equal(r.activity.length, 2);
  assert.deepEqual(r.weights, [{ date: '2026-09-20', weightKg: 71.9 }]);
});

test('import never overwrites what was entered by hand, and does not duplicate', () => {
  const p = new AppleHealthParser(); p.feed(XML); const imp = p.result();
  const current = {
    bodyComp: [{ date: '2026-09-20', weightKg: 73 }],
    energyLogs: [{ date: '2026-09-21', sleepData: { sleepStartTime: '00:00', wakeTime: '08:00' } }],
    workouts: [], activityDays: [],
  };
  const m = mergeHealthImport(current, imp);
  assert.deepEqual(m.bodyComp.map((b) => b.date), ['2026-09-21']);
  assert.equal(m.sleepLogs.length, 0);
  assert.equal(m.workouts.length, 1);
  const again = mergeHealthImport({ ...current, workouts: m.workouts }, imp);
  assert.equal(again.workouts.length, 0);
});
