import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, usdToMad } from '../utils/formatters';
import {
  validateEntry, accountBalances, ledgerFor, trialBalance,
  balanceSheet, cpc, esg, financialAnalysis, correctedNetWorth, monthlySeries,
  budgetVariance, treasuryForecast, treasuryBalance, netWorthHistory, paceFromEdges, projectValue, monthKey,
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
      treasuryAccounts: [], // comptes auxiliaires de trésorerie : [{ id, code, parentCode, name, bank, archived, createdAt, updatedAt }]
      echeances: [], // [{ id, label, type:'produit'|'charge', natureAccount, treasuryAccount, amount, dueDate, recurrence, endDate, active, paidDates, createdAt, updatedAt }]
      echeanceAlerts: { enabled: false, lastShown: {} }, // rappels navigateur pour échéances en retard — même mécanisme que tradingStore.alerts / healthStore.reminders
      budgetAlerts: { enabled: false, lastShown: {} }, // idem pour les dépassements de budget (charges)

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
        toast(`Compte auxiliaire créé : ${account.name}`, 'success');
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
        toast(`Écriture enregistrée : ${clean.label}`, 'success');
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
        return { ok: true, id: ech.id };
      },
      editEcheance: (id, updates) =>
        set({ echeances: get().echeances.map((e) => (e.id === id ? stamp({ ...e, ...updates, amount: Number(updates.amount ?? e.amount) }) : e)) }),
      deleteEcheance: (id) => set({ echeances: get().echeances.filter((e) => e.id !== id) }),
      toggleEcheanceActive: (id) => set({ echeances: get().echeances.map((e) => (e.id === id ? stamp({ ...e, active: !e.active }) : e)) }),

      // Transforme UNE occurrence d'échéance en véritable écriture de journal
      // (partie double) et l'ajoute à paidDates pour qu'elle ne réapparaisse
      // plus comme "à venir" ni ne soit comptée deux fois dans la prévision.
      markEcheancePaid: (id, occurrenceDate) => {
        const ech = get().echeances.find((e) => e.id === id);
        if (!ech) return { ok: false, error: 'Échéance introuvable.' };
        const amount = Number(ech.amount);
        const { debitAccount, creditAccount } = resolveEcheanceLines(ech);
        const lines = [{ account: debitAccount, debit: amount, credit: 0 }, { account: creditAccount, debit: 0, credit: amount }];
        const res = get().addEntry({ date: occurrenceDate, label: ech.label, lines });
        if (!res.ok) return res;
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

      resetAll: () =>
        set({
          journal: [], budgets: [], corrections: [], goals: [], labelLimits: [], legacyImported: false, treasuryAccounts: [], echeances: [],
          echeanceAlerts: { enabled: false, lastShown: {} }, budgetAlerts: { enabled: false, lastShown: {} },
        }),
    }),
    { name: 'audax-accounting' }
  )
);
