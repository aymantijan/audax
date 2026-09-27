import { supabase, isSupabaseConfigured } from './supabase';

// Calls /api/assistant (api/assistant.js) and streams the answer: onText(delta)
// is called as text arrives. Resolves with the full text. Rejects with an
// Error whose `code` is one of: not_configured, quota, busy, auth, offline, failed.
export async function askAssistant({ question, context, history, facts }, onText, { signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch('/api/assistant', { method: 'POST', headers, body: JSON.stringify({ question, context, history, facts }), signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw Object.assign(new Error('offline'), { code: 'offline' });
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    const code = res.status === 401 ? 'auth' : res.status === 404 ? 'not_configured' : body.error === 'quota' ? 'quota' : body.error === 'busy' || res.status === 429 ? 'busy' : body.error === 'not_configured' ? 'not_configured' : 'failed';
    throw Object.assign(new Error(code), { code, limit: body.limit });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (delta) { text += delta; onText?.(delta); }
  }
  return { text, used: Number(res.headers.get('X-Quota-Used')) || null, limit: Number(res.headers.get('X-Quota-Limit')) || null };
}

export const ASSISTANT_ERRORS = {
  not_configured: 'L’assistant n’est pas encore activé sur ce site : il manque la clé Gemini (gratuite) côté serveur.',
  quota: 'Tu as utilisé toutes tes questions du jour. Ça repart demain.',
  busy: 'Le service gratuit est très demandé en ce moment. Réessaie dans une minute.',
  auth: 'Connecte-toi (Paramètres → Synchronisation) pour utiliser l’assistant.',
  offline: 'Pas de connexion internet : l’assistant a besoin du réseau.',
  failed: 'L’assistant n’a pas pu répondre. Réessaie dans un instant.',
};

// Opens the assistant from anywhere (search, Aujourd'hui…), optionally with a question.
export const openAssistant = (question) => window.dispatchEvent(new CustomEvent('vaudax:assistant', { detail: { question } }));
