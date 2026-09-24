// Vercel serverless function — receives closed positions from the AUDAX Sync
// Expert Advisor running in the user's MetaTrader 5 terminal
// (public/downloads/AUDAX_Sync.mq5).
//
// Auth: a dedicated MT5 SYNC KEY (not the read-only personal API key). Only
// its SHA-256 hash is stored, in the user's own app_state row
// `mt5_sync_key` (written by the app under RLS, see src/services/mt5-sync.js).
// The key is WRITE-ONLY by design: it can append positions to the user's
// `mt5_inbox` row and nothing else — it cannot read any AUDAX data, so a key
// left on a VPS or in a terminal exposes nothing.
//
// The app pulls `mt5_inbox` and imports new positions into the linked
// trading account (dedup by position id), see src/hooks/useMt5Sync.js.
import crypto from 'crypto';

const MAX_POSITIONS_PER_CALL = 1000;
const MAX_KEPT_PER_LOGIN = 3000;

const sha256Hex = (t) => crypto.createHash('sha256').update(t).digest('hex');
const str = (v, max = 64) => String(v ?? '').slice(0, max);
const numOk = (v) => typeof v === 'number' && Number.isFinite(v);
const tsOk = (v) => Number.isInteger(v) && v > 946684800 && v < 4102444800; // 2000 → 2100, unix seconds (UTC)

function cleanPosition(p) {
  if (!p || typeof p !== 'object') return null;
  const position = str(p.position, 24);
  if (!/^\d{1,24}$/.test(position)) return null;
  const type = p.type === 'sell' ? 'sell' : p.type === 'buy' ? 'buy' : null;
  if (!type || !str(p.symbol, 32)) return null;
  if (!tsOk(p.openTime) || !tsOk(p.closeTime)) return null;
  for (const k of ['volume', 'openPrice', 'closePrice', 'profit']) if (!numOk(p[k])) return null;
  return {
    position, symbol: str(p.symbol, 32), type, volume: p.volume,
    openTime: p.openTime, openPrice: p.openPrice, sl: numOk(p.sl) ? p.sl : 0, tp: numOk(p.tp) ? p.tp : 0,
    closeTime: p.closeTime, closePrice: p.closePrice,
    commission: numOk(p.commission) ? p.commission : 0, swap: numOk(p.swap) ? p.swap : 0, profit: p.profit,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: 'MT5 sync is not configured on this deployment.' });

  const key = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!/^audaxmt5_[0-9a-f]{48}$/.test(key)) return res.status(401).json({ error: 'Missing or malformed MT5 sync key.' });
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // Key → user (the only cross-user lookup, by an unguessable hash).
  const lookup = await fetch(`${supabaseUrl}/rest/v1/app_state?store_name=eq.mt5_sync_key&data->>keyHash=eq.${sha256Hex(key)}&select=user_id`, { headers });
  if (!lookup.ok) { console.error('[mt5-sync] key lookup failed', lookup.status, await lookup.text()); return res.status(502).json({ error: 'Could not verify the key right now.' }); }
  const rows = await lookup.json();
  if (!rows.length) return res.status(401).json({ error: 'Invalid or revoked MT5 sync key — generate a new one in AUDAX › Trading › Accounts.' });
  const userId = rows[0].user_id;

  const body = req.body || {};
  const login = str(body.login, 20);
  if (!/^\d{1,20}$/.test(login)) return res.status(400).json({ error: 'Invalid account login.' });
  const incoming = Array.isArray(body.positions) ? body.positions.slice(0, MAX_POSITIONS_PER_CALL).map(cleanPosition).filter(Boolean) : [];

  // Read-merge-write the inbox row. Concurrent terminals may race; the EA
  // re-sends recent days on every sync, so anything lost is re-sent later.
  const inboxRes = await fetch(`${supabaseUrl}/rest/v1/app_state?user_id=eq.${userId}&store_name=eq.mt5_inbox&select=data`, { headers });
  if (!inboxRes.ok) return res.status(502).json({ error: 'Could not read the inbox.' });
  const inbox = (await inboxRes.json())[0]?.data || {};
  inbox.accounts = inbox.accounts || {};
  inbox.positions = inbox.positions || {};

  const known = new Map((inbox.positions[login] || []).map((p) => [p.position, p]));
  let added = 0;
  for (const p of incoming) { if (!known.has(p.position)) added++; known.set(p.position, p); }
  inbox.positions[login] = [...known.values()].sort((a, b) => b.closeTime - a.closeTime).slice(0, MAX_KEPT_PER_LOGIN);
  inbox.accounts[login] = {
    name: str(body.name, 80), server: str(body.server, 80), company: str(body.company, 80), currency: str(body.currency, 3).toUpperCase() || 'USD',
    balance: numOk(body.balance) ? body.balance : null, equity: numOk(body.equity) ? body.equity : null, demo: body.demo === true,
    firstDeposit: numOk(body.firstDeposit) ? body.firstDeposit : null, firstDepositTime: tsOk(body.firstDepositTime) ? body.firstDepositTime : null,
    ea: str(body.ea, 12), lastSync: Date.now(),
  };

  const save = await fetch(`${supabaseUrl}/rest/v1/app_state?on_conflict=user_id,store_name`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, store_name: 'mt5_inbox', data: inbox, updated_at: new Date().toISOString() }),
  });
  if (!save.ok) { console.error('[mt5-sync] save failed', save.status, await save.text()); return res.status(502).json({ error: 'Could not save positions.' }); }
  return res.status(200).json({ ok: true, received: incoming.length, added, kept: inbox.positions[login].length });
}
