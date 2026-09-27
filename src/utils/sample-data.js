// Try a module without risk (étape 3): a few example records, clearly marked
// (`sample: true`), written straight into the store — no XP, no badges, no
// toasts — and removed in one tap. Real records are never touched.
import { useCareerStore } from '../store/careerStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useRealEstateStore } from '../store/realEstateStore';
import { useFundraisingStore } from '../store/fundraisingStore';
import { useCreativeStore } from '../store/creativeStore';
import { useDealsStore } from '../store/dealsStore';
import { useAccountingStore } from '../store/accountingStore';
import { uid, todayKey } from './formatters';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayKey(d); };
const stamp = (r) => ({ id: uid(), sample: true, createdAt: Date.now(), updatedAt: Date.now(), ...r });

const SAMPLES = {
  career: {
    store: useCareerStore, key: 'applications',
    make: () => [
      stamp({ company: 'Exemple SA', role: 'Chargé·e de projet', domain: 'Général', stage: 'Interview', appliedDate: daysAgo(12), location: '', salary: '', url: '', notes: 'Candidature d’exemple.', referralContactId: '', planId: '', type: '', interviews: [], prep: { companyNotes: '', questionIds: [], storyIds: [], askThem: '' }, offer: null, stageHistory: [{ stage: 'Applied', date: daysAgo(12) }, { stage: 'Interview', date: daysAgo(3) }] }),
      stage2(),
    ],
  },
  freelance: {
    store: useFreelanceStore, key: 'engagements',
    make: () => [stamp({ clientName: 'Client exemple', description: 'Mission d’exemple', status: 'Actif', hourlyRate: 40, currency: useAccountingStore.getState().baseCurrency || 'EUR', clientEmail: '', clientAddress: '', clientTaxId: '', hoursLogged: 6, invoicedTotal: 0, paidTotal: 0, startDate: daysAgo(10), endDate: '', notes: '', timeLogs: [{ id: uid(), date: daysAgo(2), hours: 6, note: 'Atelier', createdAt: Date.now() }], payments: [] })],
  },
  realEstate: {
    store: useRealEstateStore, key: 'properties',
    make: () => [stamp({ name: 'Studio exemple', type: 'Appartement', status: 'Loué', address: '', purchasePrice: 80000, currentValue: 85000, monthlyRent: 550, monthlyExpenses: 120, purchaseDate: daysAgo(400), notes: '', rentLogs: [] })],
  },
  fundraising: {
    store: useFundraisingStore, key: 'investors',
    make: () => [stamp({ name: 'Investisseur exemple', firm: 'Fonds exemple', type: 'Angel', stage: 'Meeting', amountTarget: 50000, amountCommitted: 0, contactDate: daysAgo(8), url: '', notes: '', referralContactId: '', stageHistory: [{ stage: 'Contacted', date: daysAgo(8) }] })],
  },
  creative: {
    store: useCreativeStore, key: 'works',
    make: () => [stamp({ title: 'Œuvre d’exemple', medium: 'Autre', status: 'En cours', startDate: daysAgo(20), completedDate: '', notes: '' })],
  },
  pe: {
    store: useDealsStore, key: 'deals',
    make: () => [stamp({ name: 'Projet exemple — LBO', type: 'LBO', size: 25000000, role: 'Modeling', status: 'ongoing', firm: 'Fonds exemple', date: daysAgo(15), notes: '', tasks: [], stageIndex: 2, stageStatus: 'in-progress' })],
  },
};

function stage2() {
  return stamp({ company: 'Autre exemple SARL', role: 'Stage', domain: 'Général', stage: 'Applied', appliedDate: daysAgo(4), location: '', salary: '', url: '', notes: '', referralContactId: '', planId: '', type: '', interviews: [], prep: { companyNotes: '', questionIds: [], storyIds: [], askThem: '' }, offer: null, stageHistory: [{ stage: 'Applied', date: daysAgo(4) }] });
}

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
  const store = s?.store || useCareerStore;
  const key = s?.key || 'applications';
  const n = store((st) => (st[key] || []).filter((r) => r.sample).length);
  return s ? n : 0;
}
