import { useMemo, useState } from 'react';
import { FileUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { INSTRUMENTS, STRATEGIES } from '../../utils/constants';
import { readReportFile, parseMt5Report, positionsToTrades, newInstrumentDefs } from '../../utils/mt5-import';
import { INSTRUMENT_PRESETS } from '../../utils/trading-journal';
import { fmtMoney, fmtSignedMoney } from '../../utils/formatters';
import { Button, Field, Input, Select, Modal } from '../common/ui';

const OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12);

export default function Mt5ImportModal({ open, onClose, onDone }) {
  const { accounts, activeAccountId, trades: allTrades, customInstruments, customStrategies, addAccount, editAccount, importTrades } = useTradingStore();
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opt, setOpt] = useState({ target: activeAccountId || 'new', newType: 'propfirm', newName: '', offset: 3, strategy: STRATEGIES[0] });

  const known = useMemo(() => [...INSTRUMENTS, ...customInstruments.map((c) => c.code)], [customInstruments]);
  const strategies = useMemo(() => [...STRATEGIES, ...customStrategies.map((c) => c.name)], [customStrategies]);
  const existing = useMemo(() => new Set(allTrades.map((t) => t.external).filter(Boolean)), [allTrades]);
  const preview = useMemo(() => (report ? positionsToTrades(report, { accountId: opt.target, offsetHours: Number(opt.offset), strategy: opt.strategy, knownInstruments: known, existingExternal: existing }) : null), [report, opt, known, existing]);
  const period = useMemo(() => {
    if (!preview?.trades.length) return null;
    const ds = preview.trades.map((t) => t.date).sort();
    return `${ds[0]} → ${ds[ds.length - 1]}`;
  }, [preview]);
  const withRisk = preview ? preview.trades.filter((t) => t.riskAmount > 0).length : 0;
  // Existing prop-firm account whose phase started after these trades: they would be left out of the phase rules.
  const targetAcc = accounts.find((a) => a.id === opt.target);
  const firstDay = preview?.trades.length ? preview.trades.map((t) => t.date).sort()[0] : null;
  const phaseStartDay = targetAcc?.type === 'propfirm' && targetAcc.currentPhaseStartAt ? new Date(targetAcc.currentPhaseStartAt).toLocaleDateString('sv-SE') : null;
  const beforePhase = firstDay && phaseStartDay && firstDay < phaseStartDay;

  const reset = () => { setReport(null); setFileName(''); setError(''); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file) => {
    if (!file) return;
    setError(''); setBusy(true); setFileName(file.name);
    try {
      const rep = parseMt5Report(await readReportFile(file));
      setReport(rep);
      // A report = one MT5 account: default to its AUDAX account (same login) or a new one, never mix it into another.
      const match = accounts.find((a) => a.accountNumber && a.accountNumber === rep.meta.login);
      setOpt((o) => ({ ...o, target: match ? match.id : 'new', newName: rep.meta.name || `MT5 ${rep.meta.login}`, newType: /fund|prop|ftmo|challenge|phase/i.test(`${rep.meta.company} ${rep.meta.name}`) ? 'propfirm' : rep.meta.isDemo ? 'demo' : 'broker' }));
    } catch (e) {
      setReport(null); setError(e.message || 'Could not read this file.');
    } finally { setBusy(false); }
  };

  const doImport = () => {
    let accountId = opt.target;
    if (accountId === 'new') {
      accountId = addAccount({ type: opt.newType, name: opt.newName || 'MT5 account', currency: report.meta.currency, broker: report.meta.company, accountNumber: report.meta.login, initialBalance: report.meta.deposit || 0 });
      // Prop-firm phase metrics only count trades after the phase start: start it at the first deposit.
      const dep = report.meta.depositTime?.match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (dep) editAccount(accountId, { currentPhaseStartAt: new Date(+dep[1], +dep[2] - 1, +dep[3]).getTime() });
    }
    const { trades } = positionsToTrades(report, { accountId, offsetHours: Number(opt.offset), strategy: opt.strategy, knownInstruments: known, existingExternal: existing });
    const newInstruments = newInstrumentDefs(preview.newSymbols, INSTRUMENT_PRESETS);
    importTrades(trades, newInstruments);
    reset();
    onDone?.(accountId);
  };

  return (
    <Modal open={open} onClose={close} title="Import from MetaTrader 5" wide>
      <div className="space-y-4">
        <div className="text-xs text-mute rounded-lg border border-line p-3 space-y-1">
          <div>In MT5: <b className="text-ink">Toolbox › History</b> → choose the period (right-click › <i>Custom period</i>) → right-click › <b className="text-ink">Report</b> › <b className="text-ink">Open XML (.xlsx)</b> or HTML.</div>
          <div>Already-imported positions are skipped, so you can re-import the same account every week.</div>
        </div>
        <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-6 cursor-pointer hover:border-accent text-sm text-mute">
          <FileUp size={18} className="text-accent" />
          {busy ? 'Reading…' : fileName || 'Choose the MT5 report (.xlsx or .html)'}
          <input type="file" accept=".xlsx,.html,.htm" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {error && <p className="text-bad text-sm flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}

        {report && preview && (
          <>
            <div className="rounded-xl border border-line p-3 text-sm space-y-1">
              <div className="font-medium">{report.meta.name || 'MT5 account'} <span className="text-mute font-normal">· {report.meta.company}{report.meta.login ? ` · #${report.meta.login}` : ''} · {report.meta.currency}</span></div>
              <div className="text-mute text-xs">{report.positions.length} closed positions{period ? ` · ${period}` : ''}{report.meta.deposit ? ` · initial deposit ${fmtMoney(report.meta.deposit, 0, report.meta.currency)}` : ''}</div>
              <div className="flex flex-wrap gap-x-4 text-xs">
                <span>Net P&L (after commissions & swap): <b style={{ color: preview.net >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(preview.net, report.meta.currency)}</b></span>
                <span>New: <b>{preview.trades.length}</b></span>
                {preview.duplicates > 0 && <span className="text-mute">Already imported: {preview.duplicates}</span>}
                <span className="text-mute">R available on {withRisk}/{preview.trades.length} (from the initial stop)</span>
              </div>
              {preview.newSymbols.length > 0 && <div className="text-xs text-mute">New instruments that will be added: <b className="text-ink">{preview.newSymbols.join(', ')}</b></div>}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Import into">
                <Select value={opt.target} onChange={(e) => setOpt({ ...opt, target: e.target.value })}
                  options={[...accounts.filter((a) => a.status !== 'archived').map((a) => ({ value: a.id, label: `${a.name}${a.accountNumber ? ` (#${a.accountNumber})` : ''}` })), { value: 'new', label: '+ New account from this report' }]} />
              </Field>
              {opt.target === 'new' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Name"><Input value={opt.newName} onChange={(e) => setOpt({ ...opt, newName: e.target.value })} /></Field>
                  <Field label="Type"><Select value={opt.newType} onChange={(e) => setOpt({ ...opt, newType: e.target.value })} options={[{ value: 'propfirm', label: 'Prop Firm' }, { value: 'demo', label: 'Demo' }, { value: 'broker', label: 'Broker' }]} /></Field>
                </div>
              ) : <div />}
              <Field label="Broker server time" hint="MT5 times are in the broker's server time. Most prop firms / brokers: UTC+3 in summer, UTC+2 in winter. Sets sessions and trading days correctly.">
                <Select value={opt.offset} onChange={(e) => setOpt({ ...opt, offset: Number(e.target.value) })} options={OFFSETS.map((o) => ({ value: o, label: `UTC${o >= 0 ? '+' : ''}${o}` }))} />
              </Field>
              <Field label="Setup for these trades" hint="MT5 doesn't know your setups — tag them later in the Journal (edit a trade).">
                <Select value={opt.strategy} onChange={(e) => setOpt({ ...opt, strategy: e.target.value })} options={strategies} />
              </Field>
            </div>
            {beforePhase && (
              <div className="text-xs rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 text-warn" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }}>
                <span className="flex-1">“{targetAcc.name}” phase started on {phaseStartDay}: trades before it stay out of the phase rules (daily loss, target…).</span>
                <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => editAccount(targetAcc.id, { currentPhaseStartAt: new Date(`${firstDay}T00:00:00`).getTime() })}>Start phase on {firstDay}</Button>
              </div>
            )}
            {opt.target === 'new' && opt.newType === 'propfirm' && <p className="text-[11px] text-mute">The prop-firm rules (daily loss, max drawdown, target) can be set afterwards in Accounts › edit.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button onClick={doImport} disabled={!preview.trades.length}>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={15} /> Import {preview.trades.length} trade{preview.trades.length === 1 ? '' : 's'}</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
