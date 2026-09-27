import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Personal AI keys (Gemini, Claude, ChatGPT, OpenRouter). Kept ONLY on this
// device: this store is deliberately not in the cloud-sync REGISTRY nor in
// the data export. Keys are filed per account, so on a shared device a
// different account never uses someone else's key.
// byOwner: { [ownerId]: { active: provider|null, keys: { [provider]: { key, model } } } }
export const AI_PROVIDERS = [
  { key: 'gemini', label: 'Gemini', defaultModel: 'automatique (le plus récent)', where: 'aistudio.google.com/apikey', free: 'Offre gratuite disponible' },
  { key: 'claude', label: 'Claude', defaultModel: 'claude-haiku-4-5-20251001', where: 'console.anthropic.com → API Keys', free: 'Payant à l’usage' },
  { key: 'openai', label: 'ChatGPT', defaultModel: 'gpt-4o-mini', where: 'platform.openai.com/api-keys', free: 'Payant à l’usage' },
  { key: 'openrouter', label: 'OpenRouter', defaultModel: 'openrouter/auto', where: 'openrouter.ai/keys', free: 'Modèles gratuits « :free » disponibles' },
];

export function currentOwnerId() {
  try {
    const owner = JSON.parse(localStorage.getItem('audax-data-owner') || 'null');
    if (owner) return String(owner);
    const auth = JSON.parse(localStorage.getItem('audax-auth') || 'null');
    const u = auth?.state?.user;
    return u ? `local-${u.createdAt || u.name}` : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

const empty = () => ({ active: null, keys: {} });

export const useAiKeyStore = create(
  persist(
    (set, get) => ({
      byOwner: {},
      mine: () => get().byOwner[currentOwnerId()] || empty(),
      setKey: (provider, key, model = '') => {
        const id = currentOwnerId();
        const cur = get().byOwner[id] || empty();
        const keys = { ...cur.keys, [provider]: { key: key.trim(), model: model.trim() } };
        set({ byOwner: { ...get().byOwner, [id]: { active: cur.active || provider, keys } } });
      },
      removeKey: (provider) => {
        const id = currentOwnerId();
        const cur = get().byOwner[id] || empty();
        const { [provider]: _gone, ...keys } = cur.keys;
        const active = cur.active === provider ? Object.keys(keys)[0] || null : cur.active;
        set({ byOwner: { ...get().byOwner, [id]: { active, keys } } });
      },
      setActive: (provider) => {
        const id = currentOwnerId();
        const cur = get().byOwner[id] || empty();
        set({ byOwner: { ...get().byOwner, [id]: { ...cur, active: provider } } });
      },
    }),
    { name: 'vaudax-ai-keys' },
  ),
);

// Headers for the active personal key, or {} to use the site's shared AI.
export function aiKeyHeaders() {
  const mine = useAiKeyStore.getState().mine();
  const k = mine.active && mine.keys[mine.active];
  if (!k?.key) return {};
  return { 'X-AI-Provider': mine.active, 'X-AI-Key': k.key, ...(k.model ? { 'X-AI-Model': k.model } : {}) };
}
