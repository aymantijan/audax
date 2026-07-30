import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfMonth } from 'date-fns';
import { uid } from '../utils/formatters';
import { computeTradeDerived, round2, tradeStats, equityCurve, maxDrawdown } from '../utils/calculations';
import { computePropFirmProgress, nextPhase } from '../utils/prop-firm-analytics';
import { TRADE_XP, STRATEGY_SKILL, INSTRUMENT_SKILL, MACRO_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useAuthStore } from './authStore';
import { toast } from './uiStore';

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

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

const DEFAULT_DEMO_BALANCE = 52000;

export const useTradingStore = create(
  persist(
    (set, get) => ({
      trades: [], // trades[].accountId points into accounts[] (was accountType — 'demo'/'real' ids preserved for backward compat)
      accounts: [], // [{ id, type:'demo'|'broker'|'propfirm', name, broker, accountNumber, leverage, initialBalance, status, phase?, currentPhaseStartAt, phaseHistory, propFirmRules?, balanceAdjustments, createdAt, updatedAt }]
      activeAccountId: null,

      // One-time bootstrap: migrates the legacy authStore.user.accounts (demo/real)
      // into the new accounts[] list on first load after this refactor, or creates
      // a fresh default Demo account for a brand-new user. Idempotent — no-ops once
      // accounts[] is populated. Call once from App.jsx on mount.
      ensureAccounts: () => {
        if (get().accounts.length > 0) {
          // Still-needed one-time trade field migration for users who somehow
          // already have accounts[] but pre-migration trades (defensive).
          const trades = get().trades;
          if (trades.some((t) => !t.accountId && t.accountType)) {
            set({ trades: trades.map((t) => ({ ...t, accountId: t.accountId || t.accountType || 'demo' })) });
          }
          return;
        }
        const legacyUser = useAuthStore.getState().user;
        const legacyAccounts = legacyUser?.accounts;
        const accounts = [];

        accounts.push({
          id: 'demo',
          type: 'demo',
          name: 'Demo Account',
          broker: legacyAccounts?.demo?.brokerName || 'Demo Sim',
          initialBalance: legacyAccounts?.demo?.initialBalance ?? DEFAULT_DEMO_BALANCE,
          status: 'active',
          balanceAdjustments: legacyAccounts?.demo?.balanceAdjustments || [],
          createdAt: legacyAccounts?.demo?.createdAt || Date.now(),
          updatedAt: Date.now(),
        });

        if (legacyAccounts?.real) {
          accounts.push({
            id: 'real',
            type: 'broker',
            name: legacyAccounts.real.brokerName || 'Broker Account',
            broker: legacyAccounts.real.brokerName || '',
            accountNumber: legacyAccounts.real.accountNumber || '',
            leverage: legacyAccounts.real.leverage || undefined,
            initialBalance: legacyAccounts.real.initialBalance || 0,
            status: 'active',
            balanceAdjustments: legacyAccounts.real.balanceAdjustments || [],
            createdAt: legacyAccounts.real.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        }

        const activeAccountId = legacyUser?.activeAccount === 'real' && legacyAccounts?.real ? 'real' : 'demo';
        set({ accounts, activeAccountId });

        const trades = get().trades;
        if (trades.some((t) => !t.accountId)) {
          set({ trades: trades.map((t) => ({ ...t, accountId: t.accountId || t.accountType || 'demo' })) });
        }
      },

      // ─────────── Account CRUD ───────────
      addAccount: (data) => {
        const account = {
          id: uid(),
          type: data.type,
          name: data.name.trim(),
          broker: data.broker?.trim() || '',
          accountNumber: data.accountNumber?.trim() || '',
          leverage: data.leverage ? Number(data.leverage) : undefined,
          initialBalance: Number(data.initialBalance) || 0,
          status: data.type === 'propfirm' && data.startFunded ? 'funded' : 'active',
          phase: data.type === 'propfirm' ? (data.startFunded ? 'funded' : 'phase1') : undefined,
          propFirmRules:
            data.type === 'propfirm'
              ? {
                  maxDailyLossPct: numOrNull(data.maxDailyLossPct),
                  maxTotalDrawdownPct: numOrNull(data.maxTotalDrawdownPct),
                  profitTargetPct: numOrNull(data.profitTargetPct),
                  minTradingDays: numOrNull(data.minTradingDays),
                  consistencyRulePct: numOrNull(data.consistencyRulePct),
                  maxPhaseDurationDays: numOrNull(data.maxPhaseDurationDays),
                }
              : undefined,
          currentPhaseStartAt: Date.now(),
          phaseHistory: [],
          balanceAdjustments: [],
          payouts: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ accounts: [...get().accounts, account], activeAccountId: account.id });
        toast(`Account created: ${account.name}`, 'success');
        return account.id;
      },

      editAccount: (id, updates) =>
        set({
          accounts: get().accounts.map((a) =>
            a.id === id
              ? stamp({
                  ...a,
                  ...updates,
                  initialBalance: updates.initialBalance != null ? Number(updates.initialBalance) : a.initialBalance,
                  propFirmRules: updates.propFirmRules ? { ...a.propFirmRules, ...updates.propFirmRules } : a.propFirmRules,
                })
              : a
          ),
        }),

      archiveAccount: (id) => {
        set({ accounts: get().accounts.map((a) => (a.id === id ? stamp({ ...a, status: 'archived' }) : a)) });
        if (get().activeAccountId === id) {
          const next = get().accounts.find((a) => a.id !== id && a.status !== 'archived');
          if (next) set({ activeAccountId: next.id });
        }
        toast('Account archived', 'info');
      },

      // Hard delete only when the account has no trades — otherwise archive
      // instead, so trade history is never silently lost.
      deleteAccount: (id) => {
        if (get().trades.some((t) => t.accountId === id)) {
          return { ok: false, error: 'This account has trades — archive it instead of deleting.' };
        }
        set({ accounts: get().accounts.filter((a) => a.id !== id) });
        if (get().activeAccountId === id) {
          const next = get().accounts.find((a) => a.id !== id);
          set({ activeAccountId: next?.id || null });
        }
        toast('Account deleted', 'info');
        return { ok: true };
      },

      setActiveAccount: (id) => set({ activeAccountId: id }),

      // Update a trading account's starting balance (deposit/withdraw/adjust).
      // Trades stay untouched, so metrics recalc naturally on the next render.
      adjustAccountBalance: (id, newInitialBalance, reason) => {
        const acct = get().accounts.find((a) => a.id === id);
        if (!acct) return;
        const prev = acct.initialBalance;
        const adj = { date: Date.now(), previousBalance: prev, newBalance: Number(newInitialBalance), change: Number(newInitialBalance) - prev, reason: reason || '' };
        set({
          accounts: get().accounts.map((a) =>
            a.id === id ? stamp({ ...a, initialBalance: Number(newInitialBalance), balanceAdjustments: [...(a.balanceAdjustments || []), adj] }) : a
          ),
        });
      },

      // ─────────── Prop firm payouts ───────────
      addPayout: (id, { amount, date, notes }) => {
        const payout = { id: uid(), amount: Number(amount) || 0, date: date || new Date().toISOString().slice(0, 10), notes: notes || '', createdAt: Date.now() };
        set({ accounts: get().accounts.map((a) => (a.id === id ? stamp({ ...a, payouts: [...(a.payouts || []), payout] }) : a)) });
        toast(`Payout logged: $${payout.amount}`, 'success');
      },
      deletePayout: (id, payoutId) =>
        set({ accounts: get().accounts.map((a) => (a.id === id ? stamp({ ...a, payouts: (a.payouts || []).filter((p) => p.id !== payoutId) }) : a)) }),
      getTotalPayouts: (id) => (get().getAccount(id)?.payouts || []).reduce((a, p) => a + p.amount, 0),

      // ─────────── Prop firm phase lifecycle ───────────
      // outcome: 'advance' (phase1→phase2→funded) | 'failed'.
      advancePropFirmPhase: (id, outcome) => {
        const acct = get().accounts.find((a) => a.id === id);
        if (!acct || acct.type !== 'propfirm') return;
        const progress = computePropFirmProgress(acct, get().trades.filter((t) => t.accountId === id));
        const historyEntry = {
          phase: acct.phase,
          startedAt: acct.currentPhaseStartAt,
          endedAt: Date.now(),
          outcome: outcome === 'failed' ? 'failed' : 'passed',
          snapshot: { profitPct: progress.profitPct, tradingDays: progress.tradingDays, maxDrawdownPct: progress.maxDrawdownPct },
        };
        let newPhase = acct.phase;
        let newStatus = acct.status;
        if (outcome === 'failed') {
          newStatus = 'failed';
        } else {
          const np = nextPhase(acct.phase);
          newPhase = np || acct.phase;
          newStatus = newPhase === 'funded' ? 'funded' : 'active';
        }
        set({
          accounts: get().accounts.map((a) =>
            a.id === id ? stamp({ ...a, phase: newPhase, status: newStatus, currentPhaseStartAt: Date.now(), phaseHistory: [...(a.phaseHistory || []), historyEntry] }) : a
          ),
        });
        if (outcome !== 'failed') useSkillStore.getState().awardXP('discipline-execution-lv1', 15, `prop firm phase passed: ${acct.name}`);
        toast(outcome === 'failed' ? `${acct.name} marked as failed` : `${acct.name} advanced to ${newPhase}`, outcome === 'failed' ? 'error' : 'success');
      },

      // ─────────── SELECTORS ───────────
      // Everything here is scoped to an account id. Dashboard / Trading / burn-rate /
      // Advanced Analytics all call these — same account, same numbers, no drift.
      getAccount: (accountId) => get().accounts.find((a) => a.id === (accountId || get().activeAccountId)),
      getAccountsByType: (type) => get().accounts.filter((a) => a.type === type),

      getAccountTrades: (accountId) => {
        const id = accountId || get().activeAccountId;
        return get().trades.filter((t) => (t.accountId || 'demo') === id);
      },
      getInitialBalance: (accountId) => get().getAccount(accountId)?.initialBalance ?? 0,
      // Current account balance (initial + all P&L). This is THE canonical account value.
      accountValue: (accountId) => get().getInitialBalance(accountId) + get().getAccountTrades(accountId).reduce((a, t) => a + t.pnl, 0),
      getTotalPnL: (accountId) => get().getAccountTrades(accountId).reduce((a, t) => a + t.pnl, 0),
      getMonthPnL: (accountId) => {
        const cutoff = startOfMonth(new Date());
        return get().getAccountTrades(accountId).filter((t) => new Date(t.date) >= cutoff).reduce((a, t) => a + t.pnl, 0);
      },
      // Full stats object: count, winRate, expectancy, profit factor, etc.
      getStats: (accountId) => tradeStats(get().getAccountTrades(accountId)),
      getMonthStats: (accountId) => {
        const cutoff = startOfMonth(new Date());
        return tradeStats(get().getAccountTrades(accountId).filter((t) => new Date(t.date) >= cutoff));
      },
      getMaxDrawdown: (accountId) => maxDrawdown(equityCurve(get().getAccountTrades(accountId), get().getInitialBalance(accountId))),
      getMonthMaxDrawdown: (accountId) => {
        const cutoff = startOfMonth(new Date());
        return maxDrawdown(equityCurve(get().getAccountTrades(accountId).filter((t) => new Date(t.date) >= cutoff), get().getInitialBalance(accountId)));
      },
      getEquityCurve: (accountId) => equityCurve(get().getAccountTrades(accountId), get().getInitialBalance(accountId)),

      // Prop-firm rule tracking for the account's current phase.
      getPropFirmProgress: (accountId) => {
        const acct = get().getAccount(accountId);
        if (!acct || acct.type !== 'propfirm') return null;
        return computePropFirmProgress(acct, get().getAccountTrades(acct.id));
      },

      addTrade: (data) => {
        const accountId = data.accountId || get().activeAccountId;
        const { pnlPips } = computeTradeDerived(data);
        const balance = get().accountValue(accountId);
        const trade = {
          ...data,
          accountId,
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
        const acctName = get().getAccount(accountId)?.name || accountId;
        toast(
          `Trade saved (${acctName}) — ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl} · +${autoXP + (trade.linkedSkills?.length || 0) * TRADE_XP} XP`,
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

      resetAll: () => set({ trades: [], accounts: [], activeAccountId: null }),
    }),
    { name: 'audax-trading' }
  )
);
