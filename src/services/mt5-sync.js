import { supabase, isSupabaseConfigured } from './supabase';

// MT5 live sync (Trading n°5). The AUDAX_Sync Expert Advisor posts closed
// positions to /api/mt5-sync with a dedicated WRITE-ONLY key; they land in
// the user's `mt5_inbox` app_state row, which the app reads here and imports.
//
// Key handling mirrors api-keys.js: the raw key is generated client-side,
// shown once, and only its SHA-256 hash is stored — in the user's own
// app_state row `mt5_sync_key` (RLS: only this user can read/write it). These
// two rows are NOT in cloud-sync's REGISTRY, so the regular sync never
// overwrites them.

const KEY_ROW = 'mt5_sync_key';
const INBOX_ROW = 'mt5_inbox';

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (text) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export const mt5SyncAvailable = () => isSupabaseConfigured;

async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

/** { createdAt } if a sync key exists, null otherwise, undefined if not signed in to the cloud. */
export async function getSyncKeyStatus() {
  const userId = await currentUserId();
  if (!userId) return undefined;
  const { data, error } = await supabase.from('app_state').select('data').eq('user_id', userId).eq('store_name', KEY_ROW).maybeSingle();
  if (error) { console.error('[mt5-sync] key status failed:', error.message); return null; }
  return data?.data?.keyHash ? { createdAt: data.data.createdAt } : null;
}

/** New key (replaces any previous one — the old EA key stops working). Returns the raw key, shown once. */
export async function createSyncKey() {
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in with cloud sync enabled to use MT5 live sync.');
  const key = `audaxmt5_${toHex(crypto.getRandomValues(new Uint8Array(24)))}`;
  const { error } = await supabase.from('app_state').upsert(
    { user_id: userId, store_name: KEY_ROW, data: { keyHash: await sha256Hex(key), createdAt: new Date().toISOString() }, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,store_name' },
  );
  if (error) throw new Error(error.message);
  return key;
}

export async function revokeSyncKey() {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from('app_state').delete().eq('user_id', userId).eq('store_name', KEY_ROW);
  if (error) throw new Error(error.message);
}

/** { accounts: { [login]: meta }, positions: { [login]: [...] } } or null. */
export async function fetchInbox() {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabase.from('app_state').select('data').eq('user_id', userId).eq('store_name', INBOX_ROW).maybeSingle();
  if (error) { console.error('[mt5-sync] inbox fetch failed:', error.message); return null; }
  return data?.data || { accounts: {}, positions: {} };
}
