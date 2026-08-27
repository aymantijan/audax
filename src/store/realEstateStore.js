import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Rental property portfolio — a new asset class alongside Trading (markets)
// and PE/Business (private companies): real estate. Deliberately simple (no
// mortgage amortization schedule, no depreciation) — purchase price, current
// value, rent, and expenses are enough to compute cap rate and cash flow,
// which is the actual decision-relevant signal for a landlord.
const ADD_XP = 3; // tracking a prospect — routine logging
const ACQUIRE_XP = 15; // property actually acquired — real milestone
const RENT_XP = 3; // logging a rent payment received
const LOG_SKILL = 'budget-control-lv1'; // real, unlocked-from-start (life-skills.js)
// Real, but LOCKED until dcf-analysis-lv1 reaches Lv2 (skill-tree-data.js) —
// same intentional "advanced milestone locked behind a prerequisite" shape
// as dealsStore's pe-acquisition-valuation. awardXP silently no-ops until
// unlocked; that's expected, not a bug.
const ACQUIRE_SKILL = 'real-estate-investment-lv1';

const BADGE_DEFS = [
  { id: 'first-property', name: 'First Property', tier: 'bronze', check: (s) => s.properties.some((p) => p.status === 'Acquis' || p.status === 'Loué') },
  { id: 'portfolio-builder', name: 'Portfolio Builder', tier: 'silver', check: (s) => s.properties.filter((p) => p.status === 'Acquis' || p.status === 'Loué').length >= 3 },
  { id: 'cashflow-positive', name: 'Cash-Flow Positive', tier: 'silver', check: (s) => s.properties.some((p) => (p.monthlyRent || 0) > (p.monthlyExpenses || 0)) },
  { id: 'diversified', name: 'Diversified Portfolio', tier: 'bronze', check: (s) => new Set(s.properties.map((p) => p.type)).size >= 3 },
];

const r1 = (n) => Math.round(n * 10) / 10;

