import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';
import { useAccountingStore } from './accountingStore';
import { invoiceTotals, addDaysKey } from '../utils/invoice';

const FREELANCE_INCOME = '721'; // Classe 7 · Freelance & consulting (utils/chart-of-accounts.js)
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Cash-basis bookkeeping: a received payment = treasury (5xx) debit / 721
// credit in Finances, converted to the base currency when the client pays
// in another one (the original amount is kept in entry.fx).
function postIncome({ date, amount, currency, account, label }) {
  const acc = useAccountingStore.getState();
  const foreign = currency && currency !== acc.baseCurrency;
  const baseAmt = foreign ? r2(acc.toBase(amount, currency)) : r2(amount);
  if (!(baseAmt > 0)) return { ok: false, error: 'Montant invalide.' };
  return acc.addEntry({
    date, label,
    lines: [{ account, debit: baseAmt, credit: 0 }, { account: FREELANCE_INCOME, debit: 0, credit: baseAmt }],
    ...(foreign ? { fx: { currency, amount: r2(amount), rate: baseAmt / amount } } : {}),
  });
}

// Lightweight client/engagement tracker for freelancers and consultants —
// deliberately simpler than businessStore's formal tier (no double-entry
// ledger, no Gantt): a client engagement is hours logged + payments
// received, not a formally structured venture. Same "lighter than the
// formal version" reasoning businessStore's tier: 'leger' side-projects use.
const ENGAGEMENT_XP = 5; // adding a new client engagement
const HOURS_XP = 2; // logging a work session — routine effort credit
const PAYMENT_XP = 6; // an invoice actually getting paid
const COMPLETE_XP = 12; // engagement reaches 'Terminé'
const HOURS_SKILL = 'client-relationship-lv1'; // real, unlocked-from-start (skill-tree-data.js)
const CASHFLOW_SKILL = 'ge-cashflow-mgmt'; // real, unlocked-from-start (professional-skills.js)

