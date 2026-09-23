import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, AlertTriangle, Sparkles, History } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import {
  parseDelimited, detectColumns, extractTransactions, guessCategory, isDuplicate, entryFor,
} from '../../utils/bank-import';
import { toast } from '../../store/uiStore';
import { fmtMAD } from '../../utils/formatters';
import { Button, Field, Modal, Select } from '../common/ui';
import AccountSelect from '../common/AccountSelect';
import { useFinanceMode } from './financeMode';
import { CURRENCIES, rateFor, formatMoney } from '../../utils/currency';

const fmt = (n) => `${n < 0 ? '−' : '+'}${fmtMAD(Math.abs(n), 2)}`;

/**
 * Import a bank statement (CSV exported from the bank's website/app).
 * Columns are detected automatically (and adjustable), each line gets a
 * category guessed from its label, likely duplicates are unticked.
 */
export default function BankImportModal({ open, onClose }) {
  const { journal, addEntry, baseCurrency, fxRates, treasuryAccounts } = useAccountingStore();
  const [stmtCur, setStmtCur] = useState(null); // null = follow the account's currency
  const simple = useFinanceMode() === 'simple';
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState('');
  const [fileName, setFileName] = useState('');
  const [bank, setBank] = useState('511');
  const [map, setMap] = useState(null);
  const [rowsState, setRowsState] = useState({}); // idx → { include, category }

  useEffect(() => { if (open) { setText(''); setDraft(''); setFileName(''); setMap(null); setRowsState({}); } }, [open]);

  const parsed = useMemo(() => (text ? parseDelimited(text) : null), [text]);
  useEffect(() => { if (parsed?.rows?.length) setMap(detectColumns(parsed.rows)); }, [parsed]);
  const txs = useMemo(() => (parsed && map ? extractTransactions(parsed.rows, map) : []), [parsed, map]);
  const accountCur = treasuryAccounts.find((a) => a.code === bank)?.currency || baseCurrency;
  const cur = stmtCur || accountCur;
  const rate = rateFor(cur, baseCurrency, fxRates);
  const lines = useMemo(() => txs.map((t0) => {
    // Amounts converted to the base currency; the original stays in `fx`.
    const t = cur === baseCurrency ? t0 : { ...t0, amount: Math.round(t0.amount * rate * 100) / 100, fx: { currency: cur, amount: Math.abs(t0.amount), rate } };
    const kind = t.amount < 0 ? 'expense' : 'income';
    const g = guessCategory(journal, t.label, kind);
    return { ...t, kind, guess: g, dup: isDuplicate(journal, bank, t) };
  }), [txs, journal, bank, cur, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const stateOf = (i) => ({ include: !lines[i].dup, category: lines[i].guess.account, ...(rowsState[i] || {}) });
  const setRow = (i, patch) => setRowsState((s) => ({ ...s, [i]: { ...stateOf(i), ...patch } }));
  const selected = lines.map((l, i) => ({ l, st: stateOf(i) })).filter((x) => x.st.include);
  const totalIn = selected.filter((x) => x.l.amount > 0).reduce((a, x) => a + x.l.amount, 0);
  const totalOut = selected.filter((x) => x.l.amount < 0).reduce((a, x) => a + x.l.amount, 0);
  const cols = parsed ? Math.max(...parsed.rows.map((r) => r.length)) : 0;
  const header = parsed && map?.hasHeader ? parsed.rows[0] : null;
  const colOptions = [{ value: -1, label: '— aucune —' }, ...Array.from({ length: cols }, (_, i) => ({ value: i, label: header?.[i] || `Colonne ${i + 1}` }))];

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  };

  const doImport = () => {
    let ok = 0; let failed = 0;
    for (const { l, st } of selected) {
      const res = addEntry({ ...entryFor(l, bank, st.category), ...(l.fx ? { fx: l.fx } : {}) });
      if (res.ok) ok += 1; else failed += 1;
    }
    toast(`${ok} opération(s) importée(s)${failed ? ` · ${failed} refusée(s)` : ''}`, failed ? 'warning' : 'success');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Importer un relevé bancaire" wide>
      <div className="space-y-4">
        {!parsed ? (
          <>
            <p className="text-sm text-mute">
              Exportez vos opérations depuis le site ou l'appli de votre banque au format <b className="text-ink">CSV</b> (ou copiez-collez le tableau).
              Les colonnes sont détectées automatiquement et chaque opération reçoit une catégorie.
            </p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-line hover:border-accent py-8 flex flex-col items-center gap-2 text-mute hover:text-ink cursor-pointer transition-colors">
              <Upload size={24} /> <span className="text-sm font-medium">Choisir un fichier CSV</span>
              <span className="text-[11px]">séparateur ; , ou tabulation · dates JJ/MM/AAAA ou AAAA-MM-JJ</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={onFile} />
            <textarea rows={4} value={draft} placeholder="…ou collez ici les lignes du relevé (avec la ligne d'en-tête si possible)"
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.trim()) { e.preventDefault(); setDraft(t); setText(t); } }}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs font-mono text-ink placeholder:text-mute focus:outline-none focus:border-accent" />
            <div className="flex justify-end"><Button variant="secondary" disabled={!draft.trim()} onClick={() => setText(draft)}>Analyser le texte</Button></div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-mute">
              <FileText size={14} /> {fileName || 'Texte collé'} · {parsed.rows.length} ligne(s) · séparateur « {parsed.delim === '\t' ? 'tab' : parsed.delim} »
              <button className="ml-auto underline hover:text-ink cursor-pointer" onClick={() => { setText(''); setDraft(''); setFileName(''); setMap(null); setRowsState({}); }}>Changer de fichier</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Field label="Compte concerné par ce relevé">
                  <AccountSelect simple={simple} classes={[5]} value={bank} onChange={(e) => { setBank(e.target.value); setStmtCur(null); }} />
                </Field>
                <Field label="Devise du relevé" hint={cur !== baseCurrency ? `Converti à 1 ${cur} = ${rate} ${baseCurrency} (modifiable dans Devises)` : undefined}>
                  <Select value={cur} onChange={(e) => setStmtCur(e.target.value)} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))} />
                </Field>
              </div>
              {map && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date"><Select value={map.date} onChange={(e) => setMap({ ...map, date: Number(e.target.value) })} options={colOptions} /></Field>
                  <Field label="Libellé"><Select value={map.label} onChange={(e) => setMap({ ...map, label: Number(e.target.value) })} options={colOptions} /></Field>
                  {map.amount >= 0 || (map.debit < 0 && map.credit < 0) ? (
                    <Field label="Montant (±)"><Select value={map.amount} onChange={(e) => setMap({ ...map, amount: Number(e.target.value) })} options={colOptions} /></Field>
                  ) : (
                    <>
                      <Field label="Débit (sorties)"><Select value={map.debit} onChange={(e) => setMap({ ...map, debit: Number(e.target.value) })} options={colOptions} /></Field>
                      <Field label="Crédit (entrées)"><Select value={map.credit} onChange={(e) => setMap({ ...map, credit: Number(e.target.value) })} options={colOptions} /></Field>
                    </>
                  )}
                  <label className="col-span-2 flex items-center gap-2 text-xs text-mute cursor-pointer">
                    <input type="checkbox" checked={map.hasHeader} onChange={(e) => setMap({ ...map, hasHeader: e.target.checked })} /> La 1re ligne est un en-tête
                  </label>
                </div>
              )}
            </div>

            {lines.length ? (
              <>
                <div className="rounded-xl border border-line max-h-[45vh] overflow-y-auto divide-y divide-line/60">
                  {lines.map((l, i) => {
                    const st = stateOf(i);
                    return (
                      <div key={i} className={`grid grid-cols-[auto_4.5rem_minmax(0,1fr)_auto] sm:grid-cols-[auto_4.5rem_minmax(0,1fr)_12rem_7.5rem] gap-2 items-center px-3 py-2 text-sm ${st.include ? '' : 'opacity-45'}`}>
                        <input type="checkbox" checked={st.include} onChange={(e) => setRow(i, { include: e.target.checked })} />
                        <span className="text-[11px] text-mute tabular-nums">{new Date(l.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-ink">{l.label}</span>
                          {l.dup ? <span className="text-[10px] text-warning flex items-center gap-1"><AlertTriangle size={10} /> déjà saisie ?</span>
                            : !rowsState[i]?.category && l.guess.source !== 'default' && (
                              <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                {l.guess.source === 'history' ? <History size={10} /> : <Sparkles size={10} />}{l.guess.source === 'history' ? 'votre historique' : 'devinée'}
                              </span>
                            )}
                        </span>
                        <div className="col-span-4 sm:col-span-1 order-last sm:order-none">
                          <AccountSelect simple={simple} classes={l.kind === 'expense' ? [6, 5] : [7, 5]} value={st.category} onChange={(e) => setRow(i, { category: e.target.value })} />
                        </div>
                        <span className="text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: l.amount < 0 ? 'var(--error)' : 'var(--success)' }}>
                          {fmt(l.amount)}{l.fx && <span className="block text-[10px] font-normal text-mute">{formatMoney(l.fx.amount, l.fx.currency)}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-mute">
                  <span>{selected.length}/{lines.length} sélectionnée(s)</span>
                  <span className="text-good">{fmt(totalIn)}</span>
                  <span className="text-bad">{fmt(totalOut)}</span>
                  {lines.some((l) => l.dup) && <span className="text-warning">Les doublons probables (même montant, même compte, ±3 jours) sont décochés.</span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-warning">Aucune opération reconnue : vérifiez les colonnes Date et Montant ci-dessus.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Annuler</Button>
              <Button disabled={!selected.length} onClick={doImport}>Importer {selected.length || ''} opération(s)</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
