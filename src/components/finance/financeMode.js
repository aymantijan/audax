import { useAccountingStore } from '../../store/accountingStore';
import { classOf } from '../../utils/chart-of-accounts';

/**
 * Finance interface level. New users start in 'simple' (dépenses, revenus,
 * catégories); anyone who already keeps a journal keeps the expert view they
 * know until they switch. The engine is identical: the journal stays the
 * single source of truth in both modes.
 */
export function useFinanceMode() {
  const uiMode = useAccountingStore((s) => s.uiMode);
  const hasJournal = useAccountingStore((s) => s.journal.length > 0);
  return uiMode || (hasJournal ? 'expert' : 'simple');
}

/**
 * Plain-language reading of a journal entry for the simple view:
 * { kind: 'expense'|'income'|'transfer'|'other', amount, category, via }
 */
export function describeEntry(entry, accountMap) {
  const lines = entry.lines || [];
  const total = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const name = (code) => accountMap[code]?.label || code;
  const debit6 = lines.filter((l) => classOf(l.account) === 6 && Number(l.debit) > 0);
  const credit7 = lines.filter((l) => classOf(l.account) === 7 && Number(l.credit) > 0);
  const cash = (side) => lines.find((l) => classOf(l.account) === 5 && Number(l[side]) > 0);
  if (debit6.length && !credit7.length) {
    const amount = debit6.reduce((a, l) => a + Number(l.debit), 0);
    return { kind: 'expense', amount, category: name(debit6[0].account), via: cash('credit') ? name(cash('credit').account) : null };
  }
  if (credit7.length && !debit6.length) {
    const amount = credit7.reduce((a, l) => a + Number(l.credit), 0);
    return { kind: 'income', amount, category: name(credit7[0].account), via: cash('debit') ? name(cash('debit').account) : null };
  }
  if (lines.length === 2 && lines.every((l) => classOf(l.account) === 5)) {
    const to = lines.find((l) => Number(l.debit) > 0);
    const from = lines.find((l) => Number(l.credit) > 0);
    return { kind: 'transfer', amount: total, category: 'Transfert', via: `${name(from?.account)} → ${name(to?.account)}` };
  }
  return { kind: 'other', amount: total, category: null, via: null };
}

// Everyday wording for the guided templates (simple mode).
export const SIMPLE_TEMPLATES = {
  expense: { label: 'Dépense', debit: 'Catégorie', credit: 'Payé avec' },
  income: { label: 'Revenu', debit: 'Reçu sur', credit: 'Source du revenu' },
  transfer: { label: 'Transfert', debit: 'Vers', credit: 'Depuis' },
  invest: { label: 'Achat d’un bien / placement', debit: 'Bien acquis', credit: 'Payé avec' },
  borrow: { label: 'Emprunt reçu', debit: 'Reçu sur', credit: 'Emprunt' },
  repay: { label: 'Remboursement de dette', debit: 'Dette remboursée', credit: 'Payé avec' },
  lend: { label: 'Prêt accordé / caution', debit: 'Prêt / caution', credit: 'Depuis' },
  opening: { label: 'Soldes de départ', debit: 'Ce que vous possédez', credit: 'Contrepartie' },
};
