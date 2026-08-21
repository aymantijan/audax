import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfMonth } from 'date-fns';
import { uid, todayKey } from '../utils/formatters';
import { computeTradeDerived, round2, tradeStats, equityCurve, maxDrawdown } from '../utils/calculations';
import { computePropFirmProgress, computeRulesProgress, nextPhase } from '../utils/prop-firm-analytics';
import { computeRiskLimitBreaches } from '../utils/risk-management';
import { computeDisciplineScore, detectRevengeTrades, detectTiltSequences } from '../utils/trading-psychology';
import { generateTradingCoachRecommendation } from '../utils/trading-coach';
import { computeAccountScore, computeGroupScore, computeOverallScore, DEFAULT_SCORE_WEIGHTS } from '../utils/trading-score';
import { TRADE_XP, STRATEGY_SKILL, INSTRUMENT_SKILL, MACRO_SKILL, INSTRUMENTS, STRATEGIES, CURRENCY_SYMBOL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useAuthStore } from './authStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

// Same shape/mechanism as healthStore's/engineeringStore's BADGE_DEFS —
// `check` receives this store's state, `awardedBadges` persists which ones
// already fired so re-checking on every trade never re-toasts one.
const BADGE_DEFS = [
  { id: 'first-trade', name: 'First Trade', tier: 'bronze', check: (s) => s.trades.length >= 1 },
  { id: 'strategy-explorer', name: 'Strategy Explorer', tier: 'bronze', check: (s) => new Set(s.trades.map((t) => t.strategy).filter(Boolean)).size >= 3 },
  { id: 'instrument-explorer', name: 'Instrument Explorer', tier: 'silver', check: (s) => new Set(s.trades.map((t) => t.instrument).filter(Boolean)).size >= 4 },
  { id: 'half-century-trader', name: 'Half Century', tier: 'silver', check: (s) => s.trades.length >= 50 },
  { id: 'century-trader', name: 'Century Trader', tier: 'gold', check: (s) => s.trades.length >= 100 },
  { id: 'multi-account', name: 'Multi-Account', tier: 'silver', check: (s) => s.accounts.length >= 3 },
  { id: 'funded-trader', name: 'Funded Trader', tier: 'gold', check: (s) => s.accounts.some((a) => a.status === 'funded') },
  { id: 'profitable-trader', name: 'Profitable Trader', tier: 'silver', check: (s) => s.trades.filter((t) => t.pnl > 0).length >= 50 },
  { id: 'no-revenge-streak', name: 'No Revenge', tier: 'silver', check: (s) => s.trades.length >= 20 && detectRevengeTrades(s.trades).length === 0 },
  { id: 'disciplined-trader', name: 'Disciplined Trader', tier: 'gold', check: (s) => s.trades.length >= 20 && (computeDisciplineScore(s.trades)?.score ?? 0) >= 80 },
];

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
      awardedBadges: [], // badge ids already toasted, so checkBadges never re-fires one

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'trading-discipline-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      // ─────────── Custom instruments & strategies ───────────
      // The 5 INSTRUMENTS / 3 STRATEGIES in constants.js stay fixed (they're
      // also the keys for the auto-XP skill maps and the default pip specs) —
      // these are user-added EXTRAS, global across all accounts (an instrument
      // or strategy isn't account-specific). `kind: 'pip'` computes PnL the
      // forex way (price move / pipSize * pipValuePerLot * lots); `'direct'`
      // computes it the crypto/stock way (price move * size), same as BTC.
      customInstruments: [], // [{ id, code, kind:'pip'|'direct', pipSize?, pipValuePerLot?, createdAt }]
      customStrategies: [], // [{ id, name, createdAt }]

      getInstrumentList: () => [...INSTRUMENTS, ...get().customInstruments.map((c) => c.code)],
      getStrategyList: () => [...STRATEGIES, ...get().customStrategies.map((c) => c.name)],
      // code -> {pipSize, pipValuePerLot, kind} for every CUSTOM instrument —
      // merged with the built-in PIP_SPECS inside calculations.js#computeTradeDerived.
      getInstrumentSpecs: () =>
        Object.fromEntries(get().customInstruments.map((c) => [c.code, { pipSize: c.pipSize, pipValuePerLot: c.pipValuePerLot, kind: c.kind }])),

      addCustomInstrument: ({ code, kind, pipSize, pipValuePerLot }) => {
        const clean = (code || '').trim().toUpperCase();
        if (!clean) return { ok: false, error: 'Symbol is required.' };
        const taken = INSTRUMENTS.includes(clean) || get().customInstruments.some((c) => c.code === clean);
        if (taken) return { ok: false, error: `"${clean}" already exists.` };
        if (kind === 'pip' && (!Number(pipSize) || !Number(pipValuePerLot))) {
          return { ok: false, error: 'Pip size and pip value per lot are required for a pip-based instrument.' };
        }
        const instrument = {
          id: uid(), code: clean, kind,
          pipSize: kind === 'pip' ? Number(pipSize) : undefined,
          pipValuePerLot: kind === 'pip' ? Number(pipValuePerLot) : undefined,
          createdAt: Date.now(),
        };
        set({ customInstruments: [...get().customInstruments, instrument] });
        toast(`Instrument added: ${clean}`, 'success');
        return { ok: true };
      },
      editCustomInstrument: (id, updates) =>
        set({
          customInstruments: get().customInstruments.map((c) =>
            c.id === id
              ? {
                  ...c, ...updates,
                  pipSize: updates.kind === 'pip' || (!updates.kind && c.kind === 'pip') ? Number(updates.pipSize ?? c.pipSize) : undefined,
                  pipValuePerLot: updates.kind === 'pip' || (!updates.kind && c.kind === 'pip') ? Number(updates.pipValuePerLot ?? c.pipValuePerLot) : undefined,
                }
              : c
          ),
        }),
      deleteCustomInstrument: (id) => {
        const inst = get().customInstruments.find((c) => c.id === id);
        if (!inst) return { ok: false, error: 'Instrument not found.' };
        if (get().trades.some((t) => t.instrument === inst.code)) {
          return { ok: false, error: 'This instrument has logged trades — it cannot be deleted.' };
        }
        set({ customInstruments: get().customInstruments.filter((c) => c.id !== id) });
        toast('Instrument removed', 'info');
        return { ok: true };
      },

      addCustomStrategy: ({ name }) => {
        const clean = (name || '').trim();
        if (!clean) return { ok: false, error: 'Strategy name is required.' };
        const taken = STRATEGIES.includes(clean) || get().customStrategies.some((c) => c.name.toLowerCase() === clean.toLowerCase());
        if (taken) return { ok: false, error: `"${clean}" already exists.` };
        set({ customStrategies: [...get().customStrategies, { id: uid(), name: clean, createdAt: Date.now() }] });
        toast(`Strategy added: ${clean}`, 'success');
        return { ok: true };
      },
      editCustomStrategy: (id, name) =>
        set({ customStrategies: get().customStrategies.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) }),
      deleteCustomStrategy: (id) => {
        const strat = get().customStrategies.find((c) => c.id === id);
        if (!strat) return { ok: false, error: 'Strategy not found.' };
        if (get().trades.some((t) => t.strategy === strat.name)) {
          return { ok: false, error: 'This strategy has logged trades — it cannot be deleted.' };
        }
        set({ customStrategies: get().customStrategies.filter((c) => c.id !== id) });
        toast('Strategy removed', 'info');
        return { ok: true };
      },

      // Phase 6: local-only browser-notification alerts (rule breaches/warnings,
      // tilt, phase deadline). `lastShown` dedupes by `${accountId}|${conditionKey}`
      // → date string, so each condition fires at most once per account per day.
      alerts: { enabled: false, lastShown: {} },
      setAlertsEnabled: (enabled) => set({ alerts: { ...get().alerts, enabled } }),
      markAlertShown: (key, dateKey) => set({ alerts: { ...get().alerts, lastShown: { ...get().alerts.lastShown, [key]: dateKey } } }),

      // ─────────── Score system (Phase 8) ───────────
      // See utils/trading-score.js for the full Score-1/2/3 design. Only the
      // Score-3 (overall Trading-page) inputs are user-configurable/persisted —
      // Score-1 (per account) and Score-2 (per type) are pure derived selectors.
      scoreSettings: { includedTypes: { demo: true, broker: true, propfirm: true }, weights: DEFAULT_SCORE_WEIGHTS, mode: 'fixed' },
      setScoreSettings: (updates) =>
        set({
          scoreSettings: {
            ...get().scoreSettings,
            ...updates,
            includedTypes: updates.includedTypes ? { ...get().scoreSettings.includedTypes, ...updates.includedTypes } : get().scoreSettings.includedTypes,
            weights: updates.weights ? { ...get().scoreSettings.weights, ...updates.weights } : get().scoreSettings.weights,
          },
        }),

      getAccountScore: (accountId) => computeAccountScore(get().getAccountTrades(accountId), get().getInitialBalance(accountId)),

      getTypeScore: (type) => {
        const accts = get().accounts.filter((a) => a.status !== 'archived' && a.type === type);
        return computeGroupScore(accts, get().getAccountTrades, get().accountValue);
      },

      getOverallScore: () =>
        computeOverallScore({
          accounts: get().accounts,
          getTrades: get().getAccountTrades,
          getValue: get().accountValue,
          included: get().scoreSettings.includedTypes,
          weights: get().scoreSettings.weights,
          mode: get().scoreSettings.mode,
        }),

      // ─────────── AI Trading Coach (Phase 7) ───────────
      // Same architecture as healthStore's coach (see healthStore.js#getCoachRecommendation):
      // an instant local heuristic cached 1x/day PER ACCOUNT (keyed by accountId,
      // since a prop-firm account and a demo account need very different advice),
      // optionally upgraded in place to an AI-generated one via refreshAICoach()
      // when the OpenRouter proxy is configured/reachable.
      coachCache: {},

      getCoachRecommendation: (accountId) => {
        const id = accountId || get().activeAccountId;
        const today = todayKey();
        const cached = get().coachCache[id];
        if (cached?.date === today) return cached;

        const trades = get().getAccountTrades(id);
        const monthStats = get().getMonthStats(id);
        const disc = computeDisciplineScore(trades);
        const acct = get().getAccount(id);
        const riskBreaches = acct?.type === 'propfirm' ? get().getPropFirmProgress(id)?.breaches || [] : get().getRiskLimitBreaches(id);
        const weekAgo = Date.now() - 7 * 86400000;
        const tradesThisWeek = trades.filter((t) => new Date(t.date).getTime() >= weekAgo).length;

        const rec = generateTradingCoachRecommendation({
          disciplineScore: disc?.score ?? null,
          revengeCount: disc?.revengeCount ?? 0,
          tiltCount: disc?.tiltCount ?? 0,
          monthPnl: monthStats.totalPnl,
          maxDrawdownPct: get().getMaxDrawdown(id),
          riskBreaches,
          tradesThisWeek,
        });
        const result = { date: today, source: 'local', ...rec };
        set({ coachCache: { ...get().coachCache, [id]: result } });
        return result;
      },

      // Aggregated (no raw per-trade data) snapshot handed to the AI coach.
      buildCoachContext: (accountId) => {
        const id = accountId || get().activeAccountId;
        const acct = get().getAccount(id);
        const trades = get().getAccountTrades(id);
        const stats = get().getStats(id);
        const monthStats = get().getMonthStats(id);
        const disc = computeDisciplineScore(trades);
        const propFirmProgress = acct?.type === 'propfirm' ? get().getPropFirmProgress(id) : null;
        return {
          accountName: acct?.name, accountType: acct?.type,
          totalTrades: stats.count, winRate: round2(stats.winRate), profitFactor: stats.profitFactor,
          expectancyUsd: round2(stats.expectancyUsd),
          monthPnl: round2(monthStats.totalPnl),
          maxDrawdownPct: round2(get().getMaxDrawdown(id)),
          disciplineScore: disc?.score ?? null,
          revengeCount: disc?.revengeCount ?? 0,
          tiltCount: disc?.tiltCount ?? 0,
          propFirmProgress: propFirmProgress
            ? { profitPct: propFirmProgress.profitPct, tradingDays: propFirmProgress.tradingDays, breaches: propFirmProgress.breaches.map((b) => b.message) }
            : null,
        };
      },

      // Overwrites coachCache[id] with an AI-generated recommendation when the
      // OpenRouter proxy is configured and reachable. Silently does nothing on
      // failure — the local heuristic (already cached) stays displayed.
      refreshAICoach: async (accountId) => {
        const id = accountId || get().activeAccountId;
        const today = todayKey();
        const cached = get().coachCache[id];
        if (cached?.date === today && cached?.source === 'ai') return;
        try {
          const { getAITradingRecommendation } = await import('../services/trading-coach-ai');
          const text = await getAITradingRecommendation(get().buildCoachContext(id));
          set({ coachCache: { ...get().coachCache, [id]: { date: today, text, tone: 'info', source: 'ai' } } });
        } catch {
          // AI unavailable — local heuristic (already cached) remains shown.
        }
      },

      // Free-form Q&A about the user's own trading data, scoped to one account.
      // Throws on failure — callers should catch and show a fallback message.
      askTradingQuestion: async (accountId, question) => {
        const { askAITradingQuestion } = await import('../services/trading-coach-ai');
        return askAITradingQuestion(get().buildCoachContext(accountId || get().activeAccountId), question);
      },

      // Last-7-days rollup used for the "weekly journal digest" (local stats;
      // the narrative version is generated on-demand via the AI ask/digest mode).
      getWeeklyDigest: (accountId) => {
        const id = accountId || get().activeAccountId;
        const weekAgo = Date.now() - 7 * 86400000;
        const trades = get().getAccountTrades(id).filter((t) => new Date(t.date).getTime() >= weekAgo);
        const stats = tradeStats(trades);
        return {
          tradeCount: stats.count,
          winRate: round2(stats.winRate),
          totalPnl: round2(stats.totalPnl),
          revengeCount: detectRevengeTrades(trades).length,
          tiltCount: detectTiltSequences(trades).length,
        };
      },

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
          currency: 'USD',
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
            currency: 'USD',
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
          currency: data.currency || 'USD',
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
          // Demo/Broker only — prop-firm accounts use propFirmRules instead.
          riskLimits:
            data.type !== 'propfirm' && (data.riskMaxDailyLossPct || data.riskMaxTotalDrawdownPct)
              ? { maxDailyLossPct: numOrNull(data.riskMaxDailyLossPct), maxTotalDrawdownPct: numOrNull(data.riskMaxTotalDrawdownPct) }
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
        get().checkBadges();
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
                  // 'riskLimits' in updates (not just !== undefined) so passing
                  // `riskLimits: undefined` explicitly CLEARS it (both fields
                  // emptied in the form) rather than being indistinguishable
                  // from "this call didn't touch riskLimits at all".
                  riskLimits: 'riskLimits' in updates ? (updates.riskLimits ? { ...a.riskLimits, ...updates.riskLimits } : undefined) : a.riskLimits,
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
        const sym = CURRENCY_SYMBOL[get().getAccount(id)?.currency] || '$';
        toast(`Payout logged: ${sym}${payout.amount}`, 'success');
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
        get().checkBadges();
      },

      // A hard rule violation (max daily loss, max total drawdown) that
      // terminates the account immediately — distinct from 'failed', which
      // means an EVALUATION phase simply wasn't cleared in time (missed
      // profit target / min days) without breaking a rule. Breach can hit
      // an account at ANY stage, including already-funded — the phase-only
      // advancePropFirmPhase('failed') couldn't represent that at all, since
      // funded accounts never showed a fail/breach action in the UI.
      breachAccount: (id, note) => {
        const acct = get().accounts.find((a) => a.id === id);
        if (!acct || acct.type !== 'propfirm') return;
        const progress = computePropFirmProgress(acct, get().trades.filter((t) => t.accountId === id));
        const historyEntry = {
          phase: acct.phase,
          startedAt: acct.currentPhaseStartAt,
          endedAt: Date.now(),
          outcome: 'breached',
          note: note || '',
          snapshot: { profitPct: progress.profitPct, tradingDays: progress.tradingDays, maxDrawdownPct: progress.maxDrawdownPct },
        };
        set({
          accounts: get().accounts.map((a) =>
            a.id === id ? stamp({ ...a, status: 'breached', phaseHistory: [...(a.phaseHistory || []), historyEntry] }) : a
          ),
        });
        toast(`${acct.name} marked as breached${note ? ` — ${note}` : ''}`, 'error');
      },

      // ─────────── Demo account: opt-in Prop Firm simulation ───────────
      // Lets a Demo account train against a self-configured multi-phase
      // ruleset (pick 1-3 phases, each with its own profit target / daily
      // loss / drawdown / min days / consistency / max-daily-profit) — same
      // computeRulesProgress engine a REAL Prop Firm account uses, so a
      // trader can rehearse passing before paying for an actual evaluation.
      // Entirely separate fields from propFirmRules/phase/phaseHistory (which
      // stay reserved for actual type:'propfirm' accounts) — purely additive,
      // zero migration risk to existing accounts.
      setSimPhases: (accountId, phases) => {
        const acct = get().getAccount(accountId);
        if (!acct || acct.type !== 'demo') return { ok: false, error: 'Simulation is only available on Demo accounts.' };
        if (!phases?.length) return { ok: false, error: 'Select at least one phase.' };
        set({
          accounts: get().accounts.map((a) =>
            a.id === accountId
              ? stamp({
                  ...a, simEnabled: true, simPhases: phases,
                  simCurrentPhaseIndex: 0, simCurrentPhaseStartAt: Date.now(), simPhaseHistory: [], simStatus: 'active',
                })
              : a
          ),
        });
        toast(`Simulation configured for ${acct.name} (${phases.length} phase${phases.length > 1 ? 's' : ''})`, 'success');
        return { ok: true };
      },
      disableSim: (accountId) =>
        set({ accounts: get().accounts.map((a) => (a.id === accountId ? stamp({ ...a, simEnabled: false }) : a)) }),

      // outcome: 'advance' | 'failed'.
      advanceSimPhase: (accountId, outcome) => {
        const acct = get().getAccount(accountId);
        if (!acct?.simEnabled || !acct.simPhases?.length) return;
        const idx = acct.simCurrentPhaseIndex || 0;
        const progress = get().getSimProgress(accountId);
        const historyEntry = {
          phaseIndex: idx,
          startedAt: acct.simCurrentPhaseStartAt,
          endedAt: Date.now(),
          outcome: outcome === 'failed' ? 'failed' : 'passed',
          snapshot: { profitPct: progress.profitPct, tradingDays: progress.tradingDays, maxDrawdownPct: progress.maxDrawdownPct },
        };
        const isLast = idx >= acct.simPhases.length - 1;
        const newStatus = outcome === 'failed' ? 'failed' : isLast ? 'completed' : 'active';
        const newIndex = outcome === 'failed' || isLast ? idx : idx + 1;
        set({
          accounts: get().accounts.map((a) =>
            a.id === accountId
              ? stamp({
                  ...a, simCurrentPhaseIndex: newIndex, simCurrentPhaseStartAt: Date.now(),
                  simPhaseHistory: [...(a.simPhaseHistory || []), historyEntry], simStatus: newStatus,
                })
              : a
          ),
        });
        if (outcome !== 'failed') {
          useSkillStore.getState().awardXP('discipline-execution-lv1', isLast ? 20 : 10, `sim phase passed: ${acct.name}`);
        }
        toast(
          outcome === 'failed' ? `${acct.name} simulation: phase failed — reset when ready` : isLast ? `${acct.name}: simulation completed — all phases passed` : `${acct.name}: advanced to simulated phase ${newIndex + 1}`,
          outcome === 'failed' ? 'error' : 'success'
        );
      },

      // Current simulated phase's rules + progress — [] rules / null-safe if
      // simulation isn't enabled or has no phases configured.
      getSimPhaseRules: (accountId) => {
        const acct = get().getAccount(accountId);
        if (!acct?.simEnabled || !acct.simPhases?.length) return null;
        return acct.simPhases[acct.simCurrentPhaseIndex || 0] || null;
      },
      getSimProgress: (accountId) => {
        const acct = get().getAccount(accountId);
        const rules = get().getSimPhaseRules(accountId);
        if (!acct || !rules) return null;
        return computeRulesProgress(rules, acct.simCurrentPhaseStartAt || acct.createdAt, acct.initialBalance || 0, get().getAccountTrades(accountId));
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

      // Simpler risk-limit checks (daily loss / total drawdown) for Demo &
      // Broker accounts — prop-firm accounts use their own richer propFirmRules
      // instead, so this always returns [] for them (no double-checking). A
      // Demo account running a phase simulation uses ITS breaches instead of
      // the flat riskLimits (the simulated phase's rules are the more precise
      // check once the user has configured one).
      getRiskLimitBreaches: (accountId) => {
        const acct = get().getAccount(accountId);
        if (!acct || acct.type === 'propfirm') return [];
        if (acct.simEnabled) return get().getSimProgress(accountId)?.breaches || [];
        return computeRiskLimitBreaches(acct, get().getAccountTrades(acct.id));
      },

      addTrade: (data) => {
        const accountId = data.accountId || get().activeAccountId;
        const { pnlPips } = computeTradeDerived(data, get().getInstrumentSpecs());
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
        const acct = get().getAccount(accountId);
        const sym = CURRENCY_SYMBOL[acct?.currency] || '$';
        toast(
          `Trade saved (${acct?.name || accountId}) — ${trade.pnl >= 0 ? '+' : ''}${sym}${trade.pnl} · +${autoXP + (trade.linkedSkills?.length || 0) * TRADE_XP} XP`,
          trade.pnl >= 0 ? 'success' : 'info'
        );
        get().checkBadges();
        return trade.id;
      },

      editTrade: (id, updates) => {
        set({
          trades: get().trades.map((t) => {
            if (t.id !== id) return t;
            const merged = stamp({ ...t, ...updates });
            const { pnlPips } = computeTradeDerived(merged, get().getInstrumentSpecs());
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

      resetAll: () =>
        set({
          trades: [], accounts: [], activeAccountId: null, awardedBadges: [],
          alerts: { enabled: false, lastShown: {} }, coachCache: {},
          scoreSettings: { includedTypes: { demo: true, broker: true, propfirm: true }, weights: DEFAULT_SCORE_WEIGHTS, mode: 'fixed' },
          customInstruments: [], customStrategies: [],
        }),
    }),
    { name: 'audax-trading' }
  )
);
