import { useCallback, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Cell,
} from 'recharts';
import { startOfMonth } from 'date-fns';
import { useTradingStore } from '../store/tradingStore';
import { useAuthStore } from '../store/authStore';
import { tradeStats, equityCurve, currentAccountValue, maxDrawdown } from '../utils/calculations';
import { INSTRUMENTS, STRATEGIES } from '../utils/constants';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtDateShort } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, EmptyState } from '../components/common/ui';
import AccountSwitcher from '../components/common/AccountSwitcher';
import TradeForm from '../components/trading/TradeForm';
import PreTradingChecklist from '../components/trading/PreTradingChecklist';
import BurnRateTracker from '../components/trading/BurnRateTracker';
import AdvancedAnalytics from '../components/trading/AdvancedAnalytics';

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-secondary)' },
};

export default function Trading() {
  // Subscribe to the whole store so any trade change (add/edit/delete) re-renders.
  const tradingStore = useTradingStore();
  const { deleteTrade } = tradingStore;
  const user = useAuthStore((s) => s.user);
  const adjustAccountBalance = useAuthStore((s) => s.adjustAccountBalance);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [clearToTrade, setClearToTrade] = useState(false);
  const [filterInstrument, setFilterInstrument] = useState('all');
  const [filterStrategy, setFilterStrategy] = useState('all');
  const [balModal, setBalModal] = useState(false);
  const [balForm, setBalForm] = useState({ newBalance: '', reason: '' });

  const onStatus = useCallback((v) => setClearToTrade(v), []);

  // Everything on this page is scoped to the active account — via centralized selectors.
  const activeAccount = user?.activeAccount || 'demo';
  const initialBalance = tradingStore.getInitialBalance(activeAccount);
  const trades = tradingStore.getAccountTrades(activeAccount);
  const stats = tradingStore.getStats(activeAccount);
  const monthStats = tradingStore.getMonthStats(activeAccount);
  const account = tradingStore.accountValue(activeAccount);
  const curve = tradingStore.getEquityCurve(activeAccount);
  const maxDd = tradingStore.getMonthMaxDrawdown(activeAccount);

  const byStrategy = useMemo(
    () => STRATEGIES.map((s) => ({ name: s, pnl: trades.filter((t) => t.strategy === s).reduce((a, t) => a + t.pnl, 0) })),
    [trades]
  );
  const byInstrument = useMemo(
    () => INSTRUMENTS.map((i) => ({ name: i, pnl: trades.filter((t) => t.instrument === i).reduce((a, t) => a + t.pnl, 0) })).filter((d) => d.pnl !== 0),
    [trades]
  );

  const filtered = useMemo(
    () =>
      [...trades]
        .filter((t) => filterInstrument === 'all' || t.instrument === filterInstrument)
        .filter((t) => filterStrategy === 'all' || t.strategy === filterStrategy)
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [trades, filterInstrument, filterStrategy]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading</h1>
          <p className="text-mute text-sm mt-1">P&L tracking and edge validation — in USD.</p>
        </div>
        <div className="flex items-center gap-3">
          <AccountSwitcher />
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!clearToTrade} title={clearToTrade ? '' : 'Complete the pre-trading checklist first'}>
            <span className="flex items-center gap-2"><Plus size={16} /> Log Trade</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-line rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-mute mb-1">Account value</div>
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => { setBalForm({ newBalance: String(initialBalance), reason: '' }); setBalModal(true); }} title="Edit starting balance">
              <Wallet size={13} />
            </button>
          </div>
          <div className="text-2xl font-bold">{fmtMoney(account)}</div>
          <div className="text-xs text-mute mt-1">Start: {fmtMoney(initialBalance)}</div>
        </div>
        <Stat label="Total P&L" value={fmtSignedMoney(stats.totalPnl)} color={stats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Month P&L" value={fmtSignedMoney(monthStats.totalPnl)} color={monthStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Win rate" value={stats.count ? fmtPct(stats.winRate) : '—'} sub={`${stats.wins}W / ${stats.losses}L`} />
        <Stat label="Expectancy" value={stats.count ? `${stats.expectancyPips.toFixed(1)} pips` : '—'} sub={stats.count ? fmtSignedMoney(stats.expectancyUsd) + ' / trade' : ''} />
        <Stat label="Max DD (month)" value={fmtPct(maxDd, 1)} color={maxDd > 10 ? 'var(--error)' : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <PreTradingChecklist onStatus={onStatus} />
        <BurnRateTracker trades={trades} accountValue={account} />
        <Card title="Strategy P&L">
          {trades.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byStrategy}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtSignedMoney(v)} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {byStrategy.map((d) => (
                    <Cell key={d.name} fill={d.pnl >= 0 ? '#00d97f' : '#ff6b6b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No trades yet.</EmptyState>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Equity Curve">
          {trades.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={curve.map((p, i) => ({ ...p, idx: i, label: p.date ? fmtDateShort(p.date) : 'Start' }))}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtMoney(v)} />
                <Line type="monotone" dataKey="value" stroke="#00d9ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>Log your first trade to see the curve.</EmptyState>
          )}
        </Card>
        <Card title="Instrument P&L">
          {byInstrument.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byInstrument}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtSignedMoney(v)} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {byInstrument.map((d) => (
                    <Cell key={d.name} fill={d.pnl >= 0 ? '#00d97f' : '#ff6b6b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No instrument data yet.</EmptyState>
          )}
        </Card>
      </div>

      <AdvancedAnalytics trades={trades} />

      <Card
        title={`Trade Log (${filtered.length})`}
        action={
          <div className="flex gap-2">
            <Select value={filterInstrument} onChange={(e) => setFilterInstrument(e.target.value)} options={[{ value: 'all', label: 'All instruments' }, ...INSTRUMENTS.map((i) => ({ value: i, label: i }))]} />
            <Select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} options={[{ value: 'all', label: 'All strategies' }, ...STRATEGIES.map((s) => ({ value: s, label: s }))]} />
          </div>
        }
      >
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Instrument</th>
                  <th className="py-2 pr-4">Strategy</th>
                  <th className="py-2 pr-4">Dir</th>
                  <th className="py-2 pr-4 text-right">Pips</th>
                  <th className="py-2 pr-4 text-right">P&L</th>
                  <th className="py-2 pr-4">Emotion</th>
                  <th className="py-2 pr-4">Journal</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-line/50 hover:bg-surface/50">
                    <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateShort(t.date)}</td>
                    <td className="py-2.5 pr-4">{t.instrument}</td>
                    <td className="py-2.5 pr-4">{t.strategy}</td>
                    <td className="py-2.5 pr-4 capitalize">{t.direction}</td>
                    <td className="py-2.5 pr-4 text-right">{t.pnlPips}</td>
                    <td className="py-2.5 pr-4 text-right font-medium" style={{ color: t.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {fmtSignedMoney(t.pnl)}
                    </td>
                    <td className="py-2.5 pr-4 capitalize text-mute">{t.journal?.emotion}</td>
                    <td className="py-2.5 pr-4">{t.journal?.reasoning ? '✓' : <span className="text-warn">—</span>}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => { setEditing(t); setFormOpen(true); }}>
                        <Pencil size={14} />
                      </button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this trade? Linked XP will be reversed.')) deleteTrade(t.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No trades match. Log your first trade above.</EmptyState>
        )}
      </Card>

      <TradeForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />

      <Modal open={balModal} onClose={() => setBalModal(false)} title={`Edit ${activeAccount} account balance`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(balForm.newBalance)) return;
            adjustAccountBalance(activeAccount, balForm.newBalance, balForm.reason);
            setBalModal(false);
          }}
        >
          <div className="text-sm text-mute">
            Current start: <span className="text-ink font-medium">{fmtMoney(initialBalance)}</span> · trades P&amp;L: <span className="text-ink">{fmtSignedMoney(account - initialBalance)}</span>
          </div>
          <div className="text-xs text-mute">Changing the starting balance recalculates account value, ROI, and max drawdown. Trades are not modified.</div>
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
