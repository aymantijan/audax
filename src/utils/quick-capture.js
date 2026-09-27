// Universal capture: one free sentence ("payé 120 courses", "couru 5 km en
// 28 min", "poids 72,4") → a DRAFT to confirm. Nothing is saved here.
//
// parseCapture(text, ctx) reads the common phrasings with plain rules (free,
// instant, offline). When it returns null, the caller may ask the AI, whose
// JSON goes through normalizeDraft too — so every draft, whoever wrote it, is
// checked the same way. Drafts name habits/courses/clients; normalizeDraft
// resolves those names to ids from ctx.
//
// ctx: { today: 'YYYY-MM-DD', habits: [{id,name,kind?,target?}], courses: [{id,name}],
//        clients: [{id,name}], weightUnit: 'kg'|'lb' }
//
// Draft kinds:
//   expense | income  { amount, currency|null, label, date }
//   freelance         { clientId, client, amount, label, date }
//   workout           { type: cardio|strength|sport, exercise, durationMin, distanceKm|null, date }
//   weight            { weightKg, date }
//   sleep             { hours, date }
//   water             { ml, date }
//   study             { minutes, courseId|null, course|null, label, date }
//   habit             { habitId, habit, value|null, date }

export const CAPTURE_KINDS = {
  expense: { label: 'Dépense', where: 'Finances' },
  income: { label: 'Revenu', where: 'Finances' },
  freelance: { label: 'Encaissement client', where: 'Freelance → Finances' },
  workout: { label: 'Séance de sport', where: 'Santé' },
  weight: { label: 'Poids', where: 'Santé' },
  sleep: { label: 'Sommeil', where: 'Santé' },
  water: { label: 'Eau', where: 'Santé' },
  study: { label: 'Séance de travail', where: 'Études' },
  habit: { label: 'Habitude', where: 'Habitudes' },
};

export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

const r2 = (n) => Math.round(n * 100) / 100;
const toNum = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));

function shiftDay(key, days) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CURRENCY_WORDS = [
  [/^(€|eur|euros?)$/, 'EUR'], [/^(\$|usd|dollars?)$/, 'USD'], [/^(dh|dhs|mad|dirhams?)$/, 'MAD'],
  [/^(£|gbp|livres?)$/, 'GBP'], [/^(chf|francs? suisses?)$/, 'CHF'], [/^(cad)$/, 'CAD'],
  [/^(fcfa|xof|cfa)$/, 'XOF'], [/^(tnd|dinars? tunisiens?)$/, 'TND'], [/^(dzd|dinars? algeriens?)$/, 'DZD'],
];
const CUR_RE = '€|\\$|£|eur|euros?|usd|dollars?|dhs?|mad|dirhams?|gbp|chf|cad|fcfa|xof|cfa|tnd|dzd';
const currencyOf = (w) => (w ? (CURRENCY_WORDS.find(([re]) => re.test(w.trim()))?.[1] ?? null) : null);

// Date words, removed from the text once read.
function readDate(t, today) {
  let date = today;
  let rest = t;
  const rules = [
    [/\bavant[- ]hier\b/, -2], [/\bhier( soir| matin)?\b/, -1], [/\baujourd hui\b|\bce (matin|soir)\b/, 0],
  ];
  for (const [re, d] of rules) if (re.test(rest)) { date = shiftDay(today, d); rest = rest.replace(re, ' '); break; }
  const m = rest.match(/\ble (\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : today.slice(0, 4);
    const k = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!Number.isNaN(new Date(`${k}T12:00:00`).getTime())) { date = k; rest = rest.replace(m[0], ' '); }
  }
  return { date, rest };
}

// "1h30", "1 h 15", "45 min", "1,5 h", "2 heures" → minutes.
function readDuration(t) {
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|heures?)\s*(\d{1,2})?\s*(?:min(?:utes?)?)?(?![a-z])/);
  if (m) return { minutes: Math.round(toNum(m[1]) * 60 + (m[2] ? Number(m[2]) : 0)), text: m[0] };
  m = t.match(/(\d+)\s*(?:min(?:utes?)?|mn)\b/);
  if (m) return { minutes: Number(m[1]), text: m[0] };
  return null;
}

