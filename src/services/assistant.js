import { aiRequestHeaders } from './ai-headers';

// Calls /api/assistant (api/assistant.js) and streams the answer: onText(delta)
// is called as text arrives. Resolves with the full text. Rejects with an
// Error whose `code` is one of: not_configured, quota, busy, auth, offline, failed.
export async function askAssistant({ question, context, history, facts }, onText, { signal } = {}) {
  const headers = await aiRequestHeaders();
  let res;
  try {
    res = await fetch('/api/assistant', { method: 'POST', headers, body: JSON.stringify({ question, context, history, facts }), signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw Object.assign(new Error('offline'), { code: 'offline' });
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    const code = res.status === 401 ? 'auth' : res.status === 404 ? 'not_configured' : ['quota', 'bad_key', 'no_credit', 'bad_model', 'not_configured'].includes(body.error) ? body.error : body.error === 'busy' || res.status === 429 ? 'busy' : 'failed';
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
  not_configured: 'Aucune clé d’IA pour l’instant : ajoute la tienne dans Paramètres → Assistant (Gemini a une offre gratuite).',
  bad_key: 'Ta clé d’IA est refusée par le fournisseur : vérifie-la dans Paramètres → Assistant.',
  bad_model: 'Ce modèle d’IA n’existe pas ou plus chez le fournisseur : laisse le champ Modèle vide dans Paramètres → Assistant.',
  no_credit: 'Ton compte chez le fournisseur d’IA n’a plus de crédit : recharge-le ou choisis une autre clé dans Paramètres → Assistant.',
  quota: 'Tu as utilisé les questions gratuites du jour. Ça repart demain, ou ajoute ta propre clé dans Paramètres → Assistant.',
  busy: 'Le service gratuit est très demandé en ce moment. Réessaie dans une minute.',
  auth: 'Connecte-toi (Paramètres → Synchronisation) pour utiliser l’assistant.',
  offline: 'Pas de connexion internet : l’assistant a besoin du réseau.',
  failed: 'L’assistant n’a pas pu répondre. Réessaie dans un instant.',
};

// Checks a key before saving it: one tiny question with that key only.
// Resolves { ok: true } or { ok: false, code }.
export async function testAiKey(provider, key, model) {
  const headers = { ...(await aiRequestHeaders()), 'X-AI-Provider': provider, 'X-AI-Key': key.trim() };
  if (model?.trim()) headers['X-AI-Model'] = model.trim();
  else delete headers['X-AI-Model'];
  try {
    const res = await fetch('/api/assistant', { method: 'POST', headers, body: JSON.stringify({ question: 'Réponds uniquement : OK', context: {} }) });
    if (res.ok) { await res.text(); return { ok: true }; }
    const body = await res.json().catch(() => ({}));
    const code = res.status === 404 ? 'not_configured' : res.status === 401 ? 'auth' : body.error || 'failed';
    return { ok: false, code };
  } catch {
    return { ok: false, code: 'offline' };
  }
}

// Opens the assistant from anywhere (search, Aujourd'hui…), optionally with a question.
export const openAssistant = (question) => window.dispatchEvent(new CustomEvent('vaudax:assistant', { detail: { question } }));
