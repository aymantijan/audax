import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, usdToMad } from '../utils/formatters';
import {
  validateEntry, accountBalances, ledgerFor, trialBalance,
  balanceSheet, cpc, esg, financialAnalysis, correctedNetWorth, monthlySeries,
  budgetVariance, treasuryForecast, treasuryBalance, netWorthHistory, paceFromEdges, projectValue,
  echeanceOccurrences, treasuryForecastV2, netWorthForecastV2, resolveEcheanceLines,
  DEFAULT_BUDGET_PERIOD, budgetInsights, dailyResults,
} from '../utils/accounting-engine';
import { LEGACY_CATEGORY_TO_ACCOUNT, LEGACY_SOURCE_TO_ACCOUNT, classOf, ACCOUNT_MAP, mergedAccountMap } from '../utils/chart-of-accounts';
import { getLabelsForAccount, suggestLabels, findClosestLabel, computeLabelRatiosAfter } from '../utils/label-analysis';
import { calculateGoalXP, badgeForGoal, budgetSeverity } from '../utils/goals';
import { useFinanceStore } from './financeStore';
import { useSkillStore } from './skillStore';
import { useTradingStore } from './tradingStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Comptabilité générale personnelle en partie double.
// Le journal est la source unique ; chaque sélecteur dérive un état de synthèse
// (grand livre, balance, bilan, CPC, ESG), l'analyse financière, le budget
// et la trésorerie — exactement comme demandé : une saisie, tout se propage.

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });

// Local Y/M/D date key — NEVER `.toISOString()` for this (round-trips
// through UTC and can roll a date back a day right at a day/month/week
// boundary in any timezone ahead of UTC — see checkFinanceRewards' history).
const localDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// 'YYYY-MM' the month before `mk` ('YYYY-MM'), handling year wraparound.
const monthBefore = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // m is 1-indexed; -2 = one month before, 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Same shape/mechanism as healthStore's/engineeringStore's BADGE_DEFS —
// `check` receives the FULL store instance (get()), not just raw data, so
// it can call any getter (s.getNetWorth(), etc.) same as healthStore's
// badges already call s.getPRs(). `awardedBadges` persists which ones
// already fired so re-checking on every mutation never re-toasts one.
// Distinct from the per-goal trophy system (goal.badge,
// checkGoalAchievement) above — that's a one-off label on a specific
// financial goal; this is a cross-cutting achievement list, same as every
// other domain.
//
// 100 badges, built from a handful of tiered groups (count/streak/money
// milestones) rather than hand-written one by one — every threshold still
// maps to a real, checkable state of the account, none are filler. Tier
// (bronze/silver/gold) is assigned by RANK within its own group (first ~40%
// bronze, next ~35% silver, rest gold) so the badge list itself reads as a
// progression, not a flat pile.
function tierByRank(i, n) {
  const frac = (i + 1) / n;
  if (frac <= 0.4) return 'bronze';
  if (frac <= 0.75) return 'silver';
  return 'gold';
}
function fmtBadgeMoney(n) {
  if (n >= 1_000_000) return `${n % 1_000_000 === 0 ? n / 1_000_000 : (n / 1_000_000).toFixed(1)}M DH`;
  if (n >= 1000) return `${Math.round(n / 1000)}K DH`;
  return `${n} DH`;
}
// thresholds: number[]; ids/names get a fixed id (stable across re-evaluations,
// unaffected by later inserting/removing OTHER groups) via `idPrefix-<threshold>`
// — except where `fixedIds[threshold]` names a pre-existing id to preserve
// (so badges already earned under the old, non-tiered scheme keep their
// earned state instead of re-firing under a new id).
function countTierBadges(idPrefix, label, thresholds, getValue, fixedIds = {}) {
  return thresholds.map((t, i) => ({
    id: fixedIds[t] || `${idPrefix}-${t}`,
    name: `${label} ${t.toLocaleString('fr-FR')}`,
    tier: tierByRank(i, thresholds.length),
    check: (s) => getValue(s) >= t,
  }));
}
function moneyTierBadges(idPrefix, label, thresholds, getValue, fixedIds = {}) {
  return thresholds.map((t, i) => ({
    id: fixedIds[t] || `${idPrefix}-${t}`,
    name: `${label} ${fmtBadgeMoney(t)}`,
    tier: tierByRank(i, thresholds.length),
    check: (s) => getValue(s) >= t,
  }));
}

