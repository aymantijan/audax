// Personal AI keys saved per account (table ai_keys, migration 009), encrypted
// with AES-256-GCM. The encryption key is derived from the server-only
// SUPABASE_SERVICE_ROLE_KEY, so the table alone (or a leaked backup) never
// reveals a key. If that service key is ever rotated, saved keys can no longer
// be read: people just enter theirs again.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const vaultKey = () => createHash('sha256').update(`vaudax-ai-keys:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`).digest();

export function encryptSecret(plain, key = vaultKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptSecret(b64, key = vaultKey()) {
  const buf = Buffer.from(String(b64), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

const PROVIDERS = ['gemini', 'claude', 'openai', 'openrouter'];

function rest(path, init = {}, fetchImpl = fetch) {
  const url = process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Promise.resolve(null);
  return fetchImpl(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export const vaultAvailable = () => !!(process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// [{ provider, last4, model, active }] — never the key itself.
export async function listKeys(userId, { fetchImpl } = {}) {
  const res = await rest(`ai_keys?user_id=eq.${encodeURIComponent(userId)}&select=provider,last4,model,active`, {}, fetchImpl);
  if (!res?.ok) return [];
  return res.json();
}

export async function saveKey(userId, provider, key, model = '', { fetchImpl } = {}) {
  if (!PROVIDERS.includes(provider)) return { ok: false, error: 'bad_provider' };
  const existing = await listKeys(userId, { fetchImpl });
  const hasActive = existing.some((k) => k.active && k.provider !== provider);
  const row = {
    user_id: userId, provider, secret: encryptSecret(key.trim()), last4: key.trim().slice(-4),
    model: String(model || '').trim().slice(0, 120), active: !hasActive, updated_at: new Date().toISOString(),
  };
  const res = await rest('ai_keys?on_conflict=user_id,provider', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) }, fetchImpl);
  return res?.ok ? { ok: true } : { ok: false, error: 'save_failed' };
}

export async function deleteKey(userId, provider, { fetchImpl } = {}) {
  const res = await rest(`ai_keys?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${encodeURIComponent(provider)}`, { method: 'DELETE' }, fetchImpl);
  return { ok: !!res?.ok };
}

// provider = null → back to the site's shared service.
export async function setActiveKey(userId, provider, { fetchImpl } = {}) {
  const uid = encodeURIComponent(userId);
  await rest(`ai_keys?user_id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }, fetchImpl);
  if (provider) await rest(`ai_keys?user_id=eq.${uid}&provider=eq.${encodeURIComponent(provider)}`, { method: 'PATCH', body: JSON.stringify({ active: true }) }, fetchImpl);
  return { ok: true };
}

// The account's key in use, decrypted — for the AI endpoints only. null if none.
export async function activeKeyFor(userId, { fetchImpl } = {}) {
  if (!vaultAvailable() || !userId || userId === 'local') return null;
  const res = await rest(`ai_keys?user_id=eq.${encodeURIComponent(userId)}&active=is.true&select=provider,secret,model&limit=1`, {}, fetchImpl);
  if (!res?.ok) return null;
  const [row] = await res.json();
  if (!row) return null;
  try {
    return { provider: row.provider, key: decryptSecret(row.secret), model: row.model || null };
  } catch {
    console.error('[key-vault] cannot decrypt saved key (service key rotated?)');
    return null;
  }
}
