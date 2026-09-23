import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { computeTradeDerived, round2 } from '../../utils/calculations';
import { tradeSchema, validate } from '../../utils/validators';
import { INSTRUMENTS, STRATEGIES, EMOTIONS, MACRO_FIELDS, TRADE_XP } from '../../utils/constants';
import { Button, Field, Input, Select, Textarea, Modal } from '../common/ui';
import SkillPicker from '../common/SkillPicker';
import { usePreTradeChecklist } from './PreTradingChecklist';
import { MISTAKES, TIMEFRAMES, mistakesOf, sessionOf } from '../../utils/trading-journal';
import { todayKey } from '../../utils/formatters';

const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const blank = () => ({
  date: todayKey(),
  entryTime: nowHHMM(),
  instrument: 'EURUSD',
  strategy: 'Trend',
  direction: 'long',
  timeframe: '',
  entryPrice: '',
  exitPrice: '',
  stopLoss: '',
  takeProfit: '',
  positionSize: '',
  riskAmount: '',
  pnl: '',
  fees: '',
  holdingTime: '',
  chartUrl: '',
  journal: { reasoning: '', emotion: 'neutral', processQuality: 7, exitReason: '' },
  lesson: '',
  linkedSkills: [],
  macro: {},
  followedPlan: true,
  mistakes: [],
  criteriaMet: [],
  partials: [],
});

/**
 * Log / edit a closed trade, open a position, or close / edit an open one.
 * - editing: an existing closed trade
 * - position + positionMode 'close' | 'edit': an open position
 */
