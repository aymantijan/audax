import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/extract-timetable.js';
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
    await handler({ method: 'POST', headers: {}, body: { mimeType: 'image/jpeg', data: 'AAAA' } }, res);
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
  await handler({ method: 'POST', headers: {}, body: { mimeType: 'text/html', data: 'x' } }, res);
  assert.equal(res.statusCode, 400);
});
