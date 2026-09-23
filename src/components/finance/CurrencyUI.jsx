import { useEffect, useState } from 'react';
import { RefreshCw, Coins, Lock } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { CURRENCIES, currencyMeta, rateFor, formatMoney } from '../../utils/currency';
import { Button, Field, Modal, Select } from '../common/ui';

const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent';

/** Base currency + exchange-rate table. */
export function CurrencySettingsModal({ open, onClose }) {
  const { baseCurrency, fxRates, fxUpdatedAt, journal, setBaseCurrency, setFxRate, refreshFxRates } = useAccountingStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const locked = journal.length > 0;
  const base = currencyMeta(baseCurrency);
  useEffect(() => { if (open) setMsg(''); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Devises" wide>
      <div className="space-y-5">
        <Field label="Devise principale" hint={locked ? undefined : 'Toute votre comptabilité (soldes, budgets, objectifs, bilans) sera tenue dans cette devise.'}>
          <Select value={baseCurrency} disabled={locked} onChange={(e) => { const r = setBaseCurrency(e.target.value); if (!r.ok) setMsg(r.error); }}
            options={CURRENCIES.filter((c) => c.code !== 'BTC').map((c) => ({ value: c.code, label: `${c.label} (${c.short})` }))} />
        </Field>
        {locked && (
          <p className="text-[11px] text-mute flex items-start gap-1.5 -mt-3">
            <Lock size={11} className="mt-0.5 shrink-0" /> Verrouillée : vos {journal.length} opérations sont exprimées en {base.label.toLowerCase()}. Les opérations dans d'autres devises sont converties au taux ci-dessous, avec le montant d'origine conservé.
          </p>
        )}
        {msg && <p className="text-sm text-bad">{msg}</p>}

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="text-sm font-semibold text-ink">Taux de change</div>
              <div className="text-[11px] text-mute">Valeur d'une unité en {base.short} · {fxUpdatedAt ? `mis à jour le ${new Date(fxUpdatedAt).toLocaleDateString('fr-FR')}` : 'valeurs indicatives par défaut'}</div>
            </div>
            <Button variant="secondary" className="!py-1.5 text-xs" disabled={busy} onClick={async () => { setBusy(true); await refreshFxRates(); setBusy(false); }}>
              <span className="flex items-center gap-1.5"><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Mettre à jour en ligne</span>
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {CURRENCIES.filter((c) => c.code !== baseCurrency).map((c) => (
              <label key={c.code} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5">
                <span className="w-12 text-xs font-semibold text-ink">{c.code}</span>
                <span className="text-[11px] text-mute flex-1 truncate">1 {c.short} =</span>
                <input type="number" step="any" min="0" defaultValue={rateFor(c.code, baseCurrency, fxRates)} key={`${c.code}-${fxUpdatedAt}-${baseCurrency}`}
                  onBlur={(e) => setFxRate(c.code, e.target.value)}
                  className="w-28 bg-surface border border-line rounded px-2 py-1 text-xs text-right tabular-nums text-ink" />
                <span className="text-[11px] text-mute w-8">{base.short}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={onClose}>Fermer</Button></div>
      </div>
    </Modal>
  );
}

/**
 * Amount + currency picker. In a foreign currency it shows the rate used
 * (editable) and the converted base amount.
 * value = { amount, currency, rate }  →  onChange(next)
 */
export function MoneyInput({ value, onChange, autoFocus, big = false, inputRef }) {
  const { baseCurrency, fxRates } = useAccountingStore();
  const cur = value.currency || baseCurrency;
  const foreign = cur !== baseCurrency;
  const rate = value.rate ?? rateFor(cur, baseCurrency, fxRates);
  const amt = Number(String(value.amount).replace(',', '.')) || 0;
  const setCur = (c) => onChange({ ...value, currency: c, rate: rateFor(c, baseCurrency, fxRates) });
  return (
    <div>
      <div className={`flex items-center gap-2 ${big ? 'justify-center' : ''}`}>
        <input ref={inputRef} inputMode="decimal" autoFocus={autoFocus} value={value.amount} placeholder="0"
          onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/[^\d.,]/g, '') })}
          className={big ? 'w-44 bg-transparent text-center text-4xl font-bold tabular-nums text-ink placeholder:text-mute focus:outline-none' : `${inputCls} tabular-nums`} />
        <select value={cur} onChange={(e) => setCur(e.target.value)}
          className={`bg-surface border border-line rounded-lg px-2 py-2 text-ink ${big ? 'text-base' : 'text-sm'}`}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.short === c.code ? c.code : `${c.short} ${c.code}`}</option>)}
        </select>
      </div>
      {foreign && (
        <div className={`mt-1.5 flex items-center gap-2 text-[11px] text-mute ${big ? 'justify-center' : ''}`}>
          <Coins size={11} /> 1 {currencyMeta(cur).short} =
          <input type="number" step="any" min="0" value={rate} onChange={(e) => onChange({ ...value, rate: Number(e.target.value) || 0 })}
            className="w-20 bg-surface border border-line rounded px-1.5 py-0.5 text-[11px] text-right tabular-nums text-ink" />
          {currencyMeta(baseCurrency).short}
          {amt > 0 && <span>→ <b className="text-ink">{formatMoney(Math.round(amt * rate * 100) / 100, baseCurrency, 0)}</b></span>}
        </div>
      )}
    </div>
  );
}

/** Converts a MoneyInput value to { base, fx } for addEntry. */
export function moneyToEntry(value, baseCurrency, fxRates) {
  const amt = Number(String(value.amount).replace(',', '.')) || 0;
  const cur = value.currency || baseCurrency;
  if (cur === baseCurrency) return { base: amt, fx: null };
  const rate = value.rate ?? rateFor(cur, baseCurrency, fxRates);
  return { base: Math.round(amt * rate * 100) / 100, fx: { currency: cur, amount: amt, rate } };
}

/** "(45 €)" suffix for an entry recorded in a foreign currency. */
export function fxNote(entry) {
  if (!entry?.fx) return '';
  return ` (${formatMoney(entry.fx.amount, entry.fx.currency, 0)})`;
}
