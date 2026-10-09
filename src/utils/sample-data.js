// Try a module without risk (étape 3): a few example records, clearly marked
// (`sample: true`), written straight into the store — no XP, no badges, no
// toasts — and removed in one tap. Real records are never touched.
import { useCreativeStore } from '../store/creativeStore';
import { uid, todayKey } from './formatters';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayKey(d); };
const stamp = (r) => ({ id: uid(), sample: true, createdAt: Date.now(), updatedAt: Date.now(), ...r });

const SAMPLES = {
  creative: {
    store: useCreativeStore, key: 'works',
    make: () => [stamp({ title: 'Œuvre d’exemple', medium: 'Autre', status: 'En cours', startDate: daysAgo(20), completedDate: '', notes: '' })],
  },
};

export const SAMPLE_MODULES = Object.keys(SAMPLES);
export const hasSampleFor = (module) => !!SAMPLES[module];

export function loadSample(module) {
  const s = SAMPLES[module];
  if (!s) return 0;
  const current = s.store.getState()[s.key] || [];
  if (current.some((r) => r.sample)) return 0; // already there
  const records = s.make();
  s.store.setState({ [s.key]: [...current, ...records] });
  return records.length;
}

export function clearSample(module) {
  const s = SAMPLES[module];
  if (!s) return;
  s.store.setState({ [s.key]: (s.store.getState()[s.key] || []).filter((r) => !r.sample) });
}

// Hook: number of example records currently in a module (0 when none).
export function useSampleCount(module) {
  const s = SAMPLES[module];
  // Hooks must run unconditionally: fall back to any sampled store.
  const store = s?.store || useCreativeStore;
  const key = s?.key || 'works';
  const n = store((st) => (st[key] || []).filter((r) => r.sample).length);
  return s ? n : 0;
}
