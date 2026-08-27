import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { CAREER_STAGES, CAREER_STAGE_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Kanban-style application pipeline — same shape philosophy as dealsStore's
// deals[] (a flat entity moving through CAREER_STAGES) but simpler: no
// per-application task list, since a job application's real "work" already
// happens on Networking (outreach) and Engineering/Learning (skills built) —
// this store's job is just to track the funnel, not re-host effort logging.
const APP_XP = 4; // logging an application — the "did the outreach" credit
const STAGE_XP = 8; // advancing a stage — awarded to the stage-specific skill

const BADGE_DEFS = [
  { id: 'first-application', name: 'First Application', tier: 'bronze', check: (s) => s.applications.length >= 1 },
  { id: 'persistent', name: 'Persistent', tier: 'silver', check: (s) => s.applications.length >= 15 },
  { id: 'interview-landed', name: 'Interview Landed', tier: 'silver', check: (s) => s.applications.some((a) => CAREER_STAGES.indexOf(a.stage) >= CAREER_STAGES.indexOf('Interview')) },
  { id: 'offer-received', name: 'Offer Received', tier: 'gold', check: (s) => s.applications.some((a) => a.stage === 'Offer' || a.stage === 'Accepted') },
  { id: 'domain-diverse', name: 'Wide Net', tier: 'bronze', check: (s) => new Set(s.applications.map((a) => a.domain).filter(Boolean)).size >= 3 },
];

export const useCareerStore = create(
  persist(
    (set, get) => ({
      applications: [], // [{id, company, role, domain, stage, appliedDate, location, salary, url, notes, stageHistory:[{stage,date}], createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'written-communication-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addApplication: (data) => {
        if (!data.company?.trim() || !data.role?.trim()) return { ok: false, error: "L'entreprise et le rôle sont requis." };
        const app = {
          id: uid(),
          company: data.company.trim(),
          role: data.role.trim(),
          domain: data.domain || 'General',
          stage: 'Applied',
          appliedDate: data.appliedDate || todayKey(),
          location: data.location || '',
          salary: data.salary || '',
          url: data.url || '',
          notes: data.notes || '',
          stageHistory: [{ stage: 'Applied', date: todayKey() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ applications: [...get().applications, app] });
        useSkillStore.getState().awardXP('written-communication-lv1', APP_XP, `candidature : ${app.company}`);
        toast(`Candidature loggée : ${app.company} · +${APP_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: app.id };
      },
      editApplication: (id, updates) => set({ applications: get().applications.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a)) }),
      deleteApplication: (id) => {
        const app = get().applications.find((a) => a.id === id);
        set({ applications: get().applications.filter((a) => a.id !== id) });
        if (app) {
          const remove = useSkillStore.getState().removeXP;
          remove('written-communication-lv1', APP_XP, 'application deleted');
          for (const h of app.stageHistory || []) {
            const skillId = CAREER_STAGE_SKILL[h.stage] || 'written-communication-lv1';
            if (h.stage !== 'Applied') remove(skillId, STAGE_XP, 'application deleted');
          }
        }
        toast('Candidature supprimée', 'info');
      },

      // Moving to a NEW stage (not re-selecting the current one) awards XP to
      // that stage's skill and appends to stageHistory — the pipeline's audit
      // trail (when did this actually move, not just where is it now).
      setStage: (id, stage) => {
        const app = get().applications.find((a) => a.id === id);
        if (!app || app.stage === stage) return;
        set({
          applications: get().applications.map((a) =>
            a.id === id ? { ...a, stage, stageHistory: [...(a.stageHistory || []), { stage, date: todayKey() }], updatedAt: Date.now() } : a
          ),
        });
        if (stage !== 'Applied') {
          const skillId = CAREER_STAGE_SKILL[stage] || 'written-communication-lv1';
          useSkillStore.getState().awardXP(skillId, STAGE_XP, `${stage}: ${app.company}`);
          toast(`${app.company} → ${stage} · +${STAGE_XP} XP`, 'success');
        }
        get().checkBadges();
      },

      resetAll: () => set({ applications: [], awardedBadges: [] }),
    }),
    { name: 'audax-career' }
  )
);