export const useRealEstateStore = create(
  persist(
    (set, get) => ({
      properties: [], // [{id, name, type, status, address, purchasePrice, currentValue, monthlyRent, monthlyExpenses, purchaseDate, notes, rentLogs:[{id,date,amount,note,createdAt}], createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), LOG_SKILL);
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addProperty: (data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom est requis.' };
        const property = {
          id: uid(),
          name: data.name.trim(),
          type: data.type || 'Appartement',
          status: data.status || 'Recherche',
          address: data.address || '',
          purchasePrice: Number(data.purchasePrice) || 0,
          currentValue: Number(data.currentValue) || 0,
          monthlyRent: Number(data.monthlyRent) || 0,
          monthlyExpenses: Number(data.monthlyExpenses) || 0,
          purchaseDate: data.purchaseDate || '',
          notes: data.notes || '',
          rentLogs: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ properties: [...get().properties, property] });
        useSkillStore.getState().awardXP(LOG_SKILL, ADD_XP, `bien ajouté : ${property.name}`);
        toast(`Bien ajouté : ${property.name} · +${ADD_XP} XP`, 'success');
        if (property.status === 'Acquis' || property.status === 'Loué') {
          useSkillStore.getState().awardXP(ACQUIRE_SKILL, ACQUIRE_XP, `bien acquis : ${property.name}`);
        }
        get().checkBadges();
        return { ok: true, id: property.id };
      },
      editProperty: (id, updates) => {
        const clean = { ...updates };
        for (const k of ['purchasePrice', 'currentValue', 'monthlyRent', 'monthlyExpenses']) if (clean[k] !== undefined) clean[k] = Number(clean[k]) || 0;
        set({ properties: get().properties.map((p) => (p.id === id ? { ...p, ...clean, updatedAt: Date.now() } : p)) });
      },
      deleteProperty: (id) => {
        const property = get().properties.find((p) => p.id === id);
        set({ properties: get().properties.filter((p) => p.id !== id) });
        if (property) {
          const remove = useSkillStore.getState().removeXP;
          remove(LOG_SKILL, ADD_XP, 'property deleted');
          if (property.status === 'Acquis' || property.status === 'Loué') remove(ACQUIRE_SKILL, ACQUIRE_XP, 'property deleted');
          for (const _ of property.rentLogs || []) remove(LOG_SKILL, RENT_XP, 'property deleted');
        }
        toast('Bien supprimé', 'info');
      },

      // Awards the acquisition milestone on the transition INTO Acquis/Loué
      // (not on every re-set), same XP-on-transition shape used across every
      // stage-based store this session (careerStore/contentStore/creativeStore).
      setStatus: (id, status) => {
        const property = get().properties.find((p) => p.id === id);
        if (!property || property.status === status) return;
        const wasOwned = property.status === 'Acquis' || property.status === 'Loué';
        const nowOwned = status === 'Acquis' || status === 'Loué';
        set({
          properties: get().properties.map((p) =>
            p.id === id ? { ...p, status, purchaseDate: nowOwned && !p.purchaseDate ? todayKey() : p.purchaseDate, updatedAt: Date.now() } : p
          ),
        });
        if (nowOwned && !wasOwned) {
          useSkillStore.getState().awardXP(ACQUIRE_SKILL, ACQUIRE_XP, `bien acquis : ${property.name}`);
          toast(`Acquis : ${property.name} · +${ACQUIRE_XP} XP`, 'success');
        }
        get().checkBadges();
      },

      logRent: (id, data) => {
        const property = get().properties.find((p) => p.id === id);
        if (!property) return;
        const entry = { id: uid(), date: data.date || todayKey(), amount: Number(data.amount) || 0, note: data.note || '', createdAt: Date.now() };
        set({ properties: get().properties.map((p) => (p.id === id ? { ...p, rentLogs: [...(p.rentLogs || []), entry], updatedAt: Date.now() } : p)) });
        useSkillStore.getState().awardXP(LOG_SKILL, RENT_XP, `loyer reçu : ${property.name}`);
        toast(`Loyer loggé : ${property.name} · +${RENT_XP} XP`, 'success');
      },
      deleteRentLog: (id, logId) => {
        useSkillStore.getState().removeXP(LOG_SKILL, RENT_XP, 'rent log deleted');
        set({ properties: get().properties.map((p) => (p.id === id ? { ...p, rentLogs: (p.rentLogs || []).filter((l) => l.id !== logId), updatedAt: Date.now() } : p)) });
      },

      // Cap rate = annual net operating income / purchase price. Portfolio
      // totals only count owned properties (Acquis/Loué) — a prospect being
      // researched shouldn't inflate "your" cash flow.
      getPortfolioStats: () => {
        const owned = get().properties.filter((p) => p.status === 'Acquis' || p.status === 'Loué');
        const totalValue = owned.reduce((a, p) => a + (p.currentValue || p.purchasePrice || 0), 0);
        const monthlyRent = owned.reduce((a, p) => a + (p.monthlyRent || 0), 0);
        const monthlyExpenses = owned.reduce((a, p) => a + (p.monthlyExpenses || 0), 0);
        const totalCost = owned.reduce((a, p) => a + (p.purchasePrice || 0), 0);
        const annualNOI = (monthlyRent - monthlyExpenses) * 12;
        const avgCapRate = totalCost > 0 ? r1((annualNOI / totalCost) * 100) : null;
        return { count: owned.length, totalValue, monthlyRent, monthlyExpenses, monthlyCashFlow: monthlyRent - monthlyExpenses, avgCapRate };
      },
      getCapRate: (property) => {
        if (!property.purchasePrice) return null;
        const annualNOI = ((property.monthlyRent || 0) - (property.monthlyExpenses || 0)) * 12;
        return r1((annualNOI / property.purchasePrice) * 100);
      },

      resetAll: () => set({ properties: [], awardedBadges: [] }),
    }),
    { name: 'audax-realestate' }
  )
);