const BADGE_DEFS = [
  // ── Journal (8) ──
  ...countTierBadges('journal', 'Journal', [1, 10, 25, 50, 100, 200, 500, 1000], (s) => s.journal.length, { 1: 'first-entry', 50: 'bookkeeper', 200: 'ledger-master' }),
  // ── Budgets (5) ──
  ...countTierBadges('budgets', 'Budgets', [1, 5, 10, 20, 40], (s) => s.budgets.length, { 1: 'budget-setter', 5: 'full-budget' }),
  // ── Échéances (5) ──
  ...countTierBadges('echeances', 'Échéances', [1, 5, 10, 25, 50], (s) => s.echeances.length, { 1: 'echeance-planner' }),
  // ── Corrections ANC→ANCC (4) ──
  ...countTierBadges('corrections', 'Corrections', [1, 5, 15, 30], (s) => s.corrections.length, { 5: 'correction-analyst' }),
  // ── Comptes auxiliaires de trésorerie (4) ──
  ...countTierBadges('treasury-accts', 'Comptes Trésorerie', [1, 3, 6, 10], (s) => s.treasuryAccounts.length, { 3: 'treasury-organizer' }),
  // ── Objectifs atteints (5) ──
  ...countTierBadges('goals-achieved', 'Objectifs Atteints', [1, 3, 5, 10, 20], (s) => s.goals.filter((g) => g.achieved).length, { 1: 'goal-achiever' }),
  // ── Limites de libellé configurées (3) ──
  ...countTierBadges('label-limits', 'Limites', [1, 5, 10], (s) => s.labelLimits.length),
  // ── Comptes distincts utilisés — largeur de la comptabilité, pas juste son volume (4) ──
  ...countTierBadges('accounts-used', 'Comptes Utilisés', [5, 10, 20, 30], (s) => new Set(s.journal.flatMap((e) => e.lines.map((l) => l.account))).size),
  // ── Payouts trading reliés à une écriture réelle — voir addEntry (4) ──
  ...countTierBadges('payouts-linked', 'Payouts Reliés', [1, 5, 10, 25], (s) => s.linkedPayoutsCount || 0),
  // ── Patrimoine (ANCC) — du plus modeste au plus riche (15) ──
  ...moneyTierBadges('net-worth', 'Patrimoine', [1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000, 300000, 500000, 750000, 1000000, 2000000, 5000000, 10000000], (s) => s.getNetWorth().ancc),
  // ── Trésorerie disponible (10) ──
  ...moneyTierBadges('cash', 'Trésorerie', [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000], (s) => treasuryBalance(s.journal)),
  // ── Meilleur taux d'épargne mensuel jamais atteint (3) — voir checkFinanceRewards ──
  { id: 'savings-rate-20', name: 'Taux d\'Épargne 20%', tier: 'bronze', check: (s) => (s.bestSavingsRate || 0) >= 20 },
  { id: 'savings-rate-40', name: 'Taux d\'Épargne 40%', tier: 'silver', check: (s) => (s.bestSavingsRate || 0) >= 40 },
  { id: 'savings-rate-60', name: 'Taux d\'Épargne 60%', tier: 'gold', check: (s) => (s.bestSavingsRate || 0) >= 60 },
  // ── Streaks (30) — voir checkFinanceRewards()/checkWeeklyBudgetStreak()/markEcheancePaid(), les seuls écrivains de financeStreaks ──
  ...countTierBadges('bookkeeping-streak', 'Mois Tenus D\'Affilée', [1, 3, 6, 12, 24], (s) => s.financeStreaks?.bookkeepingMonths || 0),
  ...countTierBadges('savings-streak', 'Mois D\'Épargne D\'Affilée', [1, 3, 6, 12, 24], (s) => s.financeStreaks?.positiveSavingsMonths || 0, { 3: 'regular-saver' }),
  ...countTierBadges('no-overage-streak', 'Mois Sans Dépassement D\'Affilée', [1, 3, 6, 12, 24], (s) => s.financeStreaks?.noOverageMonths || 0, { 3: 'zero-overage' }),
  ...countTierBadges('no-overage-week-streak', 'Semaines Sans Dépassement D\'Affilée', [4, 8, 12, 26, 52], (s) => s.financeStreaks?.noOverageWeeks || 0),
  ...countTierBadges('on-time-streak', 'Échéances Payées À Temps D\'Affilée', [3, 5, 10, 20, 50], (s) => s.financeStreaks?.onTimeEcheances || 0, { 5: 'punctual' }),
  ...countTierBadges('net-worth-growth-streak', 'Mois De Patrimoine En Hausse D\'Affilée', [3, 6, 12, 24, 36], (s) => s.financeStreaks?.netWorthGrowthMonths || 0, { 6: 'growing-net-worth' }),
];

