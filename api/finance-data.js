// Vercel serverless function — read-only export of a user's Finance
// (accounting) data, authenticated by a personal API key instead of a
// Supabase session (the caller here is a separate Claude conversation the
// user pastes the key into, not the AUDAX app itself — it never has a
// Supabase JWT). See src/pages/Settings.jsx ("API Access") for key
// generation and src/services/api-keys.js for how the key is hashed.
//
// Uses a SERVICE-ROLE key (like api/reminders-cron.js) because looking a raw
// key up by its hash, and then reading that user's accounting row, are both
// cross-account operations from Postgres's point of view — there is no
// caller JWT for RLS to scope against. SUPABASE_SERVICE_ROLE_KEY must only
// ever be set as a server-side Vercel env var, never a VITE_ one.
import crypto from 'crypto';

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'This endpoint is not configured on this deployment (missing SUPABASE_SERVICE_ROLE_KEY).' });
  }

  const key = req.query.key || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!key) return res.status(401).json({ error: 'Missing API key — pass it as ?key=... or an Authorization: Bearer header.' });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const keyHash = sha256Hex(key);

  const lookupRes = await fetch(`${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&select=user_id`, { headers });
  if (!lookupRes.ok) {
    console.error('[finance-data] key lookup failed', lookupRes.status, await lookupRes.text());
    return res.status(502).json({ error: 'Could not verify the API key right now.' });
  }
  const lookupRows = await lookupRes.json();
  if (!lookupRows.length) return res.status(401).json({ error: 'Invalid or revoked API key.' });
  const userId = lookupRows[0].user_id;

  const dataRes = await fetch(`${supabaseUrl}/rest/v1/app_state?user_id=eq.${userId}&store_name=eq.accounting&select=data,updated_at`, { headers });
  if (!dataRes.ok) {
    console.error('[finance-data] data fetch failed', dataRes.status, await dataRes.text());
    return res.status(502).json({ error: 'Could not load Finance data right now.' });
  }
  const dataRows = await dataRes.json();
  if (!dataRows.length) {
    return res.status(404).json({ error: 'No Finance data found for this account — it may be local-only (never connected to cloud sync).' });
  }

  // Fire-and-forget — never blocks or fails the actual response.
  fetch(`${supabaseUrl}/rest/v1/api_keys?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch(() => {});

  const { journal, budgets, corrections, treasuryAccounts, echeances, goals, labelLimits } = dataRows[0].data || {};
  return res.status(200).json({
    note:
      "Raw double-entry accounting data for this AUDAX user's Finance page. `journal` is the source of truth (every entry has `lines`: [{account, debit, credit}], chart-of-accounts codes are the Moroccan plan comptable classes 1-8). Bilan/CPC/ESG/ratios are all DERIVED from `journal` client-side (see src/utils/accounting-engine.js) — recompute or reason over them directly from these entries rather than assuming a summary is included here.",
    exportedAt: new Date().toISOString(),
    dataUpdatedAt: dataRows[0].updated_at,
    journal: journal || [],
    budgets: budgets || [],
    corrections: corrections || [],
    treasuryAccounts: treasuryAccounts || [],
    echeances: echeances || [],
    goals: goals || [],
    labelLimits: labelLimits || [],
  });
}
