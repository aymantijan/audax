// Challenges between friends: what is measured and how one person's score is
// computed from their own data, over the challenge dates (up to today).
// Only { score, detail } leaves the device. Pure: tests/challenges.test.mjs.
import { habitCompliance } from './calculations.js';
import { dayAttendance } from './attendance.js';

export const CHALLENGE_METRICS = [
  { key: 'attendance', label: 'Cours à l’heure', unit: '%', hint: 'Part des cours où tu es arrivé·e à l’heure.' },
  { key: 'habits', label: 'Habitudes tenues', unit: '%', hint: 'Part de tes habitudes du jour cochées.' },
  { key: 'focus', label: 'Minutes de concentration', unit: 'min', hint: 'Temps total au minuteur (étude, deep work).' },
  { key: 'reading', label: 'Jours de lecture', unit: 'j', hint: 'Nombre de jours où tu as lu.' },
  { key: 'workouts', label: 'Séances de sport', unit: '', hint: 'Nombre de séances enregistrées.' },
];
export const metricOf = (key) => CHALLENGE_METRICS.find((m) => m.key === key) || CHALLENGE_METRICS[0];

const DAY = 86400000;
const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const inRange = (d, a, b) => d >= a && d <= b;

export function challengeScore(metric, data, { starts, ends, today }) {
  const to = today < ends ? today : ends;
  if (to < starts) return { score: 0, detail: 'pas encore commencé' };
  const days = Math.round((new Date(`${to}T12:00:00`) - new Date(`${starts}T12:00:00`)) / DAY) + 1;
  const { habits = [], logs = [], sessions = [], readLog = [], workouts = [], courses = [], academic = null, attendance = {} } = data;

  if (metric === 'attendance') {
    let req = 0;
    let ok = 0;
    for (let i = 0; i < days; i += 1) {
      const d = dayAttendance(courses, academic, attendance, addDays(starts, i));
      req += d.required;
      ok += d.onTime;
    }
    return req ? { score: Math.round((ok / req) * 100), detail: `${ok}/${req} cours` } : { score: 0, detail: 'aucun cours' };
  }
  if (metric === 'habits') {
    const c = habitCompliance(habits, logs, days, to);
    return c.total ? { score: Math.round(c.rate * 100), detail: `${c.completed}/${c.total}` } : { score: 0, detail: 'aucune habitude' };
  }
  if (metric === 'focus') {
    const min = sessions.filter((s) => inRange(s.date, starts, to)).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0);
    return { score: Math.round(min), detail: `${Math.floor(min / 60)} h ${Math.round(min % 60)}` };
  }
  if (metric === 'reading') {
    const n = new Set(readLog.filter((l) => inRange(l.date, starts, to)).map((l) => l.date)).size;
    return { score: n, detail: `sur ${days} j` };
  }
  const n = workouts.filter((w) => inRange(w.date, starts, to)).length;
  return { score: n, detail: `sur ${days} j` };
}

// Ranking: best score first; ties share the same place.
export function rankMembers(members) {
  const sorted = [...members].sort((a, b) => Number(b.score) - Number(a.score));
  let place = 0;
  let prev = null;
  return sorted.map((m, i) => {
    if (prev === null || Number(m.score) !== prev) { place = i + 1; prev = Number(m.score); }
    return { ...m, place };
  });
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, easy to read aloud
export function makeCode(random = Math.random) {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
}
