// Slice of accountingStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../accountingStore.js.
import { defaultRates, fetchRates, toBase, currencyMeta } from '../../utils/currency';
import { validateEntry, esg, budgetVariance, netWorthHistory } from '../../utils/accounting-engine';
import { classOf, ACCOUNT_MAP } from '../../utils/chart-of-accounts';
import { computeLabelRatiosAfter } from '../../utils/label-analysis';
import { useSkillStore } from '../skillStore';
import { toast } from '../uiStore';
import { evaluateBadges } from '../../utils/badges';
import { localDateKey, monthBefore, BADGE_DEFS } from './helpers';

export const currenciesSlice = (set, get) => ({
      // ── Devises (Finances n°4) ── see utils/currency.js for the model.
      baseCurrency: 'MAD',
      fxRates: defaultRates('MAD'), // base units per 1 unit of each currency
      fxUpdatedAt: null,
      // The base can only change while the journal is empty: every amount in
      // the journal is expressed in it, so switching later would silently
      // relabel all existing figures.
      setBaseCurrency: (code) => {
        if (code === get().baseCurrency) return { ok: true };
        if (get().journal.length) return { ok: false, error: 'La devise principale ne peut changer que tant qu’aucune opération n’est saisie.' };
        set({ baseCurrency: code, fxRates: defaultRates(code), fxUpdatedAt: null });
        toast(`Devise principale : ${currencyMeta(code).label}`, 'success');
        return { ok: true };
      },
      setFxRate: (code, rate) => {
        const r = Number(String(rate).replace(',', '.'));
        if (!(r > 0)) return;
        set({ fxRates: { ...get().fxRates, [code]: r }, fxUpdatedAt: Date.now() });
      },
      refreshFxRates: async () => {
        try {
          const rates = await fetchRates(get().baseCurrency);
          set({ fxRates: { ...get().fxRates, ...rates }, fxUpdatedAt: Date.now() });
          toast('Taux de change mis à jour', 'success');
          return { ok: true };
        } catch (e) {
          toast(`Taux non mis à jour : ${e.message}`, 'error');
          return { ok: false };
        }
      },
      toBase: (amount, code) => toBase(amount, code, get().baseCurrency, get().fxRates),
      treasuryAccounts: [], // comptes auxiliaires de trésorerie : [{ id, code, parentCode, name, bank, archived, createdAt, updatedAt }]
      assets: [], // définitions d'avoirs immobilisés (classe 2), SANS solde — le montant reste au journal (coût historique) ; ici : classification + métadonnées de valorisation pour Wealth OS. Voir addAsset.
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
});
