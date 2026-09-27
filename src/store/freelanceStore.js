import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';
import { useAccountingStore } from './accountingStore';
import { invoiceTotals, addDaysKey } from '../utils/invoice';
import { billingOf, hoursOf } from '../utils/billing';

const FREELANCE_INCOME = '721'; // Classe 7 · Freelance & consulting (utils/chart-of-accounts.js)
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Cash-basis bookkeeping: a received payment is posted in Finances, converted
// to the base currency when the client pays in another one (the original
// amount is kept in entry.fx). For an invoice it is split properly:
//   debit  treasury (5xx)                 = amount received
//   debit  347 Impôt retenu à la source   = withholding (still your income)
//   credit 447 TVA facturée à reverser    = VAT (not income)
//   credit revenue account (721 default)  = amount excl. VAT, minus any deposit
//                                           already booked when it was received
// A payment without invoice (deposit…) stays treasury / revenue.
const WITHHOLDING_ACCOUNT = '347';
const VAT_ACCOUNT = '447';
function postIncome({ date, amount, currency, account, label, incomeAccount = FREELANCE_INCOME, split = null }) {
  const acc = useAccountingStore.getState();
  const foreign = currency && currency !== acc.baseCurrency;
  const toBase = (v) => (foreign ? r2(acc.toBase(v, currency)) : r2(v));
  const baseAmt = toBase(amount);
  if (!(baseAmt > 0)) return { ok: false, error: 'Montant invalide.' };
  const lines = [{ account, debit: baseAmt, credit: 0 }];
  let revenue = baseAmt;
  if (split) {
    const wh = toBase(split.withholding || 0);
    const vat = toBase(split.vat || 0);
    if (wh > 0) lines.push({ account: WITHHOLDING_ACCOUNT, debit: wh, credit: 0 });
    if (vat > 0) lines.push({ account: VAT_ACCOUNT, debit: 0, credit: vat });
    revenue = r2(baseAmt + wh - vat); // balanced by construction, whatever the rounding
  }
  if (revenue > 0) lines.push({ account: incomeAccount, debit: 0, credit: revenue });
  else if (revenue < 0) lines.push({ account: incomeAccount, debit: -revenue, credit: 0 });
  return acc.addEntry({
    date, label, lines,
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
          billing: data.billing || null, // null = one hourly rate (utils/billing.js billingOf)
          timeLogs: [],
          expenses: [],
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
        // Keep the old single rate in step with the first hourly rate of the profile.
        if (clean.billing?.rates?.length) { const h = clean.billing.rates.find((r) => r.unit === 'h'); if (h) clean.hourlyRate = Number(h.price) || 0; }
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

      // One work entry at one of the client's rates (hours, days, units…).
      logWork: (id, data) => {
        const engagement = get().engagements.find((e) => e.id === id);
        const qty = Number(String(data.qty ?? data.hours ?? '').replace(',', '.')) || 0;
        if (!engagement || !(qty > 0)) return;
        const b = billingOf(engagement);
        const entry = { id: uid(), date: data.date || todayKey(), qty, rateId: data.rateId || b.rates[0].id, note: data.note || '', createdAt: Date.now() };
        const h = hoursOf(entry, b);
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, timeLogs: [...(e.timeLogs || []), entry], hoursLogged: r2((e.hoursLogged || 0) + h), updatedAt: Date.now() } : e
          ),
        });
        useSkillStore.getState().awardXP(HOURS_SKILL, HOURS_XP, `${engagement.clientName}`);
        toast(`Travail noté · +${HOURS_XP} XP`, 'success');
      },
      logHours: (id, data) => get().logWork(id, { ...data, qty: data.hours }),
      // Commission: a percentage of an amount.
      logCommission: (id, data) => {
        const engagement = get().engagements.find((e) => e.id === id);
        const base = Number(String(data.base ?? '').replace(',', '.')) || 0;
        if (!engagement || !(base > 0)) return;
        const entry = { id: uid(), kind: 'commission', date: data.date || todayKey(), base, note: data.note || '', createdAt: Date.now() };
        if (data.pct !== '' && data.pct != null) entry.pct = Number(data.pct) || 0;
        set({ engagements: get().engagements.map((e) => (e.id === id ? { ...e, timeLogs: [...(e.timeLogs || []), entry], updatedAt: Date.now() } : e)) });
        toast('Opération notée', 'success');
      },
      // Variable income, to put on an invoice later (amounts already received go
      // straight to logPayment instead).
      logVariable: (id, data) => {
        const amount = Number(String(data.amount ?? '').replace(',', '.')) || 0;
        if (!(amount > 0)) return;
        const entry = { id: uid(), kind: 'variable', date: data.date || todayKey(), amount, note: data.note || '', createdAt: Date.now() };
        set({ engagements: get().engagements.map((e) => (e.id === id ? { ...e, timeLogs: [...(e.timeLogs || []), entry], updatedAt: Date.now() } : e)) });
        toast('Montant à facturer noté', 'success');
      },
      deleteTimeLog: (id, logId) => {
        const engagement = get().engagements.find((e) => e.id === id);
        const log = engagement?.timeLogs.find((t) => t.id === logId);
        if (!log) return;
        if (!log.kind) useSkillStore.getState().removeXP(HOURS_SKILL, HOURS_XP, 'time log deleted');
        const h = hoursOf(log, billingOf(engagement));
        set({
          engagements: get().engagements.map((e) =>
            e.id === id ? { ...e, timeLogs: e.timeLogs.filter((t) => t.id !== logId), hoursLogged: Math.max(0, r2((e.hoursLogged || 0) - h)), updatedAt: Date.now() } : e
          ),
        });
      },

      // Expenses to recharge to the client (with an optional markup).
      addExpense: (id, data) => {
        const amount = Number(String(data.amount ?? '').replace(',', '.')) || 0;
        if (!String(data.label || '').trim() || !(amount > 0)) return { ok: false, error: 'Libellé et montant requis.' };
        const x = { id: uid(), date: data.date || todayKey(), label: data.label.trim(), amount, markupPct: Number(data.markupPct) || 0, vatRate: data.vatRate === '' || data.vatRate == null ? null : Number(data.vatRate), rebill: data.rebill !== false, invoiceId: '', createdAt: Date.now() };
        set({ engagements: get().engagements.map((e) => (e.id === id ? { ...e, expenses: [...(e.expenses || []), x], updatedAt: Date.now() } : e)) });
        return { ok: true };
      },
      deleteExpense: (id, expenseId) => set({ engagements: get().engagements.map((e) => (e.id === id ? { ...e, expenses: (e.expenses || []).filter((x) => x.id !== expenseId || x.invoiceId) } : e)) }),

      // Distinct from timeLogs — a payment is cash actually received, not
      // hours worked. invoicedTotal/paidTotal stay separate so "billed but
      // not yet paid" (aging) is visible at a glance.
      logPayment: (id, data) => {
        const engagement = get().engagements.find((e) => e.id === id);
        if (!engagement) return null;
        const entry = { id: uid(), date: data.date || todayKey(), amount: Number(data.amount) || 0, note: data.note || '', invoiceId: data.invoiceId || '', entryId: '', account: '', createdAt: Date.now() };
        if (data.account) {
          const res = postIncome({ date: entry.date, amount: entry.amount, currency: engagement.currency, account: data.account, incomeAccount: engagement.billing?.incomeAccount || FREELANCE_INCOME, split: data.split || null, label: `Freelance — ${engagement.clientName}${entry.note ? ` (${entry.note})` : ''}` });
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
        const inv = p.invoiceId ? (get().invoices || []).find((i) => i.id === p.invoiceId) : null;
        const t = inv ? invoiceTotals(inv) : null;
        const res = postIncome({ date: p.date, amount: p.amount, currency: e.currency, account, incomeAccount: e.billing?.incomeAccount || FREELANCE_INCOME, split: t ? { vat: t.vat, withholding: t.withholding } : null, label: `Freelance — ${e.clientName}${p.note ? ` (${p.note})` : ''}` });
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
      // catalog: [{ id, label, unit, price, vatRate|null }] — reusable services in quotes and invoices.
      invoiceSettings: { prefix: 'FAC', nextNumber: 1, issuerName: '', issuerAddress: '', issuerEmail: '', issuerPhone: '', taxIds: '', bankDetails: '', paymentTermsDays: 30, vatRate: 0, footer: '', catalog: [] },
      setInvoiceSettings: (s) => set({ invoiceSettings: { ...get().invoiceSettings, ...s } }),
      invoices: [], // [{ id, number, engagementId, date, dueDate, lines: [{ id, description, qty, unitPrice }], vatRate, currency, status: 'sent'|'paid'|'cancelled', paymentId, paidAt, timeLogIds, notes, createdAt }]
      // data: { lines: [{ description, qty, unit, unitPrice, vatRate?, discountPct? }], date, dueDate,
      //   vatRate, discountPct, withholdingPct, deposit, notes,
      //   refs: { timeLogIds, expenseIds, milestoneIds, retainerMonths }, blockPurchase: { hours } }
      createInvoice: (engagementId, data) => {
        const e = get().engagements.find((x) => x.id === engagementId);
        if (!e) return { ok: false, error: 'Client introuvable.' };
        const numOr = (v, d = null) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
        const lines = (data.lines || []).filter((l) => String(l.description || '').trim() && Number(l.qty) > 0).map((l) => ({
          id: uid(), description: String(l.description).trim(), qty: Number(l.qty), unit: l.unit || '', unitPrice: Number(l.unitPrice) || 0,
          vatRate: numOr(l.vatRate), discountPct: numOr(l.discountPct, 0) || 0,
        }));
        if (!lines.length) return { ok: false, error: 'Ajoute au moins une ligne.' };
        const st = get().invoiceSettings;
        const date = data.date || todayKey();
        const number = `${st.prefix || 'FAC'}-${date.slice(0, 4)}-${String(st.nextNumber || 1).padStart(3, '0')}`;
        const refs = { timeLogIds: [], expenseIds: [], milestoneIds: [], retainerMonths: [], ...(data.refs || {}) };
        if (data.timeLogIds) refs.timeLogIds = [...refs.timeLogIds, ...data.timeLogIds];
        const inv = {
          id: uid(), number, engagementId, date, dueDate: data.dueDate || addDaysKey(date, Number(st.paymentTermsDays) || 30),
          lines, vatRate: Number(data.vatRate ?? st.vatRate) || 0, discountPct: Number(data.discountPct) || 0,
          withholdingPct: Number(data.withholdingPct) || 0, deposit: Number(data.deposit) || 0,
          currency: e.currency || useAccountingStore.getState().baseCurrency,
          status: 'sent', paymentId: '', paidAt: '', timeLogIds: refs.timeLogIds, refs, notes: data.notes || '', createdAt: Date.now(),
        };
        const logIds = new Set(refs.timeLogIds);
        const expIds = new Set(refs.expenseIds);
        const msIds = new Set(refs.milestoneIds);
        const block = data.blockPurchase?.hours ? { id: uid(), date, hours: Number(data.blockPurchase.hours), invoiceId: inv.id } : null;
        set({
          invoices: [...(get().invoices || []), inv],
          invoiceSettings: { ...st, nextNumber: (st.nextNumber || 1) + 1 },
          engagements: get().engagements.map((x) => {
            if (x.id !== engagementId) return x;
            const b = x.billing;
            return {
              ...x,
              timeLogs: (x.timeLogs || []).map((t) => (logIds.has(t.id) ? { ...t, invoiceId: inv.id } : t)),
              expenses: (x.expenses || []).map((y) => (expIds.has(y.id) ? { ...y, invoiceId: inv.id } : y)),
              retainerBilled: [...new Set([...(x.retainerBilled || []), ...refs.retainerMonths])],
              blockPurchases: block ? [...(x.blockPurchases || []), block] : x.blockPurchases,
              billing: b?.fixed?.milestones?.length && msIds.size
                ? { ...b, fixed: { ...b.fixed, milestones: b.fixed.milestones.map((m) => (msIds.has(m.id) ? { ...m, invoiceId: inv.id } : m)) } }
                : b,
              invoicedTotal: r2((x.invoicedTotal || 0) + invoiceTotals(inv).due),
              updatedAt: Date.now(),
            };
          }),
        });
        toast(`Facture ${number} créée`, 'success');
        return { ok: true, id: inv.id };
      },
      // Sell a prepaid package of hours: one invoice, and the hours become available.
      sellBlock: (engagementId, { hours, price, date }) => get().createInvoice(engagementId, {
        date, lines: [{ description: `Paquet de ${hours} h prépayées`, qty: 1, unit: 'forfait', unitPrice: Number(price) || 0 }],
        blockPurchase: { hours },
      }),
      addCatalogItem: (item) => {
        const price = Number(String(item.price ?? '').replace(',', '.')) || 0;
        if (!String(item.label || '').trim()) return;
        const st = get().invoiceSettings;
        set({ invoiceSettings: { ...st, catalog: [...(st.catalog || []), { id: uid(), label: item.label.trim(), unit: item.unit || 'forfait', price, vatRate: item.vatRate === '' || item.vatRate == null ? null : Number(item.vatRate) }] } });
      },
      removeCatalogItem: (id) => { const st = get().invoiceSettings; set({ invoiceSettings: { ...st, catalog: (st.catalog || []).filter((c) => c.id !== id) } }); },
      cancelInvoice: (invoiceId) => {
        const inv = (get().invoices || []).find((i) => i.id === invoiceId);
        if (!inv || inv.status === 'paid') return;
        const months = new Set(inv.refs?.retainerMonths || []);
        set({
          invoices: get().invoices.map((i) => (i.id === invoiceId ? { ...i, status: 'cancelled' } : i)),
          engagements: get().engagements.map((x) => {
            if (x.id !== inv.engagementId) return x;
            const b = x.billing;
            return {
              ...x,
              timeLogs: (x.timeLogs || []).map((t) => (t.invoiceId === invoiceId ? { ...t, invoiceId: '' } : t)),
              expenses: (x.expenses || []).map((y) => (y.invoiceId === invoiceId ? { ...y, invoiceId: '' } : y)),
              retainerBilled: (x.retainerBilled || []).filter((m) => !months.has(m)),
              blockPurchases: (x.blockPurchases || []).filter((p) => p.invoiceId !== invoiceId),
              billing: b?.fixed?.milestones?.length ? { ...b, fixed: { ...b.fixed, milestones: b.fixed.milestones.map((m) => (m.invoiceId === invoiceId ? { ...m, invoiceId: '' } : m)) } } : b,
              invoicedTotal: Math.max(0, r2((x.invoicedTotal || 0) - invoiceTotals(inv).due)),
            };
          }),
        });
        toast(`Facture ${inv.number} annulée : ce qu’elle contenait redevient à facturer`, 'info');
      },
      markInvoiceReminded: (invoiceId, date = todayKey()) => set({
        invoices: get().invoices.map((i) => (i.id === invoiceId ? { ...i, reminders: [...(i.reminders || []), date] } : i)),
      }),

      // ── Quotes (devis): same lines as an invoice; an accepted quote becomes one ──
      quotes: [], // [{ id, number, engagementId, date, validUntil, lines, vatRate, currency, status: 'sent'|'accepted'|'refused'|'invoiced', invoiceId, notes, createdAt }]
      createQuote: (engagementId, data) => {
        const e = get().engagements.find((x) => x.id === engagementId);
        if (!e) return { ok: false, error: 'Client introuvable.' };
        const numOr = (v, d = null) => (v === '' || v == null ? d : Number(String(v).replace(',', '.')));
        const lines = (data.lines || []).filter((l) => String(l.description || '').trim() && Number(l.qty) > 0).map((l) => ({ id: uid(), description: String(l.description).trim(), qty: Number(l.qty), unit: l.unit || '', unitPrice: Number(l.unitPrice) || 0, vatRate: numOr(l.vatRate), discountPct: numOr(l.discountPct, 0) || 0 }));
        if (!lines.length) return { ok: false, error: 'Ajoute au moins une ligne.' };
        const st = get().invoiceSettings;
        const date = data.date || todayKey();
        const n = st.nextQuoteNumber || 1;
        const quote = {
          id: uid(), number: `${st.quotePrefix || 'DEV'}-${date.slice(0, 4)}-${String(n).padStart(3, '0')}`, engagementId, date,
          validUntil: data.validUntil || addDaysKey(date, 30), lines, vatRate: Number(data.vatRate ?? st.vatRate) || 0, discountPct: Number(data.discountPct) || 0,
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
        const res = get().createInvoice(q.engagementId, { lines: q.lines, vatRate: q.vatRate, discountPct: q.discountPct, notes: `Selon devis ${q.number}.${q.notes ? ` ${q.notes}` : ''}` });
        if (!res.ok) return res;
        set({ quotes: get().quotes.map((x) => (x.id === quoteId ? { ...x, status: 'invoiced', invoiceId: res.id } : x)) });
        return res;
      },
      deleteQuote: (quoteId) => set({ quotes: (get().quotes || []).filter((q) => q.id !== quoteId) }),

      // Paid in full: records the payment (and its Finances entry when an account is given).
      payInvoice: (invoiceId, { date, account }) => {
        const inv = (get().invoices || []).find((i) => i.id === invoiceId);
        if (!inv || inv.status !== 'sent') return;
        const t = invoiceTotals(inv);
        const paymentId = get().logPayment(inv.engagementId, { date: date || todayKey(), amount: t.due, note: inv.number, invoiceId, account, split: { vat: t.vat, withholding: t.withholding } });
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

      resetAll: () => set({ engagements: [], awardedBadges: [], invoices: [], quotes: [], invoiceSettings: { prefix: 'FAC', nextNumber: 1, issuerName: '', issuerAddress: '', issuerEmail: '', issuerPhone: '', taxIds: '', bankDetails: '', paymentTermsDays: 30, vatRate: 0, footer: '', catalog: [] } }),
    }),
    {
      name: 'audax-freelance',
      merge: (persisted, current) => ({ ...current, ...persisted, invoiceSettings: { ...current.invoiceSettings, ...(persisted?.invoiceSettings || {}) } }),
    }
  )
);
