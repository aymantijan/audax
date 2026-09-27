// Health data import (étape 5): Apple Santé (export.xml from the iPhone's
// "Exporter toutes les données de santé") and Google Fit (Google Takeout,
// "Daily activity metrics.csv"). Apple exports can weigh hundreds of MB, so
// the XML is fed chunk by chunk and only a few record types are kept:
// weight, sleep, steps/distance/active energy per day, workouts.
// Pure: tests/health-import.test.mjs. Writing into the stores is done by
// applyHealthImport (components/health/HealthImportCard.jsx).

const attrs = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
};
const dayOf = (s) => String(s || '').slice(0, 10);
const hhmm = (s) => String(s || '').slice(11, 16);
const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

const WORKOUTS = {
  Running: ['cardio', 'Course à pied'], Walking: ['cardio', 'Marche'], Hiking: ['cardio', 'Randonnée'],
  Cycling: ['cardio', 'Vélo'], Swimming: ['cardio', 'Natation'], Rowing: ['cardio', 'Rameur'],
  Elliptical: ['cardio', 'Vélo elliptique'], StairClimbing: ['cardio', 'Escaliers'], JumpRope: ['cardio', 'Corde à sauter'],
  HighIntensityIntervalTraining: ['cardio', 'HIIT'], MixedCardio: ['cardio', 'Cardio'],
  TraditionalStrengthTraining: ['sport', 'Musculation'], FunctionalStrengthTraining: ['sport', 'Renforcement'], CoreTraining: ['sport', 'Gainage'],
  Yoga: ['sport', 'Yoga'], Pilates: ['sport', 'Pilates'], Soccer: ['sport', 'Football'], Basketball: ['sport', 'Basketball'],
  Tennis: ['sport', 'Tennis'], Boxing: ['sport', 'Boxe'], MartialArts: ['sport', 'Arts martiaux'], Dance: ['sport', 'Danse'],
};

export class AppleHealthParser {
  constructor() {
    this.buffer = '';
    this.weights = {}; // day → kg (last of the day)
    this.sleep = {}; // wake day → { start, end } (earliest start, latest end)
    this.hasAsleep = false;
    this.inBed = {};
    this.activity = {}; // day → { steps, distanceKm, activeKcal }
    this.workouts = [];
    this.records = 0;
  }

  feed(text) {
    this.buffer += text;
    const re = /<(Record|Workout)\s[^>]*?\/?>/g;
    let last = 0;
    let m;
    while ((m = re.exec(this.buffer))) {
      this.handle(m[1], m[0]);
      last = re.lastIndex;
    }
    // Keep the tail that may hold a tag cut in half.
    const open = this.buffer.lastIndexOf('<');
    this.buffer = open >= last ? this.buffer.slice(open) : '';
  }

  handle(kind, tag) {
    const a = attrs(tag);
    this.records += 1;
    if (kind === 'Workout') {
      const type = String(a.workoutActivityType || '').replace('HKWorkoutActivityType', '');
      const [wtype, label] = WORKOUTS[type] || ['sport', type.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Activité'];
      let minutes = num(a.duration);
      if (a.durationUnit === 's' || a.durationUnit === 'sec') minutes = minutes / 60;
      if (a.durationUnit === 'hr' || a.durationUnit === 'h') minutes = minutes * 60;
      let km = num(a.totalDistance);
      if (km != null && a.totalDistanceUnit === 'mi') km *= 1.609344;
      if (km != null && a.totalDistanceUnit === 'm') km /= 1000;
      this.workouts.push({
        importId: `apple:${a.startDate}:${type}`, date: dayOf(a.startDate), type: wtype, exercise: label,
        durationMin: Math.round(minutes || 0), distanceKm: km ? Math.round(km * 100) / 100 : null,
      });
      return;
    }
    const type = a.type || '';
    const day = dayOf(a.startDate);
    if (type === 'HKQuantityTypeIdentifierBodyMass') {
      let kg = num(a.value);
      if (kg == null) return;
      if (a.unit === 'lb') kg *= 0.45359237;
      this.weights[day] = Math.round(kg * 10) / 10;
    } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      const asleep = /Asleep/.test(a.value || '');
      if (asleep) this.hasAsleep = true;
      const target = asleep ? this.sleep : /InBed/.test(a.value || '') ? this.inBed : null;
      if (!target) return;
      const wake = dayOf(a.endDate);
      const cur = target[wake];
      const start = String(a.startDate).slice(0, 19);
      const end = String(a.endDate).slice(0, 19);
      target[wake] = { start: !cur || start < cur.start ? start : cur.start, end: !cur || end > cur.end ? end : cur.end };
    } else if (type === 'HKQuantityTypeIdentifierStepCount' || type === 'HKQuantityTypeIdentifierDistanceWalkingRunning' || type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      const v = num(a.value);
      if (v == null) return;
      const d = (this.activity[day] ||= { steps: 0, distanceKm: 0, activeKcal: 0 });
      if (type.endsWith('StepCount')) d.steps += v;
      else if (type.endsWith('DistanceWalkingRunning')) d.distanceKm += a.unit === 'mi' ? v * 1.609344 : a.unit === 'm' ? v / 1000 : v;
      else d.activeKcal += a.unit === 'kJ' ? v / 4.184 : v;
    }
  }

