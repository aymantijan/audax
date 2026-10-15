// « Santé du quotidien » (chantier 7): medications, medical measures,
// appointments and documents, emergency card. Pure functions, used by the
// screens, the Today card and the push reminders (api/class-reminders.js).
// Tested in tests/care.test.mjs. Informational only, never a diagnosis.

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dayOf = (key) => WEEKDAYS[new Date(`${key}T12:00:00`).getDay()];
export const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

// ─────────── Medications ───────────
// med: { id, name, dose ('1 comprimé'), times: ['08:00','20:00'], frequency: 'daily'|'weekdays'|'asNeeded',
//        weekdays: ['mon',…], startDate, endDate|null, stock|null, stockDate, perDose (units per dose, default 1),
//        notes, active }
// log: { id, medId, date, time ('08:00' or null for as-needed), status: 'taken'|'skipped', at }

export function isMedOn(med, key) {
  if (!med || med.active === false) return false;
  if (med.startDate && key < med.startDate) return false;
  if (med.endDate && key > med.endDate) return false;
  if (med.frequency === 'asNeeded') return false;
  if (med.frequency === 'weekdays') return (med.weekdays || []).includes(dayOf(key));
  return true;
}

// Every planned dose of a day, in time order, with what was noted.
export function dosesOn(meds = [], logs = [], key) {
  const out = [];
  for (const med of meds) {
    if (!isMedOn(med, key)) continue;
    const times = med.times?.length ? med.times : [null];
    for (const time of times) {
      const log = logs.find((l) => l.medId === med.id && l.date === key && (l.time || null) === time);
      out.push({ med, time, status: log?.status || null, log: log || null });
    }
  }
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.med.name.localeCompare(b.med.name));
}

const perDayOf = (med) => {
  if (med.frequency === 'asNeeded') return 0;
  const perDose = Number(med.perDose) || 1;
  const n = (med.times?.length || 1) * perDose;
  return med.frequency === 'weekdays' ? (n * (med.weekdays?.length || 0)) / 7 : n;
};

// Units left: stock entered on stockDate minus what was taken since.
export function stockLeft(med, logs = []) {
  if (med?.stock == null || med.stock === '') return null;
  const perDose = Number(med.perDose) || 1;
  const taken = logs.filter((l) => l.medId === med.id && l.status === 'taken' && (!med.stockDate || l.date >= med.stockDate)).length;
  return Math.max(0, Number(med.stock) - taken * perDose);
}

// { left, days } — days of treatment left at the planned pace (null when unknown).
export function stockStatus(med, logs = []) {
  const left = stockLeft(med, logs);
  if (left == null) return null;
  const perDay = perDayOf(med);
  return { left, days: perDay > 0 ? Math.floor(left / perDay) : null, low: perDay > 0 && left / perDay <= 7 };
}

// Share of planned doses noted as taken over a period (for the doctor).
// On the last day, a dose not due yet (after `nowTime`) and not noted is left out.
export function adherence(meds = [], logs = [], from, to, nowTime = null) {
  let planned = 0;
  let taken = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    for (const d of dosesOn(meds, logs, k)) {
      if (k === to && nowTime && !d.status && d.time && d.time > nowTime) continue;
      planned += 1;
      if (d.status === 'taken') taken += 1;
    }
  }
  return { planned, taken, pct: planned ? Math.round((taken / planned) * 100) : null };
}

// ─────────── Medical measures ───────────
// Zones from public references (ACC/AHA 2017 blood pressure, ADA glucose,
// usual adult ranges). Shown with « ce n’est pas un diagnostic ».
export const VITALS = {
  bp: { label: 'Tension artérielle', unit: 'mmHg', fields: ['systolic', 'diastolic'], help: 'Deux chiffres : le grand (systolique) et le petit (diastolique). Assis, au calme, depuis 5 minutes.' },
  glucose: { label: 'Glycémie', unit: 'mg/dL', fields: ['value'], help: 'Note si c’est à jeun ou après un repas. Si ton appareil affiche des mmol/L, multiplie par 18.' },
  heartRate: { label: 'Pouls au repos', unit: 'bpm', fields: ['value'], help: 'Battements par minute, au calme, assis ou allongé.' },
  spo2: { label: 'Oxygène dans le sang', unit: '%', fields: ['value'], help: 'Avec un oxymètre au doigt.' },
  temperature: { label: 'Température', unit: '°C', fields: ['value'], help: '' },
};

