import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { FUNDRAISING_STAGES, FUNDRAISING_STAGE_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useNetworkingStore } from './networkingStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Investor pipeline for a founder raising capital — the mirror image of
// careerStore's applicant pipeline (same Kanban shape, same
// XP-on-stage-advance mechanic, same stale/conversion selectors), just from
// the other side of the table: investors moving through a fundraising funnel
// instead of a candidate moving through a hiring funnel.
const CONTACT_XP = 4;
const STAGE_XP = 8;

const BADGE_DEFS = [
  { id: 'first-investor', name: 'First Investor Contact', tier: 'bronze', check: (s) => s.investors.length >= 1 },
  { id: 'persistent', name: 'Wide Net', tier: 'silver', check: (s) => s.investors.length >= 15 },
  { id: 'term-sheet', name: 'Term Sheet Received', tier: 'silver', check: (s) => s.investors.some((i) => FUNDRAISING_STAGES.indexOf(i.stage) >= FUNDRAISING_STAGES.indexOf('Term Sheet') && i.stage !== 'Passed') },
  { id: 'round-closed', name: 'Round Closed', tier: 'gold', check: (s) => s.investors.some((i) => i.stage === 'Closed') },
  { id: 'diverse-captable', name: 'Diverse Cap Table', tier: 'bronze', check: (s) => new Set(s.investors.filter((i) => i.stage === 'Closed').map((i) => i.type)).size >= 3 },
];

export const useFundraisingStore = create(
  persist(
    (set, get) => ({
      investors: [], // [{id, name, firm, type, stage, amountTarget, amountCommitted, contactDate, url, notes, referralContactId, stageHistory:[{stage,date}], createdAt, updatedAt}]
      awardedBadges: [],
      roundTarget: 0, // 0 = no round size set yet

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'written-communication-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      setRoundTarget: (n) => set({ roundTarget: Math.max(0, Number(n) || 0) }),
      getRaiseProgress: () => {
        const committed = get().investors.filter((i) => i.stage === 'Closed').reduce((a, i) => a + (Number(i.amountCommitted) || 0), 0);
        const target = get().roundTarget;
        return { committed, target, pct: target > 0 ? Math.min(100, Math.round((committed / target) * 100)) : null };
      },

      addInvestor: (data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom est requis.' };
        const investor = {
          id: uid(),
          name: data.name.trim(),
          firm: data.firm || '',
          type: data.type || 'Angel',
          stage: 'Contacted',
          amountTarget: Number(data.amountTarget) || 0,
          amountCommitted: 0,
          contactDate: data.contactDate || todayKey(),
          url: data.url || '',
          notes: data.notes || '',
          referralContactId: data.referralContactId || '',
          stageHistory: [{ stage: 'Contacted', date: todayKey() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ investors: [...get().investors, investor] });
        useSkillStore.getState().awardXP('written-communication-lv1', CONTACT_XP, `investisseur contacté : ${investor.name}`);
        toast(`Investisseur ajouté : ${investor.name} · +${CONTACT_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: investor.id };
      },
      editInvestor: (id, updates) => {
        const clean = { ...updates };
        if (clean.amountTarget !== undefined) clean.amountTarget = Number(clean.amountTarget) || 0;
        if (clean.amountCommitted !== undefined) clean.amountCommitted = Number(clean.amountCommitted) || 0;
        set({ investors: get().investors.map((i) => (i.id === id ? { ...i, ...clean, updatedAt: Date.now() } : i)) });
      },
      deleteInvestor: (id) => {
        const investor = get().investors.find((i) => i.id === id);
        set({ investors: get().investors.filter((i) => i.id !== id) });
        if (investor) {
          const remove = useSkillStore.getState().removeXP;
          remove('written-communication-lv1', CONTACT_XP, 'investor deleted');
          for (const h of investor.stageHistory || []) {
            const skillId = FUNDRAISING_STAGE_SKILL[h.stage] || 'written-communication-lv1';
            if (h.stage !== 'Contacted') remove(skillId, STAGE_XP, 'investor deleted');
          }
        }
        toast('Investisseur supprimé', 'info');
      },

      // Same shape as careerStore.setStage, including the referral nudge —
      // an investor introduced by a Networking contact advancing a stage is
      // exactly when that referrer deserves an update.
      setStage: (id, stage) => {
        const investor = get().investors.find((i) => i.id === id);
        if (!investor || investor.stage === stage) return;
        set({
          investors: get().investors.map((i) =>
            i.id === id ? { ...i, stage, stageHistory: [...(i.stageHistory || []), { stage, date: todayKey() }], updatedAt: Date.now() } : i
          ),
        });
        if (stage !== 'Contacted') {
          const skillId = FUNDRAISING_STAGE_SKILL[stage] || 'written-communication-lv1';
          useSkillStore.getState().awardXP(skillId, STAGE_XP, `${stage}: ${investor.name}`);
          toast(`${investor.name} → ${stage} · +${STAGE_XP} XP`, 'success');
        }
        if (investor.referralContactId && stage !== 'Contacted' && stage !== 'Passed') {
          useNetworkingStore.getState().nudgeFollowUp(investor.referralContactId);
        }
        get().checkBadges();
      },

      // Open-pipeline investors with no stageHistory movement in `days` —
      // same convention as careerStore.getStaleApplications.
      getStaleInvestors: (days = 14, today = todayKey()) => {
        const cutoffMs = new Date(`${today}T00:00:00`).getTime() - days * 86400000;
        return get()
          .investors.filter((i) => i.stage !== 'Closed' && i.stage !== 'Passed')
          .map((i) => {
            const lastMoveDate = i.stageHistory?.length ? i.stageHistory[i.stageHistory.length - 1].date : i.contactDate;
            return { investor: i, lastMoveDate, staleMs: cutoffMs - new Date(`${lastMoveDate}T00:00:00`).getTime() };
          })
          .filter((x) => x.staleMs >= 0)
          .sort((a, b) => b.staleMs - a.staleMs);
      },

      resetAll: () => set({ investors: [], awardedBadges: [], roundTarget: 0 }),
    }),
    { name: 'audax-fundraising' }
  )
);
