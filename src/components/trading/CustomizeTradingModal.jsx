import { useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { INSTRUMENTS, STRATEGIES } from '../../utils/constants';
import { Modal, Card, Field, Input, Select, Button, Badge } from '../common/ui';
import { toast } from '../../store/uiStore';
import { ASSET_CLASSES, BUILTIN_ASSET_CLASS, INSTRUMENT_PRESETS } from '../../utils/trading-journal';

const classLabel = (v) => ASSET_CLASSES.find((c) => c.value === v)?.label || '';

const blankInstrumentForm = () => ({ code: '', kind: 'pip', pipSize: '', pipValuePerLot: '', assetClass: 'index' });

function InstrumentsSection() {
  const { customInstruments, addCustomInstrument, deleteCustomInstrument } = useTradingStore();
  const [form, setForm] = useState(blankInstrumentForm());

  const submit = (e) => {
    e.preventDefault();
    const res = addCustomInstrument(form);
    if (!res.ok) return toast(res.error, 'error');
    setForm(blankInstrumentForm());
  };

  const remove = (c) => {
    if (!confirm(`Remove instrument "${c.code}"?`)) return;
    const res = deleteCustomInstrument(c.id);
    if (!res.ok) toast(res.error, 'error');
  };

  const taken = new Set([...INSTRUMENTS, ...customInstruments.map((c) => c.code)]);
  const presets = INSTRUMENT_PRESETS.filter((p) => !taken.has(p.code));

  return (
    <Card title="Instruments">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {INSTRUMENTS.map((code) => (
          <span key={code} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-line text-mute">
            <Lock size={10} /> {code} <span className="opacity-70">· {classLabel(BUILTIN_ASSET_CLASS[code])}</span>
          </span>
        ))}
        {customInstruments.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-accent/40 text-accent bg-accent/10">
            {c.code}
            <span className="text-mute">· {c.assetClass ? `${classLabel(c.assetClass)} · ` : ''}{c.kind === 'direct' ? 'direct' : `${c.pipSize} / ${c.pipValuePerLot}`}</span>
            <button type="button" onClick={() => remove(c)} className="hover:text-bad cursor-pointer"><Trash2 size={11} /></button>
          </span>
        ))}
      </div>

      {presets.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-mute mb-1.5">Quick add — indices, metals, crypto, stocks and futures (contract values vary by broker: check yours, you can re-add with your own values)</div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p.code} type="button" onClick={() => { const res = addCustomInstrument(p); if (!res.ok) toast(res.error, 'error'); }}
                className="px-2.5 py-1 rounded-lg text-xs border border-dashed border-line text-mute hover:text-accent hover:border-accent cursor-pointer"
                title={p.kind === 'direct' ? 'P&L = price move × units' : `1 point/pip = ${p.pipSize} · value per lot/contract = ${p.pipValuePerLot}`}>
                + {p.code} <span className="opacity-70">· {classLabel(p.assetClass)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <Field label="Symbol">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. US30, ETH, NAS100" />
        </Field>
        <Field label="Asset class">
          <Select value={form.assetClass} onChange={(e) => setForm({ ...form, assetClass: e.target.value })} options={ASSET_CLASSES} />
        </Field>
        <Field label="PnL calculation">
          <Select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            options={[{ value: 'pip', label: 'Pip-based (forex-style)' }, { value: 'direct', label: 'Direct (price × size, like BTC)' }]}
          />
        </Field>
        {form.kind === 'pip' && (
          <>
            <Field label="Pip size" hint="e.g. 0.0001 for a 4-decimal FX pair, 0.01 for JPY pairs, 1 for an index">
              <Input type="number" step="any" min="0" value={form.pipSize} onChange={(e) => setForm({ ...form, pipSize: e.target.value })} />
            </Field>
            <Field label="Pip value / lot" hint="Account-currency value of a 1-pip move on 1.0 lot">
              <Input type="number" step="any" min="0" value={form.pipValuePerLot} onChange={(e) => setForm({ ...form, pipValuePerLot: e.target.value })} />
            </Field>
          </>
        )}
        <Button type="submit" className={form.kind === 'pip' ? '' : 'md:col-start-5'}>
          <span className="flex items-center gap-2"><Plus size={14} /> Add</span>
        </Button>
      </form>
    </Card>
  );
}

function StrategiesSection() {
  const { customStrategies, addCustomStrategy, deleteCustomStrategy } = useTradingStore();
  const [name, setName] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const res = addCustomStrategy({ name });
    if (!res.ok) return toast(res.error, 'error');
    setName('');
  };

  const remove = (s) => {
    if (!confirm(`Remove strategy "${s.name}"?`)) return;
    const res = deleteCustomStrategy(s.id);
    if (!res.ok) toast(res.error, 'error');
  };

  return (
    <Card title="Strategies">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STRATEGIES.map((name) => (
          <span key={name} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-line text-mute">
            <Lock size={10} /> {name}
          </span>
        ))}
        {customStrategies.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-accent/40 text-accent bg-accent/10">
            {s.name}
            <button type="button" onClick={() => remove(s)} className="hover:text-bad cursor-pointer"><Trash2 size={11} /></button>
          </span>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Scalping, News Fade, ICT" className="flex-1" />
        <Button type="submit"><span className="flex items-center gap-2"><Plus size={14} /> Add</span></Button>
      </form>
    </Card>
  );
}

export default function CustomizeTradingModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Customize instruments & strategies" wide>
      <div className="space-y-6">
        <p className="text-xs text-mute">
          Built-in <Badge color="var(--text-secondary)">locked</Badge> items can't be edited or removed. Custom ones can be removed only while unused — once a trade references them, delete is blocked so trade history stays coherent.
        </p>
        <InstrumentsSection />
        <StrategiesSection />
      </div>
    </Modal>
  );
}
