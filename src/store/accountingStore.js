import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import {
  validateEntry, accountBalances, ledgerFor, trialBalance,
  balanceSheet, cpc, esg, financialAnalysis, correctedNetWorth, monthlySeries,
  budgetVariance, treasuryForecast, treasuryBalance, netWorthHistory, paceFromEdges, projectValue, monthKey,
} from '../utils/accounting-engine';
import { LEGACY_CATEGORY_TO_ACCOUNT, LEGACY_SOURCE_TO_ACCOUNT, classOf, ACCOUNT_MAP } from '../utils/chart-of-accounts';
import { getLabelsForAccount, suggestLabels, findClosestLabel, computeLabelRatiosAfter } from '../utils/label-analysis';
import { calculateGoalXP, badgeForGoal } from '../utils/goals';
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
      goals: [], // [{ id, type:'treasury'|'networth', name, targetAmount, targetDate, achieved, achievedAt, xpAwarded, badge }]
      labelLimits: [], // [{ id, account, label, maxRatioToIncomePct, maxRatioToAccountSpendPct, createdAt }]
      legacyImported: false,

      // Vérifie, POUR CHAQUE ligne de charge (classe 6) de l'écriture, si une
      // limite est configurée pour son (compte, libellé) et si l'ajout de ce
      // montant la franchirait — appelé par addEntry/editEntry avant sauvegarde.
      // Retourne { ok:false, error } (même contrat que validateEntry) ou { ok:true }.
      _checkLabelLimits: (entry, excludeEntryId) => {
        const limits = get().labelLimits;
        if (!limits.length || !entry.label?.trim()) return { ok: true };
        const journal = excludeEntryId ? get().journal.filter((e) => e.id !== excludeEntryId) : get().journal;
        for (const line of entry.lines || []) {
          if (classOf(line.account) !== 6 || !(Number(line.debit) > 0)) continue;
          const limit = limits.find(
            (l) => l.account === line.account && l.label.trim().toLowerCase() === entry.label.trim().toLowerCase()
          );
          if (!limit) continue;
          const ratios = computeLabelRatiosAfter(journal, { account: line.account, label: entry.label, amount: Number(line.debit), date: entry.date });
          if (limit.maxRatioToIncomePct != null && ratios.ratioToIncome != null && ratios.ratioToIncome > limit.maxRatioToIncomePct) {
            return { ok: false, error: `Bloqué : "${entry.label}" atteindrait ${ratios.ratioToIncome}% de vos revenus du mois (limite : ${limit.maxRatioToIncomePct}%). Ajustez ou supprimez la limite dans l'onglet Libellés si vous voulez tout de même saisir cette dépense.` };
          }
          if (limit.maxRatioToAccountSpendPct != null && ratios.ratioToAccountSpend != null && ratios.ratioToAccountSpend > limit.maxRatioToAccountSpendPct) {
            return { ok: false, error: `Bloqué : "${entry.label}" atteindrait ${ratios.ratioToAccountSpend}% de vos dépenses "${ACCOUNT_MAP[line.account]?.label || line.account}" du mois (limite : ${limit.maxRatioToAccountSpendPct}%). Ajustez ou supprimez la limite dans l'onglet Libellés si vous voulez tout de même saisir cette dépense.` };
          }
        }
        return { ok: true };
      },

      // ─────────── Journal (mutations) ───────────
      addEntry: (entry) => {
        const res = validateEntry(entry);
        if (!res.ok) return res;
        const limitCheck = get()._checkLabelLimits(entry);
        if (!limitCheck.ok) return limitCheck;
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
        const limitCheck = get()._checkLabelLimits(entry, id);
        if (!limitCheck.ok) return limitCheck;
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

      // ─────────── Analyse & limites par libellé ───────────
      // maxRatioToIncomePct / maxRatioToAccountSpendPct sont optionnels (l'un des
      // deux, ou les deux) — null/undefined désactive ce garde-fou pour cette limite.
      setLabelLimit: (account, label, { maxRatioToIncomePct, maxRatioToAccountSpendPct }) => {
        const key = label.trim().toLowerCase();
        const existing = get().labelLimits.find((l) => l.account === account && l.label.trim().toLowerCase() === key);
        const values = {
          maxRatioToIncomePct: maxRatioToIncomePct === '' || maxRatioToIncomePct == null ? null : Number(maxRatioToIncomePct),
          maxRatioToAccountSpendPct: maxRatioToAccountSpendPct === '' || maxRatioToAccountSpendPct == null ? null : Number(maxRatioToAccountSpendPct),
        };
        if (existing) {
          set({ labelLimits: get().labelLimits.map((l) => (l.id === existing.id ? { ...l, ...values, updatedAt: Date.now() } : l)) });
        } else {
          set({ labelLimits: [...get().labelLimits, { id: uid(), account, label: label.trim(), ...values, createdAt: Date.now() }] });
        }
        toast(`Limite enregistrée pour "${label.trim()}"`, 'success');
      },
      deleteLabelLimit: (id) => set({ labelLimits: get().labelLimits.filter((l) => l.id !== id) }),

      getLabelsForAccount: (account) => getLabelsForAccount(get().journal, account),
      getLabelSuggestions: (account, query) => suggestLabels(get().journal, account, query),
      getLabelDidYouMean: (account, inputLabel) => findClosestLabel(get().journal, account, inputLabel),

      // Statut courant (mois en cours) de chaque limite configurée — pour l'onglet Libellés.
      getLabelLimitsStatus: () => {
        const today = new Date().toISOString().slice(0, 10);
        return get().labelLimits.map((limit) => {
          const ratios = computeLabelRatiosAfter(get().journal, { account: limit.account, label: limit.label, amount: 0, date: today });
          const overIncome = limit.maxRatioToIncomePct != null && ratios.ratioToIncome != null && ratios.ratioToIncome > limit.maxRatioToIncomePct;
          const overAccount = limit.maxRatioToAccountSpendPct != null && ratios.ratioToAccountSpend != null && ratios.ratioToAccountSpend > limit.maxRatioToAccountSpendPct;
          return { ...limit, accountLabel: ACCOUNT_MAP[limit.account]?.label || limit.account, ratios, breached: overIncome || overAccount };
        });
      },

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

      // ─────────── Objectifs (trésorerie & patrimoine) ───────────
      addGoal: (data) => {
        const goal = {
          ...data, id: uid(), targetAmount: Number(data.targetAmount),
          achieved: false, achievedAt: null, createdAt: Date.now(), updatedAt: Date.now(),
        };
        set({ goals: [...get().goals, goal] });
        toast(`Objectif créé : ${goal.name}`, 'success');
      },
      editGoal: (id, updates) =>
        set({ goals: get().goals.map((g) => (g.id === id ? stamp({ ...g, ...updates, targetAmount: Number(updates.targetAmount ?? g.targetAmount) }) : g)) }),
      deleteGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id) }),

      // Lignes enrichies pour l'UI : valeur actuelle, rythme, progression, projection.
      getGoalRows: () => {
        const journal = get().journal;
        const corrections = get().corrections;
        const nwHist = netWorthHistory(journal, corrections, 6);
        const nwPace = paceFromEdges(nwHist, 'ancc');
        const nwCurrent = get().getNetWorth().ancc;

        const treasurySeries = get().getMonthlySeries(6);
        const treasuryPace = paceFromEdges(treasurySeries, 'solde');
        const treasuryCurrent = treasurySeries.length ? treasurySeries[treasurySeries.length - 1].solde : treasuryBalance(journal);

        return get().goals.map((g) => {
          const isTreasury = g.type === 'treasury';
          const current = isTreasury ? treasuryCurrent : nwCurrent;
          const pace = isTreasury ? treasuryPace : nwPace;
          const progress = g.targetAmount > 0 ? Math.max(0, Math.min(100, (current / g.targetAmount) * 100)) : null;
          const projected = g.targetDate ? projectValue(current, pace, g.targetDate) : null;
          const onTrack = projected !== null ? projected >= g.targetAmount : null;
          return { ...g, current, pace, progress, projected, onTrack };
        });
      },

      // Idempotent : XP + badge une seule fois, au franchissement du seuil.
      checkGoalAchievement: (goalId, current) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || goal.achieved || current < goal.targetAmount) return;
        const xp = calculateGoalXP(goal.targetAmount);
        const badge = badgeForGoal(goal.targetAmount);
        set({ goals: get().goals.map((g) => (g.id === goalId ? stamp({ ...g, achieved: true, achievedAt: Date.now(), xpAwarded: xp, badge }) : g)) });
        const skillId = goal.type === 'treasury' ? 'treasury-planning-lv1' : 'ratio-analysis-lv1';
        useSkillStore.getState().awardXP(skillId, xp, `objectif atteint : ${goal.name}`);
        toast(`🎉 Objectif atteint : ${goal.name} · +${xp} XP · Badge : ${badge}`, 'success');
      },

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

      resetAll: () => set({ journal: [], budgets: [], corrections: [], goals: [], labelLimits: [], legacyImported: false }),
    }),
    { name: 'audax-accounting' }
  )
);
