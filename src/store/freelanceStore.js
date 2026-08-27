import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Lightweight client/engagement tracker for freelancers and consultants —
// deliberately simpler than businessStore (no double-entry ledger, no
// Gantt): a client engagement is hours logged + payments received, not a
// formally structured venture. Same "lighter than the formal version"
// reasoning projectsStore already established relative to businessStore.
const ENGAGEMENT_XP = 5; // adding a new client engagement
const HOURS_XP = 2; // logging a work session — routine effort credit
const PAYMENT_XP = 6; // an invoice actually getting paid
const COMPLETE_XP = 12; // engagement reaches 'Terminé'
const HOURS_SKILL = 'client-relationship-lv1'; // real, unlocked-from-start (skill-tree-data.js)
const CASHFLOW_SKILL = 'ge-cashflow-mgmt'; // real, unlocked-from-start (professional-skills.js)

const BADGE_DEFS = [
  { id: 'first-client', name: 'First Client', tier: 'bronze', check: (s) => s.engagements.length >= 1 },
  { id: 'five-clients', name: 'Growing Practice', tier: 'silver', check: (s) => s.engagements.length >= 5 },
  { id: 'hundred-hours', name: 'Hundred Hours', tier: 'silver', check: (s) => s.engagements.reduce((a, e) => a + (e.hoursLogged || 0), 0) >= 100 },
  { id: 'ten-k', name: 'Five-Figure Freelancer', tier: 'gold', check: (s) => s.engagements.reduce((a, e) => a + (e.paidTotal || 0), 0) >= 10000 },
  { id: 'long-term', name: 'Long-Term Client', tier: 'bronze', check: (s) => s.engagements.some((e) => e.startDate && Date.now() - new Date(`${e.startDate}T00:00:00`).getTime() >= 90 * 86400000 && e.status !== 'Terminé') },
];

