import { useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { INSTRUMENTS, STRATEGIES } from '../../utils/constants';
import { Modal, Card, Field, Input, Select, Button, Badge } from '../common/ui';
import { toast } from '../../store/uiStore';

const blankInstrumentForm = () => ({ code: '', kind: 'pip', pipSize: '', pipValuePerLot: '' });

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

  return (
    <Card title="Instruments">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {INSTRUMENTS.map((code) => (
          <span key={code} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-line text-mute">
            <Lock size={10} /> {code}
          </span>
        ))}
        {customInstruments.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-accent/40 text-accent bg-accent/10">
            {c.code}
            <span className="text-mute">· {c.kind === 'direct' ? 'direct' : `${c.pipSize} / ${c.pipValuePerLot}`}</span>
            <button type="button" onClick={() => remove(c)} className="hover:text-bad cursor-pointer"><Trash2 size={11} /></button>
          </span>
        ))}
      </div>

      <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <Field label="Symbol">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. US30, ETH, NAS100" />
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
        <Button type="submit" className={form.kind === 'pip' ? '' : 'md:col-start-4'}>
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
