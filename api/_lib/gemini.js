// Gemini (Google AI Studio) — the site's only AI provider (decision 2026-09-27:
// free tier only, project budget 0). GEMINI_API_KEY is read here, server-side
// only; never expose it as a VITE_ variable.
//
// Free-tier guarantee: the key must come from a Google AI Studio project
// WITHOUT billing enabled — Google then answers 429 at the free limits
// instead of charging. Models are tried in order; a 429/5xx on one moves on
// to the next (each model has its own free quota).

export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const isGeminiConfigured = () => !!process.env.GEMINI_API_KEY;

function body({ system, contents, maxTokens, temperature = 0.6, json = false }, model) {
  const generationConfig = { maxOutputTokens: maxTokens, temperature };
  if (json) generationConfig.responseMimeType = 'application/json';
  // 2.5 models "think" by default, which eats the output budget of short
  // answers; the coaching replies don't need it.
  if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig,
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  });
}

const textOf = (data) => (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');

// Streams the answer: calls onText(delta) as text arrives. Returns { model }.
// Throws { status, detail } when every model failed before any text was sent.
// `key`/`models`: a person's own Gemini key and chosen model (else the site's).
export async function geminiStream(req, onText, { fetchImpl = fetch, key = process.env.GEMINI_API_KEY, models = GEMINI_MODELS } = {}) {
  let last = { status: 503, detail: 'not configured' };
  for (const model of models) {
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
      console.error('[gemini] model failed', model, last.status, last.detail);
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
