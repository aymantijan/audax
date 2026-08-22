// Shared helper for every endpoint authenticated by a personal AUDAX API key
// (see src/services/api-keys.js + src/pages/Settings.jsx's "API Access").
// Leading underscore keeps Vercel from deploying this file itself as a route
// — only api/*.js files without a leading underscore become endpoints.
import crypto from 'crypto';

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Resolves the raw key on the request (?key=... or Authorization: Bearer)
// to a Supabase user_id via the api_keys table, using a SERVICE-ROLE key —
// this lookup is inherently cross-account from Postgres's point of view
// (the caller has a raw key, not a Supabase session/JWT for RLS to scope
// against), same justified exception as api/reminders-cron.js.
//
// Returns { ok: true, userId, headers } on success — `headers` is the
// service-role auth header pair, ready to reuse for the caller's own
// follow-up REST calls (e.g. reading app_state) without re-deriving it.
// On failure, returns { ok: false, status, error } — the caller should
// respond with exactly that status/error and stop.
export async function resolveApiKey(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 503, error: 'This endpoint is not configured on this deployment (missing SUPABASE_SERVICE_ROLE_KEY).' };
  }

  const key = req.query.key || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!key) return { ok: false, status: 401, error: 'Missing API key — pass it as ?key=... or an Authorization: Bearer header.' };

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const keyHash = sha256Hex(key);

  const lookupRes = await fetch(`${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&select=user_id`, { headers });
  if (!lookupRes.ok) {
    console.error('[api-key-auth] key lookup failed', lookupRes.status, await lookupRes.text());
    return { ok: false, status: 502, error: 'Could not verify the API key right now.' };
  }
  const lookupRows = await lookupRes.json();
  if (!lookupRows.length) return { ok: false, status: 401, error: 'Invalid or revoked API key.' };

  // Fire-and-forget usage timestamp — never blocks or fails the caller's response.
  fetch(`${supabaseUrl}/rest/v1/api_keys?user_id=eq.${lookupRows[0].user_id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch(() => {});

  return { ok: true, userId: lookupRows[0].user_id, supabaseUrl, headers };
}
