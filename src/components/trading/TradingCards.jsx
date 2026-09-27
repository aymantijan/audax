import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, ShieldAlert, Sun, BookOpen, BarChart3, Briefcase, Scale } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Cell } from 'recharts';
import { useTradingStore } from '../../store/tradingStore';
import { useHabitStore } from '../../store/habitStore';
import { isHabitShownOn, computeTradeDerived } from '../../utils/calculations';
import { fmtMoney, fmtSignedMoney, fmtPct, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Modal, EmptyState } from '../common/ui';
import { planSplit } from '../../utils/trading-plan';
import { mistakeStats } from '../../utils/trading-journal';
import { toast } from '../../store/uiStore';

export const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-secondary)' },
};
export const tint = (c, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
export const fmtR = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${(Math.round(r * 100) / 100).toFixed(2)}R`);

export const SPACES = [
  { key: 'today', label: 'Today', desc: 'Checklist, rules & today’s P&L', icon: Sun },
  { key: 'journal', label: 'Journal', desc: 'Trade log, calendar & lessons', icon: BookOpen },
  { key: 'analytics', label: 'Analytics', desc: 'Edge, risk & psychology', icon: BarChart3 },
  { key: 'accounts', label: 'Accounts', desc: 'Demo, broker & prop firms', icon: Briefcase },
];

// Habits flagged "obligatoire avant de trader" that are still undone today.
export function MandatoryHabitsAlert() {
  const habits = useHabitStore((st) => st.habits);
  const logs = useHabitStore((st) => st.logs);
  const today = todayKey();
  const missing = habits.filter((h) => !h.archived && h.mandatory && isHabitShownOn(h, logs, today)
    && !logs.some((l) => l.habitId === h.id && l.date === today && l.completed));
  if (!missing.length) return null;
  return (
    <div className="rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm flex items-start gap-2">
      <ShieldAlert size={16} className="text-warn shrink-0 mt-0.5" />
      <span className="flex-1">
        <b>Before trading:</b> {missing.map((h) => h.name).join(', ')} {missing.length > 1 ? 'are' : 'is'} not done yet (mandatory habit{missing.length > 1 ? 's' : ''}).{' '}
        <Link to="/habits" className="underline">Open habits</Link>
      </span>
    </div>
  );
}

export function PlanBadge({ t }) {
  if (t.followedPlan === true) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: 'var(--success)', background: tint('var(--success)', 12) }}>ON</span>;
  if (t.followedPlan === false) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" title={(t.planBreaks || []).join(', ')} style={{ color: 'var(--error)', background: tint('var(--error)', 12) }}>OFF</span>;
  return <span className="text-mute">—</span>;
}

// On-plan vs off-plan: what trading against your own rules really costs.
export function PlanDisciplineCard({ trades, currency }) {
  const s = useMemo(() => planSplit(trades), [trades]);
  const m = useMemo(() => mistakeStats(trades), [trades]);
  const Col = ({ label, g, color }) => (
    <div className="rounded-xl border p-3" style={{ borderColor: tint(color, 35), background: tint(color, 5) }}>
      <div className="text-xs font-semibold mb-2" style={{ color }}>{label} · {g.count} trade{g.count === 1 ? '' : 's'}</div>
      {g.count ? (
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-mute text-xs">Net P&L</span><span className="text-right font-semibold tabular-nums" style={{ color: g.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(g.pnl, currency)}</span>
          <span className="text-mute text-xs">Win rate</span><span className="text-right tabular-nums">{fmtPct(g.winRate)}</span>
          <span className="text-mute text-xs">Expectancy</span><span className="text-right tabular-nums">{g.rCount ? fmtR(g.expR) : `${fmtSignedMoney(g.avgPnl, currency)}/trade`}</span>
        </div>
      ) : <div className="text-xs text-mute">No trades yet.</div>}
    </div>
  );
  return (
    <Card title="Plan discipline & mistakes" action={s.onPlanPct != null ? <span className="text-xs text-mute">{Math.round(s.onPlanPct)}% of tagged trades on plan</span> : null}>
      {s.tagged === 0 && m.tags.length === 0 ? (
        <EmptyState>Every new trade is tagged <b>on plan</b> or <b>off plan</b>. Once you have a few of each, this compares what following your rules earns you against breaking them.</EmptyState>
      ) : (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Col label="On plan" g={s.on} color="var(--success)" />
            <Col label="Off plan" g={s.off} color="var(--error)" />
          </div>
          {s.off.count > 0 && s.off.pnl < 0 && (
            <p className="text-sm"><Scale size={14} className="inline -mt-0.5 mr-1 text-bad" />Off-plan trades cost you <b className="text-bad">{fmtMoney(Math.abs(s.off.pnl), 0, currency)}</b> on this account.</p>
          )}
          {m.tags.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-mute mb-1.5">What your mistakes cost (all trades)</div>
              {m.clean.count > 0 && (
                <p className="text-xs text-mute mb-1.5">Clean trades: <b className="text-ink">{m.clean.count}</b> · {m.clean.expR != null ? fmtR(m.clean.expR) : fmtSignedMoney(m.clean.avgPnl, currency)} per trade — with a mistake: <b className="text-ink">{m.withMistakes.count}</b> · {m.withMistakes.expR != null ? fmtR(m.withMistakes.expR) : fmtSignedMoney(m.withMistakes.avgPnl, currency)} per trade.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {m.tags.slice(0, 8).map((b) => (
                  <span key={b.label} className="text-xs px-2 py-0.5 rounded-full border border-line">
                    {b.label} · {b.count}× · <span style={{ color: b.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(b.pnl, currency)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {s.untagged > 0 && <p className="text-[11px] text-mute">{s.untagged} older trade{s.untagged > 1 ? 's are' : ' is'} not tagged — edit {s.untagged > 1 ? 'them' : 'it'} in the Journal to include {s.untagged > 1 ? 'them' : 'it'}.</p>}
        </div>
      )}
    </Card>
  );
}

// Open positions: not in any stat until closed; partials bank P&L along the way.
export function OpenPositionsCard({ positions, currency, onClosePos, onEditPos }) {
  const { addPartial, removePartial, discardPosition, getInstrumentSpecs } = useTradingStore();
  const [partialFor, setPartialFor] = useState(null);
  const [pf, setPf] = useState({ exitPrice: '', size: '', pnl: '' });
  const [pnlTouched, setPnlTouched] = useState(false);
  const autoPnl = partialFor ? computeTradeDerived({ ...partialFor, exitPrice: pf.exitPrice, positionSize: pf.size }, getInstrumentSpecs()).pnl : 0;
  const pnlValue = pnlTouched ? pf.pnl : (autoPnl || '');
  const remaining = (p) => Math.max(0, Number(p.positionSize) - (p.partials || []).reduce((a, x) => a + Number(x.size || 0), 0));
  if (!positions.length) return null;
  return (
    <Card title={`Open positions (${positions.length})`}>
      <ul className="divide-y divide-line/60">
        {positions.map((p) => {
          const banked = (p.partials || []).reduce((a, x) => a + Number(x.pnl || 0), 0);
          return (
            <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
              <span className="font-medium">{p.instrument}</span>
              <span className="capitalize text-mute">{p.direction}</span>
              <span className="text-mute tabular-nums">{remaining(p)}{(p.partials || []).length ? `/${p.positionSize}` : ''} @ {p.entryPrice}</span>
              {Number(p.stopLoss) > 0 && <span className="text-xs text-mute">SL {p.stopLoss}</span>}
              {Number(p.riskAmount) > 0 && <span className="text-xs text-mute">risk {fmtMoney(p.riskAmount, 0, currency)}</span>}
              <span className="text-xs text-mute">{p.strategy}{p.session ? ` · ${p.session}` : ''}{p.timeframe ? ` · ${p.timeframe}` : ''}</span>
              {(p.partials || []).length > 0 && <span className="text-xs" style={{ color: banked >= 0 ? 'var(--success)' : 'var(--error)' }}>banked {fmtSignedMoney(banked, currency)}</span>}
              <span className="ml-auto flex items-center gap-1.5">
                <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => { setPartialFor(p); setPf({ exitPrice: '', size: '', pnl: '' }); setPnlTouched(false); }}>Partial</Button>
                <Button className="!py-1 !px-2 text-xs" onClick={() => onClosePos(p)}>Close</Button>
                <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => onEditPos(p)} title="Edit (move stop, notes…)"><Pencil size={13} /></button>
                <button className="p-1 text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Remove this open position without logging a trade?')) discardPosition(p.id); }} title="Remove"><Trash2 size={13} /></button>
              </span>
              {(p.partials || []).length > 0 && (
                <div className="w-full pl-5 flex flex-wrap gap-1.5">
                  {p.partials.map((x) => (
                    <span key={x.id} className="text-[11px] px-2 py-0.5 rounded-full border border-line text-mute">
                      {x.size} @ {x.exitPrice} · <span style={{ color: x.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(x.pnl, currency)}</span>
                      <button className="ml-1 hover:text-bad cursor-pointer" onClick={() => removePartial(p.id, x.id)} title="Undo partial">×</button>
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Modal open={!!partialFor} onClose={() => setPartialFor(null)} title={`Partial close · ${partialFor?.instrument || ''}`}>
        {partialFor && (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const size = Number(pf.size);
            if (!(size > 0) || size >= remaining(partialFor)) return toast(`Size must be between 0 and ${remaining(partialFor)} (use Close for the rest)`, 'error');
            if (!(Number(pf.exitPrice) > 0)) return toast('Exit price is required', 'error');
            addPartial(partialFor.id, { exitPrice: pf.exitPrice, size, pnl: Number(pnlValue) || 0 });
            setPartialFor(null);
          }}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Exit price"><Input type="number" step="any" value={pf.exitPrice} onChange={(e) => setPf({ ...pf, exitPrice: e.target.value })} autoFocus /></Field>
              <Field label={`Size closed (of ${remaining(partialFor)})`}><Input type="number" step="any" value={pf.size} onChange={(e) => setPf({ ...pf, size: e.target.value })} /></Field>
              <Field label={`P&L (${currency})`} hint={autoPnl ? `Auto: ${autoPnl}` : ''}><Input type="number" step="any" value={pnlValue} onChange={(e) => { setPnlTouched(true); setPf({ ...pf, pnl: e.target.value }); }} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPartialFor(null)}>Cancel</Button>
              <Button type="submit">Record partial</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

export function PnLBarCard({ title, data, currency, empty }) {
  return (
    <Card title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <Tooltip {...tooltipStyle} formatter={(v) => fmtSignedMoney(v, currency)} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.pnl >= 0 ? 'var(--success)' : 'var(--error)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState>{empty}</EmptyState>}
    </Card>
  );
}