export const useAccountingStore = create(
  persist(
    (set, get) => ({
      journal: [], // écritures en partie double
      budgets: [], // [{ id, account, amount }] — budget mensuel par compte (classes 6 & 7)
      corrections: [], // [{ id, type:'plus-value'|'moins-value', label, amount, account, date }] — ANC → ANCC
      goals: [], // [{ id, type:'treasury'|'networth', name, targetAmount, targetDate, achieved, achievedAt, xpAwarded, badge }]
      labelLimits: [], // [{ id, account, label, maxRatioToIncomePct, maxRatioToAccountSpendPct, createdAt }]
      legacyImported: false,
      treasuryAccounts: [], // comptes auxiliaires de trésorerie : [{ id, code, parentCode, name, bank, archived, createdAt, updatedAt }]
      echeances: [], // [{ id, label, type:'produit'|'charge', natureAccount, treasuryAccount, amount, dueDate, recurrence, endDate, active, paidDates, createdAt, updatedAt }]
      echeanceAlerts: { enabled: false, lastShown: {} }, // rappels navigateur pour échéances en retard — même mécanisme que tradingStore.alerts / healthStore.reminders
      budgetAlerts: { enabled: false, lastShown: {} }, // idem pour les dépassements de budget (charges)
      awardedBadges: [], // badge ids already toasted, so checkBadges never re-fires one
      financeMonthChecks: [], // ['2026-07', ...] months already evaluated by checkFinanceRewards — checked once, ever, regardless of outcome
      financeWeekChecks: [], // ['2026-08-17', ...] Mondays of weeks already evaluated by checkWeeklyBudgetStreak
      financeStreaks: {
        bookkeepingMonths: 0, // consecutive closed months with >= 1 journal entry
        positiveSavingsMonths: 0, // consecutive closed months with tauxEpargne > 0
        noOverageMonths: 0, // consecutive closed months with zero overage on monthly budgets
        noOverageWeeks: 0, // consecutive closed weeks with zero overage on weekly budgets
        onTimeEcheances: 0, // consecutive échéances paid on or before their due date (resets on ANY late payment)
        netWorthGrowthMonths: 0, // consecutive closed months where ANCC grew vs the month before
      },
      linkedPayoutsCount: 0, // total trading payouts ever auto-linked to a journal entry — see addEntry
      bestSavingsRate: 0, // highest tauxEpargne (%) ever seen across every closed month checkFinanceRewards has evaluated

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'financial-discipline-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      // Evaluates the most recently CLOSED month (not the in-progress one —
      // it's over, every number is final) across every recurring Finance
      // reward at once. Idempotent via financeMonthChecks: each month is
      // evaluated exactly once, ever, whichever page happens to call this
      // first after that month ends — a losing month is marked checked too
      // (never retried), it just doesn't extend a streak. Call from any
      // Finance page's mount (see AccountingOverview.jsx) — cheap no-op
      // once caught up.
      checkFinanceRewards: () => {
        // Built from local Y/M directly, NOT via `.toISOString()` (that
        // round-trips through UTC and can roll the date back a day right
        // at a month boundary in any timezone ahead of UTC — silently
        // evaluating the wrong month).
        const now = new Date();
        const prevMonthIndex = now.getMonth() - 1;
        const y = prevMonthIndex < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const m = ((prevMonthIndex % 12) + 12) % 12;
        const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
        if (get().financeMonthChecks.includes(mk)) return;
        set({ financeMonthChecks: [...get().financeMonthChecks, mk] });

        const journal = get().journal;
        const period = { from: `${mk}-01`, to: `${mk}-31` };
        const award = useSkillStore.getState().awardXP;
        const streaks = { ...get().financeStreaks };

        // C — tenue de livre : au moins une écriture ce mois-là.
        const hadEntry = journal.some((e) => e.date >= period.from && e.date <= period.to);
        streaks.bookkeepingMonths = hadEntry ? streaks.bookkeepingMonths + 1 : 0;
        if (hadEntry) award('journal-keeper-lv1', 3, `mois tenu à jour : ${mk}`);

        // B — taux d'épargne positif, et bonus si en progression vs le mois d'avant.
        const e = esg(journal, period);
        if (e.tauxEpargne != null && e.tauxEpargne > get().bestSavingsRate) {
          set({ bestSavingsRate: e.tauxEpargne });
        }
        if (e.tauxEpargne != null && e.tauxEpargne > 0) {
          streaks.positiveSavingsMonths += 1;
          award('financial-discipline-lv1', 20, `mois clôturé, épargne positive : ${mk}`);
          toast(`🎉 ${mk} clôturé avec un taux d'épargne positif (${e.tauxEpargne.toFixed(1)}%) · +20 XP`, 'success');
          const prevMk = monthBefore(mk);
          const prevE = esg(journal, { from: `${prevMk}-01`, to: `${prevMk}-31` });
          if (prevE.tauxEpargne != null && e.tauxEpargne > prevE.tauxEpargne) {
            award('financial-discipline-lv1', 10, `épargne en progression vs le mois précédent : ${mk}`);
          }
        } else {
          streaks.positiveSavingsMonths = 0;
        }

        // B/E — budgets MENSUELS (period.type calendar, 1 mois) sans dépassement.
        // Connecte budget-control-lv2 ("favorable écarts month after month"),
        // qui n'avait jusqu'ici jamais reçu d'XP nulle part.
        const monthlyBudgets = get().budgets.filter((b) => (b.period?.type || 'calendar') === 'calendar' && (b.period?.months || 1) === 1);
        if (monthlyBudgets.length) {
          const variance = budgetVariance(journal, monthlyBudgets, `${mk}-15`, get().getAccountMap());
          const anyOverage = variance.some((v) => v.cls === 6 && !v.favorable);
          streaks.noOverageMonths = anyOverage ? 0 : streaks.noOverageMonths + 1;
          if (!anyOverage) {
            award('budget-control-lv2', 15, `mois sans dépassement budgétaire : ${mk}`);
            toast(`✅ ${mk} : aucun dépassement de budget · +15 XP`, 'success');
          }
        }

        // B — patrimoine (ANCC) en hausse vs le mois précédent.
        const hist = netWorthHistory(journal, get().corrections, 13);
        const idx = hist.findIndex((h) => h.key === mk);
        if (idx > 0) {
          const grew = hist[idx].ancc > hist[idx - 1].ancc;
          streaks.netWorthGrowthMonths = grew ? streaks.netWorthGrowthMonths + 1 : 0;
          if (grew) award('ratio-analysis-lv1', 8, `patrimoine en hausse : ${mk}`);
        }

        // B — bonus trimestriel/annuel : la tenue de livre elle-même, sans
        // interruption, est le jalon le plus rare et le plus difficile —
        // XP explicitement plus généreux qu'un mois isolé.
        if (streaks.bookkeepingMonths > 0 && streaks.bookkeepingMonths % 12 === 0) {
          award('financial-discipline-lv1', 100, `un an de comptabilité tenue sans interruption : ${mk}`);
          toast(`🏆 12 mois de comptabilité tenue d'affilée · +100 XP`, 'success');
        } else if (streaks.bookkeepingMonths > 0 && streaks.bookkeepingMonths % 3 === 0) {
          award('financial-discipline-lv1', 30, `trimestre de comptabilité tenue sans interruption : ${mk}`);
          toast(`🏆 3 mois de comptabilité tenue d'affilée · +30 XP`, 'success');
        }

        set({ financeStreaks: streaks });
        get().checkBadges();
      },

      // Weekly counterpart of the block above, scoped to budgets whose OWN
      // period is 'weekly' (monthly budgets are covered by checkFinanceRewards).
      // Evaluates the most recently closed week (Monday-Sunday), idempotent
      // via financeWeekChecks keyed on that week's Monday.
      checkWeeklyBudgetStreak: () => {
        const now = new Date();
        const day = now.getDay(); // 0=dim..6=sam
        const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
        const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
        const wk = localDateKey(lastMonday);
        if (get().financeWeekChecks.includes(wk)) return;
        set({ financeWeekChecks: [...get().financeWeekChecks, wk] });

        const weeklyBudgets = get().budgets.filter((b) => b.period?.type === 'weekly');
        if (!weeklyBudgets.length) return; // nothing to evaluate — streak untouched either way
        const midWeek = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + 3);
        const variance = budgetVariance(get().journal, weeklyBudgets, localDateKey(midWeek), get().getAccountMap());
        const anyOverage = variance.some((v) => v.cls === 6 && !v.favorable);
        const streaks = { ...get().financeStreaks };
        streaks.noOverageWeeks = anyOverage ? 0 : streaks.noOverageWeeks + 1;
        set({ financeStreaks: streaks });
        if (!anyOverage) useSkillStore.getState().awardXP('budget-control-lv1', 5, `semaine sans dépassement budgétaire : ${wk}`);
        get().checkBadges();
      },

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

      // ─────────── Comptes auxiliaires de trésorerie ───────────
      // Un compte auxiliaire (ex: "CIH") est rattaché à un compte collectif de
      // classe 5 fixe (ex: "511" Compte bancaire courant) via son propre code
      // généré ("511-<uid>") — le chiffre de classe reste en tête donc classOf()
      // continue de le traiter comme un compte de trésorerie ordinaire partout
      // dans le moteur comptable ; seul le LIBELLÉ affiché doit passer par
      // getAccountMap() (voir mergedAccountMap dans chart-of-accounts.js).
      getAccountMap: () => mergedAccountMap(get().treasuryAccounts),

      addTreasuryAccount: ({ parentCode, name, bank }) => {
        if (classOf(parentCode) !== 5) return { ok: false, error: 'Le compte auxiliaire doit être rattaché à un compte de trésorerie (classe 5).' };
        if (!name?.trim()) return { ok: false, error: 'Le nom du compte est requis.' };
        const account = {
          id: uid(), code: `${parentCode}-${uid()}`, parentCode, name: name.trim(), bank: bank?.trim() || '',
          archived: false, createdAt: Date.now(), updatedAt: Date.now(),
        };
        set({ treasuryAccounts: [...get().treasuryAccounts, account] });
        // Was a real gap: treasury-planning-lv1 previously only ever got XP
        // from an achieved treasury goal (rare) — setting up how your money
        // is actually organized is itself treasury planning, not a footnote.
        useSkillStore.getState().awardXP('treasury-planning-lv1', 3, `compte auxiliaire créé : ${account.name}`);
        toast(`Compte auxiliaire créé : ${account.name}`, 'success');
        get().checkBadges();
        return { ok: true, code: account.code };
      },
      editTreasuryAccount: (id, updates) =>
        set({
          treasuryAccounts: get().treasuryAccounts.map((a) =>
            a.id === id ? stamp({ ...a, ...updates, name: updates.name != null ? updates.name.trim() : a.name }) : a
          ),
        }),
      archiveTreasuryAccount: (id) => {
        set({ treasuryAccounts: get().treasuryAccounts.map((a) => (a.id === id ? stamp({ ...a, archived: true }) : a)) });
        toast('Compte auxiliaire archivé', 'info');
      },
      unarchiveTreasuryAccount: (id) =>
        set({ treasuryAccounts: get().treasuryAccounts.map((a) => (a.id === id ? stamp({ ...a, archived: false }) : a)) }),
      // Suppression définitive seulement si le compte n'a aucune écriture —
      // sinon on archive (même logique que tradingStore.deleteAccount).
      deleteTreasuryAccount: (id) => {
        const acct = get().treasuryAccounts.find((a) => a.id === id);
        if (!acct) return { ok: false, error: 'Compte introuvable.' };
        const used = get().journal.some((e) => e.lines.some((l) => l.account === acct.code));
        if (used) return { ok: false, error: 'Ce compte a des écritures au journal — archivez-le plutôt que de le supprimer.' };
        set({ treasuryAccounts: get().treasuryAccounts.filter((a) => a.id !== id) });
        toast('Compte auxiliaire supprimé', 'info');
        return { ok: true };
      },

      // ─────────── Journal (mutations) ───────────
      addEntry: (entry) => {
        const res = validateEntry(entry, get().getAccountMap());
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
        // F — pont cross-domaine : un trading payout gagné mais jamais
        // réellement comptabilisé n'existe que dans tradingStore, séparé de
        // la vraie trésorerie qu'on suit ici. Auto-détecte une écriture qui
        // correspond à un payout non encore relié (même montant, ±7 jours)
        // et le marque comme comptabilisé — récompense le fait de VRAIMENT
        // faire remonter les gains de trading dans la compta, pas juste de
        // les logger côté Trading et de s'arrêter là.
        const incoming = clean.lines.reduce((a, l) => a + (classOf(l.account) === 5 ? Number(l.debit) || 0 : 0), 0);
        if (incoming > 0) {
          const entryTime = new Date(`${clean.date}T00:00:00`).getTime();
          const match = useTradingStore.getState().getAllPayoutsFlat().find((p) => {
            if (p.bookkept || Math.abs(p.amount - incoming) > 0.01) return false;
            const payoutTime = new Date(`${p.date}T00:00:00`).getTime();
            return Math.abs(entryTime - payoutTime) <= 7 * 86400000;
          });
          if (match) {
            useTradingStore.getState().markPayoutBookkept(match.accountId, match.id);
            set({ linkedPayoutsCount: (get().linkedPayoutsCount || 0) + 1 });
            award('treasury-planning-lv1', 8, `payout trading comptabilisé : ${match.accountName}`);
            toast(`💰 Payout "${match.accountName}" relié à cette écriture · +8 XP`, 'success');
          }
        }
        toast(`Écriture enregistrée : ${clean.label}`, 'success');
        get().checkBadges();
        return { ok: true, id: clean.id };
      },
      editEntry: (id, entry) => {
        const res = validateEntry(entry, get().getAccountMap());
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
          // Only on first creation, not every edit (re-saving the same limit
          // shouldn't be farmable). Third gap fill: ratio-analysis-lv1 never
          // had a routine XP source — setting a spend-ratio guardrail is
          // literally that skill's own description in action.
          useSkillStore.getState().awardXP('ratio-analysis-lv1', 2, `limite définie : ${label.trim()}`);
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
      // `period` : { type:'calendar', months } | { type:'weekly' } |
      // { type:'custom', startDate, endDate, recurring } — voir getPeriodBounds
      // (accounting-engine.js). Plusieurs budgets peuvent coexister sur le MÊME
      // compte (ex : un plafond hebdomadaire ET un plafond annuel sur "Loisirs")
      // — chacun est une enveloppe indépendante, identifiée par son `id`, pas
      // par son compte. budgetByAccount/treasuryForecast (accounting-engine.js)
      // les additionnent (équivalent mensuel de chacune) : deux enveloppes sur
      // un même compte sont deux engagements financiers distincts, pas deux vues
      // du même chiffre.
      addBudget: (account, amount, period) => {
        const budget = { id: uid(), account, amount: Number(amount), period: period || DEFAULT_BUDGET_PERIOD, createdAt: Date.now(), updatedAt: Date.now() };
        set({ budgets: [...get().budgets, budget] });
        useSkillStore.getState().awardXP('budget-control-lv1', 3, `budget set: ${account}`);
        get().checkBadges();
        return budget.id;
      },
      editBudget: (id, { account, amount, period }) =>
        set({
          budgets: get().budgets.map((b) =>
            b.id === id ? stamp({ ...b, account, amount: Number(amount), period: period || DEFAULT_BUDGET_PERIOD }) : b
          ),
        }),
      deleteBudget: (id) => set({ budgets: get().budgets.filter((b) => b.id !== id) }),

      // Budgets de CHARGES dont le réalisé, sur LEUR propre période en cours
      // aujourd'hui, dépasse le budgété de plus de 10% (orange) ou 25% (rouge) —
      // budgetSeverity (utils/goals.js), même seuil déjà utilisé côté
      // financeStore historique. Un budget de produit "manqué" n'est pas un
      // dépassement au même sens, donc exclu ici.
      getBudgetAlerts: () => {
        const today = new Date().toISOString().slice(0, 10);
        return get()
          .getBudgetVariance(today)
          .filter((v) => v.cls === 6)
          .map((v) => ({ ...v, severity: budgetSeverity(v.reel, v.amount) }))
          .filter((v) => v.severity)
          .sort((a, b) => b.severity.over - a.severity.over);
      },

      // ─────────── Rappels navigateur pour dépassements de budget ───────────
      setBudgetAlertsEnabled: (enabled) => set({ budgetAlerts: { ...get().budgetAlerts, enabled } }),
      markBudgetAlertShown: (key, dateKey) =>
        set({ budgetAlerts: { ...get().budgetAlerts, lastShown: { ...get().budgetAlerts.lastShown, [key]: dateKey } } }),

      // ─────────── Échéances (produits & charges programmés) ───────────
      // Différence avec les budgets : un budget est une ENVELOPPE mensuelle
      // lissée pour contrôler un écart (dépensé vs prévu) ; une échéance est un
      // MOUVEMENT concret daté (ponctuel ou récurrent) — c'est elle qui nourrit
      // la prévision de trésorerie jour par jour (getTreasuryForecastV2), pas le
      // budget. "Marquer payé" transforme l'échéance en véritable écriture.
      // `templateId` reprend un modèle de ENTRY_TEMPLATES (chart-of-accounts.js) —
      // income/expense (comme avant) mais aussi invest/borrow/repay pour modéliser
      // un achat d'immobilisation, la réception ou le remboursement d'un emprunt
      // (classes 1/2/4) : debitAccount/creditAccount remplacent l'ancien couple
      // type+natureAccount/treasuryAccount, qui reste lu en rétro-compatibilité
      // par resolveEcheanceLines (accounting-engine.js) pour les échéances existantes.
      addEcheance: (data) => {
        if (!data.label?.trim() || !Number(data.amount) || !data.dueDate) {
          return { ok: false, error: 'Libellé, montant et date sont requis.' };
        }
        if (!data.debitAccount || !data.creditAccount) {
          return { ok: false, error: 'Comptes débit/crédit requis.' };
        }
        const ech = {
          id: uid(),
          label: data.label.trim(),
          templateId: data.templateId || 'expense',
          debitAccount: data.debitAccount,
          creditAccount: data.creditAccount,
          amount: Number(data.amount),
          dueDate: data.dueDate,
          recurrence: data.recurrence || 'once',
          weekday: data.recurrence === 'weekly' ? data.weekday || 'mon' : null,
          endDate: data.endDate || null,
          active: true,
          paidDates: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ echeances: [...get().echeances, ech] });
        useSkillStore.getState().awardXP('budget-control-lv1', 2, `échéance créée : ${ech.label}`);
        toast(`Échéance créée : ${ech.label}`, 'success');
        get().checkBadges();
        return { ok: true, id: ech.id };
      },
      editEcheance: (id, updates) =>
        set({ echeances: get().echeances.map((e) => (e.id === id ? stamp({ ...e, ...updates, amount: Number(updates.amount ?? e.amount) }) : e)) }),
      deleteEcheance: (id) => set({ echeances: get().echeances.filter((e) => e.id !== id) }),
      toggleEcheanceActive: (id) => set({ echeances: get().echeances.map((e) => (e.id === id ? stamp({ ...e, active: !e.active }) : e)) }),

      // Transforme UNE occurrence d'échéance en véritable écriture de journal
      // (partie double) et l'ajoute à paidDates pour qu'elle ne réapparaisse
      // plus comme "à venir" ni ne soit comptée deux fois dans la prévision.
      // `occurrenceDate` reste la vraie date d'échéance théorique de cette
      // occurrence (sert au calcul "payé à temps" ci-dessous ET à paidDates,
      // inchangé) ; `entryDate` (optionnel) est la date effective de
      // l'écriture si l'utilisateur l'a modifiée dans le formulaire —
      // distinction nécessaire pour ne pas confondre "j'ai backdaté une
      // écriture" avec "j'ai payé en retard".
      markEcheancePaid: (id, occurrenceDate, entryDate) => {
        const ech = get().echeances.find((e) => e.id === id);
        if (!ech) return { ok: false, error: 'Échéance introuvable.' };
        const amount = Number(ech.amount);
        const { debitAccount, creditAccount } = resolveEcheanceLines(ech);
        const lines = [{ account: debitAccount, debit: amount, credit: 0 }, { account: creditAccount, debit: 0, credit: amount }];
        const res = get().addEntry({ date: entryDate || occurrenceDate, label: ech.label, lines });
        if (!res.ok) return res;
        // "À temps" = marqué payé au plus tard le jour de son échéance
        // théorique — comparé à AUJOURD'HUI (l'instant du clic), pas à la
        // date de l'écriture (qui peut être backdatée sans rapport avec la
        // ponctualité réelle).
        const onTime = occurrenceDate >= localDateKey(new Date());
        const streaks = { ...get().financeStreaks };
        streaks.onTimeEcheances = onTime ? streaks.onTimeEcheances + 1 : 0;
        set({ financeStreaks: streaks });
        if (onTime) useSkillStore.getState().awardXP('budget-control-lv1', 1, `échéance payée à temps : ${ech.label}`);
        get().checkBadges();
        set({
          echeances: get().echeances.map((e) =>
            e.id === id
              ? stamp({ ...e, paidDates: [...(e.paidDates || []), occurrenceDate], ...(e.recurrence === 'once' ? { active: false } : {}) })
              : e
          ),
        });
        return { ok: true };
      },

      // Occurrences à venir dans les `daysAhead` prochains jours, toutes échéances
      // actives confondues, triées par date — pour la liste "à venir" et les rappels.
      getUpcomingEcheances: (daysAhead = 30) => {
        const today = new Date().toISOString().slice(0, 10);
        const end = new Date();
        end.setDate(end.getDate() + daysAhead);
        const endKey = end.toISOString().slice(0, 10);
        return get()
          .echeances.filter((e) => e.active)
          .flatMap((e) => echeanceOccurrences(e, today, endKey).map((occurrenceDate) => ({ ...e, occurrenceDate })))
          .sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? -1 : 1));
      },

      // Occurrences dont la date est déjà passée sans avoir été marquées payées
      // (fenêtre : depuis la date de création de chaque échéance jusqu'à hier) —
      // pour la bannière "en retard" et les rappels navigateur.
      getOverdueEcheances: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = yesterday.toISOString().slice(0, 10);
        return get()
          .echeances.filter((e) => e.active)
          .flatMap((e) => echeanceOccurrences(e, e.dueDate, yKey).map((occurrenceDate) => ({ ...e, occurrenceDate })))
          .sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? -1 : 1));
      },

      // ─────────── Rappels navigateur pour échéances en retard ───────────
      // Même mécanisme que tradingStore.alerts / healthStore.reminders : local
      // uniquement (pas de push serveur), ne se déclenche que si l'onglet AUDAX
      // est ouvert — voir hooks/useEcheanceAlerts.js.
      setEcheanceAlertsEnabled: (enabled) => set({ echeanceAlerts: { ...get().echeanceAlerts, enabled } }),
      markEcheanceAlertShown: (key, dateKey) =>
        set({ echeanceAlerts: { ...get().echeanceAlerts, lastShown: { ...get().echeanceAlerts.lastShown, [key]: dateKey } } }),

      // Estimation des payouts trading à venir : Σ P&L des 30 derniers jours des
      // comptes Broker/Prop Firm (le compte Demo ne génère jamais de vrai retrait),
      // × payoutPct (défaut 80%, taux de reversement typique des prop firms), en
      // ne comptant qu'un P&L positif. Simplification assumée : tout est ramené en
      // DH via le taux USD→DH fixe de l'app pour les comptes non-DH (la plupart des
      // prop firms/brokers sont libellés en USD) — un compte déjà en 'MAD' passe
      // tel quel, un autre devise non gérée est ignoré plutôt que mal converti.
      getTradingPayoutEstimate: (payoutPct = 0.8) => {
        const { accounts, getAccountTrades } = useTradingStore.getState();
        const cutoff = Date.now() - 30 * 86400000;
        let pnlMad = 0;
        for (const acct of accounts.filter((a) => a.type === 'broker' || a.type === 'propfirm')) {
          const currency = acct.currency || 'USD';
          if (currency !== 'USD' && currency !== 'MAD') continue;
          const pnl = getAccountTrades(acct.id)
            .filter((t) => new Date(t.date).getTime() >= cutoff)
            .reduce((a, t) => a + (Number(t.pnl) || 0), 0);
          pnlMad += currency === 'USD' ? usdToMad(pnl) : pnl;
        }
        return Math.round(Math.max(0, pnlMad) * payoutPct);
      },

      // Prévision v2 jour par jour — voir treasuryForecastV2 (accounting-engine.js)
      // pour la logique (habitudes + échéances + payout trading en option).
      // `method`: 'sma' (défaut) | 'ema' | 'budget' — voir accounting-engine.js.
      getTreasuryForecastV2: (days = 90, { includeTradingPayout = false, payoutPct = 0.8, method = 'sma' } = {}) => {
        const tradingMonthlyPayout = includeTradingPayout ? get().getTradingPayoutEstimate(payoutPct) : 0;
        return treasuryForecastV2(get().journal, get().echeances, { days, tradingMonthlyPayout, method, budgets: get().budgets });
      },

      // Prévision de patrimoine (ANCC) jour par jour — voir netWorthForecastV2
      // (accounting-engine.js) : réutilise la trajectoire de trésorerie v2 et
      // gèle le reste du bilan (immobilisé, créances, dettes, corrections).
      getNetWorthForecastV2: (days = 90, { includeTradingPayout = false, payoutPct = 0.8, method = 'sma' } = {}) => {
        const tradingMonthlyPayout = includeTradingPayout ? get().getTradingPayoutEstimate(payoutPct) : 0;
        return netWorthForecastV2(get().journal, get().corrections, get().echeances, { days, tradingMonthlyPayout, method, budgets: get().budgets });
      },

      // ─────────── Corrections de valeur (ANC → ANCC) ───────────
      addCorrection: (data) => {
        const c = { ...data, id: uid(), amount: Number(data.amount), createdAt: Date.now(), updatedAt: Date.now() };
        set({ corrections: [...get().corrections, c] });
        // Another real gap: financial-statements-lv1 ("Read your own Bilan,
        // CPC, and ESG fluently") never received XP anywhere — an ANC→ANCC
        // correction is exactly that skill in action (recognizing your ANC
        // doesn't reflect real value and adjusting it).
        useSkillStore.getState().awardXP('financial-statements-lv1', 3, `correction ajoutée : ${c.label}`);
        toast(`Correction ajoutée : ${c.label}`, 'success');
        get().checkBadges();
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
          // Once achieved, the goal is CLOSED: frozen at the amount actually
          // reached when it was hit (achievedAmount), never recomputed
          // against today's live balance. Without this, a goal marked
          // "atteint" kept showing a progress bar racing the current
          // treasury/net-worth figure — which naturally drifts BELOW the
          // target again the moment money gets spent, making an achieved
          // goal look unachieved days later. Pre-existing achieved goals
          // that predate this fix (no achievedAmount on file) fall back to
          // the target itself — the best available "closed at 100%" value,
          // since the actual historical figure was never stored.
          if (g.achieved) {
            const amount = g.achievedAmount ?? g.targetAmount;
            const progress = g.targetAmount > 0 ? Math.max(0, Math.min(100, (amount / g.targetAmount) * 100)) : null;
            return { ...g, current: amount, pace: null, progress, projected: null, onTrack: null };
          }
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
      // achievedAmount freezes what getGoalRows() displays forever after —
      // see its comment above for why that matters.
      checkGoalAchievement: (goalId, current) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || goal.achieved || current < goal.targetAmount) return;
        const xp = calculateGoalXP(goal.targetAmount);
        const badge = badgeForGoal(goal.targetAmount);
        set({ goals: get().goals.map((g) => (g.id === goalId ? stamp({ ...g, achieved: true, achievedAt: Date.now(), achievedAmount: current, xpAwarded: xp, badge }) : g)) });
        const skillId = goal.type === 'treasury' ? 'treasury-planning-lv1' : 'ratio-analysis-lv1';
        useSkillStore.getState().awardXP(skillId, xp, `objectif atteint : ${goal.name}`);
        toast(`🎉 Objectif atteint : ${goal.name} · +${xp} XP · Badge : ${badge}`, 'success');
        get().checkBadges();
      },

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
          journal: [], budgets: [], corrections: [], goals: [], labelLimits: [], legacyImported: false, treasuryAccounts: [], echeances: [],
          echeanceAlerts: { enabled: false, lastShown: {} }, budgetAlerts: { enabled: false, lastShown: {} }, awardedBadges: [],
        }),
    }),
    { name: 'audax-accounting' }
  )
);
