import { useMemo, useState } from 'react';
import { Landmark, CheckCircle2, XCircle, MinusCircle, Pencil } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { equityCurve, maxDrawdown } from '../../utils/calculations';
import { tradeRMultiple } from '../../utils/risk-management';
import { planSplit } from '../../utils/trading-plan';
import { CURRENCIES } from '../../utils/constants';
import { fmtMoney, fmtSignedMoney } from '../../utils/formatters';
import { Card, Button, Field, Input, Select } from '../common/ui';

const DEFAULTS = { realCapital: '', currency: '', extraCostPerLot: '', maxDdPct: 10, maxRiskPct: 1 };
const MIN_TRADES = 30;

/**
 * Broker simulation on a Demo account: "what would these results be on my
 * real account?" — every amount scaled by realCapital / demo start, optional
 * extra broker cost per lot, and a go-live checklist with real-money thresholds.
 */
export function brokerSimResults(account, trades) {
  const cfg = { ...DEFAULTS, ...(account.brokerSim || {}) };
  const demoStart = account.initialBalance || 0;
  const real = Number(cfg.realCapital) || 0;
  if (!real || !demoStart) return null;
  const factor = real / demoStart;
  const extra = Number(cfg.extraCostPerLot) || 0;
  // Each trade as it would have been on the real account (size × factor, extra cost per scaled lot).
  const scaled = trades.map((t) => ({ ...t, pnl: t.pnl * factor - extra * (Number(t.positionSize) || 0) * factor, riskAmount: (Number(t.riskAmount) || 0) * factor, positionSize: (Number(t.positionSize) || 0) * factor }));
  const pnl = scaled.reduce((a, t) => a + t.pnl, 0);
  const curve = equityCurve(scaled, real);
  const dd = maxDrawdown(curve);
  let peak = real; let ddAmount = 0;
  for (const p of curve) { peak = Math.max(peak, p.value); ddAmount = Math.max(ddAmount, peak - p.value); }
  const byDay = {};
  for (const t of scaled) byDay[t.date] = (byDay[t.date] || 0) + t.pnl;
  const worstDay = Math.min(0, ...Object.values(byDay));
  const costs = extra * scaled.reduce((a, t) => a + (Number(t.positionSize) || 0), 0);
  const sizes = scaled.map((t) => t.positionSize).filter((v) => v > 0).sort((a, b) => a - b);
  const medianLot = sizes.length ? sizes[Math.floor(sizes.length / 2)] : null;

  // ── Go-live checklist (real money) ──
  const rs = trades.map(tradeRMultiple).filter((r) => r != null);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const expAll = rs.length >= trades.length * 0.6 ? avg(rs) : (trades.length ? avg(trades.map((t) => t.pnl)) : null);
  const last20 = [...trades].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  const rs20 = last20.map(tradeRMultiple).filter((r) => r != null);
  const exp20 = rs20.length >= last20.length * 0.6 ? avg(rs20) : (last20.length ? avg(last20.map((t) => t.pnl)) : null);
  const riskPcts = trades.filter((t) => Number(t.riskAmount) > 0).map((t) => (Number(t.riskAmount) / demoStart) * 100);
  const withinRisk = riskPcts.length ? riskPcts.filter((p) => p <= Number(cfg.maxRiskPct) + 1e-9).length / riskPcts.length : null;
  const plan = planSplit(trades);
  const months = {};
  for (const t of scaled) { const m = String(t.date).slice(0, 7); months[m] = (months[m] || 0) + t.pnl; }
  const lastMonths = Object.entries(months).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 3);
  const positiveMonths = lastMonths.filter(([, v]) => v > 0).length;

  const checks = [
    { label: `At least ${MIN_TRADES} trades on this demo`, ok: trades.length >= MIN_TRADES, detail: `${trades.length}/${MIN_TRADES}` },
    { label: 'Positive expectancy (all trades)', ok: expAll != null && expAll > 0, detail: expAll == null ? '—' : rs.length >= trades.length * 0.6 ? `${expAll.toFixed(2)}R` : `${fmtSignedMoney(expAll, account.currency)}/trade` },
    { label: 'Still positive on the last 20 trades', ok: exp20 != null && exp20 > 0, na: last20.length < 20, detail: exp20 == null ? '—' : rs20.length >= last20.length * 0.6 ? `${exp20.toFixed(2)}R` : `${fmtSignedMoney(exp20, account.currency)}/trade` },
    { label: `Max drawdown ≤ ${cfg.maxDdPct}% (your real-money limit)`, ok: dd <= Number(cfg.maxDdPct), detail: `${dd.toFixed(1)}%` },
    { label: `Risk ≤ ${cfg.maxRiskPct}% of the account on 90% of trades`, ok: withinRisk != null && withinRisk >= 0.9, na: withinRisk == null, detail: withinRisk == null ? 'enter the risk on trades' : `${Math.round(withinRisk * 100)}% of trades` },
    { label: 'Discipline: ≥ 80% of tagged trades on plan', ok: plan.onPlanPct != null && plan.onPlanPct >= 80, na: plan.tagged < 10, detail: plan.onPlanPct == null ? 'tag your trades' : `${Math.round(plan.onPlanPct)}% (${plan.tagged} tagged)` },
    { label: 'At least 2 of the last 3 months positive', ok: positiveMonths >= 2, na: lastMonths.length < 2, detail: lastMonths.length ? `${positiveMonths}/${lastMonths.length}` : '—' },
  ];
  const required = checks.filter((c) => !c.na);
  return { cfg, factor, real, pnl, returnPct: (pnl / real) * 100, dd, ddAmount, worstDay, costs, medianLot, checks, ready: required.length === checks.length && required.every((c) => c.ok) };
}

