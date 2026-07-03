import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { DEAL_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

// XP a logged deal awards. Deal-type skills +10 each, plus cross-cutting PE competencies.
// awardXP no-ops on locked skills, so awards to still-locked masteries are safe.
export function dealAwardsFor(deal) {
  const out = (DEAL_SKILL[deal.type] || []).map((skillId) => ({ skillId, amount: 10 }));
  out.push({ skillId: 'pe-deal-sourcing', amount: 3 });
  out.push({ skillId: 'pe-acquisition-valuation', amount: 5 });
  out.push({ skillId: 'three-statement-modeling-lv1', amount: 5 });
  return out;
}

export const useDealsStore = create(
  persist(
    (set, get) => ({
      deals: [],

      addDeal: (data) => {
        const deal = { ...data, id: uid(), size: Number(data.size) || 0, createdAt: Date.now(), updatedAt: Date.now() };
        set({ deals: [...get().deals, deal] });
        const award = useSkillStore.getState().awardXP;
        const awards = dealAwardsFor(deal);
        for (const { skillId, amount } of awards) award(skillId, amount, `deal: ${deal.name}`);

        const sameType = get().deals.filter((d) => d.type === deal.type).length;
        const milestone = sameType === 3 ? ` · ${deal.type} milestone (3 logged)` : '';
        toast(`Deal logged: ${deal.name} · +${awards.reduce((a, x) => a + x.amount, 0)} PE XP${milestone}`, 'success');
        return deal.id;
      },

      editDeal: (id, updates) => set({ deals: get().deals.map((d) => (d.id === id ? { ...d, ...updates, size: Number(updates.size ?? d.size), updatedAt: Date.now() } : d)) }),

      deleteDeal: (id) => {
        const deal = get().deals.find((d) => d.id === id);
        set({ deals: get().deals.filter((d) => d.id !== id) });
        if (deal) {
          const remove = useSkillStore.getState().removeXP;
          for (const { skillId, amount } of dealAwardsFor(deal)) remove(skillId, amount, 'deal deleted');
        }
        toast('Deal deleted', 'info');
      },

      resetAll: () => set({ deals: [] }),
    }),
    { name: 'audax-deals' }
  )
);
