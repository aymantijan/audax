import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Pencil, Wallet, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTradingStore } from '../store/tradingStore';
import { PROP_FIRM_PHASES } from '../utils/prop-firm-analytics';
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
  const { accounts, getStats, accountValue, getEquityCurve, getPropFirmProgress, advancePropFirmPhase, adjustAccountBalance, setActiveAccount } = useTradingStore();
  const [editModal, setEditModal] = useState(false);
  const [balModal, setBalModal] = useState(false);
  const [balForm, setBalForm] = useState({ newBalance: '', reason: '' });

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

  const goTrade = () => { setActiveAccount(account.id); navigate('/trading'); };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge color={STATUS_COLOR[account.status]}>{TYPE_LABEL[account.type]}</Badge>
            <span className="text-xs capitalize" style={{ color: STATUS_COLOR[account.status] }}>{account.status}</span>
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
          <div className="text-2xl font-bold">{fmtMoney(value)}</div>
          <div className="text-xs text-mute mt-1">Start: {fmtMoney(account.initialBalance)}</div>
        </div>
        <Stat label="Total P&L" value={fmtSignedMoney(stats.totalPnl)} color={stats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Win rate" value={stats.count ? fmtPct(stats.winRate) : '—'} sub={`${stats.wins}W / ${stats.losses}L`} />
        <Stat label="Trades" value={stats.count} />
      </div>

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
              <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} width={54} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v)} labelFormatter={() => ''} />
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
            Current start: <span className="text-ink font-medium">{fmtMoney(account.initialBalance)}</span> · trades P&amp;L: <span className="text-ink">{fmtSignedMoney(value - account.initialBalance)}</span>
          </div>
          <div className="text-xs text-mute">Changing the starting balance recalculates account value, ROI, and drawdown. Trades are not modified.</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New starting balance ($)">
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