export default function BrokerSimCard({ account, trades }) {
  const editAccount = useTradingStore((s) => s.editAccount);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(null);
  const res = useMemo(() => brokerSimResults(account, trades), [account, trades]);
  const cur = account.brokerSim?.currency || account.currency || 'USD';
  const start = () => { setF({ ...DEFAULTS, currency: account.currency || 'USD', ...(account.brokerSim || {}) }); setEditing(true); };
  const save = (e) => {
    e.preventDefault();
    if (!(Number(f.realCapital) > 0)) return;
    editAccount(account.id, { brokerSim: { realCapital: Number(f.realCapital), currency: f.currency, extraCostPerLot: Number(f.extraCostPerLot) || 0, maxDdPct: Number(f.maxDdPct) || 10, maxRiskPct: Number(f.maxRiskPct) || 1 } });
    setEditing(false);
  };

  if (editing && f) {
    return (
      <Card title="Broker simulation">
        <form onSubmit={save} className="space-y-3">
          <p className="text-xs text-mute">Trade this demo as if it were your future real broker account: AUDAX converts every result to the capital you plan to put in, and tells you when the demo justifies going live.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Real capital you plan to deposit"><Input type="number" min="1" step="any" value={f.realCapital} onChange={(e) => setF((p) => ({ ...p, realCapital: e.target.value }))} autoFocus required /></Field>
            <Field label="Currency of the real account"><Select value={f.currency} onChange={(e) => setF((p) => ({ ...p, currency: e.target.value }))} options={CURRENCIES} /></Field>
            <Field label="Extra broker cost per lot (optional)" hint="If your real broker charges more than the demo (commission, wider spread) — per round-trip lot"><Input type="number" min="0" step="any" value={f.extraCostPerLot} onChange={(e) => setF((p) => ({ ...p, extraCostPerLot: e.target.value }))} /></Field>
            <Field label="Max drawdown you accept (%)"><Input type="number" min="1" step="0.5" value={f.maxDdPct} onChange={(e) => setF((p) => ({ ...p, maxDdPct: e.target.value }))} /></Field>
            <Field label="Max risk per trade (% of account)"><Input type="number" min="0.1" step="0.1" value={f.maxRiskPct} onChange={(e) => setF((p) => ({ ...p, maxRiskPct: e.target.value }))} /></Field>
          </div>
          {f.currency !== (account.currency || 'USD') && <p className="text-[11px] text-warn">The demo is in {account.currency || 'USD'}: amounts are scaled as-is, without exchange rate — compare in % and R.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            {account.brokerSim && <Button type="button" variant="secondary" onClick={() => { editAccount(account.id, { brokerSim: null }); setEditing(false); }}>Turn off</Button>}
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>
    );
  }

  if (!res) {
    return (
      <Card title="Broker simulation">
        <div className="flex items-start gap-3">
          <Landmark size={20} className="text-mute shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-mute mb-3">Planning to open a real broker account? Enter the capital you’d deposit: every result of this demo is converted to it (P&L, worst day, drawdown in money, lot size), with a go-live checklist for real money.</p>
            <Button variant="secondary" onClick={start}>Simulate my broker account</Button>
          </div>
        </div>
      </Card>
    );
  }

  const Icon = ({ c }) => (c.na ? <MinusCircle size={15} className="text-mute shrink-0" /> : c.ok ? <CheckCircle2 size={15} className="text-good shrink-0" /> : <XCircle size={15} className="text-bad shrink-0" />);
  return (
    <Card title={`Broker simulation — on ${fmtMoney(res.real, 0, cur)} of real capital`} action={<button onClick={start} className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1"><Pencil size={12} /> Settings</button>}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div><div className="text-[11px] text-mute">Net P&L</div><div className="text-lg font-bold" style={{ color: res.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(res.pnl, cur)}</div><div className="text-[11px] text-mute">{res.returnPct >= 0 ? '+' : ''}{res.returnPct.toFixed(2)}%</div></div>
        <div><div className="text-[11px] text-mute">Worst day</div><div className="text-lg font-bold text-bad">{fmtSignedMoney(res.worstDay, cur)}</div></div>
        <div><div className="text-[11px] text-mute">Max drawdown</div><div className="text-lg font-bold">{fmtMoney(res.ddAmount, 0, cur)}</div><div className="text-[11px] text-mute">{res.dd.toFixed(1)}%</div></div>
        <div><div className="text-[11px] text-mute">Typical size</div><div className="text-lg font-bold">{res.medianLot != null ? `${Math.round(res.medianLot * 100) / 100} lots` : '—'}</div><div className="text-[11px] text-mute">demo size × {res.factor.toFixed(2)}</div></div>
        <div><div className="text-[11px] text-mute">Extra broker costs</div><div className="text-lg font-bold">{res.costs ? fmtMoney(res.costs, 0, cur) : '—'}</div></div>
      </div>
      <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Ready for real money?</div>
      <ul className="space-y-1.5">
        {res.checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            <Icon c={c} /><span className="flex-1">{c.label}</span><span className="text-xs text-mute">{c.detail}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3 text-sm font-medium ${res.ready ? 'text-good' : 'text-warn'}`}>
        {res.ready ? 'Every check passes: this demo supports going live at this size — start small and keep the same rules.' : 'Not yet: keep trading this demo until every check is green (grey = not enough data yet).'}
      </div>
    </Card>
  );
}
