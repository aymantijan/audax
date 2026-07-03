import { createClient } from '@supabase/supabase-js';

// Supabase is OPTIONAL. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env
// file to turn on real cloud auth (email verification, password reset, 2FA, JWT
// sessions with auto-refresh). Until then the app runs on the local-first profile.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// supabase.auth handles JWT + refresh-token rotation + persistence for us
// (browser can't hold httpOnly cookies without a server; the SDK stores the session
// securely and auto-refreshes — this is the client-side equivalent of the spec's
// session management).
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