export default function TradeForm({ open, onClose, editing, position = null, positionMode = null }) {
  const { addTrade, editTrade, openPosition, editPosition, closePosition, addCustomMistake } = useTradingStore();
  // `accounts.find` returns the SAME object reference across renders while the
  // accounts array itself is unchanged, so this selector is safe.
  const activeAccount = useTradingStore((s) => s.accounts.find((a) => a.id === (editing?.accountId || position?.accountId || s.activeAccountId)));
  const currency = activeAccount?.currency || 'USD';
  const customInstruments = useTradingStore((s) => s.customInstruments);
  const customStrategies = useTradingStore((s) => s.customStrategies);
  const playbook = useTradingStore((s) => s.playbook) || {};
  const customMistakes = useTradingStore((s) => s.customMistakes) || [];
  const instrumentOptions = useMemo(() => [...INSTRUMENTS, ...customInstruments.map((c) => c.code)], [customInstruments]);
  const strategyOptions = useMemo(() => [...STRATEGIES, ...customStrategies.map((c) => c.name)], [customStrategies]);
  const instrumentSpecs = useMemo(
    () => Object.fromEntries(customInstruments.map((c) => [c.code, { pipSize: c.pipSize, pipValuePerLot: c.pipValuePerLot, kind: c.kind }])),
    [customInstruments]
  );
  const [form, setForm] = useState(blank());
  const [pnlTouched, setPnlTouched] = useState(false);
  const [error, setError] = useState('');
  const [newMistake, setNewMistake] = useState('');
  const { reds } = usePreTradeChecklist();
  const [redsAtOpen, setRedsAtOpen] = useState([]);
  const isNew = !editing && !position;

  useEffect(() => {
    if (!open) return;
    // New trade while the checklist is red → off-plan by default, with the red items as the reasons.
    const redLabels = isNew ? reds.map((r) => r.label) : [];
    setRedsAtOpen(redLabels);
    const src = editing || position;
    if (src) {
      const { id, accountId, createdAt, updatedAt, ...rest } = src; // eslint-disable-line no-unused-vars
      setForm({
        ...blank(), ...rest, journal: { ...blank().journal, ...src.journal },
        entryTime: src.entryTime || '', followedPlan: src.followedPlan ?? null, mistakes: mistakesOf(src),
        criteriaMet: src.criteriaMet || [], partials: src.partials || [], chartUrl: src.chartUrl || '', timeframe: src.timeframe || '',
        ...(positionMode === 'close' ? { date: todayKey(), exitPrice: '', pnl: '' } : {}),
      });
    } else {
      setForm({ ...blank(), followedPlan: redLabels.length === 0, mistakes: redLabels });
    }
    setPnlTouched(!!editing);
    setError(''); setNewMistake('');
  }, [open, editing, position, positionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Partial closes: the auto P&L covers the remaining size + what partials already banked.
  const partialSize = form.partials.reduce((a, p) => a + (Number(p.size) || 0), 0);
  const partialPnl = round2(form.partials.reduce((a, p) => a + (Number(p.pnl) || 0), 0));
  const remainingSize = Math.max(0, (Number(form.positionSize) || 0) - partialSize);
  const derived = useMemo(() => {
    const d = computeTradeDerived({ ...form, positionSize: form.partials.length ? remainingSize : form.positionSize }, instrumentSpecs);
    return form.partials.length && d.pnl ? { ...d, pnl: round2(d.pnl + partialPnl) } : d;
  }, [form.instrument, form.direction, form.entryPrice, form.exitPrice, form.positionSize, form.partials, instrumentSpecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill PnL from prices unless user overrode it manually
  useEffect(() => {
    if (!pnlTouched && derived.pnl) setForm((f) => ({ ...f, pnl: derived.pnl }));
  }, [derived.pnl, pnlTouched]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updJournal = (k, v) => setForm((f) => ({ ...f, journal: { ...f.journal, [k]: v } }));
  const updMacro = (k, v) => setForm((f) => ({ ...f, macro: { ...f.macro, [k]: v || undefined } }));
  const toggleIn = (k, v) => setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const criteria = playbook[form.strategy]?.criteria || [];
  const metCount = form.criteriaMet.filter((c) => criteria.includes(c)).length;
  const session = sessionOf(form.date, form.entryTime);
  const mistakeOptions = [...new Set([...redsAtOpen, ...MISTAKES, ...customMistakes, ...form.mistakes])];

  const extras = () => ({
    macro: form.macro,
    followedPlan: form.followedPlan ?? null,
    mistakes: form.mistakes,
    entryTime: form.entryTime || '',
    session,
    timeframe: form.timeframe || '',
    chartUrl: form.chartUrl.trim(),
    criteriaMet: criteria.length ? form.criteriaMet.filter((c) => criteria.includes(c)) : undefined,
  });
  const urlOk = () => {
    if (form.chartUrl.trim() && !/^https?:\/\//i.test(form.chartUrl.trim())) { setError('Chart link must start with http:// or https://'); return false; }
    return true;
  };

  // Open position = trade without exit yet (never counted in stats until closed).
  const savePosition = () => {
    if (!urlOk()) return;
    if (!(Number(form.entryPrice) > 0)) return setError('Entry price must be > 0');
    if (!(Number(form.positionSize) > 0)) return setError('Position size must be > 0');
    const { exitPrice, pnl, fees, holdingTime, partials, ...rest } = form; // eslint-disable-line no-unused-vars
    const data = {
      ...rest, ...extras(),
      entryPrice: Number(form.entryPrice), positionSize: Number(form.positionSize),
      stopLoss: Number(form.stopLoss) || 0, takeProfit: Number(form.takeProfit) || 0, riskAmount: Number(form.riskAmount) || 0,
    };
    if (position) editPosition(position.id, data); else openPosition(data);
    onClose();
  };

  const submit = (e) => {
    e.preventDefault();
    if (positionMode === 'edit') return savePosition();
    if (!urlOk()) return;
    const res = validate(tradeSchema, form);
    if (!res.ok) return setError(res.error);
    const data = { ...res.data, ...extras() };
    if (editing) editTrade(editing.id, data);
    else if (position) closePosition(position.id, data);
    else addTrade(data);
    onClose();
  };

  const title = editing ? 'Edit Trade' : positionMode === 'close' ? `Close position · ${position?.instrument}` : positionMode === 'edit' ? `Edit open position · ${position?.instrument}` : 'Log Trade';
  const closing = positionMode !== 'edit';

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg border p-3" style={{ borderColor: form.followedPlan === false ? 'color-mix(in srgb, var(--error) 45%, transparent)' : 'var(--border)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium flex-1 min-w-[10rem]">Was this trade within your plan & rules?</span>
            {[{ v: true, label: 'On plan', c: 'var(--success)' }, { v: false, label: 'Off plan', c: 'var(--error)' }].map((o) => (
              <button key={o.label} type="button" onClick={() => upd('followedPlan', o.v)}
                className="px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer"
                style={form.followedPlan === o.v ? { borderColor: o.c, color: o.c, background: `color-mix(in srgb, ${o.c} 12%, transparent)` } : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                {o.label}
              </button>
            ))}
          </div>
          {redsAtOpen.length > 0 && <p className="text-[11px] text-warn mt-2">Your pre-trading checklist is red ({redsAtOpen.join(', ')}). If you took this trade earlier under your plan, switch to On plan.</p>}
          {form.followedPlan == null && editing && <p className="text-[11px] text-mute mt-2">Not tagged yet — tag it to include it in the on-plan / off-plan comparison.</p>}
          <div className="text-[11px] uppercase tracking-wide text-mute mt-3 mb-1.5">{form.followedPlan === false ? 'What broke the plan?' : 'Mistakes (optional — an on-plan trade can still be managed badly)'}</div>
          <div className="flex flex-wrap gap-1.5">
            {mistakeOptions.map((b) => {
              const on = form.mistakes.includes(b);
              return (
                <button key={b} type="button" onClick={() => toggleIn('mistakes', b)}
                  className={`px-2 py-0.5 rounded-full border text-[11px] cursor-pointer ${on ? 'border-bad text-bad bg-bad/10' : 'border-line text-mute hover:text-ink'}`}>
                  {b}
                </button>
              );
            })}
            <input value={newMistake} onChange={(e) => setNewMistake(e.target.value)} placeholder="+ own tag"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const v = newMistake.trim();
                if (!v) return;
                addCustomMistake(v);
                if (!form.mistakes.includes(v)) toggleIn('mistakes', v);
                setNewMistake('');
              }}
              className="w-24 bg-transparent border border-dashed border-line rounded-full px-2 py-0.5 text-[11px] text-ink placeholder:text-mute focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label={positionMode === 'close' ? 'Exit date' : 'Date'}>
            <Input type="date" value={form.date} onChange={(e) => upd('date', e.target.value)} />
          </Field>
          <Field label="Entry time" hint={session ? `Session: ${session}` : 'Sets the session automatically'}>
            <Input type="time" value={form.entryTime} onChange={(e) => upd('entryTime', e.target.value)} />
          </Field>
          <Field label="Instrument">
            <Select value={form.instrument} onChange={(e) => upd('instrument', e.target.value)} options={instrumentOptions} />
          </Field>
          <Field label="Direction">
            <Select value={form.direction} onChange={(e) => upd('direction', e.target.value)} options={['long', 'short']} />
          </Field>
          <Field label="Strategy / setup">
            <Select value={form.strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value, criteriaMet: [] }))} options={strategyOptions} />
          </Field>
          <Field label="Timeframe">
            <Select value={form.timeframe} onChange={(e) => upd('timeframe', e.target.value)} options={[{ value: '', label: '—' }, ...TIMEFRAMES.map((t) => ({ value: t, label: t }))]} />
          </Field>
          <Field label="Entry price">
            <Input type="number" step="any" value={form.entryPrice} onChange={(e) => upd('entryPrice', e.target.value)} />
          </Field>
          {closing && (
            <Field label="Exit price">
              <Input type="number" step="any" value={form.exitPrice} onChange={(e) => upd('exitPrice', e.target.value)} autoFocus={positionMode === 'close'} />
            </Field>
          )}
          <Field label="Stop loss">
            <Input type="number" step="any" value={form.stopLoss} onChange={(e) => upd('stopLoss', e.target.value)} />
          </Field>
          <Field label="Take profit">
            <Input type="number" step="any" value={form.takeProfit} onChange={(e) => upd('takeProfit', e.target.value)} />
          </Field>
          <Field label="Size (lots / contracts / units)">
            <Input type="number" step="any" value={form.positionSize} onChange={(e) => upd('positionSize', e.target.value)} />
          </Field>
          <Field label={`Risk (${currency})`} hint="Loss if stopped out — needed for R">
            <Input type="number" step="any" value={form.riskAmount} onChange={(e) => upd('riskAmount', e.target.value)} />
          </Field>
          {closing && (
            <Field label={`P&L (${currency})`} hint={derived.pnl ? `Auto: ${derived.pnl}${form.partials.length ? ` (incl. partials ${partialPnl >= 0 ? '+' : ''}${partialPnl})` : ` (${derived.pnlPips} pips/pts)`}` : ''}>
              <Input type="number" step="any" value={form.pnl} onChange={(e) => { setPnlTouched(true); upd('pnl', e.target.value); }} />
            </Field>
          )}
          {closing && (
            <Field label={`Fees (${currency})`} hint="Optional — informational only">
              <Input type="number" step="any" min="0" value={form.fees} onChange={(e) => upd('fees', e.target.value)} />
            </Field>
          )}
          {closing && (
            <Field label="Holding time (min)">
              <Input type="number" value={form.holdingTime} onChange={(e) => upd('holdingTime', e.target.value)} />
            </Field>
          )}
          <Field label="Chart link" hint="TradingView snapshot, screenshot URL…">
            <div className="flex gap-1.5">
              <Input value={form.chartUrl} onChange={(e) => upd('chartUrl', e.target.value)} placeholder="https://" />
              {/^https?:\/\//i.test(form.chartUrl) && <a href={form.chartUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center px-1 text-accent" title="Open"><ExternalLink size={14} /></a>}
            </div>
          </Field>
        </div>

        {form.partials.length > 0 && (
          <div className="text-xs text-mute rounded-lg border border-line p-2.5">
            Partials already closed: {form.partials.map((p) => `${p.size} @ ${p.exitPrice} (${p.pnl >= 0 ? '+' : ''}${p.pnl})`).join(' · ')} — remaining size {round2(remainingSize)}.
          </div>
        )}

        {criteria.length > 0 && (
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-mute uppercase tracking-wide">{form.strategy} criteria</span>
              <span className={`text-xs font-semibold ${metCount === criteria.length ? 'text-good' : 'text-warn'}`}>{metCount}/{criteria.length}{metCount === criteria.length ? ' · A+ setup' : ''}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {criteria.map((c) => (
                <label key={c} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-[var(--accent-primary)]" checked={form.criteriaMet.includes(c)} onChange={() => toggleIn('criteriaMet', c)} />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-line pt-4">
          <h4 className="text-xs font-semibold text-mute uppercase tracking-wide mb-3">Journal</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Why this trade?">
              <Textarea value={form.journal.reasoning} onChange={(e) => updJournal('reasoning', e.target.value)} placeholder="Setup, criteria, macro context…" />
            </Field>
            {closing && (
              <Field label="Exit reason">
                <Textarea value={form.journal.exitReason} onChange={(e) => updJournal('exitReason', e.target.value)} placeholder="TP hit, stop, discretionary…" />
              </Field>
            )}
            <Field label="Emotion">
              <Select value={form.journal.emotion} onChange={(e) => updJournal('emotion', e.target.value)} options={EMOTIONS} />
            </Field>
            {closing && (
              <Field label={`Process quality: ${form.journal.processQuality}/10`}>
                <input type="range" min="1" max="10" value={form.journal.processQuality} onChange={(e) => updJournal('processQuality', Number(e.target.value))} className="w-full" />
              </Field>
            )}
            {closing && (
              <Field label="Lesson learned">
                <Textarea value={form.lesson} onChange={(e) => upd('lesson', e.target.value)} placeholder="What did this trade teach you?" />
              </Field>
            )}
          </div>
        </div>

        {closing && (
          <div className="border-t border-line pt-4">
            <h4 className="text-xs font-semibold text-mute uppercase tracking-wide mb-3">Macro context (optional — powers regime analytics)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {MACRO_FIELDS.map((mf) => (
                <Field key={mf.key} label={mf.label}>
                  <Select value={form.macro?.[mf.key] || ''} onChange={(e) => updMacro(mf.key, e.target.value)}>
                    <option value="">—</option>
                    {mf.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
          </div>
        )}

        {closing && (
          <div className="border-t border-line pt-4">
            <h4 className="text-xs font-semibold text-mute uppercase tracking-wide mb-3">Linked skills (+{TRADE_XP} XP each)</h4>
            <SkillPicker value={form.linkedSkills} onChange={(ids) => upd('linkedSkills', ids)} />
          </div>
        )}

        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          {isNew && <Button type="button" variant="secondary" onClick={savePosition} title="No exit yet — track it in Today › Open positions">Save as open position</Button>}
          <Button type="submit">{editing ? 'Save changes' : positionMode === 'close' ? 'Close position' : positionMode === 'edit' ? 'Save position' : 'Log trade'}</Button>
        </div>
      </form>
    </Modal>
  );
}
