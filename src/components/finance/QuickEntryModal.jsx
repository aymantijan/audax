import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Sparkles, History, Check } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { guessCategory, lastCashAccount, topCategories } from '../../utils/bank-import';
import { classOf } from '../../utils/chart-of-accounts';
import { normalizeLabel } from '../../utils/label-analysis';
import { todayKey } from '../../utils/formatters';
import { toast } from '../../store/uiStore';
import { Button, Modal } from '../common/ui';
import AccountSelect from '../common/AccountSelect';
import { MoneyInput, moneyToEntry } from './CurrencyUI';
import { formatMoney } from '../../utils/currency';

const KINDS = {
  expense: { label: 'Dépense', Icon: ArrowUpRight, color: 'var(--error)' },
  income: { label: 'Revenu', Icon: ArrowDownLeft, color: 'var(--success)' },
};

/**
 * Saisie éclair — amount, label, done. The category is guessed from the
 * label (your own history first, then known merchants) and the account from
 * your last operation; both stay one tap away to change.
 */
export default function QuickEntryModal({ open, onClose }) {
  const { journal, addEntry, getAccountMap, baseCurrency, fxRates } = useAccountingStore();
  const accountMap = getAccountMap();
  const [kind, setKind] = useState('expense');
  const [money, setMoney] = useState({ amount: '', currency: null, rate: null });
  const amount = money.amount;
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState(null); // null = follow the guess
  const [cash, setCash] = useState(null);
  const [date, setDate] = useState(todayKey());
  const [count, setCount] = useState(0);
  const amountRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setKind('expense'); setMoney({ amount: '', currency: null, rate: null }); setLabel(''); setCategory(null); setCash(null); setDate(todayKey()); setCount(0);
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [open]);

  const guess = useMemo(() => guessCategory(journal, label, kind), [journal, label, kind]);
  const chosenCategory = category || guess.account;
  const chosenCash = cash || lastCashAccount(journal, kind);
  const chips = useMemo(() => topCategories(journal, kind, 6), [journal, kind]);
  const cashChips = useMemo(() => {
    const counts = {};
    for (const e of journal) for (const l of e.lines) if (classOf(l.account) === 5) counts[l.account] = (counts[l.account] || 0) + 1;
    return [...new Set([...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([a]) => a), '511', '571'])].slice(0, 4);
  }, [journal]);
  // Past labels for autocomplete (any category of this kind).
  const labelOptions = useMemo(() => {
    const cls = kind === 'income' ? 7 : 6;
    const seen = new Map();
    for (const e of [...journal].reverse()) {
      if (!e.lines.some((l) => classOf(l.account) === cls)) continue;
      const k = normalizeLabel(e.label);
      if (k && !seen.has(k)) seen.set(k, e.label);
    }
    return [...seen.values()].slice(0, 50);
  }, [journal, kind]);

  const name = (code) => accountMap[code]?.label || code;
  const save = (again) => {
    const { base: amt, fx } = moneyToEntry(money, baseCurrency, fxRates);
    if (!amt || amt <= 0) { toast('Indiquez un montant', 'error'); amountRef.current?.focus(); return; }
    const lbl = label.trim() || name(chosenCategory);
    const lines = kind === 'expense'
      ? [{ account: chosenCategory, debit: amt, credit: 0 }, { account: chosenCash, debit: 0, credit: amt }]
      : [{ account: chosenCash, debit: amt, credit: 0 }, { account: chosenCategory, debit: 0, credit: amt }];
    const res = addEntry({ date, label: lbl, lines, fx });
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast(`${KINDS[kind].label} enregistrée : ${lbl} · ${fx ? `${formatMoney(fx.amount, fx.currency)} → ` : ''}${formatMoney(amt, baseCurrency)}`, 'success');
    if (again) {
      setCount((c) => c + 1); setMoney((m) => ({ ...m, amount: '' })); setLabel(''); setCategory(null);
      setTimeout(() => amountRef.current?.focus(), 30);
    } else onClose();
  };

  const K = KINDS[kind];
  return (
    <Modal open={open} onClose={onClose} title="Saisie éclair">
      <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface border border-line">
          {Object.entries(KINDS).map(([k, m]) => (
            <button key={k} type="button" onClick={() => { setKind(k); setCategory(null); setCash(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold cursor-pointer transition-colors ${kind === k ? 'bg-card ring-1 ring-line shadow-sm' : 'text-mute hover:text-ink'}`}
              style={kind === k ? { color: m.color } : undefined}>
              <m.Icon size={15} /> {m.label}
            </button>
          ))}
        </div>

        <div className="py-2" style={{ color: amount ? K.color : undefined }}>
          <MoneyInput big value={money} onChange={setMoney} inputRef={amountRef} />
        </div>

        <div>
          <input list="quick-labels" value={label} onChange={(e) => { setLabel(e.target.value); setCategory(null); }}
            placeholder={kind === 'expense' ? 'Quoi ? (Café Omar, Marjane, taxi…)' : 'D’où ? (bourse, salaire, freelance…)'}
            className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent" />
          <datalist id="quick-labels">{labelOptions.map((l) => <option key={l} value={l} />)}</datalist>
          {label.trim() && !category && guess.source !== 'default' && (
            <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
              {guess.source === 'history' ? <History size={11} /> : <Sparkles size={11} />}
              {guess.source === 'history' ? 'Comme la dernière fois' : 'Catégorie devinée'} : {name(guess.account)}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-mute mb-1.5">{kind === 'expense' ? 'Catégorie' : 'Source'}</div>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([chosenCategory, ...chips])].slice(0, 7).map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs border cursor-pointer transition-colors ${chosenCategory === c ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>
                {chosenCategory === c && <Check size={11} className="inline mr-1" />}{name(c)}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <AccountSelect simple classes={[kind === 'expense' ? 6 : 7, ...(kind === 'expense' ? [5] : [])]} value={chosenCategory} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <div className="text-xs text-mute mb-1.5">{kind === 'expense' ? 'Payé avec' : 'Reçu sur'}</div>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([chosenCash, ...cashChips])].slice(0, 4).map((c) => (
                <button key={c} type="button" onClick={() => setCash(c)}
                  className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${chosenCash === c ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>{name(c)}</button>
              ))}
            </div>
          </div>
          <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-ink" />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {count > 0 && <span className="text-xs text-good">{count} enregistrée(s)</span>}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={() => save(true)}>Enregistrer + nouvelle</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
