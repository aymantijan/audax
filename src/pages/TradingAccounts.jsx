import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Archive, Trash2, ChevronRight } from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';
import { fmtMoney, fmtPct } from '../utils/formatters';
import { Card, Stat, Button, Badge, EmptyState } from '../components/common/ui';
import AccountFormModal from '../components/trading/AccountFormModal';

const TYPE_LABEL = { demo: 'Demo', broker: 'Broker', propfirm: 'Prop Firm' };
const TYPE_ORDER = ['demo', 'broker', 'propfirm'];
const STATUS_COLOR = {
  active: 'var(--accent-primary)', funded: 'var(--success)', passed: 'var(--success)',
  failed: 'var(--error)', archived: 'var(--text-secondary)',
};

export default function TradingAccounts() {
  const { accounts, activeAccountId, setActiveAccount, archiveAccount, deleteAccount, accountValue, getStats, getTypeScore, getAccountScore } = useTradingStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const active = accounts.filter((a) => a.status !== 'archived');
  const archived = accounts.filter((a) => a.status === 'archived');

  const remove = (a) => {
    if (!confirm(`Delete "${a.name}"? Only possible if it has no trades.`)) return;
    const res = deleteAccount(a.id);
    if (!res.ok) alert(res.error);
  };

  const Row = ({ a }) => {
    const stats = getStats(a.id);
    const score = getAccountScore(a.id);
    return (
      <li className="border border-line rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <Badge color={STATUS_COLOR[a.status]}>{TYPE_LABEL[a.type]}</Badge>
          <Link to={`/trading/account/${a.id}`} className="font-medium hover:text-accent flex items-center gap-1">
            {a.name} <ChevronRight size={14} />
          </Link>
          {a.type === 'propfirm' && a.phase && <span className="text-xs text-mute">· {a.phase}</span>}
          <span className="text-xs capitalize" style={{ color: STATUS_COLOR[a.status] }}>{a.status}</span>
          <div className="ml-auto flex items-center gap-2">
            {a.id !== activeAccountId && a.status !== 'archived' && (
              <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setActiveAccount(a.id)}>Set active</Button>
            )}
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditing(a)}><Pencil size={14} /></button>
            {a.status !== 'archived' && (
              <button className="text-mute hover:text-warn cursor-pointer" onClick={() => archiveAccount(a.id)} title="Archive">
                <Archive size={14} />
              </button>
            )}
            <button className="text-mute hover:text-bad cursor-pointer" onClick={() => remove(a)} title="Delete"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div><div className="text-xs text-mute">Value</div><div className="font-semibold">{fmtMoney(accountValue(a.id))}</div></div>
          <div><div className="text-xs text-mute">Start</div><div>{fmtMoney(a.initialBalance)}</div></div>
          <div><div className="text-xs text-mute">Trades</div><div>{stats.count}</div></div>
          <div><div className="text-xs text-mute">Win rate</div><div>{stats.count ? fmtPct(stats.winRate) : '—'}</div></div>
          <div><div className="text-xs text-mute">Score</div><div className="font-semibold" style={{ color: score.band?.color }}>{score.score ?? '—'}</div></div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading Accounts</h1>
          <p className="text-mute text-sm mt-1">Manage your demo, broker, and prop firm accounts.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModal(true); }}>
          <span className="flex items-center gap-2"><Plus size={16} /> New account</span>
        </Button>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TYPE_ORDER.map((type) => {
            const group = active.filter((a) => a.type === type);
            if (!group.length) return null;
            const totalValue = group.reduce((a, acc) => a + accountValue(acc.id), 0);
            const typeScore = getTypeScore(type);
            const sub = [
              type === 'propfirm' ? `${group.filter((a) => a.status === 'funded').length} funded` : null,
              typeScore ? `Score ${typeScore.score}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <Stat
                key={type}
                label={`${TYPE_LABEL[type]} (${group.length})`}
                value={fmtMoney(totalValue)}
                sub={sub || undefined}
              />
            );
          })}
        </div>
      )}

      <Card title={`Active accounts (${active.length})`}>
        {active.length ? <ul className="space-y-3">{active.map((a) => <Row key={a.id} a={a} />)}</ul> : <EmptyState>No accounts yet.</EmptyState>}
      </Card>

      {archived.length > 0 && (
        <Card title={`Archived (${archived.length})`}>
          <ul className="space-y-3">{archived.map((a) => <Row key={a.id} a={a} />)}</ul>
        </Card>
      )}

      <AccountFormModal open={modal || !!editing} onClose={() => { setModal(false); setEditing(null); }} account={editing} />
    </div>
  );
}
