import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfMonth } from 'date-fns';
import { uid } from '../utils/formatters';
import { computeTradeDerived, round2, tradeStats, equityCurve, maxDrawdown } from '../utils/calculations';
import { TRADE_XP, STRATEGY_SKILL, INSTRUMENT_SKILL, MACRO_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useAuthStore } from './authStore';
import { toast } from './uiStore';

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });

// Derived XP awards for a trade (in addition to user-picked linkedSkills).
// awardXP no-ops on locked/unknown skills, so mapping to locked masteries is safe.
export function autoAwardsFor(trade) {
  const out = [];
  const add = (skillId, amount) => skillId && out.push({ skillId, amount });
  add(STRATEGY_SKILL[trade.strategy], 5);
  add(INSTRUMENT_SKILL[trade.instrument], 5);
  add('trading-discipline-lv1', 2);
  for (const [key, val] of Object.entries(trade.macro || {})) if (val) add(MACRO_SKILL[key], 3);
  if (trade.pnl > 0) add('discipline-execution-lv1', 5); // profitable trade bonus
  else if (trade.pnl < 0 && Number(trade.stopLoss) > 0) add('losing-streak-recovery-lv1', 3); // loss within a defined stop
  return out;
}

export const useTradingStore = create(
  persist(
    (set, get) => ({
      trades: [],

      // ─────────── SELECTORS ───────────
      // Everything here is scoped to an account type. Dashboard / Trading / burn-rate /
      // Advanced Analytics all call these — same account, same numbers, no drift.

      getAccountTrades: (accountType) => {
        const type = accountType || useAuthStore.getState().user?.activeAccount || 'demo';
        return get().trades.filter((t) => (t.accountType || 'demo') === type);
      },
      getInitialBalance: (accountType) => {
        const type = accountType || useAuthStore.getState().user?.activeAccount || 'demo';
        return useAuthStore.getState().user?.accounts?.[type]?.initialBalance ?? 52000;
      },
      // Current account balance (initial + all P&L). This is THE canonical account value.
      accountValue: (accountType) => get().getInitialBalance(accountType) + get().getAccountTrades(accountType).reduce((a, t) => a + t.pnl, 0),
      getTotalPnL: (accountType) => get().getAccountTrades(accountType).reduce((a, t) => a + t.pnl, 0),
      getMonthPnL: (accountType) => {
        const cutoff = startOfMonth(new Date());
        return get().getAccountTrades(accountType).filter((t) => new Date(t.date) >= cutoff).reduce((a, t) => a + t.pnl, 0);
      },
      // Full stats object: count, winRate, expectancy, profit factor, etc.
      getStats: (accountType) => tradeStats(get().getAccountTrades(accountType)),
      getMonthStats: (accountType) => {
        const cutoff = startOfMonth(new Date());
        return tradeStats(get().getAccountTrades(accountType).filter((t) => new Date(t.date) >= cutoff));
      },
      getMaxDrawdown: (accountType) => maxDrawdown(equityCurve(get().getAccountTrades(accountType), get().getInitialBalance(accountType))),
      getMonthMaxDrawdown: (accountType) => {
        const cutoff = startOfMonth(new Date());
        return maxDrawdown(equityCurve(get().getAccountTrades(accountType).filter((t) => new Date(t.date) >= cutoff), get().getInitialBalance(accountType)));
      },
      getEquityCurve: (accountType) => equityCurve(get().getAccountTrades(accountType), get().getInitialBalance(accountType)),

      addTrade: (data) => {
        const activeAccount = useAuthStore.getState().user?.activeAccount || 'demo';
        const accountType = data.accountType || activeAccount;
        const { pnlPips } = computeTradeDerived(data);
        const balance = get().accountValue(accountType);
        const trade = {
          ...data,
          accountType,
          id: uid(),
          pnl: round2(Number(data.pnl)),
          pnlPips,
          pnlPercent: balance > 0 ? round2((Number(data.pnl) / balance) * 100) : 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ trades: [...get().trades, trade] });

        const award = useSkillStore.getState().awardXP;
        for (const skillId of trade.linkedSkills || []) award(skillId, TRADE_XP, 'trade');
        const auto = autoAwardsFor(trade);
        for (const { skillId, amount } of auto) award(skillId, amount, 'trade (auto)');

        const autoXP = auto.reduce((a, x) => a + x.amount, 0);
        toast(
          `Trade saved (${accountType}) — ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl} · +${autoXP + (trade.linkedSkills?.length || 0) * TRADE_XP} XP`,
          trade.pnl >= 0 ? 'success' : 'info'
        );
        return trade.id;
      },

      editTrade: (id, updates) => {
        set({
          trades: get().trades.map((t) => {
            if (t.id !== id) return t;
            const merged = stamp({ ...t, ...updates });
            const { pnlPips } = computeTradeDerived(merged);
            return { ...merged, pnl: round2(Number(merged.pnl)), pnlPips };
          }),
        });
        toast('Trade updated', 'success');
      },

      deleteTrade: (id) => {
        const trade = get().trades.find((t) => t.id === id);
        set({ trades: get().trades.filter((t) => t.id !== id) });
        if (trade) {
          const remove = useSkillStore.getState().removeXP;
          for (const skillId of trade.linkedSkills || []) remove(skillId, TRADE_XP, 'trade deleted');
          for (const { skillId, amount } of autoAwardsFor(trade)) remove(skillId, amount, 'trade deleted');
        }
        toast('Trade deleted', 'info');
      },

      resetAll: () => set({ trades: [] }),
    }),
    { name: 'audax-trading' }
  )
);