const BADGE_DEFS = [
  { id: 'first-client', name: 'Premier client', tier: 'bronze', check: (s) => s.engagements.length >= 1 },
  { id: 'five-clients', name: 'Activité qui grandit', tier: 'silver', check: (s) => s.engagements.length >= 5 },
  { id: 'hundred-hours', name: 'Cent heures', tier: 'silver', check: (s) => s.engagements.reduce((a, e) => a + (e.hoursLogged || 0), 0) >= 100 },
  { id: 'ten-k', name: 'Freelance à 5 chiffres', tier: 'gold', check: (s) => s.engagements.reduce((a, e) => a + (e.paidTotal || 0), 0) >= 10000 },
  { id: 'long-term', name: 'Client fidèle', tier: 'bronze', check: (s) => s.engagements.some((e) => e.startDate && Date.now() - new Date(`${e.startDate}T00:00:00`).getTime() >= 90 * 86400000 && e.status !== 'Terminé') },
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
          currency: data.currency || useAccountingStore.getState().baseCurrency || 'MAD',
          clientEmail: data.clientEmail || '', clientAddress: data.clientAddress || '', clientTaxId: data.clientTaxId || '',
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
        if (!engagement) return null;
        const entry = { id: uid(), date: data.date || todayKey(), amount: Number(data.amount) || 0, note: data.note || '', invoiceId: data.invoiceId || '', entryId: '', account: '', createdAt: Date.now() };
        if (data.account) {
          const res = postIncome({ date: entry.date, amount: entry.amount, currency: engagement.currency, account: data.account, label: `Freelance — ${engagement.clientName}${entry.note ? ` (${entry.note})` : ''}` });
          if (res.ok) { entry.entryId = res.id; entry.account = data.account; } else toast(`Paiement noté, mais pas comptabilisé : ${res.error}`, 'error');
        }
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, payments: [...(e.payments || []), entry], paidTotal: (e.paidTotal || 0) + entry.amount, updatedAt: Date.now() } : e
          ),
        });
        useSkillStore.getState().awardXP(CASHFLOW_SKILL, PAYMENT_XP, `paiement reçu : ${engagement.clientName}`);
        toast(`Paiement enregistré : ${engagement.clientName}${entry.entryId ? ' · comptabilisé dans Finances' : ''} · +${PAYMENT_XP} XP`, 'success');
        get().checkBadges();
        return entry.id;
      },
      // Book an older payment (logged before the Finances link) — once.
      postPayment: (id, paymentId, account) => {
        const e = get().engagements.find((x) => x.id === id);
        const p = e?.payments.find((x) => x.id === paymentId);
        if (!p || p.entryId) return;
        const res = postIncome({ date: p.date, amount: p.amount, currency: e.currency, account, label: `Freelance — ${e.clientName}${p.note ? ` (${p.note})` : ''}` });
        if (!res.ok) return toast(res.error, 'error');
        set({ engagements: get().engagements.map((x) => (x.id === id ? { ...x, payments: x.payments.map((q) => (q.id === paymentId ? { ...q, entryId: res.id, account } : q)) } : x)) });
      },
      deletePayment: (id, paymentId) => {
        const e = get().engagements.find((x) => x.id === id);
        const p = e?.payments.find((x) => x.id === paymentId);
        if (!p) return;
        if (p.entryId) useAccountingStore.getState().deleteEntry(p.entryId);
        useSkillStore.getState().removeXP(CASHFLOW_SKILL, PAYMENT_XP, 'payment deleted');
        set({
          engagements: get().engagements.map((x) => (x.id === id ? { ...x, payments: x.payments.filter((q) => q.id !== paymentId), paidTotal: Math.max(0, r2((x.paidTotal || 0) - p.amount)), updatedAt: Date.now() } : x)),
          invoices: (get().invoices || []).map((inv) => (inv.paymentId === paymentId ? { ...inv, status: 'sent', paymentId: '', paidAt: '' } : inv)),
        });
        toast(p.entryId ? 'Paiement supprimé (et son écriture dans Finances)' : 'Paiement supprimé', 'info');
      },

      // ── Invoices (Carrière n°4) ──
      invoiceSettings: { prefix: 'FAC', nextNumber: 1, issuerName: '', issuerAddress: '', issuerEmail: '', issuerPhone: '', taxIds: '', bankDetails: '', paymentTermsDays: 30, vatRate: 0, footer: '' },
      setInvoiceSettings: (s) => set({ invoiceSettings: { ...get().invoiceSettings, ...s } }),
      invoices: [], // [{ id, number, engagementId, date, dueDate, lines: [{ id, description, qty, unitPrice }], vatRate, currency, status: 'sent'|'paid'|'cancelled', paymentId, paidAt, timeLogIds, notes, createdAt }]
      createInvoice: (engagementId, data) => {
        const e = get().engagements.find((x) => x.id === engagementId);
        if (!e) return { ok: false, error: 'Client introuvable.' };
        const lines = (data.lines || []).filter((l) => String(l.description || '').trim() && Number(l.qty) > 0).map((l) => ({ id: uid(), description: String(l.description).trim(), qty: Number(l.qty), unitPrice: Number(l.unitPrice) || 0 }));
        if (!lines.length) return { ok: false, error: 'Ajoute au moins une ligne.' };
        const st = get().invoiceSettings;
        const date = data.date || todayKey();
        const number = `${st.prefix || 'FAC'}-${date.slice(0, 4)}-${String(st.nextNumber || 1).padStart(3, '0')}`;
        const inv = {
          id: uid(), number, engagementId, date, dueDate: data.dueDate || addDaysKey(date, Number(st.paymentTermsDays) || 30),
          lines, vatRate: Number(data.vatRate ?? st.vatRate) || 0, currency: e.currency || useAccountingStore.getState().baseCurrency,
          status: 'sent', paymentId: '', paidAt: '', timeLogIds: data.timeLogIds || [], notes: data.notes || '', createdAt: Date.now(),
        };
        const logIds = new Set(inv.timeLogIds);
        set({
          invoices: [...(get().invoices || []), inv],
          invoiceSettings: { ...st, nextNumber: (st.nextNumber || 1) + 1 },
          engagements: get().engagements.map((x) => (x.id === engagementId ? { ...x, timeLogs: (x.timeLogs || []).map((t) => (logIds.has(t.id) ? { ...t, invoiceId: inv.id } : t)), updatedAt: Date.now() } : x)),
        });
        toast(`Facture ${number} créée`, 'success');
        return { ok: true, id: inv.id };
      },
      cancelInvoice: (invoiceId) => {
        const inv = (get().invoices || []).find((i) => i.id === invoiceId);
        if (!inv || inv.status === 'paid') return;
        set({
          invoices: get().invoices.map((i) => (i.id === invoiceId ? { ...i, status: 'cancelled' } : i)),
          engagements: get().engagements.map((x) => (x.id === inv.engagementId ? { ...x, timeLogs: (x.timeLogs || []).map((t) => (t.invoiceId === invoiceId ? { ...t, invoiceId: '' } : t)) } : x)),
        });
        toast(`Facture ${inv.number} annulée — les heures redeviennent facturables`, 'info');
      },
      markInvoiceReminded: (invoiceId, date = todayKey()) => set({
        invoices: get().invoices.map((i) => (i.id === invoiceId ? { ...i, reminders: [...(i.reminders || []), date] } : i)),
      }),

      // ── Quotes (devis): same lines as an invoice; an accepted quote becomes one ──
      quotes: [], // [{ id, number, engagementId, date, validUntil, lines, vatRate, currency, status: 'sent'|'accepted'|'refused'|'invoiced', invoiceId, notes, createdAt }]
      createQuote: (engagementId, data) => {
        const e = get().engagements.find((x) => x.id === engagementId);
        if (!e) return { ok: false, error: 'Client introuvable.' };
        const lines = (data.lines || []).filter((l) => String(l.description || '').trim() && Number(l.qty) > 0).map((l) => ({ id: uid(), description: String(l.description).trim(), qty: Number(l.qty), unitPrice: Number(l.unitPrice) || 0 }));
        if (!lines.length) return { ok: false, error: 'Ajoute au moins une ligne.' };
        const st = get().invoiceSettings;
        const date = data.date || todayKey();
        const n = st.nextQuoteNumber || 1;
        const quote = {
          id: uid(), number: `${st.quotePrefix || 'DEV'}-${date.slice(0, 4)}-${String(n).padStart(3, '0')}`, engagementId, date,
          validUntil: data.validUntil || addDaysKey(date, 30), lines, vatRate: Number(data.vatRate ?? st.vatRate) || 0,
          currency: e.currency || useAccountingStore.getState().baseCurrency, status: 'sent', invoiceId: '', notes: data.notes || '', createdAt: Date.now(),
        };
        set({ quotes: [...(get().quotes || []), quote], invoiceSettings: { ...st, nextQuoteNumber: n + 1 } });
        toast(`Devis ${quote.number} créé`, 'success');
        return { ok: true, id: quote.id };
      },
      setQuoteStatus: (quoteId, status) => set({ quotes: (get().quotes || []).map((q) => (q.id === quoteId ? { ...q, status } : q)) }),
      quoteToInvoice: (quoteId) => {
        const q = (get().quotes || []).find((x) => x.id === quoteId);
        if (!q || q.status === 'invoiced') return { ok: false, error: 'Devis déjà facturé.' };
        const res = get().createInvoice(q.engagementId, { lines: q.lines, vatRate: q.vatRate, notes: `Selon devis ${q.number}.${q.notes ? ` ${q.notes}` : ''}` });
        if (!res.ok) return res;
        set({ quotes: get().quotes.map((x) => (x.id === quoteId ? { ...x, status: 'invoiced', invoiceId: res.id } : x)) });
        return res;
      },
      deleteQuote: (quoteId) => set({ quotes: (get().quotes || []).filter((q) => q.id !== quoteId) }),

      // Paid in full: records the payment (and its Finances entry when an account is given).
      payInvoice: (invoiceId, { date, account }) => {
        const inv = (get().invoices || []).find((i) => i.id === invoiceId);
        if (!inv || inv.status !== 'sent') return;
        const paymentId = get().logPayment(inv.engagementId, { date: date || todayKey(), amount: invoiceTotals(inv).total, note: inv.number, invoiceId, account });
        if (!paymentId) return;
        set({ invoices: get().invoices.map((i) => (i.id === invoiceId ? { ...i, status: 'paid', paymentId, paidAt: date || todayKey() } : i)) });
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
        // In the base currency (clients may pay in another one).
        const acc = useAccountingStore.getState();
        const toBase = (amt, cur) => (cur && cur !== acc.baseCurrency ? acc.toBase(amt, cur) : amt);
        const revenue = r2(engagements.reduce((sum, e) => sum + (e.payments || []).filter((p) => p.date.startsWith(monthPrefix)).reduce((a, p) => a + toBase(p.amount, e.currency), 0), 0));
        return { hours, revenue };
      },

      resetAll: () => set({ engagements: [], awardedBadges: [], invoices: [], quotes: [], invoiceSettings: { prefix: 'FAC', nextNumber: 1, issuerName: '', issuerAddress: '', issuerEmail: '', issuerPhone: '', taxIds: '', bankDetails: '', paymentTermsDays: 30, vatRate: 0, footer: '' } }),
    }),
    {
      name: 'audax-freelance',
      merge: (persisted, current) => ({ ...current, ...persisted, invoiceSettings: { ...current.invoiceSettings, ...(persisted?.invoiceSettings || {}) } }),
    }
  )
);
