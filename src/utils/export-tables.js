// Readable export (chantier 8, D3): every section as a spreadsheet file
// (CSV, opened by Excel, Numbers, LibreOffice, Google Sheets), one row per
// entry, French column names. The JSON backup stays the full copy to restore;
// this one is for reading, sharing with a doctor or an accountant.
// Pure: tests/export.test.mjs.
import { accountLabel } from './chart-of-accounts.js';
import { VITALS, vitalText } from './care.js';

const SEP = ';'; // the separator French-language spreadsheets expect

export function toCSV(columns, rows) {
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(SEP), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(SEP))];
  return `﻿${lines.join('\r\n')}\r\n`; // BOM: accents read correctly in Excel
}

const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));

export function buildExportTables({ habits = {}, accounting = {}, health = {}, learning = {}, readings = {} }) {
  const tables = [];
  const habitName = Object.fromEntries((habits.habits || []).map((h) => [h.id, h.name]));
  tables.push({
    file: 'habitudes.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'habit', label: 'Habitude' }, { key: 'done', label: 'Fait' }, { key: 'value', label: 'Valeur' }],
    rows: (habits.logs || []).map((l) => ({ date: l.date, habit: habitName[l.habitId] || '(supprimée)', done: l.completed ? 'oui' : 'non', value: l.value ?? '' })).sort(byDate),
  });
  tables.push({
    file: 'check-in.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'energy', label: 'Énergie /10' }, { key: 'sleep', label: 'Sommeil /10' }, { key: 'hours', label: 'Heures de sommeil' }, { key: 'stress', label: 'Stress /10' }],
    rows: (habits.energyLogs || []).map((e) => ({ date: e.date, energy: e.energyStartLevel, sleep: e.sleepData?.sleepQualityScore, hours: e.sleepData?.hours ?? e.sleepData?.sleepHours, stress: e.stressLevel })).sort(byDate),
  });
  tables.push({
    file: 'argent-operations.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'label', label: 'Libellé' }, { key: 'account', label: 'Compte' }, { key: 'name', label: 'Nom du compte' }, { key: 'debit', label: 'Débit' }, { key: 'credit', label: 'Crédit' }],
    rows: (accounting.journal || []).flatMap((e) => (e.lines || []).map((l) => ({ date: e.date, label: e.label, account: l.account, name: accountLabel(l.account), debit: l.debit || '', credit: l.credit || '' }))).sort(byDate),
  });
  tables.push({
    file: 'sante-seances.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'kind', label: 'Type' }, { key: 'exercise', label: 'Exercice' }, { key: 'minutes', label: 'Minutes' }, { key: 'sets', label: 'Séries' }, { key: 'notes', label: 'Note' }],
    rows: (health.workouts || []).map((w) => ({ date: w.date, kind: w.type, exercise: w.exercise, minutes: w.durationMin || '', sets: (w.sets || []).map((s) => `${s.reps || ''}×${s.weight || 0}`).join(' '), notes: w.notes })).sort(byDate),
  });
  tables.push({
    file: 'sante-repas.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'name', label: 'Aliment' }, { key: 'grams', label: 'Grammes' }, { key: 'kcal', label: 'Calories' }, { key: 'protein', label: 'Protéines (g)' }, { key: 'carbs', label: 'Glucides (g)' }, { key: 'fat', label: 'Lipides (g)' }],
    rows: (health.nutritionLogs || []).map((n) => ({ date: n.date, name: n.name, grams: n.grams, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat })).sort(byDate),
  });
  tables.push({
    file: 'sante-poids.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'weightKg', label: 'Poids (kg)' }, { key: 'waistCm', label: 'Tour de taille (cm)' }, { key: 'bodyFatPct', label: 'Masse grasse (%)' }],
    rows: (health.bodyComp || []).map((b) => ({ date: b.date, weightKg: b.weightKg, waistCm: b.waistCm, bodyFatPct: b.bodyFatPct })).sort(byDate),
  });
  tables.push({
    file: 'sante-mesures.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'time', label: 'Heure' }, { key: 'type', label: 'Mesure' }, { key: 'value', label: 'Valeur' }, { key: 'unit', label: 'Unité' }, { key: 'notes', label: 'Note' }],
    rows: (health.vitals || []).map((v) => ({ date: v.date, time: v.time, type: VITALS[v.type]?.label || v.type, value: vitalText(v.type, v), unit: VITALS[v.type]?.unit || '', notes: v.notes })).sort(byDate),
  });
  const medName = Object.fromEntries((health.medications || []).map((m) => [m.id, m.name]));
  tables.push({
    file: 'sante-medicaments.csv',
    columns: [{ key: 'date', label: 'Date' }, { key: 'time', label: 'Heure' }, { key: 'med', label: 'Médicament' }, { key: 'status', label: 'Prise' }],
    rows: (health.medLogs || []).map((l) => ({ date: l.date, time: l.time, med: medName[l.medId] || '(supprimé)', status: l.status === 'taken' ? 'pris' : 'pas pris' })).sort(byDate),
  });
  tables.push({
    file: 'etudes-notes.csv',
    columns: [{ key: 'course', label: 'Matière' }, { key: 'name', label: 'Évaluation' }, { key: 'date', label: 'Date' }, { key: 'grade', label: 'Note' }, { key: 'outOf', label: 'Sur' }, { key: 'weight', label: 'Coefficient (%)' }],
    rows: (learning.courses || []).flatMap((c) => (c.evaluations || []).map((ev) => ({ course: c.name, name: ev.name, date: ev.date, grade: ev.grade ?? '', outOf: ev.outOf ?? ev.scale ?? '', weight: ev.weight ?? '' }))),
  });
  const book = Object.fromEntries((readings.library || []).map((b) => [b.id, b]));
  tables.push({
    file: 'lectures.csv',
    columns: [{ key: 'title', label: 'Livre' }, { key: 'author', label: 'Auteur' }, { key: 'status', label: 'État' }, { key: 'pagesRead', label: 'Pages lues' }, { key: 'pages', label: 'Pages' }],
    rows: (readings.progress || []).map((p) => ({ title: book[p.bookId]?.title || '—', author: book[p.bookId]?.author || '', status: p.status === 'completed' ? 'terminé' : p.status === 'active' ? 'en cours' : p.status, pagesRead: p.pagesRead, pages: p.customPages || book[p.bookId]?.pages })),
  });
  return tables.filter((t) => t.rows.length);
}
