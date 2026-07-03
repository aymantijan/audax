import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfMonth, differenceInDays } from 'date-fns';
import { uid } from '../utils/formatters';
import { calculateGoalXP, badgeForGoal, budgetSeverity } from '../utils/goals';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

// Every mutation stamps `updatedAt`. Pure selectors (get*) are the single source
// of truth for computed values — Dashboard, Finance, and anything else all call
// the same selector so they can't drift out of sync.

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });

export const useFinanceStore = create(
  persist(
    (set, get) => ({
      transactions: [],
      budgets: [],
      snapshots: [], // net worth snapshots
      adjustments: [], // off-book net-worth adjustments
      goals: [], // financial goals

      // ─────────── SELECTORS (computed, single source of truth) ───────────

      // Base net worth from the latest snapshot (nullable).
      getBaseNetWorth: () => {
        const snaps = get().snapshots;
        return snaps.length ? snaps[snaps.length - 1].netWorth : null;
      },
      // Sum of manual off-book adjustments.
      getAdjustmentsTotal: () => get().adjustments.reduce((a, x) => a + Number(x.amount || 0), 0),
      // TOTAL net worth (base + adjustments). This is what every page should show.
      getNetWorth: () => {
        const base = get().getBaseNetWorth();
        if (base === null) return null;
        return base + get().getAdjustmentsTotal();
      },

      // Transactions filtered to a month (0 = current, -1 = last, etc.).
      getMonthTransactions: (monthOffset = 0) => {
        const cutoff = startOfMonth(new Date());
        if (monthOffset) cutoff.setMonth(cutoff.getMonth() + monthOffset);
        const endCutoff = new Date(cutoff);
        endCutoff.setMonth(endCutoff.getMonth() + 1);
        return get().transactions.filter((t) => {
          const d = new Date(t.date);
          return d >= cutoff && d < endCutoff;
        });
      },
      getMonthIncome: (monthOffset = 0) =>
        get().getMonthTransactions(monthOffset).filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0),
      getMonthExpenses: (monthOffset = 0) =>
        get().getMonthTransactions(monthOffset).filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0),
      getSavingsRate: () => {
        const income = get().getMonthIncome();
        const expenses = get().getMonthExpenses();
        return income > 0 ? ((income - expenses) / income) * 100 : 0;
      },

      // Per-budget status: applies %-of-income scaling and returns severity ('ok' | 'orange' | 'red').
      getBudgetStatuses: () => {
        const income = get().getMonthIncome();
        return get().budgets.map((b) => {
          const effAmount = b.type === 'percent' ? (income * b.amount) / 100 : b.amount;
          const spent = get()
            .getMonthTransactions()
            .filter((t) => t.type === 'expense' && t.category === b.category)
            .reduce((a, t) => a + t.amount, 0);
          const pct = effAmount > 0 ? (spent / effAmount) * 100 : spent > 0 ? 100 : 0;
          const sev = budgetSeverity(spent, effAmount);
          return { ...b, effAmount, spent, pct, severity: sev, isOverBudget: spent > effAmount };
        });
      },
      getBudgetWarnings: () => get().getBudgetStatuses().filter((b) => b.severity),
      getBudgetAdherence: () => {
        const rows = get().getBudgetStatuses();
        if (!rows.length) return null;
        return rows.reduce((a, b) => a + (b.spent <= b.effAmount ? 100 : Math.max(0, 100 - ((b.spent - b.effAmount) / (b.effAmount || 1)) * 100)), 0) / rows.length;
      },

      // Snapshot momentum + linear growth pace ($/day) for goal forecasting.
      getSnapshotMomentum: () => {
        const sorted = [...get().snapshots].sort((a, b) => a.date - b.date);
        if (sorted.length < 2) return { change: null, pace: null };
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const days = Math.max(1, differenceInDays(last.date, first.date));
        return {
          change: last.netWorth - sorted[sorted.length - 2].netWorth,
          pace: (last.netWorth - first.netWorth) / days,
        };
      },

      // Enriched goal rows for the UI: current, progress, projected, onTrack.
      getGoalRows: ({ tradingAccountValueMad = null } = {}) => {
        const netWorth = get().getNetWorth();
        const pace = get().getSnapshotMomentum().pace;
        return get().goals.map((g) => {
          const current = g.type === 'account' ? tradingAccountValueMad : netWorth;
          const progress = current !== null && g.targetAmount > 0 ? Math.max(0, Math.min(100, (current / g.targetAmount) * 100)) : null;
          let projected = null;
          if (g.type !== 'account' && pace !== null && g.targetDate && netWorth !== null) {
            const daysLeft = differenceInDays(new Date(g.targetDate), new Date());
            projected = netWorth + pace * Math.max(0, daysLeft);
          }
          const onTrack = projected !== null ? projected >= g.targetAmount : null;
          return { ...g, current, progress, projected, onTrack };
        });
      },

      // ─────────── MUTATIONS (all stamp updatedAt) ───────────

      addTransaction: (data) => {
        const tx = { ...data, id: uid(), amount: Number(data.amount), createdAt: Date.now(), updatedAt: Date.now() };
        set({ transactions: [...get().transactions, tx] });
        toast(`${tx.type === 'income' ? 'Income' : 'Expense'} logged`, 'success');
      },
      editTransaction: (id, updates) =>
        set({ transactions: get().transactions.map((t) => (t.id === id ? stamp({ ...t, ...updates, amount: Number(updates.amount ?? t.amount) }) : t)) }),
      deleteTransaction: (id) => set({ transactions: get().transactions.filter((t) => t.id !== id) }),

      addBudget: (data) => {
        const budget = { ...data, id: uid(), amount: Number(data.amount), alertThreshold: Number(data.alertThreshold) || 90, createdAt: Date.now(), updatedAt: Date.now() };
        set({ budgets: [...get().budgets, budget] });
        toast(`Budget set: ${budget.category}`, 'success');
      },
      editBudget: (id, updates) =>
        set({ budgets: get().budgets.map((b) => (b.id === id ? stamp({ ...b, ...updates, amount: Number(updates.amount ?? b.amount) }) : b)) }),
      deleteBudget: (id) => set({ budgets: get().budgets.filter((b) => b.id !== id) }),

      addSnapshot: (assets, liabilities) => {
        const sum = (o) => Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0);
        const snap = {
          id: uid(),
          date: Date.now(),
          assets: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, Number(v) || 0])),
          liabilities: Object.fromEntries(Object.entries(liabilities).map(([k, v]) => [k, Number(v) || 0])),
          netWorth: sum(assets) - sum(liabilities),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ snapshots: [...get().snapshots, snap] });
        toast(`Net worth snapshot saved`, 'success');
      },
      editSnapshot: (id, updates) => set({ snapshots: get().snapshots.map((s) => (s.id === id ? stamp({ ...s, ...updates }) : s)) }),
      deleteSnapshot: (id) => set({ snapshots: get().snapshots.filter((s) => s.id !== id) }),

      addGoal: (data) => {
        const goal = { ...data, id: uid(), targetAmount: Number(data.targetAmount), achieved: false, achievedAt: null, createdAt: Date.now(), updatedAt: Date.now() };
        set({ goals: [...get().goals, goal] });
        toast(`Goal set: ${goal.name}`, 'success');
      },
      editGoal: (id, updates) =>
        set({ goals: get().goals.map((g) => (g.id === id ? stamp({ ...g, ...updates, targetAmount: Number(updates.targetAmount ?? g.targetAmount) }) : g)) }),
      deleteGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id) }),

      // Fire once when `current` first reaches the target: award XP + badge, mark achieved.
      // Idempotent — a re-check with an already-achieved goal is a no-op.
      checkGoalAchievement: (goalId, current) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || goal.achieved || current < goal.targetAmount) return;
        const xp = calculateGoalXP(goal.targetAmount);
        const badge = badgeForGoal(goal.targetAmount);
        set({ goals: get().goals.map((g) => (g.id === goalId ? stamp({ ...g, achieved: true, achievedAt: Date.now(), xpAwarded: xp, badge }) : g)) });
        useSkillStore.getState().awardXP('financial-discipline-lv1', xp, `goal: ${goal.name}`);
        toast(`🎉 Goal achieved: ${goal.name} · +${xp} XP · Badge: ${badge}`, 'success');
      },

      addAdjustment: (data) => {
        const adj = { ...data, id: uid(), amount: Number(data.amount), date: Date.now(), createdAt: Date.now(), updatedAt: Date.now() };
        set({ adjustments: [...get().adjustments, adj] });
      },
      editAdjustment: (id, updates) =>
        set({ adjustments: get().adjustments.map((a) => (a.id === id ? stamp({ ...a, ...updates, amount: Number(updates.amount ?? a.amount) }) : a)) }),
      deleteAdjustment: (id) => set({ adjustments: get().adjustments.filter((a) => a.id !== id) }),

      resetAll: () => set({ transactions: [], budgets: [], snapshots: [], adjustments: [], goals: [] }),
    }),
    { name: 'audax-finance' }
  )
);