export const useFreelanceStore = create(
  persist(
    (set, get) => ({
      engagements: [], // [{id, clientName, description, status, hourlyRate, hoursLogged, invoicedTotal, paidTotal, startDate, endDate, notes, timeLogs:[{id,date,hours,note,createdAt}], payments:[{id,date,amount,note,createdAt}], createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), HOURS_SKILL);
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addEngagement: (data) => {
        if (!data.clientName?.trim()) return { ok: false, error: 'Le nom du client est requis.' };
        const engagement = {
          id: uid(),
          clientName: data.clientName.trim(),
          description: data.description || '',
          status: data.status || 'Prospect',
          hourlyRate: Number(data.hourlyRate) || 0,
          hoursLogged: 0,
          invoicedTotal: 0,
          paidTotal: 0,
          startDate: data.startDate || todayKey(),
          endDate: '',
          notes: data.notes || '',
          timeLogs: [],
          payments: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ engagements: [...get().engagements, engagement] });
        useSkillStore.getState().awardXP(HOURS_SKILL, ENGAGEMENT_XP, `client : ${engagement.clientName}`);
        toast(`Client ajouté : ${engagement.clientName} · +${ENGAGEMENT_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: engagement.id };
      },
      editEngagement: (id, updates) => {
        const clean = { ...updates };
        if (clean.hourlyRate !== undefined) clean.hourlyRate = Number(clean.hourlyRate) || 0;
        set({ engagements: get().engagements.map((e) => (e.id === id ? { ...e, ...clean, updatedAt: Date.now() } : e)) });
      },
      deleteEngagement: (id) => {
        const engagement = get().engagements.find((e) => e.id === id);
        set({ engagements: get().engagements.filter((e) => e.id !== id) });
        if (engagement) {
          const remove = useSkillStore.getState().removeXP;
          remove(HOURS_SKILL, ENGAGEMENT_XP, 'engagement deleted');
          for (const _ of engagement.timeLogs || []) remove(HOURS_SKILL, HOURS_XP, 'engagement deleted');
          for (const _ of engagement.payments || []) remove(CASHFLOW_SKILL, PAYMENT_XP, 'engagement deleted');
          if (engagement.status === 'Terminé') remove(CASHFLOW_SKILL, COMPLETE_XP, 'engagement deleted');
        }
        toast('Client supprimé', 'info');
      },

      setStatus: (id, status) => {
        const engagement = get().engagements.find((e) => e.id === id);
        if (!engagement || engagement.status === status) return;
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, status, endDate: status === 'Terminé' ? todayKey() : e.endDate, updatedAt: Date.now() } : e
          ),
        });
        if (status === 'Terminé') {
          useSkillStore.getState().awardXP(CASHFLOW_SKILL, COMPLETE_XP, `mission terminée : ${engagement.clientName}`);
          toast(`Mission terminée : ${engagement.clientName} · +${COMPLETE_XP} XP`, 'success');
        }
        get().checkBadges();
      },

      logHours: (id, data) => {
        const engagement = get().engagements.find((e) => e.id === id);
        if (!engagement) return;
        const entry = { id: uid(), date: data.date || todayKey(), hours: Number(data.hours) || 0, note: data.note || '', createdAt: Date.now() };
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, timeLogs: [...(e.timeLogs || []), entry], hoursLogged: (e.hoursLogged || 0) + entry.hours, updatedAt: Date.now() } : e
          ),
        });
        useSkillStore.getState().awardXP(HOURS_SKILL, HOURS_XP, `${entry.hours}h · ${engagement.clientName}`);
        toast(`${entry.hours}h loggées · +${HOURS_XP} XP`, 'success');
      },
      deleteTimeLog: (id, logId) => {
        const engagement = get().engagements.find((e) => e.id === id);
        const log = engagement?.timeLogs.find((t) => t.id === logId);
        if (!log) return;
        useSkillStore.getState().removeXP(HOURS_SKILL, HOURS_XP, 'time log deleted');
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, timeLogs: e.timeLogs.filter((t) => t.id !== logId), hoursLogged: Math.max(0, (e.hoursLogged || 0) - log.hours), updatedAt: Date.now() } : e
          ),
        });
      },

      // Distinct from timeLogs — a payment is cash actually received, not
      // hours worked. invoicedTotal/paidTotal stay separate so "billed but
      // not yet paid" (aging) is visible at a glance.
      logPayment: (id, data) => {
        const engagement = get().engagements.find((e) => e.id === id);
        if (!engagement) return;
        const entry = { id: uid(), date: data.date || todayKey(), amount: Number(data.amount) || 0, note: data.note || '', createdAt: Date.now() };
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, payments: [...(e.payments || []), entry], paidTotal: (e.paidTotal || 0) + entry.amount, updatedAt: Date.now() } : e
          ),
        });
        useSkillStore.getState().awardXP(CASHFLOW_SKILL, PAYMENT_XP, `paiement reçu : ${engagement.clientName}`);
        toast(`Paiement loggé : ${engagement.clientName} · +${PAYMENT_XP} XP`, 'success');
        get().checkBadges();
      },
      setInvoicedTotal: (id, amount) => set({ engagements: get().engagements.map((e) => (e.id === id ? { ...e, invoicedTotal: Number(amount) || 0, updatedAt: Date.now() } : e)) }),

      // Hours actually logged this month, across all engagements — the
      // freelance equivalent of a utilization rate (no fixed weekly-hours
      // target exists app-wide, so this reports the raw number rather than
      // a % of a target that doesn't exist yet).
      getMonthStats: (today = todayKey()) => {
        const monthPrefix = today.slice(0, 7);
        const engagements = get().engagements;
        const hours = engagements.flatMap((e) => e.timeLogs || []).filter((t) => t.date.startsWith(monthPrefix)).reduce((a, t) => a + t.hours, 0);
        const revenue = engagements.flatMap((e) => e.payments || []).filter((p) => p.date.startsWith(monthPrefix)).reduce((a, p) => a + p.amount, 0);
        return { hours, revenue };
      },

      resetAll: () => set({ engagements: [], awardedBadges: [] }),
    }),
    { name: 'audax-freelance' }
  )
);
