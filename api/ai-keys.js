// Personal AI keys of the signed-in account (api/_lib/key-vault.js).
//   GET                          → { keys: [{ provider, last4, model, active }], vault }
//   POST { action: 'save', provider, key, model }
//   POST { action: 'delete', provider }
//   POST { action: 'activate', provider | null }
// A key goes in once and never comes back out: only its last 4 characters.
import { verifyUser } from './_lib/ai-guard.js';
import { listKeys, saveKey, deleteKey, setActiveKey, vaultAvailable } from './_lib/key-vault.js';

const PROVIDERS = ['gemini', 'claude', 'openai', 'openrouter'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!vaultAvailable()) return res.status(503).json({ error: 'vault_unavailable' });
  const userId = await verifyUser(req);
  if (!userId || userId === 'local') return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') return res.status(200).json({ keys: await listKeys(userId), vault: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, provider, key, model } = req.body || {};
  if (provider != null && !PROVIDERS.includes(provider)) return res.status(400).json({ error: 'bad_provider' });
  let out;
  if (action === 'save') {
    if (typeof key !== 'string' || key.trim().length < 8 || key.length > 400) return res.status(400).json({ error: 'bad_key' });
    out = await saveKey(userId, provider, key, model);
  } else if (action === 'delete') out = await deleteKey(userId, provider);
  else if (action === 'activate') out = await setActiveKey(userId, provider || null);
  else return res.status(400).json({ error: 'bad_action' });
  if (!out.ok) return res.status(502).json({ error: out.error || 'failed' });
  return res.status(200).json({ keys: await listKeys(userId) });
}
