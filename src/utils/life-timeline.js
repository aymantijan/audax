// Chronologie (phase 2, partie 11): everything the person noted, on one line
// of time, and the links between sections measured on their own days.
// Pure: tests/life-timeline.test.mjs. The page gathers the data from the
// stores (services/life-timeline.js) and passes it in.
//
// data = { journal, trades, workouts, bodyComp, energyLogs, habits, habitLogs,
//          sessions, courses, attendance, payments: [{date, amount, client, currency}] }
import { classOf } from './chart-of-accounts.js';
import { sleepHoursOf } from './life-review.js';
import { ATTENDANCE_STATUS } from './attendance.js';

export const DOMAINS = {
  etudes: { label: 'Études' },
  sante: { label: 'Santé' },
  argent: { label: 'Argent' },
  trading: { label: 'Trading' },
  habitudes: { label: 'Habitudes' },
};

const r1 = (n) => Math.round(n * 10) / 10;
const fmtH = (h) => { const hh = Math.floor(h); const mm = Math.round((h - hh) * 60); return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`; };

// ── The timeline ──
// → [{ id, date, time, domain, kind, title, detail, amount?, to }] newest first.
export function buildEvents(data, { money = (n) => String(n) } = {}) {
  const ev = [];
  const push = (e) => { if (e.date) ev.push(e); };

  for (const e of data.journal || []) {
    const spent = e.lines.filter((l) => classOf(l.account) === 6).reduce((s, l) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
    const earned = e.lines.filter((l) => classOf(l.account) === 7).reduce((s, l) => s + (Number(l.credit) || 0) - (Number(l.debit) || 0), 0);
    if (spent > 0) push({ id: `j-${e.id}`, date: e.date, domain: 'argent', kind: 'expense', title: e.label || 'Dépense', detail: `− ${money(spent)}`, amount: -spent, to: '/finance?tab=journal' });
    else if (earned > 0) push({ id: `j-${e.id}`, date: e.date, domain: 'argent', kind: 'income', title: e.label || 'Revenu', detail: `+ ${money(earned)}`, amount: earned, to: '/finance?tab=journal' });
  }
  for (const p of data.payments || []) {
    push({ id: `p-${p.id}`, date: p.date, domain: 'argent', kind: 'payment', title: `Encaissement · ${p.client}`, detail: `+ ${money(p.amount, p.currency)}`, to: '/freelance' });
  }
  for (const t of data.trades || []) {
    const pnl = Number(t.pnl) || 0;
    push({ id: `t-${t.id}`, date: t.date, domain: 'trading', kind: 'trade', title: `Trade · ${t.instrument || '—'}`, detail: `${pnl >= 0 ? '+' : '−'} ${money(Math.abs(pnl), t.currency)}`, amount: pnl, to: '/trading' });
  }
  for (const w of data.workouts || []) {
    const bits = [w.cardio?.distance ? `${String(w.cardio.distance).replace('.', ',')} km` : null, w.durationMin ? `${w.durationMin} min` : null].filter(Boolean);
    push({ id: `w-${w.id}`, date: w.date, domain: 'sante', kind: 'workout', title: w.exercise || 'Séance de sport', detail: bits.join(' · '), to: '/health' });
  }
  for (const b of data.bodyComp || []) {
    if (b.weightKg) push({ id: `b-${b.id}`, date: b.date, time: b.time, domain: 'sante', kind: 'weight', title: 'Poids', detail: `${String(b.weightKg).replace('.', ',')} kg`, to: '/health' });
  }
  for (const l of data.energyLogs || []) {
    const h = sleepHoursOf(l);
    if (h != null) push({ id: `s-${l.date}`, date: l.date, domain: 'sante', kind: 'sleep', title: 'Sommeil', detail: fmtH(h), to: '/health' });
  }
  const habitName = new Map((data.habits || []).map((h) => [h.id, h.name]));
  for (const l of data.habitLogs || []) {
    if (l.completed && habitName.has(l.habitId)) push({ id: `h-${l.habitId}-${l.date}`, date: l.date, domain: 'habitudes', kind: 'habit', title: habitName.get(l.habitId), detail: l.value != null ? String(l.value).replace('.', ',') : 'faite', to: '/habits' });
  }
  const courseName = new Map((data.courses || []).map((c) => [c.id, c.name]));
  for (const s of data.sessions || []) {
    push({ id: `f-${s.id}`, date: s.date, domain: 'etudes', kind: 'study', title: courseName.get(s.courseId) || s.notes || 'Séance de travail', detail: `${s.durationMinutes} min`, to: '/learning' });
  }
  for (const [key, rec] of Object.entries(data.attendance || {})) {
    const [courseId, , date] = key.split('|');
    const st = ATTENDANCE_STATUS[rec?.status];
    if (!st || !date || !courseName.has(courseId)) continue;
    push({ id: `a-${key}`, date, domain: 'etudes', kind: 'class', title: `Cours · ${courseName.get(courseId)}`, detail: st.label, to: '/learning' });
  }
  return ev.sort((a, b) => (a.date === b.date ? String(b.time || '').localeCompare(String(a.time || '')) : a.date < b.date ? 1 : -1));
}

// ── Daily values ──
const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// { date → { sleep, sportMin, sport, study, onTime, spend, pnl, energy, habits: Set } }
// A value is only present when that section was really used that day (or
// since the person started using it, for sums like spending and study).
export function dailyValues(data) {
  const days = {};
  const day = (d) => (days[d] ||= { habits: new Set() });

  for (const l of data.energyLogs || []) {
    const h = sleepHoursOf(l);
    if (h != null) day(l.date).sleep = h;
    const e = Number(l.energyStartLevel);
    if (e > 0) day(l.date).energy = e;
  }
  for (const w of data.workouts || []) { const d = day(w.date); d.sportMin = (d.sportMin || 0) + (Number(w.durationMin) || 0); d.sport = true; }
  for (const s of data.sessions || []) { const d = day(s.date); d.study = (d.study || 0) + (Number(s.durationMinutes) || 0); }
  for (const t of data.trades || []) { const d = day(t.date); d.pnl = (d.pnl || 0) + (Number(t.pnl) || 0); }
  for (const e of data.journal || []) {
    const spent = e.lines.filter((l) => classOf(l.account) === 6).reduce((s, l) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0);
    if (spent > 0) { const d = day(e.date); d.spend = (d.spend || 0) + spent; }
  }
  for (const l of data.habitLogs || []) if (l.completed) day(l.date).habits.add(l.habitId);
  const att = {};
  for (const [key, rec] of Object.entries(data.attendance || {})) {
    const date = key.split('|')[2];
    const st = ATTENDANCE_STATUS[rec?.status];
    if (!date || !st || st.neutral) continue;
    const a = (att[date] ||= { n: 0, ok: 0 });
    a.n += 1; if (rec.status === 'on_time') a.ok += 1;
  }
  for (const [date, a] of Object.entries(att)) day(date).onTime = (a.ok / a.n) * 100;

  // Sums that are zero on a day with nothing noted, from the first day used.
  const first = (key) => Object.keys(days).filter((d) => days[d][key] != null).sort()[0];
  const all = Object.keys(days).sort();
  const last = all[all.length - 1];
  for (const key of ['study', 'spend', 'sportMin']) {
    const f = first(key);
    if (!f) continue;
    for (let d = f; d <= last; d = addDays(d, 1)) { const x = day(d); if (x[key] == null) x[key] = 0; if (key === 'sportMin' && x.sport == null) x.sport = false; }
  }
  return days;
}

// ── Links ──
export const MIN_DAYS = 10;
export const MIN_EFFECT = 0.4; // difference / pooled standard deviation
export const MIN_RELATIVE = 0.1; // and at least 10 % apart: 16 vs 17 is not a finding

// What changes on a day…
const OUTCOMES = {
  study: { label: 'de travail / révision', unit: 'min', fmt: (v) => `${Math.round(v)} min` },
  pnl: { label: 'de résultat de trading', fmt: (v, money) => money(Math.round(v)) },
  onTime: { label: 'des cours à l’heure', fmt: (v) => `${Math.round(v)} %` },
  spend: { label: 'de dépenses', fmt: (v, money) => money(Math.round(v)) },
  energy: { label: 'd’énergie au réveil', fmt: (v) => `${r1(v).toString().replace('.', ',')}/10` },
  sleep: { label: 'de sommeil', fmt: (v) => fmtH(v) },
};

// …depending on a condition. lag = the outcome is read that many days later.
function conditions(data) {
  const list = [
    { key: 'sleep', lag: 0, test: (d) => (d.sleep == null ? null : d.sleep >= 7 ? true : d.sleep < 6.5 ? false : null), with: 'après une nuit de 7 h ou plus', without: 'après une nuit de moins de 6 h 30', outcomes: ['study', 'pnl', 'onTime', 'spend', 'energy'] },
    { key: 'sport', lag: 0, test: (d) => d.sport ?? null, with: 'les jours avec sport', without: 'les jours sans sport', outcomes: ['study', 'spend'] },
    { key: 'sport-next', lag: 1, test: (d) => d.sport ?? null, with: 'le lendemain d’un jour avec sport', without: 'le lendemain d’un jour sans sport', outcomes: ['study', 'pnl', 'onTime', 'energy', 'sleep'] },
  ];
  for (const h of (data.habits || []).filter((x) => !x.archived && x.kind !== 'quit')) {
    const since = (data.habitLogs || []).filter((l) => l.habitId === h.id).map((l) => l.date).sort()[0];
    if (!since) continue;
    list.push({
      key: `habit-${h.id}`, lag: 0, habit: h.name,
      test: (d, date) => (date < since ? null : d.habits.has(h.id)),
      with: `les jours où « ${h.name} » est faite`, without: 'les autres jours', outcomes: ['study', 'pnl', 'spend', 'energy'],
    });
  }
  return list;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs, m) => Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));

// → { findings: [{ key, text, detail, better, a, b, nWith, nWithout, effect, days: {with: [{date, value}], without} }],
//     waiting: [{ key, text }] } — findings strongest first.
// `today`: that day is not over yet, so it is left out of every comparison.
export function lifeLinks(data, { money = (n) => String(n), days: given, today = null } = {}) {
  const days = given || dailyValues(data);
  const dates = Object.keys(days).sort();
  const findings = [];
  const waiting = [];
  for (const c of conditions(data)) {
    let best = 0;
    for (const o of c.outcomes) {
      const withD = []; const withoutD = [];
      for (const date of dates) {
        const cond = c.test(days[date], date);
        if (cond == null) continue;
        const target = c.lag ? addDays(date, c.lag) : date;
        if (today && target >= today) continue;
        const v = days[target]?.[o];
        if (v == null) continue;
        (cond ? withD : withoutD).push({ date: target, value: v });
      }
      best = Math.max(best, Math.min(withD.length, withoutD.length));
      if (withD.length < MIN_DAYS || withoutD.length < MIN_DAYS) continue;
      const a = mean(withD.map((x) => x.value)); const b = mean(withoutD.map((x) => x.value));
      const pooled = Math.sqrt((sd(withD.map((x) => x.value), a) ** 2 + sd(withoutD.map((x) => x.value), b) ** 2) / 2);
      const effect = pooled ? Math.abs(a - b) / pooled : 0;
      if (effect < MIN_EFFECT || Math.abs(a - b) < MIN_RELATIVE * Math.max(Math.abs(a), Math.abs(b))) continue;
      const O = OUTCOMES[o];
      const good = o === 'spend' ? a < b : a > b;
      findings.push({
        key: `${c.key}:${o}`, condition: c.key, outcome: o, better: good, a, b, nWith: withD.length, nWithout: withoutD.length, effect,
        text: `${c.with[0].toUpperCase()}${c.with.slice(1)} : ${O.fmt(a, money)} ${O.label} en moyenne, contre ${O.fmt(b, money)} ${c.without}.`,
        detail: `${withD.length} jours contre ${withoutD.length}`,
        days: { with: withD, without: withoutD },
      });
    }
    if (best < MIN_DAYS && !c.habit) {
      waiting.push({ key: c.key, text: `${c.with[0].toUpperCase()}${c.with.slice(1)} / ${c.without} : ${best} jour(s) comparables de chaque côté pour l’instant, il en faut ${MIN_DAYS}.` });
    }
  }
  findings.sort((x, y) => y.effect - x.effect);
  return { findings, waiting };
}
