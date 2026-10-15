import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, buildExportTables } from '../src/utils/export-tables.js';
import { feedbackMailto } from '../src/utils/feedback.js';

test('CSV for French spreadsheets: semicolons, decimal comma, quotes, accents', () => {
  const csv = toCSV([{ key: 'a', label: 'Libellé' }, { key: 'b', label: 'Montant' }], [{ a: 'Courses; marché "bio"', b: 12.5 }]);
  assert.ok(csv.startsWith('﻿Libellé;Montant\r\n'));
  assert.ok(csv.includes('"Courses; marché ""bio""";12,5'));
});

test('one table per section that has data, rows in date order', () => {
  const tables = buildExportTables({
    habits: { habits: [{ id: 'h', name: 'Marcher' }], logs: [{ habitId: 'h', date: '2026-10-02', completed: true }, { habitId: 'h', date: '2026-10-01', completed: false }] },
    accounting: { journal: [{ date: '2026-10-01', label: 'Courses', lines: [{ account: '6111', debit: 50, credit: 0 }, { account: '5141', debit: 0, credit: 50 }] }] },
    health: { medications: [{ id: 'm', name: 'Metformine' }], medLogs: [{ medId: 'm', date: '2026-10-01', time: '08:00', status: 'taken' }], vitals: [{ type: 'bp', date: '2026-10-01', systolic: 120, diastolic: 80 }] },
  });
  const by = Object.fromEntries(tables.map((t) => [t.file, t.rows]));
  assert.deepEqual(Object.keys(by).sort(), ['argent-operations.csv', 'habitudes.csv', 'sante-medicaments.csv', 'sante-mesures.csv']);
  assert.deepEqual(by['habitudes.csv'].map((r) => [r.date, r.done]), [['2026-10-01', 'non'], ['2026-10-02', 'oui']]);
  assert.equal(by['argent-operations.csv'].length, 2);
  assert.equal(by['sante-mesures.csv'][0].value, '120/80');
  assert.equal(by['sante-medicaments.csv'][0].status, 'pris');
});

test('feedback e-mail: the message plus screen and device, nothing else', () => {
  const url = feedbackMailto({ kind: 'bug', message: 'Le bouton ne marche pas', path: '/health', userAgent: 'Mozilla (iPhone)' });
  assert.ok(url.startsWith('mailto:tijan7609@gmail.com?subject=VAUDAX%20%C2%B7%20Probl%C3%A8me'));
  const body = decodeURIComponent(url.split('body=')[1]);
  assert.ok(body.startsWith('Le bouton ne marche pas') && body.includes('Écran : /health') && body.includes('Appareil : iPhone/iPad'));
});
