// One door to every AI provider (Gemini, Claude, ChatGPT, OpenRouter).
// Each person may bring their own key: the browser sends it in the
// X-AI-Provider / X-AI-Key / X-AI-Model headers for that request only — it is
// never stored or logged here. Without a personal key, the site's own Gemini
// key (GEMINI_API_KEY, free tier) is used with the daily quota.
//
// Requests use the Gemini-style shape the endpoints already build:
//   { system, contents: [{ role: 'user'|'model', parts: [{ text } | { inlineData: { mimeType, data } }] }],
//     maxTokens, temperature, json }
import { geminiStream } from './gemini.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini', defaultModel: 'gemini-2.5-flash' },
  claude: { label: 'Claude', defaultModel: 'claude-haiku-4-5-20251001' },
  openai: { label: 'ChatGPT', defaultModel: 'gpt-4o-mini' },
  openrouter: { label: 'OpenRouter', defaultModel: 'openrouter/auto' },
};

// Personal key from the request headers, or null.
export function userKeyFrom(req) {
  const provider = String(req.headers['x-ai-provider'] || '').toLowerCase();
  const key = String(req.headers['x-ai-key'] || '').trim();
  if (!PROVIDERS[provider] || !key || key.length > 400) return null;
  const model = String(req.headers['x-ai-model'] || '').trim().slice(0, 120) || null;
  return { provider, key, model };
}

// Reads a server-sent-events body, calling onEvent(parsedJson) per data line.
async function readSSE(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try { onEvent(JSON.parse(payload)); } catch { /* keep-alive or partial */ }
    }
  }
}

const fail = async (res) => ({ status: res.status, detail: (await res.text().catch(() => '')).slice(0, 300) });

// OpenAI-compatible message list (ChatGPT, OpenRouter).
function toOpenAI({ system, contents }) {
  const messages = [{ role: 'system', content: system }];
  for (const c of contents) {
    const parts = c.parts.map((p) => {
      if (p.text != null) return { type: 'text', text: p.text };
      const { mimeType, data } = p.inlineData;
      if (mimeType === 'application/pdf') return { type: 'file', file: { filename: 'document.pdf', file_data: `data:${mimeType};base64,${data}` } };
      return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } };
    });
    const onlyText = parts.every((p) => p.type === 'text');
    messages.push({ role: c.role === 'model' ? 'assistant' : 'user', content: onlyText ? parts.map((p) => p.text).join('\n') : parts });
  }
  return messages;
}

async function openAIStream({ url, key, model, extraHeaders = {} }, req, onText, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({
      model, messages: toOpenAI(req), max_tokens: req.maxTokens, temperature: req.temperature ?? 0.6, stream: true,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok || !res.body) throw await fail(res);
  await readSSE(res.body, (e) => { const d = e.choices?.[0]?.delta?.content; if (d) onText(d); });
}

// Claude (Anthropic Messages API).
function toClaude({ contents }) {
  // Claude needs strictly alternating roles starting with 'user'.
  const out = [];
  for (const c of contents) {
    const role = c.role === 'model' ? 'assistant' : 'user';
    const content = c.parts.map((p) => {
      if (p.text != null) return { type: 'text', text: p.text };
      const { mimeType, data } = p.inlineData;
      return mimeType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: mimeType, data } }
        : { type: 'image', source: { type: 'base64', media_type: mimeType, data } };
    });
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content.push(...content);
    else out.push({ role, content });
  }
  return out;
}

async function claudeStream(key, model, req, onText, fetchImpl) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, system: req.json ? `${req.system}\nRéponds uniquement par l’objet JSON, sans texte autour.` : req.system,
      messages: toClaude(req), max_tokens: req.maxTokens, temperature: req.temperature ?? 0.6, stream: true,
    }),
  });
  if (!res.ok || !res.body) throw await fail(res);
  await readSSE(res.body, (e) => { if (e.type === 'content_block_delta' && e.delta?.text) onText(e.delta.text); });
}

// Streams an answer with the person's own key when given, else the site's Gemini.
// Returns { provider, model }. Throws { status, detail } before any text on failure.
export async function aiStream(req, onText, { userKey = null, fetchImpl = fetch } = {}) {
  if (!userKey) {
    const { model } = await geminiStream(req, onText, { fetchImpl });
    return { provider: 'gemini-site', model };
  }
  const model = userKey.model || PROVIDERS[userKey.provider].defaultModel;
  if (userKey.provider === 'gemini') {
    const { model: m } = await geminiStream(req, onText, { fetchImpl, key: userKey.key, models: [model] });
    return { provider: 'gemini', model: m };
  }
  if (userKey.provider === 'claude') await claudeStream(userKey.key, model, req, onText, fetchImpl);
  else if (userKey.provider === 'openai') await openAIStream({ url: 'https://api.openai.com/v1/chat/completions', key: userKey.key, model }, req, onText, fetchImpl);
  else await openAIStream({ url: 'https://openrouter.ai/api/v1/chat/completions', key: userKey.key, model, extraHeaders: { 'HTTP-Referer': 'https://vaudax.vercel.app', 'X-Title': 'VAUDAX' } }, req, onText, fetchImpl);
  return { provider: userKey.provider, model };
}

export async function aiText(req, opts) {
  let text = '';
  const meta = await aiStream(req, (d) => { text += d; }, opts);
  return { text: text.trim(), ...meta };
}

// Error code for the browser: a rejected personal key is told apart from a busy service.
export function keyError(e, userKey) {
  if (userKey && (e?.status === 401 || e?.status === 403)) return 'bad_key';
  if (userKey && e?.status === 400 && /api.?key|invalid.*key|x-api-key/i.test(e?.detail || '')) return 'bad_key';
  if (userKey && e?.status === 402) return 'no_credit';
  return e?.status === 429 ? 'busy' : 'failed';
}
