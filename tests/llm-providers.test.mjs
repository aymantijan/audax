import test from 'node:test';
import assert from 'node:assert/strict';
import { aiText, userKeyFrom, keyError } from '../api/_lib/llm.js';

const sse = (events) => new Response(events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''), { status: 200 });
const req = { system: 'sys', contents: [{ role: 'user', parts: [{ text: 'Q' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } }] }], maxTokens: 50 };

test('reads the personal key from headers, ignores unknown providers', () => {
  assert.deepEqual(userKeyFrom({ headers: { 'x-ai-provider': 'Claude', 'x-ai-key': ' sk-1 ', 'x-ai-model': '' } }), { provider: 'claude', key: 'sk-1', model: null });
  assert.equal(userKeyFrom({ headers: { 'x-ai-provider': 'other', 'x-ai-key': 'k' } }), null);
  assert.equal(userKeyFrom({ headers: {} }), null);
});

test('ChatGPT: OpenAI format with image parts, streamed deltas', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, init }; return sse([{ choices: [{ delta: { content: 'Bon' } }] }, { choices: [{ delta: { content: 'jour' } }] }, '[DONE]']); };
  const r = await aiText(req, { userKey: { provider: 'openai', key: 'sk', model: null }, fetchImpl });
  assert.equal(r.text, 'Bonjour');
  assert.equal(r.model, 'gpt-4o-mini');
  assert.match(sent.url, /api\.openai\.com/);
  const body = JSON.parse(sent.init.body);
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].content[1].type, 'image_url');
  assert.equal(sent.init.headers.Authorization, 'Bearer sk');
});

test('OpenRouter: same format, its own address and chosen model', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return sse([{ choices: [{ delta: { content: 'ok' } }] }]); };
  await aiText(req, { userKey: { provider: 'openrouter', key: 'or', model: 'meta-llama/llama-3.3-70b-instruct:free' }, fetchImpl });
  assert.match(sent.url, /openrouter\.ai/);
  assert.equal(sent.body.model, 'meta-llama/llama-3.3-70b-instruct:free');
});

test('Claude: messages API, base64 image block, text deltas', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return sse([{ type: 'message_start' }, { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Salut' } }]); };
  const r = await aiText(req, { userKey: { provider: 'claude', key: 'ak', model: null }, fetchImpl });
  assert.equal(r.text, 'Salut');
  assert.match(sent.url, /api\.anthropic\.com/);
  assert.equal(sent.init.headers['x-api-key'], 'ak');
  assert.equal(sent.body.system, 'sys');
  assert.equal(sent.body.messages[0].content[1].type, 'image');
});

test('Gemini with a personal key uses that key and model', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, init }; return sse([{ candidates: [{ content: { parts: [{ text: 'G' }] } }] }]); };
  const r = await aiText(req, { userKey: { provider: 'gemini', key: 'gk', model: 'gemini-2.0-flash' }, fetchImpl });
  assert.equal(r.text, 'G');
  assert.match(sent.url, /gemini-2\.0-flash/);
  assert.equal(sent.init.headers['x-goog-api-key'], 'gk');
});

test('a refused key is reported as such, not as a busy service', async () => {
  const fetchImpl = async () => new Response('invalid x-api-key', { status: 401 });
  await assert.rejects(aiText(req, { userKey: { provider: 'claude', key: 'bad' }, fetchImpl }), (e) => keyError(e, { provider: 'claude' }) === 'bad_key');
  assert.equal(keyError({ status: 400, detail: 'API key not valid' }, { provider: 'gemini' }), 'bad_key');
  assert.equal(keyError({ status: 402 }, { provider: 'openrouter' }), 'no_credit');
  assert.equal(keyError({ status: 429 }, null), 'busy');
});
