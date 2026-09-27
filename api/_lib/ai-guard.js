import { userKeyFrom } from './llm.js';

// Shared guard for every AI endpoint: a real signed-in user, and a daily
// quota per person (F8) so a private circle can never exhaust the free
// Gemini limits for everyone else.

export const DAILY_AI_LIMIT = 30;

// Returns the Supabase user id, or null when the token is missing/invalid.
// When Supabase is not configured (local dev), returns 'local'.
export async function verifyUser(req, { fetchImpl = fetch } = {}) {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return 'local';
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.id || null;
}

// Counts one request. Returns { ok, used, limit }. Atomic in the database
// (supabase/migrations/008_ai_usage.sql). If the quota table is unreachable
// the request is allowed: the free tier cannot bill, so failing open only
// risks hitting Google's own free limit, never money.
export async function takeQuota(userId, { fetchImpl = fetch, limit = DAILY_AI_LIMIT } = {}) {
  const url = process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service || userId === 'local') return { ok: true, used: null, limit };
  try {
    const r = await fetchImpl(`${url}/rest/v1/rpc/ai_usage_hit`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user: userId, p_limit: limit }),
    });
    if (!r.ok) {
      console.error('[ai-guard] quota rpc failed', r.status, (await r.text()).slice(0, 200));
      return { ok: true, used: null, limit };
    }
    const n = await r.json();
    return n === -1 ? { ok: false, used: limit, limit } : { ok: true, used: n, limit };
  } catch (e) {
    console.error('[ai-guard] quota rpc threw', e?.message || e);
    return { ok: true, used: null, limit };
  }
}

// Common preamble: method, config, auth, quota. Sends the error response and
// returns null when the request must stop; otherwise returns { userId, quota, userKey }.
// With a personal key (api/_lib/llm.js) there is no VAUDAX quota: the person's
// own provider account sets the limits. Sign-in is still required either way.
export async function guardAiRequest(req, res, { isConfigured }) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return null; }
  const userKey = userKeyFrom(req);
  if (!userKey && !isConfigured()) { res.status(503).json({ error: 'not_configured' }); return null; }
  const userId = await verifyUser(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  if (userKey) return { userId, userKey, quota: { ok: true, used: null, limit: null } };
  const quota = await takeQuota(userId);
  if (!quota.ok) { res.status(429).json({ error: 'quota', limit: quota.limit }); return null; }
  return { userId, quota, userKey: null };
}