// First amount with its currency: "120", "3 000 dh", "45,50 €", "$20", "2k".
function readAmount(t) {
  const re = new RegExp(`(?:(${CUR_RE})\\s*)?(\\d{1,3}(?:[  ]\\d{3})+|\\d+(?:[.,]\\d{1,2})?)\\s*(k\\b)?\\s*(${CUR_RE})?(?![a-z0-9])`);
  const m = t.match(re);
  if (!m) return null;
  let amount = toNum(m[2]);
  if (m[3]) amount *= 1000;
  return { amount: r2(amount), currency: currencyOf(m[4] || m[1]), text: m[0] };
}

const STOP = new Set(['de', 'du', 'des', 'd', 'le', 'la', 'les', 'l', 'un', 'une', 'pour', 'en', 'au', 'aux', 'a', 'et', 'avec', 'mon', 'ma', 'mes', 'j', 'je', 'ai', 'sur', 'par', 'chez']);
const cleanLabel = (s) => {
  const words = fold(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  while (words.length && STOP.has(words[0])) words.shift();
  while (words.length && STOP.has(words[words.length - 1])) words.pop();
  const out = words.join(' ');
  return out ? out[0].toUpperCase() + out.slice(1) : '';
};

// Longest name of `list` contained in the folded text.
function findByName(t, list) {
  let best = null;
  for (const x of list || []) {
    const n = fold(x.name);
    if (n.length < 2) continue;
    if (new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t) && (!best || n.length > fold(best.name).length)) best = x;
  }
  return best;
}

const SPORTS = [
  [/\b(couru|cours a pied|course a pied|footing|jogging|run|running)\b/, 'cardio', 'Course à pied'],
  [/\b(velo|cyclisme|spinning|vtt)\b/, 'cardio', 'Vélo'],
  [/\b(nage|natation|piscine)\b/, 'cardio', 'Natation'],
  [/\b(marche|rando|randonnee)\b/, 'cardio', 'Marche'],
  [/\b(rameur|elliptique|hiit|cardio|corde a sauter)\b/, 'cardio', 'Cardio'],
  [/\b(muscu|musculation|salle|gym|crossfit|renfo|renforcement)\b/, 'strength', 'Musculation'],
  [/\b(yoga|pilates|etirements|stretching)\b/, 'sport', 'Yoga / mobilité'],
  [/\b(foot|football|futsal)\b/, 'sport', 'Football'],
  [/\b(basket|basketball)\b/, 'sport', 'Basket'],
  [/\b(tennis|padel|squash|badminton)\b/, 'sport', 'Raquette'],
  [/\b(boxe|mma|judo|karate|lutte|jiu)\b/, 'sport', 'Sport de combat'],
];

const EXPENSE_VERBS = /\b(paye|payee|depense|achete|achat|regle|facture de|ticket)\b/;
const INCOME_VERBS = /\b(recu|gagne|encaisse|touche|salaire|virement recu|rembourse|prime|bourse)\b/;
const HABIT_DONE = /\b(fait|faite|faits|coche|cochee|ok|termine|terminee|done|valide|validee)\b/;

