// Gemini (Google AI Studio): the site's shared key (GEMINI_API_KEY, server-side
// only, never a VITE_ variable) or a person's own key (api/_lib/llm.js).
//
// Free-tier guarantee for the site's key: it must come from a Google AI Studio
// project WITHOUT billing enabled — Google then answers 429 at the free limits
// instead of charging.

// Preferred models, newest first. Google retires models without notice (in
// Sept 2026 "gemini-2.5-flash" became unavailable to new accounts), so when
// they all fail with "not found", the models this key can really use are
// listed from the API and the newest "flash" one is taken.
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const isGeminiConfigured = () => !!process.env.GEMINI_API_KEY;

function body({ system, contents, maxTokens, temperature = 0.6, json = false }, model) {
  // Newer models "think" before answering and that counts against the output
  // budget: give them headroom. 2.5 models can switch thinking off instead.
  const thinkingOff = model.startsWith('gemini-2.5');
  const generationConfig = { maxOutputTokens: thinkingOff ? maxTokens : maxTokens + 2048, temperature };
  if (json) generationConfig.responseMimeType = 'application/json';
  if (thinkingOff) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig,
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  });
}

// "gemini-3.8-flash" → [3, 8]. Keeps stable text "flash" models, newest first.
const versionOf = (name) => (name.match(/gemini-(\d+)(?:\.(\d+))?/) || []).slice(1).map((n) => Number(n) || 0);
export function pickFlashModels(list) {
  return (list || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((n) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(n))
    .sort((a, b) => {
      const [a1, a2] = versionOf(a);
      const [b1, b2] = versionOf(b);
      return b1 - a1 || b2 - a2 || (a.endsWith('-lite') ? 1 : 0) - (b.endsWith('-lite') ? 1 : 0);
    });
}

const discovered = new Map(); // key fingerprint → { at, models }
async function discoverModels(key, fetchImpl) {
  const fp = `${key.length}:${key.slice(-6)}`;
  const hit = discovered.get(fp);
  if (hit && Date.now() - hit.at < 3600000) return hit.models;
  try {
    const res = await fetchImpl(`${API}?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) return [];
    const models = pickFlashModels((await res.json()).models).slice(0, 4);
    discovered.set(fp, { at: Date.now(), models });
    return models;
  } catch {
    return [];
  }
}

const isKeyProblem = (status, detail) => status === 401 || status === 403 || (status === 400 && /api.?key/i.test(detail));
const textOf = (data) => (data?.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? '' : p.text || '')).join('');

// Streams the answer: calls onText(delta) as text arrives. Returns { model }.
// Throws { status, detail } when every model failed before any text was sent.
// `key`/`models`: a person's own Gemini key and chosen models (else the site's).
export async function geminiStream(req, onText, { fetchImpl = fetch, key = process.env.GEMINI_API_KEY, models = GEMINI_MODELS } = {}) {
  let last = { status: 503, detail: 'not configured' };
  const tried = new Set();
  let queue = [...new Set(models)];
  let listed = false;
  for (;;) {
    if (!queue.length) {
      // Every preferred model is gone for this key: ask Google which ones exist.
      if (listed || last.status !== 404) break;
      listed = true;
      queue = (await discoverModels(key, fetchImpl)).filter((m) => !tried.has(m));
      if (!queue.length) break;
    }
    const model = queue.shift();
    tried.add(model);
    let upstream;
    try {
      upstream = await fetchImpl(`${API}/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: body(req, model),
      });
    } catch (e) {
      last = { status: 502, detail: e?.message || 'network error' };
      continue;
    }
    if (!upstream.ok || !upstream.body) {
      last = { status: upstream.status, detail: (await upstream.text().catch(() => '')).slice(0, 300) };
      console.error('[gemini] model failed', model, last.status, last.detail.slice(0, 160));
      if (isKeyProblem(last.status, last.detail)) break; // another model will not help
      continue;
    }
    const reader = upstream.body.getReader();
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
        try {
          const delta = textOf(JSON.parse(line.slice(5)));
          if (delta) onText(delta);
        } catch { /* partial or keep-alive line */ }
      }
    }
    return { model };
  }
  throw last;
}

// Whole answer at once (for the section coaches that return JSON).
export async function geminiText(req, opts) {
  let text = '';
  const { model } = await geminiStream(req, (d) => { text += d; }, opts);
  return { text: text.trim(), model };
}
