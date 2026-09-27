// F7 · error log: sends crashes seen in users' browsers to the Supabase table
// public.client_errors (insert-only, see supabase/migrations/007). Nothing
// personal is sent: the error message, stack, page path, app version and
// browser. At most 10 distinct errors per page load.
import { supabase, isSupabaseConfigured } from './supabase';

const MAX_PER_LOAD = 10;
const sent = new Set();
const cut = (s, n) => (s == null ? null : String(s).slice(0, n));
// eslint-disable-next-line no-undef
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export async function logError(kind, error, extra = '') {
  try {
    if (!isSupabaseConfigured || sent.size >= MAX_PER_LOAD) return;
    const message = cut(error?.message || String(error || 'Unknown error'), 1000);
    const key = `${kind}:${message}`;
    if (sent.has(key)) return;
    sent.add(key);
    const { data } = await supabase.auth.getSession();
    await supabase.from('client_errors').insert({
      kind,
      message,
      stack: cut([error?.stack, extra].filter(Boolean).join('\n--\n'), 4000),
      url: cut(window.location.pathname, 500), // path only: no query string, no personal data
      app_version: cut(APP_VERSION, 40),
      user_agent: cut(navigator.userAgent, 300),
      user_id: data?.session?.user?.id || null,
    });
  } catch { /* the logger must never throw */ }
}

export function installErrorLog() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => { if (e.error || e.message) logError('error', e.error || { message: e.message }); });
  window.addEventListener('unhandledrejection', (e) => logError('unhandledrejection', e.reason));
}
