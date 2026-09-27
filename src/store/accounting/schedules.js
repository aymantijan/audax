// Slice of accountingStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../accountingStore.js.
import { uid } from '../../utils/formatters';
import { echeanceOccurrences, treasuryForecastV2, netWorthForecastV2, resolveEcheanceLines } from '../../utils/accounting-engine';
import { useSkillStore } from '../skillStore';
import { useTradingStore } from '../tradingStore';
import { toast } from '../uiStore';
import { stamp, localDateKey } from './helpers';

export const schedulesSlice = (set, get) => ({
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
          // Posted to the journal automatically on its date (Finances n°2).
          autoPost: !!data.autoPost,
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
      markEcheancePaid: (id, occurrenceDate, entryDate, { auto = false } = {}) => {
        const ech = get().echeances.find((e) => e.id === id);
        if (!ech) return { ok: false, error: 'Échéance introuvable.' };
        const amount = Number(ech.amount);
        const { debitAccount, creditAccount } = resolveEcheanceLines(ech);
        const lines = [{ account: debitAccount, debit: amount, credit: 0 }, { account: creditAccount, debit: 0, credit: amount }];
        const res = get().addEntry({ date: entryDate || occurrenceDate, label: ech.label, lines, ...(auto ? { auto: true, echeanceId: id } : {}) });
        if (!res.ok) return res;
        if (auto) {
          // Automatic posting: no punctuality streak / XP (nobody "paid on time").
          set({ echeances: get().echeances.map((e) => (e.id === id ? stamp({ ...e, paidDates: [...(e.paidDates || []), occurrenceDate], ...(e.recurrence === 'once' ? { active: false } : {}) }) : e)) });
          return { ok: true };
        }
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

      // Enregistre au journal toutes les occurrences échues (jusqu'à aujourd'hui
      // inclus) des échéances en mode automatique — salaire, loyer, abonnements…
      // Idempotent grâce à paidDates. Renvoie le nombre d'écritures créées.
      autoPostEcheances: () => {
        const today = localDateKey(new Date());
        let posted = 0;
        for (const e of get().echeances.filter((x) => x.active && x.autoPost)) {
          const done = new Set(e.paidDates || []);
          for (const occ of echeanceOccurrences(e, e.dueDate, today)) {
            if (done.has(occ)) continue;
            const res = get().markEcheancePaid(e.id, occ, occ, { auto: true });
            if (res.ok) posted += 1;
          }
        }
        if (posted) toast(`${posted} échéance(s) enregistrée(s) automatiquement`, 'success');
        return posted;
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
          const pnl = getAccountTrades(acct.id)
            .filter((t) => new Date(t.date).getTime() >= cutoff)
            .reduce((a, t) => a + (Number(t.pnl) || 0), 0);
          // Converted to the user's base currency at their own rate table.
          pnlMad += get().toBase(pnl, currency);
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
});
