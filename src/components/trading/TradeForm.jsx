import { useEffect, useMemo, useState } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { computeTradeDerived } from '../../utils/calculations';
import { tradeSchema, validate } from '../../utils/validators';
import { INSTRUMENTS, STRATEGIES, EMOTIONS, MACRO_FIELDS, TRADE_XP } from '../../utils/constants';
import { Button, Field, Input, Select, Textarea, Modal } from '../common/ui';
import SkillPicker from '../common/SkillPicker';

const blank = () => ({
  date: new Date().toISOString().slice(0, 10),
  instrument: 'EURUSD',
  strategy: 'Trend',
  direction: 'long',
  entryPrice: '',
  exitPrice: '',
  stopLoss: '',
  takeProfit: '',
  positionSize: '',
  riskAmount: '',
  pnl: '',
  holdingTime: '',
  journal: { reasoning: '', emotion: 'neutral', processQuality: 7, exitReason: '' },
  lesson: '',
  linkedSkills: [],
  macro: {},
});

export default function TradeForm({ open, onClose, editing }) {
  const addTrade = useTradingStore((s) => s.addTrade);
  const editTrade = useTradingStore((s) => s.editTrade);
  const [form, setForm] = useState(blank());
  const [pnlTouched, setPnlTouched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...blank(), ...editing, journal: { ...blank().journal, ...editing.journal } } : blank());
      setPnlTouched(!!editing);
      setError('');
    }
  }, [open, editing]);

  const derived = useMemo(() => computeTradeDerived(form), [form.instrument, form.direction, form.entryPrice, form.exitPrice, form.positionSize]);

  // Auto-fill PnL from prices unless user overrode it manually
  useEffect(() => {
    if (!pnlTouched && derived.pnl) setForm((f) => ({ ...f, pnl: derived.pnl }));
  }, [derived.pnl, pnlTouched]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updJournal = (k, v) => setForm((f) => ({ ...f, journal: { ...f.journal, [k]: v } }));
  const updMacro = (k, v) => setForm((f) => ({ ...f, macro: { ...f.macro, [k]: v || undefined } }));

  const submit = (e) => {
    e.preventDefault();
    const res = validate(tradeSchema, form);
    if (!res.ok) return setError(res.error);
    const data = { ...res.data, macro: form.macro };
    if (editing) editTrade(editing.id, data);
    else addTrade(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Trade' : 'Log Trade'} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => upd('date', e.target.value)} />
          </Field>
          <Field label="Instrument">
            <Select value={form.instrument} onChange={(e) => upd('instrument', e.target.value)} options={INSTRUMENTS} />
          </Field>
          <Field label="Strategy">
            <Select value={form.strategy} onChange={(e) => upd('strategy', e.target.value)} options={STRATEGIES} />
          </Field>
          <Field label="Direction">
            <Select value={form.direction} onChange={(e) => upd('direction', e.target.value)} options={['long', 'short']} />
          </Field>
          <Field label="Entry price">
            <Input type="number" step="any" value={form.entryPrice} onChange={(e) => upd('entryPrice', e.target.value)} />
          </Field>
          <Field label="Exit price">
            <Input type="number" step="any" value={form.exitPrice} onChange={(e) => upd('exitPrice', e.target.value)} />
          </Field>
          <Field label="Stop loss">
            <Input type="number" step="any" value={form.stopLoss} onChange={(e) => upd('stopLoss', e.target.value)} />
          </Field>
          <Field label="Take profit">
            <Input type="number" step="any" value={form.takeProfit} onChange={(e) => upd('takeProfit', e.target.value)} />
          </Field>
          <Field label="Size (lots / coins)">
            <Input type="number" step="any" value={form.positionSize} onChange={(e) => upd('positionSize', e.target.value)} />
          </Field>
          <Field label="Risk ($)">
            <Input type="number" step="any" value={form.riskAmount} onChange={(e) => upd('riskAmount', e.target.value)} />
          </Field>
          <Field label="P&L ($)" hint={derived.pnl ? `Auto: $${derived.pnl} (${derived.pnlPips} pips)` : ''}>
            <Input
              type="number"
              step="any"
              value={form.pnl}
              onChange={(e) => {
                setPnlTouched(true);
                upd('pnl', e.target.value);
              }}
            />
          </Field>
          <Field label="Holding time (min)">
            <Input type="number" value={form.holdingTime} onChange={(e) => upd('holdingTime', e.target.value)} />
          </Field>
        </div>

        <div className="border-t border-line pt-4">
          <h4 className="text-xs font-semibold text-mute uppercase tracking-wide mb-3">Journal</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Why this trade?">
              <Textarea value={form.journal.reasoning} onChange={(e) => updJournal('reasoning', e.target.value)} placeholder="Setup, criteria, macro context…" />
            </Field>
            <Field label="Exit reason">
              <Textarea value={form.journal.exitReason} onChange={(e) => updJournal('exitReason', e.target.value)} placeholder="TP hit, stop, discretionary…" />
            </Field>
            <Field label="Emotion">
              <Select value={form.journal.emotion} onChange={(e) => updJournal('emotion', e.target.value)} options={EMOTIONS} />
            </Field>
            <Field label={`Process quality: ${form.journal.processQuality}/10`}>
              <input
                type="range"
                min="1"
                max="10"
                value={form.journal.processQuality}
                onChange={(e) => updJournal('processQuality', Number(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field label="Lesson learned">
              <Textarea value={form.lesson} onChange={(e) => upd('lesson', e.target.value)} placeholder="What did this trade teach you?" />
            </Field>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <h4 className="text-xs font-semibold text-mute uppercase tracking-wide mb-3">
            Macro context (optional — powers regime analytics)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MACRO_FIELDS.map((mf) => (
              <Field key={mf.key} label={mf.label}>
                <Select value={form.macro?.[mf.key] || ''} onChange={(e) => updMacro(mf.key, e.target.value)}>
                  <option value="">—</option>
                  {mf.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <h4 className="text-xs font-semibold text-mute uppercase tracking-wide mb-3">
            Linked skills (+{TRADE_XP} XP each)
          </h4>
          <SkillPicker value={form.linkedSkills} onChange={(ids) => upd('linkedSkills', ids)} />
        </div>

        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{editing ? 'Save changes' : 'Log trade'}</Button>
        </div>
      </form>
    </Modal>
  );
}
