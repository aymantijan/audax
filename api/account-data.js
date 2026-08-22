// Vercel serverless function — read-only export of EVERY synced store for
// one AUDAX account (trading, finance/accounting, deals, learning, habits,
// skills, readings, health, business, plus the local profile) — "all my
// data, but only mine." See api/finance-data.js for the narrower Finance-
// only version.
//
// Auth: personal API key (see src/services/api-keys.js + src/pages/
// Settings.jsx's "API Access"), not a Supabase session — the caller here is
// a separate Claude conversation the user pastes the key into, which never
// has a Supabase JWT. The key is account-scoped only: it resolves to exactly
// one user_id (see api/_lib/api-key-auth.js) and every row read below is
// filtered to that id — there is no way for a key to read another account's
// data, and no endpoint anywhere reads across accounts except this
// key→user_id lookup itself.
import { resolveApiKey } from './_lib/api-key-auth.js';

// store_name -> a one-line hint of what's in it, so a reader (human or
// Claude) doesn't have to guess the shape from raw JSON alone.
const STORE_NOTES = {
  auth: 'Local profile: name, career goal, gender, birth year, height, which nav sections are enabled.',
  trading: 'Accounts (demo/broker/prop-firm) and every trade, with derived P&L/pips.',
  accounting: 'Double-entry journal (source of truth), budgets, treasury accounts, échéances, corrections, goals — see src/utils/accounting-engine.js for how Bilan/CPC/ESG are derived from `journal`.',
  finance: 'Legacy pre-accounting-engine store — superseded by `accounting`, kept only for backward compatibility.',
  deals: 'PE/GE/VC deal log with per-deal task pipelines.',
  learning: 'Courses, chapters, checklists.',
  habits: 'Habit definitions, daily completion logs, energy/sleep/stress check-ins.',
  skills: 'The ~200-skill tree: level/XP/xpLog per skill (this is what Lifetime XP and the Leaderboard grade are computed from).',
  readings: 'Book reading progress by page/genre.',
  health: 'Workouts, nutrition logs, body composition, recovery, cycle tracking, goals.',
  business: 'Business/side-project tracking pipeline.',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await resolveApiKey(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const { userId, supabaseUrl, headers } = auth;

  const dataRes = await fetch(`${supabaseUrl}/rest/v1/app_state?user_id=eq.${userId}&select=store_name,data,updated_at`, { headers });
  if (!dataRes.ok) {
    console.error('[account-data] data fetch failed', dataRes.status, await dataRes.text());
    return res.status(502).json({ error: 'Could not load account data right now.' });
  }
  const rows = await dataRes.json();
  if (!rows.length) {
    return res.status(404).json({ error: 'No data found for this account — it may be local-only (never connected to cloud sync).' });
  }

  const stores = {};
  for (const row of rows) {
    stores[row.store_name] = { note: STORE_NOTES[row.store_name] || null, updatedAt: row.updated_at, data: row.data };
  }

  return res.status(200).json({
    note: "Every cloud-synced store for exactly ONE AUDAX account (this API key resolves to a single user_id — there is no cross-account access). Each store below is the raw persisted Zustand state, same shape the app itself reads.",
    exportedAt: new Date().toISOString(),
    stores,
  });
}
