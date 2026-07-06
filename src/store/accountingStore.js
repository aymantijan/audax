import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import {
  validateEntry, accountBalances, ledgerFor, trialBalance,
  balanceSheet, cpc, esg, financialAnalysis, correctedNetWorth, monthlySeries,
  budgetVariance, treasuryForecast, monthKey,
} from '../utils/accounting-engine';
import { LEGACY_CATEGORY_TO_ACCOUNT, LEGACY_SOURCE_TO_ACCOUNT } from '../utils/chart-of-accounts';
import { useFinanceStore } from './financeStore';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

// Comptabilité générale personnelle en partie double.
// Le journal est la source unique ; chaque sélecteur dérive un état de synthèse
// (grand livre, balance, bilan, CPC, ESG), l'analyse financière, le budget
// et la trésorerie — exactement comme demandé : une saisie, tout se propage.

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });

export const useAccountingStore = create(
  persist(
    (set, get) => ({
      journal: [], // écritures en partie double
      budgets: [], // [{ id, account, amount }] — budget mensuel par compte (classes 6 & 7)
      corrections: [], // [{ id, type:'plus-value'|'moins-value', label, amount, account, date }] — ANC → ANCC
      legacyImported: false,

      // ─────────── Journal (mutations) ───────────
      addEntry: (entry) => {
        const res = validateEntry(entry);
        if (!res.ok) return res;
        const clean = {
          id: uid(),
          date: entry.date,
          ref: entry.ref || `E${get().journal.length + 1}`,
          label: entry.label.trim(),
          lines: res.lines.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ journal: [...get().journal, clean] });
        // Bookkeeping feeds the skill tree: every balanced entry trains double-entry
        const award = useSkillStore.getState().awardXP;
        award('double-entry-lv1', 2, `journal: ${clean.label}`);
        award('journal-keeper-lv1', 1, `journal: ${clean.label}`);
        if (clean.lines.length > 2) award('double-entry-lv2', 2, `multi-line entry: ${clean.label}`);
        toast(`Écriture enregistrée : ${clean.label}`, 'success');
        return { ok: true, id: clean.id };
      },
      editEntry: (id, entry) => {
        const res = validateEntry(entry);
        if (!res.ok) return res;
        set({
          journal: get().journal.map((e) =>
            e.id === id
              ? stamp({ ...e, date: entry.date, label: entry.label.trim(), lines: res.lines.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) })
              : e
          ),
        });
        return { ok: true };
      },
      deleteEntry: (id) => set({ journal: get().journal.filter((e) => e.id !== id) }),

      // ─────────── Budgets ───────────
      setBudget: (account, amount) => {
        const existing = get().budgets.find((b) => b.account === account);
        if (existing) {
          set({ budgets: get().budgets.map((b) => (b.account === account ? stamp({ ...b, amount: Number(amount) }) : b)) });
        } else {
          set({ budgets: [...get().budgets, { id: uid(), account, amount: Number(amount), createdAt: Date.now(), updatedAt: Date.now() }] });
          useSkillStore.getState().awardXP('budget-control-lv1', 3, `budget set: ${account}`);
        }
      },
      deleteBudget: (id) => set({ budgets: get().budgets.filter((b) => b.id !== id) }),

      // ─────────── Corrections de valeur (ANC → ANCC) ───────────
      addCorrection: (data) => {
        const c = { ...data, id: uid(), amount: Number(data.amount), createdAt: Date.now(), updatedAt: Date.now() };
        set({ corrections: [...get().corrections, c] });
        toast(`Correction ajoutée : ${c.label}`, 'success');
      },
      editCorrection: (id, updates) =>
        set({ corrections: get().corrections.map((c) => (c.id === id ? stamp({ ...c, ...updates, amount: Number(updates.amount ?? c.amount) }) : c)) }),
      deleteCorrection: (id) => set({ corrections: get().corrections.filter((c) => c.id !== id) }),

      // ─────────── Sélecteurs (tout dérive du journal) ───────────
      getBalances: (period) => accountBalances(get().journal, period),
      getLedger: (code, period) => ledgerFor(get().journal, code, period),
      getTrialBalance: (period) => trialBalance(get().journal, period),
      getBalanceSheet: (until) => balanceSheet(get().journal, until),
      getCPC: (period) => cpc(get().journal, period),
      getESG: (period) => esg(get().journal, period),
      getAnalysis: (until) => financialAnalysis(get().journal, until),
      // Net worth automatique : ANC (Actif − Dettes) puis ANCC (+ corrections manuelles).
      getNetWorth: (until) => {
        const a = get().getAnalysis(until);
        const cv = correctedNetWorth(a.anc, get().corrections, until);
        return { anc: a.anc, ...cv };
      },
      getMonthlySeries: (months = 6) => monthlySeries(get().journal, months),
      getBudgetVariance: (mk) => budgetVariance(get().journal, get().budgets, mk || monthKey(new Date().toISOString())),
      getTreasuryForecast: (months = 6) => treasuryForecast(get().journal, get().budgets, months),

      // Période du mois courant : { from, to }
      currentMonthPeriod: () => {
        const mk = monthKey(new Date().toISOString().slice(0, 10));
        return { from: `${mk}-01`, to: `${mk}-31` };
      },

      // ─────────── Passerelle : import de l'ancien système ───────────
      // Convertit les transactions simples (financeStore) en écritures partie
      // double : dépense → Débit 6xx / Crédit 511 ; revenu → Débit 511 / Crédit 7xx.
      importLegacyTransactions: () => {
        if (get().legacyImported) return { ok: false, error: 'Import déjà effectué.' };
        const txs = useFinanceStore.getState().transactions;
        if (!txs.length) return { ok: false, error: 'Aucune ancienne transaction à importer.' };
        const entries = txs.map((t, i) => {
          const amount = Number(t.amount) || 0;
          const isIncome = t.type === 'income';
          const counterpart = isIncome
            ? LEGACY_SOURCE_TO_ACCOUNT[t.incomeSource] || '798'
            : LEGACY_CATEGORY_TO_ACCOUNT[t.category] || '698';
          const lines = isIncome
            ? [{ account: '511', debit: amount, credit: 0 }, { account: counterpart, debit: 0, credit: amount }]
            : [{ account: counterpart, debit: amount, credit: 0 }, { account: '511', debit: 0, credit: amount }];
          return {
            id: uid(),
            date: t.date,
            ref: `L${i + 1}`,
            label: t.description || (isIncome ? t.incomeSource || 'Revenu' : t.category),
            lines,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        });
        set({ journal: [...get().journal, ...entries], legacyImported: true });
        toast(`${entries.length} transactions importées dans le journal`, 'success');
        return { ok: true, count: entries.length };
      },

      resetAll: () => set({ journal: [], budgets: [], corrections: [], legacyImported: false }),
    }),
    { name: 'audax-accounting' }
  )
);