  result() {
    const nights = this.hasAsleep ? this.sleep : this.inBed;
    return {
      source: 'apple',
      weights: Object.entries(this.weights).map(([date, weightKg]) => ({ date, weightKg })),
      sleep: Object.entries(nights).map(([date, s]) => ({ date, sleepStartTime: hhmm(s.start.replace('T', ' ')), wakeTime: hhmm(s.end.replace('T', ' ')) })),
      activity: Object.entries(this.activity).map(([date, d]) => ({ date, steps: Math.round(d.steps), distanceKm: Math.round(d.distanceKm * 100) / 100, activeKcal: Math.round(d.activeKcal) })),
      workouts: this.workouts,
      records: this.records,
    };
  }
}

// Google Takeout → Fit → "Daily activity metrics.csv" (one line per day).
export function parseGoogleFitDaily(csv) {
  const lines = String(csv).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { source: 'googlefit', weights: [], sleep: [], activity: [], workouts: [], records: 0 };
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (...names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const iDate = col('date');
  const iSteps = col('step count', 'nombre de pas');
  const iDist = col('distance (m)', 'distance');
  const iKcal = col('calories (kcal)', 'calories');
  const iWeight = col('average weight (kg)', 'poids moyen');
  const activity = [];
  const weights = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const date = (c[iDate] || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const steps = iSteps >= 0 ? num(c[iSteps]) : null;
    const dist = iDist >= 0 ? num(c[iDist]) : null;
    const kcal = iKcal >= 0 ? num(c[iKcal]) : null;
    if (steps || dist || kcal) activity.push({ date, steps: Math.round(steps || 0), distanceKm: Math.round(((dist || 0) / 1000) * 100) / 100, activeKcal: Math.round(kcal || 0) });
    const w = iWeight >= 0 ? num(c[iWeight]) : null;
    if (w) weights.push({ date, weightKg: Math.round(w * 10) / 10 });
  }
  return { source: 'googlefit', weights, sleep: [], activity, workouts: [], records: lines.length - 1 };
}

// Merge into the current data without touching what the person entered:
// a day that already has a weight / a sleep check-in keeps it; workouts are
// deduplicated by importId; activity days are replaced by the latest import.
export function mergeHealthImport(current, imp, { newId = () => Math.random().toString(36).slice(2) } = {}) {
  const bodyDays = new Set((current.bodyComp || []).map((b) => b.date));
  const sleepDays = new Set((current.energyLogs || []).filter((l) => l.sleepData?.sleepStartTime).map((l) => l.date));
  const importIds = new Set((current.workouts || []).map((w) => w.importId).filter(Boolean));

  const bodyComp = imp.weights.filter((w) => !bodyDays.has(w.date)).map((w) => ({
    id: newId(), date: w.date, time: '08:00', weightKg: w.weightKg, waistCm: null, neckCm: null, hipCm: null, heightCm: null,
    sex: current.sex || 'male', bodyFatPct: null, bodyFatMethod: null, photo: null, source: imp.source, createdAt: Date.now(),
  }));
  const sleepLogs = imp.sleep.filter((s) => !sleepDays.has(s.date) && s.sleepStartTime && s.wakeTime);
  const workouts = imp.workouts.filter((w) => !importIds.has(w.importId)).map((w) => ({
    id: newId(), date: w.date, type: w.type, category: w.type, sessionType: null, sessionId: null, exercise: w.exercise,
    durationMin: w.durationMin, sets: [], avgRpe: null, quality: null, cardio: w.distanceKm ? { distanceKm: w.distanceKm } : null,
    notes: '', importId: w.importId, source: imp.source, createdAt: Date.now(),
  }));
  const byDay = new Map((current.activityDays || []).map((d) => [d.date, d]));
  for (const d of imp.activity) byDay.set(d.date, { ...d, source: imp.source });
  return {
    bodyComp, sleepLogs, workouts,
    activityDays: [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    counts: { weights: bodyComp.length, sleep: sleepLogs.length, workouts: workouts.length, activityDays: imp.activity.length },
  };
}
