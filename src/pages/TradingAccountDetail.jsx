import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Pencil, Wallet, ArrowRight, Clock, Plus, Trash2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTradingStore } from '../store/tradingStore';
import { PROP_FIRM_PHASES } from '../utils/prop-firm-analytics';
import { computeDemoReadiness, computeBrokerHealth, computePropFirmTimeline } from '../utils/account-type-analytics';
import { fmtMoney, fmtSignedMoney, fmtPct } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Modal, Badge, ProgressBar, EmptyState } from '../components/common/ui';
import AccountFormModal from '../components/trading/AccountFormModal';

const TYPE_LABEL = { demo: 'Demo', broker: 'Broker', propfirm: 'Prop Firm' };
const STATUS_COLOR = {
  active: 'var(--accent-primary)', funded: 'var(--success)', passed: 'var(--success)',
  failed: 'var(--error)', archived: 'var(--text-secondary)',
};

function RuleGauge({ label, value, max, unit = '%', invert = false }) {
  if (max == null) return null;
  const pct = Math.min(100, (value / max) * 100);
  const danger = invert ? value < max * 0.3 : pct >= 100;
  const warn = invert ? value < max * 0.6 : pct >= 70;
  const color = danger ? 'var(--error)' : warn ? 'var(--warning)' : 'var(--success)';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-mute">{label}</span>
        <span style={{ color }}>{value}{unit} / {max}{unit}</span>
      </div>
      <ProgressBar value={pct} color={color} />
    </div>
  );
}