// → { level: 'ok'|'watch'|'high'|'urgent'|'low', label }
export function vitalZone(type, m = {}) {
  const v = Number(m.value);
  if (type === 'bp') {
    const s = Number(m.systolic); const d = Number(m.diastolic);
    if (!s || !d) return null;
    if (s > 180 || d > 120) return { level: 'urgent', label: 'Très élevée : consulte rapidement' };
    if (s >= 140 || d >= 90) return { level: 'high', label: 'Élevée (niveau 2)' };
    if (s >= 130 || d >= 80) return { level: 'watch', label: 'Élevée (niveau 1)' };
    if (s >= 120) return { level: 'watch', label: 'Un peu haute' };
    if (s < 90 || d < 60) return { level: 'low', label: 'Basse' };
    return { level: 'ok', label: 'Normale' };
  }
  if (!Number.isFinite(v) || !m.value && m.value !== 0) return null;
  if (type === 'glucose') {
    if (v < 70) return { level: 'urgent', label: 'Trop basse (hypoglycémie)' };
    if (m.context === 'after') return v >= 200 ? { level: 'high', label: 'Élevée' } : v >= 140 ? { level: 'watch', label: 'Un peu haute' } : { level: 'ok', label: 'Normale' };
    return v >= 126 ? { level: 'high', label: 'Élevée' } : v >= 100 ? { level: 'watch', label: 'Un peu haute' } : { level: 'ok', label: 'Normale' };
  }
  if (type === 'heartRate') return v > 100 ? { level: 'watch', label: 'Rapide' } : v < 50 ? { level: 'watch', label: 'Lent (normal chez les sportifs)' } : { level: 'ok', label: 'Normal' };
  if (type === 'spo2') return v <= 90 ? { level: 'urgent', label: 'Basse : consulte rapidement' } : v < 95 ? { level: 'watch', label: 'Un peu basse' } : { level: 'ok', label: 'Normale' };
  if (type === 'temperature') return v >= 39.5 ? { level: 'high', label: 'Forte fièvre' } : v >= 38 ? { level: 'watch', label: 'Fièvre' } : v < 35.5 ? { level: 'low', label: 'Basse' } : { level: 'ok', label: 'Normale' };
  return null;
}

export const vitalText = (type, m) => (type === 'bp' ? `${m.systolic}/${m.diastolic}` : `${m.value}`);

// ─────────── Appointments & documents ───────────
// appointment: { id, date, time, title, place, who, notes, done }
export const upcomingAppointments = (list = [], today) => list.filter((a) => !a.done && a.date >= today).sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

// document: { id, kind: 'prescription'|'vaccine'|'report'|'other', date, title, notes, photo, nextDate }
export const DOC_KINDS = [
  { value: 'prescription', label: 'Ordonnance' },
  { value: 'vaccine', label: 'Vaccin' },
  { value: 'report', label: 'Compte rendu / analyse' },
  { value: 'other', label: 'Autre' },
];
// Vaccines whose booster (nextDate) is past or within 30 days.
export const boostersDue = (docs = [], today) => docs.filter((d) => d.kind === 'vaccine' && d.nextDate && daysBetween(today, d.nextDate) <= 30).sort((a, b) => a.nextDate.localeCompare(b.nextDate));

// ─────────── Push reminders (server side) ───────────
// Times in minutes since midnight; `inWindow(min)` says if a moment falls in
// the current 5-minute run. Returns the messages to send.
const toMinutes = (hhmm) => { if (!hhmm) return null; const [h, m] = String(hhmm).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };

export function dueCareReminders(health, date, inWindow) {
  const out = [];
  const meds = health?.medications || [];
  const logs = health?.medLogs || [];
  for (const d of dosesOn(meds, logs, date)) {
    if (d.status || !d.time || d.med.remind === false) continue;
    if (inWindow(toMinutes(d.time))) out.push({ tag: `med-${d.med.id}-${d.time}`, body: `${d.med.name}${d.med.dose ? ` · ${d.med.dose}` : ''} : c’est l’heure (${d.time}).`, url: '/today' });
  }
  for (const a of health?.appointments || []) {
    if (a.done) continue;
    if (a.date === addDays(date, 1) && inWindow(18 * 60)) out.push({ tag: `rdv-eve-${a.id}`, body: `Demain${a.time ? ` à ${a.time}` : ''} : ${a.title}${a.place ? ` (${a.place})` : ''}.`, url: '/health?tab=appointments' });
    const t = toMinutes(a.time);
    if (a.date === date && t != null && inWindow(t - 120)) out.push({ tag: `rdv-2h-${a.id}`, body: `Dans 2 heures : ${a.title}${a.place ? ` (${a.place})` : ''}.`, url: '/health?tab=appointments' });
  }
  return out;
}

// ─────────── Emergency card ───────────
export const BLOOD_TYPES = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
export const emergencyIsEmpty = (card) => !card || !(card.bloodType || card.allergies || card.conditions || card.contacts?.some((c) => c.name || c.phone) || card.notes);
