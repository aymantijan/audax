import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useTradingStore } from '../../store/tradingStore';
import { equityCurve, maxDrawdown } from '../../utils/calculations';
import { tradeRMultiple } from '../../utils/risk-management';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtDateShort } from '../../utils/formatters';
import { Card, EmptyState } from '../common/ui';

const fmtR = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${(Math.round(r * 100) / 100).toFixed(2)}R`);
const TYPE_LABEL = { demo: 'Demo', broker: 'Broker', propfirm: 'Prop Firm' };
const COLORS = ['#00d9ff', '#a78bfa', '#f59e0b', '#10b981', '#f472b6', '#60a5fa'];

function statsOf(trades, initial) {
  const pnl = trades.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const rs = trades.map(tradeRMultiple).filter((r) => r != null);
  return {
    count: trades.length, pnl,
    winRate: trades.length ? (trades.filter((t) => t.pnl > 0).length / trades.length) * 100 : null,
    expR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    returnPct: initial > 0 ? (pnl / initial) * 100 : null,
    maxDd: initial > 0 ? maxDrawdown(equityCurve(trades, initial)) : null,
  };
}

/**
 * Side-by-side accounts of the analytics scope: per account, subtotal per
 * type (Demo / Prop Firm / Broker), and cumulative P&L curves. Return % and
 * drawdown are relative to each account's own starting balance, so a $10k
 * demo and a $100k prop account compare fairly.
 */
export default function AccountsCompare({ accounts, currency }) {
  const allTrades = useTradingStore((s) => s.trades);
  const getAccountScore = useTradingStore((s) => s.getAccountScore);
  const rows = useMemo(() => accounts.map((a) => {
    const ts = allTrades.filter((t) => t.accountId === a.id);
    return { a, ts, s: statsOf(ts, a.initialBalance || 0), score: getAccountScore(a.id)?.score ?? null };
  }), [accounts, allTrades, getAccountScore]);
  const types = [...new Set(accounts.map((a) => a.type))];
  const typeRows = types.map((type) => {
    const rs = rows.filter((r) => r.a.type === type);
    const ts = rs.flatMap((r) => r.ts);
    const initial = rs.reduce((sum, r) => sum + (r.a.initialBalance || 0), 0);
    return { type, n: rs.length, s: statsOf(ts, initial) };
  });

  // Cumulative P&L per account on a shared date axis (max 6 lines).
  const chart = useMemo(() => {
    const shown = rows.filter((r) => r.ts.length).sort((x, y) => y.ts.length - x.ts.length).slice(0, 6);
    const days = [...new Set(shown.flatMap((r) => r.ts.map((t) => t.date)))].sort();
    const cum = Object.fromEntries(shown.map((r) => [r.a.id, 0]));
    const data = days.map((d) => {
      const point = { date: fmtDateShort(d) };
      for (const r of shown) { cum[r.a.id] += r.ts.filter((t) => t.date === d).reduce((a, t) => a + t.pnl, 0); point[r.a.name] = Math.round(cum[r.a.id] * 100) / 100; }
      return point;
    });
    return { data, lines: shown.map((r) => r.a.name) };
  }, [rows]);

  if (!accounts.length) return <Card title="Accounts compared"><EmptyState>No account in this scope.</EmptyState></Card>;
  const Cells = ({ s, cur = currency }) => (
    <>
      <td className="py-2 pr-3 text-right tabular-nums">{s.count}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{s.winRate == null ? '—' : fmtPct(s.winRate)}</td>
      <td className="py-2 pr-3 text-right tabular-nums" style={{ color: s.expR == null ? undefined : s.expR >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtR(s.expR)}</td>
      <td className="py-2 pr-3 text-right tabular-nums font-medium" style={{ color: s.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(s.pnl, cur)}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{s.returnPct == null ? '—' : `${s.returnPct >= 0 ? '+' : ''}${s.returnPct.toFixed(2)}%`}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{s.maxDd == null ? '—' : `${s.maxDd.toFixed(1)}%`}</td>
    </>
  );
  return (
    <Card title="Accounts compared">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-mute border-b border-line">
              <th className="py-2 pr-3">Account</th><th className="py-2 pr-3 text-right">Trades</th><th className="py-2 pr-3 text-right">Win rate</th>
              <th className="py-2 pr-3 text-right">Expectancy</th><th className="py-2 pr-3 text-right">Net P&L</th><th className="py-2 pr-3 text-right">Return</th>
              <th className="py-2 pr-3 text-right">Max DD</th><th className="py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, s, score }) => (
              <tr key={a.id} className="border-b border-line/50">
                <td className="py-2 pr-3">
                  <div className="font-medium">{a.name}{a.status === 'archived' ? <span className="text-[10px] text-mute"> · archived</span> : null}</div>
                  <div className="text-[11px] text-mute">{TYPE_LABEL[a.type]} · {fmtMoney(a.initialBalance || 0, 0, a.currency || currency)}{a.simEnabled ? ' · prop sim' : ''}</div>
                </td>
                <Cells s={s} cur={a.currency || currency} />
                <td className="py-2 text-right tabular-nums">{score ?? '—'}</td>
              </tr>
            ))}
            {types.length > 1 && typeRows.map(({ type, n, s }) => (
              <tr key={type} className="border-b border-line/50 bg-surface/60">
                <td className="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-mute">All {TYPE_LABEL[type]} ({n})</td>
                <Cells s={s} />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-mute mt-2">Return and max drawdown are measured against each account’s own starting balance (for a type: the sum of its accounts’), so small and large accounts compare fairly. R ignores account size entirely.</p>
      {chart.lines.length > 0 && chart.data.length > 1 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-mute mb-2">Cumulative P&L</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chart.data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtSignedMoney(v, currency)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {chart.lines.map((name, i) => <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
