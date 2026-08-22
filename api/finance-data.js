// Vercel serverless function — read-only export of a user's Finance
// (accounting) data only. See api/account-data.js for the full-account
// version ("all my data, still just my account") — this one stays around
// for anyone who already shared this narrower URL/key combo.
//
// Auth: personal API key (see src/services/api-keys.js + src/pages/
// Settings.jsx's "API Access"), not a Supabase session — the caller here is
// a separate Claude conversation the user pastes the key into, which never
// has a Supabase JWT.
import { resolveApiKey } from './_lib/api-key-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await resolveApiKey(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { userId, supabaseUrl, headers } = auth;

  const dataRes = await fetch(`${supabaseUrl}/rest/v1/app_state?user_id=eq.${userId}&store_name=eq.accounting&select=data,updated_at`, { headers });
  if (!dataRes.ok) {
    console.error('[finance-data] data fetch failed', dataRes.status, await dataRes.text());
    return res.status(502).json({ error: 'Could not load Finance data right now.' });
  }
  const dataRows = await dataRes.json();
  if (!dataRows.length) {
    return res.status(404).json({ error: 'No Finance data found for this account — it may be local-only (never connected to cloud sync).' });
  }

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
