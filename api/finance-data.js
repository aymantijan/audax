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

  const { journal, budgets, corrections, treasuryAccounts, assets, echeances, goals, labelLimits } = dataRows[0].data || {};
  return res.status(200).json({
    note:
      "Raw double-entry accounting data for this AUDAX user's Finance page. `journal` is the source of truth (every entry has `lines`: [{account, debit, credit}], chart-of-accounts codes are the Moroccan plan comptable classes 1-8). Bilan/CPC/ESG/ratios are all DERIVED from `journal` client-side (see src/utils/accounting-engine.js) — recompute or reason over them directly from these entries rather than assuming a summary is included here.",
    assetsNote:
      "`assets[]` describes each fixed asset (class-2 account) with classification + valuation metadata, so Wealth OS can value the immobilised assets properly. The `journal` still carries the amount at HISTORICAL COST; `assets` adds { accountCode, assetClass, liquidityTier (1→3), label, quantity, unit, unitCost, totalCost, acquisitionDate, valuationSource, marketIdentifier, currentEstimate }. VALUATION CONTRACT: valuationSource='market_live' (or/gold, autres_metaux_precieux, actions) → AUDAX supplies ONLY quantity + unitCost + marketIdentifier (gold: karat e.g. '18K'; other metals: type+purity e.g. 'argent_925'; stocks: BVC ticker e.g. 'IAM'); AUDAX does NOT compute any live price — Wealth OS applies the real spot/quote and the latent gain/loss. valuationSource='audax_manual' (immobilier, matériel de transport) → AUDAX may supply `currentEstimate` (via the corrections plus/moins-value mechanism); display as-is. valuationSource='cost' → value = historical cost (optionally net of amortisation). Gold ('or') has its OWN account, distinct from 'autres_metaux_precieux'. Missing quantity/unitCost is tolerated: fall back to the asset's cost. `assets` classifies; it never overrides the double-entry `journal`.",
    exportedAt: new Date().toISOString(),
    dataUpdatedAt: dataRows[0].updated_at,
    journal: journal || [],
    budgets: budgets || [],
    corrections: corrections || [],
    treasuryAccounts: treasuryAccounts || [],
    assets: assets || [],
    echeances: echeances || [],
    goals: goals || [],
    labelLimits: labelLimits || [],
  });
}
