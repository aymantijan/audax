import { useMemo, useState } from 'react';
import { Plus, Pencil, BookMarked } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { STRATEGIES } from '../../utils/constants';
import { TIMEFRAMES, setupStats } from '../../utils/trading-journal';
import { fmtSignedMoney, fmtPct } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Textarea, Modal, EmptyState } from '../common/ui';

const fmtR = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${(Math.round(r * 100) / 100).toFixed(2)}R`);

function PlaybookModal({ open, name, onClose }) {
  const { playbook, setPlaybook, addCustomStrategy } = useTradingStore();
  const entry = (name && playbook?.[name]) || {};
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  // (Re)initialise when the modal opens for another setup.
  const key = `${open}|${name}`;
  const [lastKey, setLastKey] = useState('');
  if (open && key !== lastKey) {
    setLastKey(key);
    setF({ name: name || '', description: entry.description || '', timeframe: entry.timeframe || '', criteria: (entry.criteria || []).join('\n') });
    setError('');
  }
  if (!open && lastKey) setLastKey('');
  if (!open || !f) return null;
  const submit = (e) => {
    e.preventDefault();
    let setupName = name;
    if (!name) {
      const res = addCustomStrategy({ name: f.name });
      if (!res.ok) return setError(res.error);
      setupName = f.name.trim();
    }
    setPlaybook(setupName, { description: f.description, timeframe: f.timeframe, criteria: f.criteria.split('\n') });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={name ? `Playbook · ${name}` : 'New setup'} wide>
      <form onSubmit={submit} className="space-y-3">
        {!name && <Field label="Setup name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. London breakout, ICT silver bullet, VWAP reclaim" autoFocus /></Field>}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Market context, what you look for, where you enter / exit…" /></Field></div>
          <Field label="Main timeframe"><Select value={f.timeframe} onChange={(e) => setF({ ...f, timeframe: e.target.value })} options={[{ value: '', label: '—' }, ...TIMEFRAMES.map((t) => ({ value: t, label: t }))]} /></Field>
        </div>
        <Field label="Entry criteria — one per line" hint="Ticked in the trade form. A trade meeting all of them is an A+ setup, and the playbook compares A+ trades with the others.">
          <Textarea rows={6} value={f.criteria} onChange={(e) => setF({ ...f, criteria: e.target.value })} placeholder={'HTF trend aligned\nLiquidity sweep\nBreak of structure on entry TF\nRR ≥ 2'} />
        </Field>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PlaybookCard({ trades, currency }) {
  const { customStrategies, playbook } = useTradingStore();
  const [editing, setEditing] = useState(null); // setup name, '' = new, null = closed
  const names = useMemo(() => [...STRATEGIES, ...customStrategies.map((c) => c.name)], [customStrategies]);
  const rows = useMemo(() => names.map((n) => ({ name: n, pb: playbook?.[n] || {}, s: setupStats(trades, n, playbook?.[n]?.criteria || []) }))
    .sort((a, b) => b.s.count - a.s.count), [names, playbook, trades]);
  return (
    <Card title="Playbook" action={<button className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setEditing('')}><Plus size={12} /> New setup</button>}>
      {rows.length ? (
        <div className="divide-y divide-line/60">
          {rows.map(({ name, pb, s }) => (
            <div key={name} className="py-2.5 flex items-start gap-3">
              <BookMarked size={15} className="text-accent mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium flex flex-wrap items-center gap-x-2">
                  {name}
                  {pb.timeframe && <span className="text-[11px] text-mute">{pb.timeframe}</span>}
                  <span className="text-[11px] text-mute">{pb.criteria?.length ? `${pb.criteria.length} criteria` : 'no criteria yet'}</span>
                </div>
                {pb.description && <div className="text-xs text-mute line-clamp-2">{pb.description}</div>}
                {s.full && (s.full.count > 0 || s.partial.count > 0) && (
                  <div className="text-[11px] mt-1 flex flex-wrap gap-x-3">
                    <span><b className="text-good">A+</b> {s.full.count} trades · {fmtR(s.full.expR)} · {fmtSignedMoney(s.full.pnl, currency)}</span>
                    <span><b className="text-warn">Partial</b> {s.partial.count} · {fmtR(s.partial.expR)} · {fmtSignedMoney(s.partial.pnl, currency)}</span>
                  </div>
                )}
              </div>
              <div className="text-right text-xs shrink-0 w-32">
                {s.count ? (
                  <>
                    <div className="font-semibold tabular-nums" style={{ color: s.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(s.pnl, currency)}</div>
                    <div className="text-mute">{s.count} trades · {fmtPct(s.winRate)} · {fmtR(s.expR)}</div>
                  </>
                ) : <div className="text-mute">no trades</div>}
              </div>
              <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => setEditing(name)} title="Edit playbook"><Pencil size={13} /></button>
            </div>
          ))}
        </div>
      ) : <EmptyState>No setups yet.</EmptyState>}
      <PlaybookModal open={editing !== null} name={editing || ''} onClose={() => setEditing(null)} />
    </Card>
  );
}
