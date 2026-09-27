// Shared helpers of accountingStore.js (moved verbatim, F3).
import { treasuryBalance } from '../../utils/accounting-engine';
import { baseCurrencyShort } from '../../utils/formatters';

// Comptabilité générale personnelle en partie double.
// Le journal est la source unique ; chaque sélecteur dérive un état de synthèse
// (grand livre, balance, bilan, CPC, ESG), l'analyse financière, le budget
// et la trésorerie — exactement comme demandé : une saisie, tout se propage.

export const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });

// Produit arrondi à 2 décimales (coût total = quantité × coût unitaire).
export const r2mul = (a, b) => Math.round((a * b + Number.EPSILON) * 100) / 100;

// Local Y/M/D date key — NEVER `.toISOString()` for this (round-trips
// through UTC and can roll a date back a day right at a day/month/week
// boundary in any timezone ahead of UTC — see checkFinanceRewards' history).
export const localDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// 'YYYY-MM' the month before `mk` ('YYYY-MM'), handling year wraparound.
export const monthBefore = (mk) => {
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
export function tierByRank(i, n) {
  const frac = (i + 1) / n;
  if (frac <= 0.4) return 'bronze';
  if (frac <= 0.75) return 'silver';
  return 'gold';
}
// In the person's own currency (read when the badge is shown, not at load).
export function fmtBadgeMoney(n) {
  const cur = baseCurrencyShort();
  if (n >= 1_000_000) return `${n % 1_000_000 === 0 ? n / 1_000_000 : (n / 1_000_000).toFixed(1)}M ${cur}`;
  if (n >= 1000) return `${Math.round(n / 1000)}K ${cur}`;
  return `${n} ${cur}`;
}
// thresholds: number[]; ids/names get a fixed id (stable across re-evaluations,
// unaffected by later inserting/removing OTHER groups) via `idPrefix-<threshold>`
// — except where `fixedIds[threshold]` names a pre-existing id to preserve
// (so badges already earned under the old, non-tiered scheme keep their
// earned state instead of re-firing under a new id).
export function countTierBadges(idPrefix, label, thresholds, getValue, fixedIds = {}) {
  return thresholds.map((t, i) => ({
    id: fixedIds[t] || `${idPrefix}-${t}`,
    name: `${label} ${t.toLocaleString('fr-FR')}`,
    tier: tierByRank(i, thresholds.length),
    check: (s) => getValue(s) >= t,
  }));
}
export function moneyTierBadges(idPrefix, label, thresholds, getValue, fixedIds = {}) {
  return thresholds.map((t, i) => ({
    id: fixedIds[t] || `${idPrefix}-${t}`,
    get name() { return `${label} ${fmtBadgeMoney(t)}`; },
    tier: tierByRank(i, thresholds.length),
    check: (s) => getValue(s) >= t,
  }));
}

export const BADGE_DEFS = [
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
