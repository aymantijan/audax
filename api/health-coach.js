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

const MAX_TOKENS = { daily: 150, digest: 250, ask: 300 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI coach is not configured on this deployment.' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const verify = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!verify.ok) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mode, context, question } = req.body || {};
  if (!['daily', 'digest', 'ask'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  if (mode === 'ask' && !question?.trim()) return res.status(400).json({ error: 'Missing question' });

  const userInstruction = mode === 'ask' ? question.trim().slice(0, 500) : MODE_INSTRUCTIONS[mode];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Here is my current health data (JSON): ${JSON.stringify(context || {}).slice(0, 4000)}` },
    { role: 'user', content: userInstruction },
  ];

  try {
    const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';
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
      return res.status(502).json({ error: 'AI request failed', detail: detail.slice(0, 300) });
    }

    const data = await upstream.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return res.status(502).json({ error: 'Empty AI response' });
    return res.status(200).json({ text });
  } catch {
    return res.status(500).json({ error: 'AI request error' });
  }
}
