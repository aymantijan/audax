// Slice of accountingStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../accountingStore.js.
import { uid } from '../../utils/formatters';
import { validateEntry, treasuryForecast, DEFAULT_BUDGET_PERIOD } from '../../utils/accounting-engine';
import { classOf, ACCOUNT_MAP } from '../../utils/chart-of-accounts';
import { getLabelsForAccount, suggestLabels, findClosestLabel, computeLabelRatiosAfter } from '../../utils/label-analysis';
import { budgetSeverity } from '../../utils/goals';
import { useSkillStore } from '../skillStore';
import { useTradingStore } from '../tradingStore';
import { toast } from '../uiStore';
import { stamp } from './helpers';

export const journalSlice = (set, get) => ({
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
          ...(entry.fx && entry.fx.currency && entry.fx.currency !== get().baseCurrency ? { fx: { currency: entry.fx.currency, amount: Number(entry.fx.amount), rate: Number(entry.fx.rate) } } : {}),
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
});
