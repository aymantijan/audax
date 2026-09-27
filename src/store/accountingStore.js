import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setFxContext } from '../utils/formatters';
import { migrateClass2Code } from '../utils/chart-of-accounts';
import { currenciesSlice } from './accounting/currencies';
import { treasurySlice } from './accounting/treasury';
import { journalSlice } from './accounting/journal';
import { schedulesSlice } from './accounting/schedules';
import { valuationSlice } from './accounting/valuation';
import { selectorsSlice } from './accounting/selectors';

// Split into slices under ./accounting/ (F3): each file holds whole sections of
// the original store, verbatim; they are spread back into one store here.
export const useAccountingStore = create(
  persist(
    (set, get) => ({
      journal: [], // écritures en partie double
      budgets: [], // [{ id, account, amount }] — budget mensuel par compte (classes 6 & 7)
      corrections: [], // [{ id, type:'plus-value'|'moins-value', label, amount, account, date }] — ANC → ANCC
      goals: [], // [{ id, type:'treasury'|'networth', name, targetAmount, targetDate, achieved, achievedAt, xpAwarded, badge }]
      labelLimits: [], // [{ id, account, label, maxRatioToIncomePct, maxRatioToAccountSpendPct, createdAt }]
      legacyImported: false,
      // Interface level: 'simple' (dépenses / revenus / catégories) or 'expert'
      // (partie double, grand livre, états). null = not chosen yet — see useFinanceMode.
      uiMode: null,
      setUiMode: (mode) => set({ uiMode: mode }),

      ...currenciesSlice(set, get),
      ...treasurySlice(set, get),
      ...journalSlice(set, get),
      ...schedulesSlice(set, get),
      ...valuationSlice(set, get),
      ...selectorsSlice(set, get),
    }),
    {
      name: 'audax-accounting',
      // v1 : découpage de la classe 2 (Actif immobilisé) en sous-comptes
      // catégorisés par liquidité. Remap une seule fois, au chargement, des
      // anciens codes fourre-tout vers les nouveaux sous-comptes — partout où
      // un code de classe 2 apparaît (journal, corrections, échéances). Les
      // budgets (classes 6/7) et limites de libellé (classe 6) ne sont pas
      // concernés. Passage unique par code (migrateClass2Code) → les échanges
      // de codes (ancien 231↔nouveau 231) restent corrects.
      version: 1,
      migrate: (state, version) => {
        if (state && version < 1) {
          if (Array.isArray(state.journal)) {
            state.journal = state.journal.map((e) => ({
              ...e,
              lines: (e.lines || []).map((l) => ({ ...l, account: migrateClass2Code(l.account) })),
            }));
          }
          if (Array.isArray(state.corrections)) {
            state.corrections = state.corrections.map((c) =>
              c.account ? { ...c, account: migrateClass2Code(c.account) } : c);
          }
          if (Array.isArray(state.echeances)) {
            state.echeances = state.echeances.map((ec) => ({
              ...ec,
              ...(ec.debitAccount ? { debitAccount: migrateClass2Code(ec.debitAccount) } : {}),
              ...(ec.creditAccount ? { creditAccount: migrateClass2Code(ec.creditAccount) } : {}),
              ...(ec.natureAccount ? { natureAccount: migrateClass2Code(ec.natureAccount) } : {}),
            }));
          }
          if (!Array.isArray(state.assets)) state.assets = [];
        }
        return state;
      },
    }
  )
);

// Keep the synchronous money formatters (utils/formatters.js) in sync with the
// user's base currency and rate table — initial hydration and every change
// (including a cloud-sync setState from another device).
{
  const push = (st) => setFxContext(st.baseCurrency, st.fxRates);
  push(useAccountingStore.getState());
  let last = null;
  useAccountingStore.subscribe((st) => {
    const key = `${st.baseCurrency}|${st.fxUpdatedAt}`;
    if (key !== last) { last = key; push(st); }
  });
}