export function parseCapture(text, ctx = {}) {
  const today = ctx.today || new Date().toISOString().slice(0, 10);
  const raw = fold(text);
  if (!raw) return null;
  const { date, rest } = readDate(raw, today);
  const t = ` ${rest.replace(/\s+/g, ' ').trim()} `;

  // Weight: "poids 72,4", "je pèse 72 kg", "72,4 kg".
  let m = t.match(/\b(?:poids|pese|je pese|pesee)\b[^\d]*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|lbs?|livres?)?/) || t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?)\b(?!.*\b(soulev|develop|squat|bench))/);
  if (m && !SPORTS.some(([re]) => re.test(t))) {
    let kg = toNum(m[1]);
    if ((m[2] && /^(lb|livre)/.test(m[2])) || (!m[2] && ctx.weightUnit === 'lb')) kg = kg / 2.20462;
    return normalizeDraft({ kind: 'weight', weightKg: kg, date }, ctx);
  }

  // Sleep: "dormi 7h30", "nuit de 6 h".
  if (/\b(dormi|sommeil|nuit de|couche)\b/.test(t)) {
    const d = readDuration(t);
    if (d) return normalizeDraft({ kind: 'sleep', hours: d.minutes / 60, date }, ctx);
  }

  // Water: "bu 1,5 l d'eau", "2 verres d'eau", "500 ml".
  if (/\b(eau|bu|hydrat)/.test(t)) {
    m = t.match(/(\d+(?:[.,]\d+)?)\s*(l|litres?|ml|cl|verres?|bouteilles?)\b/);
    if (m) {
      const n = toNum(m[1]);
      const ml = /^ml/.test(m[2]) ? n : /^cl/.test(m[2]) ? n * 10 : /^verre/.test(m[2]) ? n * 250 : /^bouteille/.test(m[2]) ? n * 500 : n * 1000;
      return normalizeDraft({ kind: 'water', ml, date }, ctx);
    }
  }

  // Workout: a sport word, with a duration and/or a distance.
  const sport = SPORTS.find(([re]) => re.test(t));
  if (sport) {
    const d = readDuration(t);
    const km = t.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
    if (d || km || /\b(seance|entrainement|fait|faite)\b/.test(t)) {
      return normalizeDraft({ kind: 'workout', type: sport[1], exercise: sport[2], durationMin: d?.minutes || 0, distanceKm: km ? toNum(km[1]) : null, date }, ctx);
    }
  }

  // Study / focused work: "révisé IFRS 45 min", "travaillé 2 h sur le mémoire".
  if (/\b(revise|revision|reviser|etudie|etude|bosse|travaille|lu|lecture|cours de|appris)\b/.test(t)) {
    const d = readDuration(t);
    if (d) {
      const course = findByName(t, ctx.courses);
      const label = cleanLabel((course ? t.replace(fold(course.name), ' ') : t).replace(d.text, ' ').replace(/\b(j ai|revise|revision|reviser|etudie|etude|bosse|travaille|lu|lecture|appris)\b/g, ' '));
      return normalizeDraft({ kind: 'study', minutes: d.minutes, course: course?.name || null, label, date }, ctx);
    }
  }

  const amount = readAmount(t);

  // A client paid me: a known client's name + an amount + "reçu/encaissé/payé par".
  const client = findByName(t, ctx.clients);
  if (client && amount && (INCOME_VERBS.test(t) || /\bpaye par\b/.test(t))) {
    const label = cleanLabel(t.replace(amount.text, ' ').replace(new RegExp(fold(client.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ').replace(INCOME_VERBS, ' ').replace(/\b(client|paye par|par)\b/g, ' '));
    return normalizeDraft({ kind: 'freelance', client: client.name, amount: amount.amount, label, date }, ctx);
  }

  // Habit: its name, alone or with "fait", or a value for a measured habit.
  const habit = findByName(t, ctx.habits);
  if (habit && (!amount || !amount.currency)) {
    const rest2 = t.replace(fold(habit.name), ' ');
    const measured = habit.kind === 'quantity';
    if (HABIT_DONE.test(rest2) || !rest2.replace(/[^a-z0-9]/g, '') || (measured && amount)) {
      return normalizeDraft({ kind: 'habit', habit: habit.name, value: measured && amount ? amount.amount : null, date }, ctx);
    }
  }

  // Money: an amount and some words.
  if (amount) {
    const kind = INCOME_VERBS.test(t) && !EXPENSE_VERBS.test(t) ? 'income' : 'expense';
    const label = cleanLabel(t.replace(amount.text, ' ').replace(EXPENSE_VERBS, ' ').replace(/\b(recu|gagne|encaisse|touche)\b/g, ' '));
    if (!label) return null;
    return normalizeDraft({ kind, amount: amount.amount, currency: amount.currency, label, date }, ctx);
  }
  return null;
}

// Checks and completes a draft from the rules or the AI. Returns null when it
// cannot be saved as is (unknown kind, missing amount, unknown habit…).
export function normalizeDraft(d, ctx = {}) {
  if (!d || !CAPTURE_KINDS[d.kind]) return null;
  const today = ctx.today || new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && d.date <= today ? d.date : today;
  const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
  const text = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const byName = (list, name) => {
    const f = fold(name);
    return f ? (list || []).find((x) => fold(x.name) === f) || (list || []).find((x) => fold(x.name).includes(f) || f.includes(fold(x.name))) || null : null;
  };
  switch (d.kind) {
    case 'expense':
    case 'income': {
      const amount = r2(n(d.amount));
      if (!(amount > 0)) return null;
      const currency = /^[A-Z]{3}$/.test(d.currency || '') ? d.currency : null;
      return { kind: d.kind, amount, currency, label: text(d.label) || (d.kind === 'expense' ? 'Dépense' : 'Revenu'), date };
    }
    case 'freelance': {
      const c = ctx.clients?.find((x) => x.id === d.clientId) || byName(ctx.clients, d.client);
      const amount = r2(n(d.amount));
      if (!c || !(amount > 0)) return null;
      return { kind: 'freelance', clientId: c.id, client: c.name, amount, label: text(d.label), date };
    }
    case 'workout': {
      const type = ['cardio', 'strength', 'sport'].includes(d.type) ? d.type : 'sport';
      const durationMin = Math.round(n(d.durationMin));
      const distanceKm = n(d.distanceKm) > 0 ? r2(n(d.distanceKm)) : null;
      if (durationMin < 0 || durationMin > 24 * 60) return null;
      return { kind: 'workout', type, exercise: text(d.exercise, 40) || 'Séance', durationMin, distanceKm, date };
    }
    case 'weight': {
      const weightKg = Math.round(n(d.weightKg) * 10) / 10;
      if (!(weightKg >= 20 && weightKg <= 350)) return null;
      return { kind: 'weight', weightKg, date };
    }
    case 'sleep': {
      const hours = Math.round(n(d.hours) * 100) / 100;
      if (!(hours > 0 && hours <= 16)) return null;
      return { kind: 'sleep', hours, date };
    }
    case 'water': {
      const ml = Math.round(n(d.ml));
      if (!(ml > 0 && ml <= 10000)) return null;
      return { kind: 'water', ml, date };
    }
    case 'study': {
      const minutes = Math.round(n(d.minutes));
      if (!(minutes > 0 && minutes <= 16 * 60)) return null;
      const c = ctx.courses?.find((x) => x.id === d.courseId) || byName(ctx.courses, d.course);
      return { kind: 'study', minutes, courseId: c?.id || null, course: c?.name || null, label: text(d.label), date };
    }
    case 'habit': {
      const h = ctx.habits?.find((x) => x.id === d.habitId) || byName(ctx.habits, d.habit);
      if (!h) return null;
      const value = d.value != null && n(d.value) > 0 ? n(d.value) : null;
      return { kind: 'habit', habitId: h.id, habit: h.name, value, date };
    }
    default:
      return null;
  }
}

// One line describing a draft, for the confirmation card.
export function describeDraft(d, fmtMoney = (a, c) => `${a}${c ? ` ${c}` : ''}`) {
  const h = (x) => { const hh = Math.floor(x); const mm = Math.round((x - hh) * 60); return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`; };
  const min = (m) => (m >= 60 ? h(m / 60) : `${m} min`);
  switch (d.kind) {
    case 'expense': case 'income': return `${d.label} · ${fmtMoney(d.amount, d.currency)}`;
    case 'freelance': return `${d.client}${d.label ? ` · ${d.label}` : ''} · ${fmtMoney(d.amount, null)}`;
    case 'workout': return [d.exercise, d.distanceKm ? `${String(d.distanceKm).replace('.', ',')} km` : null, d.durationMin ? min(d.durationMin) : null].filter(Boolean).join(' · ');
    case 'weight': return `${String(d.weightKg).replace('.', ',')} kg`;
    case 'sleep': return h(d.hours);
    case 'water': return d.ml >= 1000 ? `${String(r2(d.ml / 1000)).replace('.', ',')} L` : `${d.ml} ml`;
    case 'study': return [d.course || d.label || 'Travail', min(d.minutes)].join(' · ');
    case 'habit': return `${d.habit}${d.value != null ? ` · ${String(d.value).replace('.', ',')}` : ' · faite'}`;
    default: return '';
  }
}
