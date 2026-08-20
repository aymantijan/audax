// Vercel serverless function — mirrors api/health-coach.js and api/trading-coach.js
// exactly (see those files' comments for the full rationale: key never reaches
// the browser, Supabase bearer-token auth guard, free-model fallback list, hard
// "always free" guarantee). Kept as a separate file rather than a shared module
// since each is an independent Vercel function entry point. Only the SYSTEM_PROMPT
// and the "ask" mode are implemented here — unlike health-coach, there's no
// daily/digest card in the Engineering UI to justify those modes.

const SYSTEM_PROMPT =
  "You are a supportive, concise chemical engineering study coach embedded in a personal tracking app called AUDAX. " +
  "You are given the user's own lab journal entries (experiment yields, courses, observations) and project pipeline (design/PFE/internship projects, their current process-engineering stage, task completion) as JSON. " +
  'Never invent data not present in the JSON, never give real chemical safety/handling guidance beyond what the user themselves logged — for anything involving lab safety or hazardous materials, tell them to consult their lab supervisor or a real safety data sheet, never improvise one. ' +
  'Be direct and specific to the data given — interpret it (e.g. yield trends, which stage a project is stuck at), do not just restate it verbatim.';

const MAX_TOKENS = { ask: 500 };

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
    console.error('[engineering-coach] OPENROUTER_API_KEY not set');
    return res.status(503).json({ error: 'AI coach is not configured on this deployment.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      console.error('[engineering-coach] missing bearer token');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const verify = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!verify.ok) {
      console.error('[engineering-coach] supabase token verify failed', verify.status, await verify.text());
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { mode, context, question } = req.body || {};
  if (mode !== 'ask') return res.status(400).json({ error: 'Invalid mode' });
  if (!question?.trim()) return res.status(400).json({ error: 'Missing question' });

  const userInstruction = `${question.trim().slice(0, 500)} (Answer in the same language as this question, in 3-4 complete sentences — finish your thought, don't trail off.)`;
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Here is my current engineering data (JSON): ${JSON.stringify(context || {}).slice(0, 4000)}` },
    { role: 'user', content: userInstruction },
  ];

  const envModel = process.env.OPENROUTER_MODEL;
  const modelsToTry = envModel && envModel.endsWith(':free') ? [envModel] : FALLBACK_FREE_MODELS;
  if (envModel && !envModel.endsWith(':free')) {
    console.error('[engineering-coach] OPENROUTER_MODEL is set but not a :free slug — ignoring it, using the free fallback list instead:', envModel);
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
          'X-Title': 'AUDAX Engineering Coach',
        },
        body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS[mode], temperature: 0.7 }),
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error('[engineering-coach] upstream OpenRouter error', upstream.status, 'model:', model, detail.slice(0, 500));
        lastError = { status: upstream.status, detail: detail.slice(0, 300) };
        continue;
      }

      const data = await upstream.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        console.error('[engineering-coach] empty AI response', model, JSON.stringify(data).slice(0, 500));
        lastError = { status: 502, detail: 'Empty AI response' };
        continue;
      }
      console.log('[engineering-coach] success', model);
      return res.status(200).json({ text, model });
    } catch (e) {
      console.error('[engineering-coach] request threw', model, e?.message || e);
      lastError = { status: 500, detail: e?.message || 'request error' };
    }
  }

  return res.status(lastError?.status || 502).json({ error: 'AI request failed', detail: lastError?.detail });
}
