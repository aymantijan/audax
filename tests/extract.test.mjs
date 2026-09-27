import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/extract.js';
import { parseTimetableLines } from '../src/utils/academic.js';

const fakeRes = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const sse = (t) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`, { status: 200 });

test('keeps only import-format lines, which the timetable parser then reads', async () => {
  process.env.GEMINI_API_KEY = 'k';
  delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_ANON_KEY; // local mode: no auth/quota
  const original = globalThis.fetch;
  globalThis.fetch = async () => sse('Voici :\n- Finance ; Lundi ; 8h30-10h00 ; M. A ; B12 ; Cours\n```\nMarketing ; Mardi ; 13h-14h30 ;  ;  ; TD\n');
  try {
    const res = fakeRes();
    await handler({ method: 'POST', headers: {}, body: { kind: 'timetable', mimeType: 'image/jpeg', data: 'AAAA' } }, res);
    assert.equal(res.statusCode, 200);
    const { rows, errors } = parseTimetableLines(res.body.text);
    assert.equal(rows.length, 2);
    assert.equal(errors.length, 0);
    assert.equal(rows[1].kind, 'TD');
  } finally {
    globalThis.fetch = original;
  }
});

test('refuses other file types', async () => {
  process.env.GEMINI_API_KEY = 'k';
  const res = fakeRes();
  await handler({ method: 'POST', headers: {}, body: { kind: 'timetable', mimeType: 'text/html', data: 'x' } }, res);
  assert.equal(res.statusCode, 400);
});

import { parseReceipt } from '../api/extract.js';

test('receipt: keeps the total, a valid date and currency, drops what is unreadable', () => {
  assert.deepEqual(parseReceipt('{"amount":"23,50","currency":"EUR","date":"2026-09-26","merchant":"Boulangerie","category":"alimentation"}'),
    { amount: 23.5, currency: 'EUR', date: '2026-09-26', merchant: 'Boulangerie', category: 'alimentation' });
  const r = parseReceipt('```json\n{"amount": null, "currency": "euros", "date": "26/09", "merchant": null, "category": null}\n```');
  assert.equal(r.amount, null);
  assert.equal(r.currency, null);
  assert.equal(r.date, null);
  assert.equal(parseReceipt('not json'), null);
});
