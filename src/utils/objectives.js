// Plan de l'année (étape 5): objectives on three horizons — year → quarter →
// week — each linked to its parent and optionally to habits. Stored in
// habitStore.objectives (synced with the rest of the habits).
// objective: { id, horizon: 'year'|'quarter'|'week', period, title, parentId, habitIds[], done, createdAt }
// Pure: tests/objectives.test.mjs.
import { habitCompliance } from './calculations.js';

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ISO week number (weeks start on Monday; week 1 holds the first Thursday).
export function isoWeek(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / DAY + 1) / 7) };
}

export function periodOf(horizon, key) {
  const [y, m] = key.split('-').map(Number);
  if (horizon === 'year') return String(y);
  if (horizon === 'quarter') return `${y}-T${Math.floor((m - 1) / 3) + 1}`;
  const { year, week } = isoWeek(key);
  return `${year}-S${pad(week)}`;
}

// First and last day of a period ('2026', '2026-T4', '2026-S40').
export function periodRange(period) {
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  const q = period.match(/^(\d{4})-T(\d)$/);
  if (q) {
    const y = Number(q[1]); const startM = (Number(q[2]) - 1) * 3;
    return { from: iso(new Date(y, startM, 1, 12)), to: iso(new Date(y, startM + 3, 0, 12)) };
  }
  const w = period.match(/^(\d{4})-S(\d{2})$/);
  const y = Number(w[1]); const week = Number(w[2]);
  const jan4 = new Date(y, 0, 4, 12);
  const monday = new Date(jan4.getTime() - ((jan4.getDay() + 6) % 7) * DAY + (week - 1) * 7 * DAY);
  return { from: iso(monday), to: iso(new Date(monday.getTime() + 6 * DAY)) };
}

export const HORIZONS = [
  { key: 'year', label: 'Année', child: 'quarter' },
  { key: 'quarter', label: 'Trimestre', child: 'week' },
  { key: 'week', label: 'Semaine', child: null },
];

export function periodLabel(period) {
  if (/^\d{4}$/.test(period)) return period;
  const q = period.match(/^(\d{4})-T(\d)$/);
  if (q) return `${q[2]}${q[2] === '1' ? 'er' : 'e'} trimestre ${q[1]}`;
  const w = period.match(/^(\d{4})-S(\d{2})$/);
  return `semaine ${Number(w[2])}`;
}

// Progress 0-100: the average of its children when it has some; otherwise the
// habits it is linked to over the period lived so far; otherwise done or not.
export function objectiveProgress(obj, all, { habits = [], logs = [], today }) {
  if (obj.done) return 100;
  const children = all.filter((o) => o.parentId === obj.id);
  if (children.length) {
    return Math.round(children.reduce((a, c) => a + objectiveProgress(c, all, { habits, logs, today }), 0) / children.length);
  }
  const linked = habits.filter((h) => (obj.habitIds || []).includes(h.id));
  if (linked.length) {
    const { from, to } = periodRange(obj.period);
    const end = today < to ? today : to;
    if (end < from) return 0;
    const days = Math.round((new Date(`${end}T12:00:00`) - new Date(`${from}T12:00:00`)) / DAY) + 1;
    const c = habitCompliance(linked, logs, days, end);
    return c.total ? Math.round(c.rate * 100) : 0;
  }
  return 0;
}
