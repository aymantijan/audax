import { supabase, isSupabaseConfigured } from './supabase';

// Personal AI keys saved on the account (api/ai-keys.js): encrypted on the
// server, usable from every device, never read back in clear.
async function authHeaders() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null;
}

// → { ok: true, keys: [{ provider, last4, model, active }] } or { ok: false } (no account, offline…)
export async function fetchAccountKeys() {
  const headers = await authHeaders();
  if (!headers) return { ok: false };
  try {
    const res = await fetch('/api/ai-keys', { headers });
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return { ok: true, keys: body.keys || [] };
  } catch {
    return { ok: false };
  }
}

async function post(payload) {
  const headers = await authHeaders();
  if (!headers) return { ok: false };
  try {
    const res = await fetch('/api/ai-keys', { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!res.ok) return { ok: false };
    return { ok: true, keys: (await res.json()).keys || [] };
  } catch {
    return { ok: false };
  }
}

export const saveAccountKey = (provider, key, model) => post({ action: 'save', provider, key, model });
export const deleteAccountKey = (provider) => post({ action: 'delete', provider });
export const activateAccountKey = (provider) => post({ action: 'activate', provider });

// [{provider,last4,model,active}] → { active, keys: { [provider]: { last4, model } } }
export function toKeyState(list) {
  return {
    active: (list.find((k) => k.active) || {}).provider || null,
    keys: Object.fromEntries(list.map((k) => [k.provider, { last4: k.last4, model: k.model }])),
  };
}
