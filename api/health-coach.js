// Vercel serverless function — the ONLY place OPENROUTER_API_KEY is read.
// Never expose this key as a VITE_ variable; VITE_ vars get bundled into the
// client JS and would be extractable by anyone via DevTools on the deployed
// site (AUDAX is public at vaudax.vercel.app). This function runs server-side
// only, so the key never reaches the browser.
//
// Auth guard: requires a valid Supabase session token so the endpoint can't
// be hit anonymously by strangers to burn the OpenRouter quota. Reuses the
// existing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (safe to read
// server-side too — the anon key is public by design, RLS is what protects
// data, and here it's only used to verify a token belongs to a real session).

const SYSTEM_PROMPT =
  "You are a supportive, concise health & fitness coach embedded in a personal tracking app called AUDAX. " +
  "You are given the user's own aggregated health metrics (sleep, energy, stress, nutrition, workouts, goals) as JSON — never invent numbers not present in it. " +
  'Never give medical diagnoses or claim to replace a doctor; for anything alarming, suggest they consult a professional. ' +
  'Be direct and specific to the numbers given — interpret them, do not just restate them verbatim.';

const MODE_INSTRUCTIONS = {
  daily: 'Give one short (1-3 sentence) recommendation for today based on this data.',
  digest: 'Write a short (3-5 sentence) narrative summary of the week based on this data — what went well, what to watch.',
};

const MAX_TOKENS = { daily: 150, digest: 250, ask: 500 };

// OpenRouter's ":free" models share a single public rate-limit pool across
// EVERY app using OpenRouter, not just this one — a 429 here is normal under
// load and not specific to this deployment. Falling back across a short list
// of free models (instead of just retrying the same one) is the practical fix
// without paying for a dedicated key. process.env.OPENROUTER_MODEL, if set,
// is tried first and exclusively (an explicit choice should not silently fall
// back to a different model the user didn't pick).
// Verified live against https://openrouter.ai/api/v1/models on 2026-07-16 —
// filtered for pricing.prompt === '0' && pricing.completion === '0'. Slugs
// drift over time; re-check that endpoint if these start 404ing again.
const FALLBACK_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[health-coach] OPENROUTER_API_KEY not set');
    return res.status(503).json({ error: 'AI coach is not configured on this deployment.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      console.error('[health-coach] missing bearer token');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const verify = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!verify.ok) {
      console.error('[health-coach] supabase token verify failed', verify.status, await verify.text());
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { mode, context, question } = req.body || {};
  if (!['daily', 'digest', 'ask'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  if (mode === 'ask' && !question?.trim()) return res.status(400).json({ error: 'Missing question' });

  const userInstruction =
    mode === 'ask'
      ? `${question.trim().slice(0, 500)} (Answer in the same language as this question, in 3-4 complete sentences — finish your thought, don't trail off.)`
      : MODE_INSTRUCTIONS[mode];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Here is my current health data (JSON): ${JSON.stringify(context || {}).slice(0, 4000)}` },
    { role: 'user', content: userInstruction },
  ];

  // Hard "always free" guarantee: even if OPENROUTER_MODEL is ever set to a
  // paid slug by mistake, it's ignored in favor of the verified free list —
  // this endpoint must never be able to incur a bill.
  const envModel = process.env.OPENROUTER_MODEL;
  const modelsToTry = envModel && envModel.endsWith(':free') ? [envModel] : FALLBACK_FREE_MODELS;
  if (envModel && !envModel.endsWith(':free')) {
    console.error('[health-coach] OPENROUTER_MODEL is set but not a :free slug — ignoring it, using the free fallback list instead:', envModel);
  }
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vaudax.vercel.app',
          'X-Title': 'AUDAX Health Coach',
        },
        body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS[mode], temperature: 0.7 }),
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error('[health-coach] upstream OpenRouter error', upstream.status, 'model:', model, detail.slice(0, 500));
        lastError = { status: upstream.status, detail: detail.slice(0, 300) };
        continue; // try the next free model — a 429 on one doesn't mean the pool is down for all of them
      }

      const data = await upstream.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        console.error('[health-coach] empty AI response', model, JSON.stringify(data).slice(0, 500));
        lastError = { status: 502, detail: 'Empty AI response' };
        continue;
      }
      console.log('[health-coach] success', model);
      return res.status(200).json({ text, model });
    } catch (e) {
      console.error('[health-coach] request threw', model, e?.message || e);
      lastError = { status: 500, detail: e?.message || 'request error' };
    }
  }

  return res.status(lastError?.status || 502).json({ error: 'AI request failed', detail: lastError?.detail });
}
