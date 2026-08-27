import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Lightweight personal CRM — contacts + a touch history per contact (each
// logged interaction: call, coffee, email…), so "when did I last actually
// talk to this person" is a real answered question, not a guess. Mirrors the
// dealsStore/engineeringStore shape (flat entity array + evaluateBadges +
// awardXP-on-real-work) rather than inventing a new pattern.
const TOUCH_XP = 3; // logging a real interaction
const CONTACT_XP = 5; // adding a new contact — the "did the outreach work" credit

const BADGE_DEFS = [
  { id: 'first-contact', name: 'First Contact', tier: 'bronze', check: (s) => s.contacts.length >= 1 },
  { id: 'network-builder', name: 'Network Builder', tier: 'silver', check: (s) => s.contacts.length >= 15 },
  { id: 'network-veteran', name: 'Network Veteran', tier: 'gold', check: (s) => s.contacts.length >= 50 },
  { id: 'first-touch', name: 'First Follow-Up', tier: 'bronze', check: (s) => s.contacts.some((c) => (c.touches || []).length >= 1) },
  { id: 'consistent-networker', name: 'Consistent Networker', tier: 'silver', check: (s) => s.contacts.reduce((a, c) => a + (c.touches || []).length, 0) >= 20 },
  { id: 'domain-diverse', name: 'Cross-Domain Network', tier: 'silver', check: (s) => new Set(s.contacts.map((c) => c.domain).filter(Boolean)).size >= 4 },
  { id: 'role-model-linked', name: 'Role Model Linked', tier: 'bronze', check: (s) => s.contacts.some((c) => c.linkedPersonalityName) },
];

export const useNetworkingStore = create(
  persist(
    (set, get) => ({
      contacts: [], // [{id, name, role, org, domain, email, phone, notes, linkedPersonalityName, nextFollowUpDate, touches:[{id,date,note}], createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'networking-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addContact: (data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom est requis.' };
        const contact = {
          id: uid(),
          name: data.name.trim(),
          role: data.role || '',
          org: data.org || '',
          domain: data.domain || 'General',
          email: data.email || '',
          phone: data.phone || '',
          notes: data.notes || '',
          linkedPersonalityName: data.linkedPersonalityName || '',
          nextFollowUpDate: data.nextFollowUpDate || '',
          touches: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ contacts: [...get().contacts, contact] });
        useSkillStore.getState().awardXP('networking-lv1', CONTACT_XP, `contact ajouté : ${contact.name}`);
        toast(`Contact ajouté : ${contact.name} · +${CONTACT_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: contact.id };
      },
      editContact: (id, updates) => set({ contacts: get().contacts.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)) }),
      deleteContact: (id) => {
        const c = get().contacts.find((x) => x.id === id);
        set({ contacts: get().contacts.filter((x) => x.id !== id) });
        if (c) {
          const remove = useSkillStore.getState().removeXP;
          remove('networking-lv1', CONTACT_XP, 'contact deleted');
          for (const t of c.touches || []) remove('client-relationship-lv1', TOUCH_XP, 'contact deleted');
        }
        toast('Contact supprimé', 'info');
      },
      getContact: (id) => get().contacts.find((c) => c.id === id),

      // A logged touch bumps lastContactDate implicitly (it IS the latest
      // touches[] entry) and clears the follow-up reminder once acted on —
      // the user re-sets nextFollowUpDate explicitly if they want another one.
      logTouch: (contactId, data) => {
        const contact = get().getContact(contactId);
        if (!contact) return;
        const touch = { id: uid(), date: data.date || todayKey(), type: data.type || 'Autre', note: data.note || '', createdAt: Date.now() };
        set({
          contacts: get().contacts.map((c) =>
            c.id === contactId ? { ...c, touches: [...(c.touches || []), touch], nextFollowUpDate: data.nextFollowUpDate ?? c.nextFollowUpDate, updatedAt: Date.now() } : c
          ),
        });
        useSkillStore.getState().awardXP('client-relationship-lv1', TOUCH_XP, `contact: ${contact.name}`);
        toast(`Contact loggé : ${contact.name} · +${TOUCH_XP} XP`, 'success');
        get().checkBadges();
      },
      deleteTouch: (contactId, touchId) => {
        const contact = get().getContact(contactId);
        if (!contact) return;
        useSkillStore.getState().removeXP('client-relationship-lv1', TOUCH_XP, 'touch deleted');
        set({ contacts: get().contacts.map((c) => (c.id === contactId ? { ...c, touches: (c.touches || []).filter((t) => t.id !== touchId), updatedAt: Date.now() } : c)) });
        get().checkBadges();
      },

      // Contacts with a nextFollowUpDate today-or-earlier (overdue) or within
      // `days` — same shape/convention as engineeringStore.getDeadlineAlerts.
      // Returns a fresh array — call inside a useMemo, never as a bare
      // `useNetworkingStore(s => s.getFollowUpAlerts())` selector.
      getFollowUpAlerts: (days = 7, today = todayKey()) => {
        const cutoff = new Date(new Date(`${today}T00:00:00`).getTime() + days * 86400000).toISOString().slice(0, 10);
        return get().contacts
          .filter((c) => c.nextFollowUpDate && c.nextFollowUpDate <= cutoff)
          .map((c) => ({ contact: c, overdue: c.nextFollowUpDate < today }))
          .sort((a, b) => (a.contact.nextFollowUpDate < b.contact.nextFollowUpDate ? -1 : 1));
      },

      // Relationship tier — "who am I neglecting" at a glance, derived from
      // the most recent touch (falling back to createdAt if never touched
      // yet, so a brand-new contact reads as warm, not cold). hot ≤14d,
      // warm ≤45d, else cold. Returns a fresh value each call — safe here
      // since it's called per-row in a render loop, never as a bare
      // `useNetworkingStore(s => s.getContactTier(...))` selector.
      getContactTier: (contact, today = todayKey()) => {
        const lastTouch = [...(contact.touches || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const lastDate = lastTouch?.date || new Date(contact.createdAt).toISOString().slice(0, 10);
        const days = Math.floor((new Date(`${today}T00:00:00`) - new Date(`${lastDate}T00:00:00`)) / 86400000);
        if (days <= 14) return 'hot';
        if (days <= 45) return 'warm';
        return 'cold';
      },

      // Nudges a contact's next-follow-up date forward — called by
      // careerStore when a referred application advances a stage, so the
      // referrer doesn't go silent right when they'd want a "thanks, moving
      // to interview" update. Never pulls a date CLOSER than one already set.
      nudgeFollowUp: (contactId, days = 3) => {
        const contact = get().getContact(contactId);
        if (!contact) return;
        const candidate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        if (contact.nextFollowUpDate && contact.nextFollowUpDate <= candidate) return;
        set({ contacts: get().contacts.map((c) => (c.id === contactId ? { ...c, nextFollowUpDate: candidate, updatedAt: Date.now() } : c)) });
        toast(`Relance planifiée pour ${contact.name} suite à l'avancement d'une candidature référée`, 'info');
      },

      resetAll: () => set({ contacts: [], awardedBadges: [] }),
    }),
    { name: 'audax-networking' }
  )
);
