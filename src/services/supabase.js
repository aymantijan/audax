import { createClient } from '@supabase/supabase-js';

// Supabase is OPTIONAL. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env
// file to turn on real cloud auth (email verification, password reset, 2FA, JWT
// sessions with auto-refresh). Until then the app runs on the local-first profile.
//
// IMPORTANT: a missing OR malformed URL must NEVER crash the whole app. createClient
// throws synchronously on an invalid URL — at module-eval time that took the entire
// SPA down to a black screen. So we clean + validate first and construct the client
// defensively; if anything is off, Supabase features simply stay disabled.
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// CI env files can wrap values in quotes or leave stray whitespace/newlines —
// strip them so a value like '"https://x.supabase.co"' doesn't read as invalid.
function clean(v) {
  return v == null ? '' : String(v).trim().replace(/^["']+|["']+$/g, '');
}
const url = clean(rawUrl);
const anonKey = clean(rawKey);

function isValidHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(url && anonKey && isValidHttpUrl(url));

// supabase.auth handles JWT + refresh-token rotation + persistence for us
// (browser can't hold httpOnly cookies without a server; the SDK stores the session
// securely and auto-refreshes — this is the client-side equivalent of the spec's
// session management).
let client = null;
if (isSupabaseConfigured) {
  try {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (err) {
    // Never let a client-init failure black-screen the app — degrade to local-first.
    console.error('Supabase init failed — cloud features disabled:', err?.message || err);
    client = null;
  }
} else if (rawUrl || rawKey) {
  // Configured but invalid — surface why, without crashing.
  console.warn('Supabase env present but invalid — cloud features disabled. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
}

export const supabase = client;
