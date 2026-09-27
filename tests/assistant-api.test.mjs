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

test('2.5 models run without thinking; newer ones get room to think', async () => {
  process.env.GEMINI_API_KEY = 'test';
  const bodies = [];
  const fetchImpl = async (_u, init) => { bodies.push(JSON.parse(init.body)); return sse(['x']); };
  await geminiStream({ system: 's', contents: [], maxTokens: 10 }, () => {}, { fetchImpl, models: ['gemini-2.5-flash'] });
  await geminiStream({ system: 's', contents: [], maxTokens: 10 }, () => {}, { fetchImpl, models: ['gemini-3.8-flash'] });
  assert.equal(bodies[0].generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(bodies[1].generationConfig.thinkingConfig, undefined);
  assert.ok(bodies[1].generationConfig.maxOutputTokens > 1000);
  assert.equal(bodies[0].systemInstruction.parts[0].text, 's');
});

test('retired models: the newest flash model available to the key is found and used', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('?pageSize')) {
      return new Response(JSON.stringify({ models: [
        { name: 'models/gemini-4.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-4.1-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-4.1-flash-image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] },
      ] }));
    }
    if (url.includes('gemini-4.1-flash:')) return sse(['ok']);
    return new Response('{"error":{"code":404,"message":"no longer available to new users"}}', { status: 404 });
  };
  const { text, model } = await geminiText({ system: 's', contents: [], maxTokens: 10 }, { fetchImpl, key: 'fresh-key' });
  assert.equal(text, 'ok');
  assert.equal(model, 'gemini-4.1-flash');
  assert.ok(calls.some((u) => u.includes('?pageSize')));
});

test('a refused key stops at once instead of trying every model', async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return new Response('API key not valid', { status: 400 }); };
  await assert.rejects(geminiText({ system: 's', contents: [], maxTokens: 10 }, { fetchImpl, key: 'bad' }), (e) => e.status === 400);
  assert.equal(n, 1);
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
