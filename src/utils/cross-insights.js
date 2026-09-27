// Links between sections (étape 5): does a good night change the next day's
// trading, class punctuality or focus? Compares days after a night of 7 h+
// with days after a short night (< 6 h 30). Says nothing below 5 days in each
// group: a pattern, not a verdict. Pure: tests/cross-insights.test.mjs.
import { sleepHoursOf } from './life-review.js';
import { dayAttendance } from './attendance.js';

export const MIN_DAYS = 5;
const GOOD = 7;
const SHORT = 6.5;

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// { date → hours slept the night before that day } (check-ins are logged in the morning).
export function sleepByDay(energyLogs) {
  const out = {};
  for (const l of energyLogs || []) {
    const h = sleepHoursOf(l);
    if (h != null) out[l.date] = h;
  }
  return out;
}

function compare(sleep, valueByDay) {
  const good = [];
  const short = [];
  for (const [date, v] of Object.entries(valueByDay)) {
    const h = sleep[date];
    if (h == null || v == null) continue;
    if (h >= GOOD) good.push(v);
    else if (h < SHORT) short.push(v);
  }
  if (good.length < MIN_DAYS || short.length < MIN_DAYS) return null;
  return { good: avg(good), short: avg(short), nGood: good.length, nShort: short.length };
}

export function crossInsights({ energyLogs = [], trades = [], sessions = [], courses, academic, attendance, formatMoney = (v) => String(Math.round(v)) }) {
  const sleep = sleepByDay(energyLogs);
  const out = [];

  const pnl = {};
  for (const t of trades) pnl[t.date] = (pnl[t.date] || 0) + (Number(t.pnl) || 0);
  const tr = compare(sleep, pnl);
  if (tr) {
    out.push({
      key: 'trading', better: tr.good >= tr.short,
      text: `Trading : ${formatMoney(Math.round(tr.good))} par jour en moyenne après une nuit de 7 h ou plus, contre ${formatMoney(Math.round(tr.short))} après une nuit courte.`,
      detail: `${tr.nGood} jours contre ${tr.nShort}`,
    });
  }

  const focus = {};
  for (const s of sessions) focus[s.date] = (focus[s.date] || 0) + (Number(s.durationMinutes) || 0);
  const fo = compare(sleep, focus);
  if (fo) {
    out.push({
      key: 'focus', better: fo.good >= fo.short,
      text: `Concentration : ${Math.round(fo.good)} min par jour après une bonne nuit, contre ${Math.round(fo.short)} min après une nuit courte.`,
      detail: `${fo.nGood} jours contre ${fo.nShort}`,
    });
  }

  if (courses && academic) {
    const onTime = {};
    for (const date of Object.keys(sleep)) {
      const d = dayAttendance(courses, academic, attendance || {}, date);
      if (d.required) onTime[date] = (d.onTime / d.required) * 100;
    }
    const at = compare(sleep, onTime);
    if (at) {
      out.push({
        key: 'attendance', better: at.good >= at.short,
        text: `Cours : à l’heure ${Math.round(at.good)} % du temps après une bonne nuit, contre ${Math.round(at.short)} % après une nuit courte.`,
        detail: `${at.nGood} jours contre ${at.nShort}`,
      });
    }
  }
  return out;
}
