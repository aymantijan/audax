import { supabase, isSupabaseConfigured } from './supabase';

// Personal API key for external read access to a user's OWN data (currently:
// Finance/accounting — see api/finance-data.js). Deliberately NOT a Supabase
// JWT (those expire, aren't meant to be pasted into a third-party tool, and
// grant far more than read-only access to one dataset) — a separate,
// long-lived, narrow-scope secret the user can generate, share, and revoke
// independently of their login session.
//
// The raw key is generated and hashed entirely CLIENT-SIDE via Web Crypto —
// only the SHA-256 hash ever reaches Supabase (see supabase/schema.sql's
// api_keys table). The raw key is returned once, here, at creation time; it
// is never stored anywhere, so if the user loses it their only recourse is
// to generate a new one (which invalidates the old one, same as any other
// API key UX).

const PREFIX = 'audax_';

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(buf);
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return PREFIX + toHex(bytes);
}

// Returns { createdAt, lastUsedAt } if this user has a key on file, or null —
// never the key itself (it was never stored raw).
export async function getApiKeyStatus(userId) {
  if (!isSupabaseConfigured || !userId) return null;
  const { data, error } = await supabase.from('api_keys').select('created_at, last_used_at').eq('user_id', userId).maybeSingle();
  if (error) {
    console.error('[api-keys] status fetch failed:', error.message);
    return null;
  }
  return data ? { createdAt: data.created_at, lastUsedAt: data.last_used_at } : null;
}

// Generates a fresh key, stores only its hash (upsert — regenerating silently
// invalidates whatever key existed before, same as rotating any API key),
// and returns the raw key for one-time display. Throws on failure so the
// caller can show an error instead of silently displaying a key that was
// never actually saved.
export async function createOrRotateApiKey(userId) {
  if (!isSupabaseConfigured || !userId) throw new Error('Cloud sync is not configured on this deployment.');
  const key = randomKey();
  const keyHash = await sha256Hex(key);
  const { error } = await supabase
    .from('api_keys')
    .upsert({ user_id: userId, key_hash: keyHash, created_at: new Date().toISOString(), last_used_at: null }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return key;
}

export async function revokeApiKey(userId) {
  if (!isSupabaseConfigured || !userId) return;
  const { error } = await supabase.from('api_keys').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