export default function TradingAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accounts, getStats, accountValue, getEquityCurve, getAccountTrades, getPropFirmProgress, advancePropFirmPhase, adjustAccountBalance, setActiveAccount, addPayout, deletePayout, getTotalPayouts, getAccountScore } = useTradingStore();
  const [editModal, setEditModal] = useState(false);
  const [balModal, setBalModal] = useState(false);
  const [balForm, setBalForm] = useState({ newBalance: '', reason: '' });
  const [payoutForm, setPayoutForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });

  const account = accounts.find((a) => a.id === id);
  if (!account) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState>Account not found. <Link to="/trading/accounts" className="text-accent">Back to accounts</Link></EmptyState>
      </div>
    );
  }

  const stats = getStats(account.id);
  const value = accountValue(account.id);
  const curve = getEquityCurve(account.id).map((p, i) => ({ i, value: p.value }));
  const progress = account.type === 'propfirm' ? getPropFirmProgress(account.id) : null;
  const phaseIdx = account.type === 'propfirm' ? PROP_FIRM_PHASES.findIndex((p) => p.value === account.phase) : -1;
  const isLastPhase = phaseIdx === PROP_FIRM_PHASES.length - 1;
  const timeline = account.type === 'propfirm' ? computePropFirmTimeline(account) : null;
  const totalPayouts = account.type === 'propfirm' ? getTotalPayouts(account.id) : 0;
  const demoReadiness = account.type === 'demo' ? computeDemoReadiness(getAccountTrades(account.id), account.initialBalance) : null;
  const brokerHealth = account.type === 'broker' ? computeBrokerHealth(account, getAccountTrades(account.id)) : null;
  const score = getAccountScore(account.id);
  const currency = account.currency || 'USD';

  const goTrade = () => { setActiveAccount(account.id); navigate('/trading'); };
  const submitPayout = (e) => {
    e.preventDefault();
    if (!Number(payoutForm.amount)) return;
    addPayout(account.id, payoutForm);
    setPayoutForm({ amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color={STATUS_COLOR[account.status]}>{TYPE_LABEL[account.type]}</Badge>
            <span className="text-xs capitalize" style={{ color: STATUS_COLOR[account.status] }}>{account.status}</span>
            <span className="text-xs text-mute">· {currency}</span>
          </div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          {account.broker && <p className="text-mute text-sm mt-1">{account.broker}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditModal(true)}><span className="flex items-center gap-2"><Pencil size={14} /> Edit</span></Button>
          <Button onClick={goTrade}><span className="flex items-center gap-2">Trade this account <ArrowRight size={14} /></span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-mute mb-1">Value</div>
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => { setBalForm({ newBalance: String(account.initialBalance), reason: '' }); setBalModal(true); }} title="Adjust balance">
              <Wallet size={13} />
            </button>
          </div>
          <div className="text-2xl font-bold">{fmtMoney(value, 0, currency)}</div>
          <div className="text-xs text-mute mt-1">Start: {fmtMoney(account.initialBalance, 0, currency)}</div>
        </div>
        <Stat label="Total P&L" value={fmtSignedMoney(stats.totalPnl, currency)} color={stats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Win rate" value={stats.count ? fmtPct(stats.winRate) : '—'} sub={`${stats.wins}W / ${stats.losses}L`} />
        <Stat label="Trades" value={stats.count} />
      </div>

      {!score.insufficientData && (
        <Card title="Account Score">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold" style={{ color: score.band.color }}>{score.score}</div>
            <Badge color={score.band.color}>{score.band.label}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div><div className="text-xs text-mute mb-1">Profitability</div><div className="text-sm font-semibold">{score.breakdown.profitability}/30</div></div>
            <div><div className="text-xs text-mute mb-1">Risk control</div><div className="text-sm font-semibold">{score.breakdown.riskControl}/25</div></div>
            <div><div className="text-xs text-mute mb-1">Discipline</div><div className="text-sm font-semibold">{score.breakdown.discipline}/25</div></div>
            <div><div className="text-xs text-mute mb-1">Consistency</div><div className="text-sm font-semibold">{score.breakdown.consistency}/20</div></div>
          </div>
        </Card>
      )}

      {demoReadiness && (
        <Card title="Readiness to Go Live">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold" style={{ color: demoReadiness.band.color }}>{demoReadiness.score}</div>
            <Badge color={demoReadiness.band.color}>{demoReadiness.band.label}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
            <div><div className="text-xs text-mute mb-1">Sample size</div><div className="text-sm font-semibold">{demoReadiness.breakdown.sample}/25</div></div>
            <div><div className="text-xs text-mute mb-1">Expectancy</div><div className="text-sm font-semibold">{demoReadiness.breakdown.expectancy}/25</div></div>
            <div><div className="text-xs text-mute mb-1">Profit factor</div><div className="text-sm font-semibold">{demoReadiness.breakdown.profitFactor}/25</div></div>
            <div><div className="text-xs text-mute mb-1">Drawdown control</div><div className="text-sm font-semibold">{demoReadiness.breakdown.drawdown}/25</div></div>
          </div>
          {demoReadiness.gaps.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-mute">
              {demoReadiness.gaps.map((g, i) => <li key={i}>· {g}</li>)}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-good"><CheckCircle2 size={15} /> This strategy meets the readiness bar — consider opening a broker or prop firm account.</div>
          )}
        </Card>
      )}

      {brokerHealth && (
        <Card title="Capital Preservation">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
            <div><div className="text-xs text-mute mb-1">ROI</div><div className="text-lg font-semibold" style={{ color: brokerHealth.roiPct >= 0 ? 'var(--success)' : 'var(--error)' }}>{brokerHealth.roiPct}%</div></div>
            <div><div className="text-xs text-mute mb-1">Max drawdown</div><div className="text-lg font-semibold" style={{ color: brokerHealth.maxDrawdownPct > 15 ? 'var(--error)' : 'var(--text-primary)' }}>{brokerHealth.maxDrawdownPct}%</div></div>
            <div><div className="text-xs text-mute mb-1">Annualized</div><div className="text-lg font-semibold">{brokerHealth.annualizedPct != null ? `${brokerHealth.annualizedPct}%` : '—'}</div></div>
          </div>
        </Card>
      )}

      {account.type === 'propfirm' && timeline && (
        <div className={`flex items-center gap-2 text-sm border rounded-lg px-4 py-3 ${timeline.overdue ? 'border-bad/50 bg-bad/10 text-bad' : timeline.daysRemaining <= 3 ? 'border-warn/50 bg-warn/10 text-warn' : 'border-line bg-card'}`}>
          <Clock size={15} className="shrink-0" />
          {timeline.overdue
            ? `Phase deadline passed (${timeline.deadline}) — ${Math.abs(timeline.daysRemaining)} day(s) overdue.`
            : `${timeline.daysRemaining} day(s) left in this phase — deadline ${timeline.deadline}.`}
        </div>
      )}

      {account.type === 'propfirm' && account.status === 'funded' && (
        <Card title="Payouts" action={<Badge color="var(--success)">Total: {fmtMoney(totalPayouts, 0, currency)}</Badge>}>
          <form onSubmit={submitPayout} className="flex flex-wrap gap-2 items-end mb-4">
            <Field label={`Amount (${currency})`}>
              <Input type="number" step="any" value={payoutForm.amount} onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })} className="w-32" />
            </Field>
            <Field label="Date">
              <Input type="date" value={payoutForm.date} onChange={(e) => setPayoutForm({ ...payoutForm, date: e.target.value })} />
            </Field>
            <Field label="Notes (optional)">
              <Input value={payoutForm.notes} onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })} placeholder="e.g. 1st payout" />
            </Field>
            <Button type="submit"><span className="flex items-center gap-2"><Plus size={14} /> Log payout</span></Button>
          </form>
          {account.payouts?.length ? (
            <ul className="space-y-1.5">
              {[...account.payouts].reverse().map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                  <span>{p.date} {p.notes && <span className="text-mute">· {p.notes}</span>}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-good">{fmtMoney(p.amount, 0, currency)}</span>
                    <button onClick={() => deletePayout(account.id, p.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No payouts logged yet.</EmptyState>
          )}
        </Card>
      )}

      {account.type === 'propfirm' && progress && (
        <Card
          title={`Phase: ${PROP_FIRM_PHASES.find((p) => p.value === account.phase)?.label || account.phase}`}
          action={
            account.status !== 'failed' && account.status !== 'archived' && !isLastPhase ? (
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => { if (confirm('Mark this phase as failed?')) advancePropFirmPhase(account.id, 'failed'); }}>Mark failed</Button>
                <Button
                  className="!px-3 !py-1.5 text-xs"
                  disabled={!progress.readyToAdvance}
                  title={progress.readyToAdvance ? '' : 'Profit target, min days, and no rule breach required'}
                  onClick={() => advancePropFirmPhase(account.id, 'advance')}
                >
                  Advance to {PROP_FIRM_PHASES[phaseIdx + 1]?.label}
                </Button>
              </div>
            ) : account.status === 'funded' ? (
              <Badge color="var(--success)">Funded</Badge>
            ) : null
          }
        >
          <div className="space-y-3 mb-4">
            {progress.rules.maxDailyLossPct != null && <RuleGauge label="Today's loss" value={progress.dailyLossPct} max={progress.rules.maxDailyLossPct} />}
            {progress.rules.maxTotalDrawdownPct != null && <RuleGauge label="Max drawdown (this phase)" value={progress.maxDrawdownPct} max={progress.rules.maxTotalDrawdownPct} />}
            {progress.rules.profitTargetPct != null && <RuleGauge label="Profit toward target" value={Math.max(0, progress.profitPct)} max={progress.rules.profitTargetPct} invert />}
            {progress.rules.minTradingDays != null && <RuleGauge label="Trading days" value={progress.tradingDays} max={progress.rules.minTradingDays} unit="" invert />}
            {progress.rules.consistencyRulePct != null && <RuleGauge label="Consistency (best day / total profit)" value={progress.consistencyPct} max={progress.rules.consistencyRulePct} />}
          </div>
          {progress.breaches.length > 0 ? (
            <div className="space-y-2">
              {progress.breaches.map((b, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 ${b.level === 'danger' ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`}>
                  <AlertTriangle size={14} /> {b.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-good">
              <CheckCircle2 size={15} /> All rules currently respected.
            </div>
          )}

          {account.phaseHistory?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Phase History</div>
              <ul className="space-y-1.5 text-sm">
                {account.phaseHistory.map((h, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>{PROP_FIRM_PHASES.find((p) => p.value === h.phase)?.label || h.phase}</span>
                    <span className={h.outcome === 'passed' ? 'text-good' : 'text-bad'}>
                      {h.outcome === 'passed' ? 'Passed' : 'Failed'} · {h.snapshot.profitPct}% · {h.snapshot.tradingDays}d
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card title="Equity Curve">
        {curve.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="acctEqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="i" hide />
              <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={(v) => fmtMoney(v, 0, currency)} width={54} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v, 0, currency)} labelFormatter={() => ''} />
              <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#acctEqFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log trades on this account to see its equity curve.</EmptyState>
        )}
      </Card>

      <AccountFormModal open={editModal} onClose={() => setEditModal(false)} account={account} />

      <Modal open={balModal} onClose={() => setBalModal(false)} title={`Adjust ${account.name} balance`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(balForm.newBalance)) return;
            adjustAccountBalance(account.id, balForm.newBalance, balForm.reason);
            setBalModal(false);
          }}
        >
          <div className="text-sm text-mute">
            Current start: <span className="text-ink font-medium">{fmtMoney(account.initialBalance, 0, currency)}</span> · trades P&amp;L: <span className="text-ink">{fmtSignedMoney(value - account.initialBalance, currency)}</span>
          </div>
          <div className="text-xs text-mute">Changing the starting balance recalculates account value, ROI, and drawdown. Trades are not modified.</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`New starting balance (${currency})`}>
              <Input type="number" step="any" value={balForm.newBalance} onChange={(e) => setBalForm({ ...balForm, newBalance: e.target.value })} autoFocus />
            </Field>
            <Field label="Reason">
              <Input value={balForm.reason} onChange={(e) => setBalForm({ ...balForm, reason: e.target.value })} placeholder="Deposit, withdrawal, fees…" />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setBalModal(false)}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
