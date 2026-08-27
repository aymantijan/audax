import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Creative practice tracker for artists/musicians/writers — deliberately NOT
// shaped like contentStore (which is about personal-brand posts and their
// social engagement). A creative's unit of work is a piece (painting, song,
// manuscript) moving from idea to finished, and a showcase (exhibition,
// concert, publication) is the real-world "did it reach an audience" signal
// — success here isn't measured in likes.
//
// Practice HOURS deliberately are NOT re-implemented here — focusStore
// already has a working session timer; this store just reads focusStore's
// sessions filtered to domain === 'Creative' (see getPracticeMinutes) rather
// than duplicating a timer feature. Log practice from /focus, tagged Creative.
const WORK_XP = 5; // starting a new work
const COMPLETE_XP = 10; // finishing a work
const SHOWCASE_XP = 12; // exhibiting / performing / publishing it
const WORK_SKILL = 'deep-focus-lv1'; // real, unlocked-from-start (life-skills.js)
const SHOWCASE_SKILL = 'presentation-skills-lv1'; // real, unlocked-from-start (skill-tree-data.js)

const BADGE_DEFS = [
  { id: 'first-work', name: 'First Work', tier: 'bronze', check: (s) => s.works.length >= 1 },
  { id: 'five-works', name: 'Growing Body of Work', tier: 'silver', check: (s) => s.works.filter((w) => w.status === 'Terminé').length >= 5 },
  { id: 'first-showcase', name: 'First Showcase', tier: 'bronze', check: (s) => s.showcases.length >= 1 },
  { id: 'prolific', name: 'Prolific Creator', tier: 'gold', check: (s) => s.works.filter((w) => w.status === 'Terminé').length >= 10 },
  { id: 'multi-medium', name: 'Multi-Medium', tier: 'bronze', check: (s) => new Set(s.works.map((w) => w.medium)).size >= 3 },
];

export const useCreativeStore = create(
  persist(
    (set, get) => ({
      works: [], // [{id, title, medium, status, startDate, completedDate, notes, createdAt, updatedAt}]
      showcases: [], // [{id, workId, title, venue, type, date, url, notes, createdAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), WORK_SKILL);
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addWork: (data) => {
        if (!data.title?.trim()) return { ok: false, error: 'Le titre est requis.' };
        const work = {
          id: uid(),
          title: data.title.trim(),
          medium: data.medium || 'Autre',
          status: data.status || 'Idée',
          startDate: data.startDate || todayKey(),
          completedDate: '',
          notes: data.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ works: [...get().works, work] });
        useSkillStore.getState().awardXP(WORK_SKILL, WORK_XP, `œuvre : ${work.title}`);
        toast(`Œuvre ajoutée : ${work.title} · +${WORK_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: work.id };
      },
      // Awards completion XP on the transition INTO 'Terminé' — same
      // XP-on-transition shape as careerStore/contentStore, so re-editing an
      // already-finished work never double-pays.
      editWork: (id, updates) => {
        const prev = get().works.find((w) => w.id === id);
        if (!prev) return;
        const becameComplete = prev.status !== 'Terminé' && updates.status === 'Terminé';
        const clean = { ...updates };
        if (becameComplete && !clean.completedDate) clean.completedDate = todayKey();
        set({ works: get().works.map((w) => (w.id === id ? { ...w, ...clean, updatedAt: Date.now() } : w)) });
        if (becameComplete) {
          useSkillStore.getState().awardXP(WORK_SKILL, COMPLETE_XP, `œuvre terminée : ${prev.title}`);
          toast(`Terminé : ${prev.title} · +${COMPLETE_XP} XP`, 'success');
        }
        get().checkBadges();
      },
      deleteWork: (id) => {
        const work = get().works.find((w) => w.id === id);
        const linkedShowcases = get().showcases.filter((s) => s.workId === id);
        set({ works: get().works.filter((w) => w.id !== id), showcases: get().showcases.filter((s) => s.workId !== id) });
        if (work) {
          const remove = useSkillStore.getState().removeXP;
          remove(WORK_SKILL, WORK_XP, 'work deleted');
          if (work.status === 'Terminé') remove(WORK_SKILL, COMPLETE_XP, 'work deleted');
          for (const _ of linkedShowcases) remove(SHOWCASE_SKILL, SHOWCASE_XP, 'work deleted');
        }
        toast('Œuvre supprimée', 'info');
      },

      addShowcase: (data) => {
        if (!data.title?.trim()) return { ok: false, error: 'Le titre est requis.' };
        const showcase = {
          id: uid(),
          workId: data.workId || '',
          title: data.title.trim(),
          venue: data.venue || '',
          type: data.type || 'Autre',
          date: data.date || todayKey(),
          url: data.url || '',
          notes: data.notes || '',
          createdAt: Date.now(),
        };
        set({ showcases: [...get().showcases, showcase] });
        useSkillStore.getState().awardXP(SHOWCASE_SKILL, SHOWCASE_XP, `showcase : ${showcase.title}`);
        toast(`Showcase ajouté : ${showcase.title} · +${SHOWCASE_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: showcase.id };
      },
      deleteShowcase: (id) => {
        const showcase = get().showcases.find((s) => s.id === id);
        set({ showcases: get().showcases.filter((s) => s.id !== id) });
        if (showcase) useSkillStore.getState().removeXP(SHOWCASE_SKILL, SHOWCASE_XP, 'showcase deleted');
        toast('Showcase supprimé', 'info');
      },

      resetAll: () => set({ works: [], showcases: [], awardedBadges: [] }),
    }),
    { name: 'audax-creative' }
  )
);
