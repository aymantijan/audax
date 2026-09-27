// Slice of accountingStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../accountingStore.js.
import { uid } from '../../utils/formatters';
import { accountBalances, ledgerFor, trialBalance, balanceSheet, cpc, esg, financialAnalysis, correctedNetWorth, monthlySeries, budgetVariance, treasuryForecast, budgetInsights, dailyResults } from '../../utils/accounting-engine';
import { LEGACY_CATEGORY_TO_ACCOUNT, LEGACY_SOURCE_TO_ACCOUNT } from '../../utils/chart-of-accounts';
import { useFinanceStore } from '../financeStore';
import { toast } from '../uiStore';

export const selectorsSlice = (set, get) => ({
      // ─────────── Sélecteurs (tout dérive du journal) ───────────
      getBalances: (period) => accountBalances(get().journal, period),
      getLedger: (code, period) => ledgerFor(get().journal, code, period),
      getTrialBalance: (period) => trialBalance(get().journal, period, get().getAccountMap()),
      getBalanceSheet: (until) => balanceSheet(get().journal, until, get().getAccountMap()),
      getCPC: (period) => cpc(get().journal, period, get().getAccountMap()),
      getESG: (period) => esg(get().journal, period),
      getAnalysis: (until) => financialAnalysis(get().journal, until, get().getAccountMap()),
      // Net worth automatique : ANC (Actif − Dettes) puis ANCC (+ corrections manuelles).
      getNetWorth: (until) => {
        const a = get().getAnalysis(until);
        const cv = correctedNetWorth(a.anc, get().corrections, until);
        return { anc: a.anc, ...cv };
      },
      getMonthlySeries: (months = 6) => monthlySeries(get().journal, months),
      // Résultat (produits − charges) jour par jour sur [from, to] — voir dailyResults (accounting-engine.js).
      getDailyResults: (from, to) => dailyResults(get().journal, from, to),
      // refDate : 'YYYY-MM-DD' — chaque budget calcule sa propre période à
      // partir de cette date de référence (voir getPeriodBounds). Défaut : aujourd'hui.
      getBudgetVariance: (refDate) => budgetVariance(get().journal, get().budgets, refDate || new Date().toISOString().slice(0, 10), get().getAccountMap()),
      getTreasuryForecast: (months = 6) => treasuryForecast(get().journal, get().budgets, months),

      // Panneau "raisonné" d'un budget : répartition par tiers, comparaison
      // historique, rythme/projection, anomalies — voir budgetInsights (accounting-engine.js).
      getBudgetInsights: (budgetId, refDate) => {
        const budget = get().budgets.find((b) => b.id === budgetId);
        if (!budget) return null;
        return budgetInsights(get().journal, budget, refDate || new Date().toISOString().slice(0, 10), get().getAccountMap());
      },

      // Période du mois courant : { from, to }. Built from local Y/M/D
      // directly, not `.toISOString()` — that round-trips through UTC and
      // can roll back a day right at a month boundary in any timezone
      // ahead of UTC, silently showing last month's period as "current."
      currentMonthPeriod: () => {
        const now = new Date();
        const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

      resetAll: () =>
        set({
          journal: [], budgets: [], corrections: [], goals: [], labelLimits: [], legacyImported: false, treasuryAccounts: [], assets: [], echeances: [],
          echeanceAlerts: { enabled: false, lastShown: {} }, budgetAlerts: { enabled: false, lastShown: {} }, awardedBadges: [],
        }),
});
