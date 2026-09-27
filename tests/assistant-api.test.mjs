import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiStream, geminiText, GEMINI_MODELS } from '../api/_lib/gemini.js';
import { takeQuota, verifyUser } from '../api/_lib/ai-guard.js';

const sse = (chunks) => new Response(new ReadableStream({
  start(c) {
    for (const t of chunks) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`));
    c.close();
  },
}), { status: 200 });

test('streams text deltas from Gemini server-sent events', async () => {
  process.env.GEMINI_API_KEY = 'test';
  const seen = [];
  const { model } = await geminiStream({ system: 's', contents: [], maxTokens: 10 }, (d) => seen.push(d), { fetchImpl: async () => sse(['Bon', 'jour']) });
  assert.deepEqual(seen, ['Bon', 'jour']);
  assert.equal(model, GEMINI_MODELS[0]);
});

test('falls back to the next free model on 429, then gives up with the last status', async () => {
  process.env.GEMINI_API_KEY = 'test';
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return calls.length === 1 ? new Response('rate', { status: 429 }) : sse(['ok']); };
  const { text, model } = await geminiText({ system: 's', contents: [], maxTokens: 10 }, { fetchImpl });
  assert.equal(text, 'ok');
  assert.equal(model, GEMINI_MODELS[1]);
  await assert.rejects(geminiText({ system: 's', contents: [], maxTokens: 10 }, { fetchImpl: async () => new Response('x', { status: 429 }) }), (e) => e.status === 429);
});

test('2.5 models run without thinking so short answers are not cut', async () => {
  process.env.GEMINI_API_KEY = 'test';
  let sent;
  await geminiStream({ system: 's', contents: [], maxTokens: 10 }, () => {}, { fetchImpl: async (_u, init) => { sent = JSON.parse(init.body); return sse(['x']); } });
  assert.equal(sent.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(sent.systemInstruction.parts[0].text, 's');
});

test('quota: -1 from the database means the limit is reached; errors fail open', async () => {
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  assert.deepEqual(await takeQuota('u1', { fetchImpl: async () => new Response('4'), limit: 30 }), { ok: true, used: 4, limit: 30 });
  assert.equal((await takeQuota('u1', { fetchImpl: async () => new Response('-1'), limit: 30 })).ok, false);
  assert.equal((await takeQuota('u1', { fetchImpl: async () => new Response('boom', { status: 500 }) })).ok, true);
});

test('auth: no token means no answer', async () => {
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon';
  assert.equal(await verifyUser({ headers: {} }), null);
  const id = await verifyUser({ headers: { authorization: 'Bearer t' } }, { fetchImpl: async () => new Response(JSON.stringify({ id: 'abc' })) });
  assert.equal(id, 'abc');
});
