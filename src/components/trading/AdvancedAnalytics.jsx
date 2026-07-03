import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import {
  sharpeRatio, sortinoRatio, calmarRatio, recoveryFactor, streaks, byDayOfWeek,
  strategyComparison, instrumentCorrelation, concentration, macroEdge,
} from '../../utils/analytics';
import { STRATEGIES, INSTRUMENTS, MACRO_FIELDS } from '../../utils/constants';
import { fmtSignedMoney, fmtPct } from '../../utils/formatters';
import { Card, Stat, EmptyState } from '../common/ui';

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
};

const fmtRatio = (v) => (v === null ? '—' : v === Infinity ? '∞' : v.toFixed(2));

export default function AdvancedAnalytics({ trades }) {
  const sharpe = useMemo(() => sharpeRatio(trades), [trades]);
  const sortino = useMemo(() => sortinoRatio(trades), [trades]);
  const calmar = useMemo(() => calmarRatio(trades), [trades]);
  const recovery = useMemo(() => recoveryFactor(trades), [trades]);
  const { maxWinStreak, maxLossStreak } = useMemo(() => streaks(trades), [trades]);
  const conc = useMemo(() => concentration(trades), [trades]);
  const dow = useMemo(() => byDayOfWeek(trades), [trades]);
  const strat = useMemo(() => strategyComparison(trades, STRATEGIES).filter((s) => s.count > 0), [trades]);
  const corr = useMemo(() => instrumentCorrelation(trades, INSTRUMENTS), [trades]);
  const macroRows = useMemo(
    () =>
      MACRO_FIELDS.map((mf) => ({ field: mf, rows: macroEdge(trades, mf.key) })).filter((m) => m.rows.length > 0),
    [trades]
  );

  if (!trades.length) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Sharpe (ann.)" value={fmtRatio(sharpe)} sub={sharpe === null ? 'needs 5+ active days' : ''} />
        <Stat label="Sortino (ann.)" value={fmtRatio(sortino)} />
        <Stat label="Calmar" value={fmtRatio(calmar)} />
        <Stat label="Recovery factor" value={fmtRatio(recovery)} sub="profit / max DD" />
        <Stat label="Streaks" value={`${maxWinStreak}W / ${maxLossStreak}L`} sub="max consecutive" />
        <Stat label="Top-3 concentration" value={conc === null ? '—' : fmtPct(conc)} sub="of gross wins" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Strategy Comparison">
          {strat.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-3">Strategy</th>
                  <th className="py-2 pr-3 text-right">Trades</th>
                  <th className="py-2 pr-3 text-right">Win rate</th>
                  <th className="py-2 pr-3 text-right">Avg win</th>
                  <th className="py-2 pr-3 text-right">Avg loss</th>
                  <th className="py-2 pr-3 text-right">Expectancy</th>
                  <th className="py-2 text-right">Total P&L</th>
                </tr>
              </thead>
              <tbody>
                {strat.map((s) => (
                  <tr key={s.strategy} className="border-b border-line/50">
                    <td className="py-2 pr-3">{s.strategy}</td>
                    <td className="py-2 pr-3 text-right">{s.count}</td>
                    <td className="py-2 pr-3 text-right">{fmtPct(s.winRate)}</td>
                    <td className="py-2 pr-3 text-right text-good">{fmtSignedMoney(s.avgWin)}</td>
                    <td className="py-2 pr-3 text-right text-bad">{fmtSignedMoney(s.avgLoss)}</td>
                    <td className="py-2 pr-3 text-right">{fmtSignedMoney(s.expectancy)}</td>
                    <td className="py-2 text-right font-medium" style={{ color: s.totalPnl >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {fmtSignedMoney(s.totalPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState>No strategy data yet.</EmptyState>
          )}
        </Card>

        <Card title="Win Rate by Day of Week">
          {dow.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dow}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v, name) => (name === 'winRate' ? fmtPct(v) : v)} />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                  {dow.map((d) => (
                    <Cell key={d.key} fill={d.winRate >= 50 ? '#00d97f' : '#ff6b6b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No data.</EmptyState>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Instrument Correlation (daily P&L)">
          {corr.instruments.length >= 2 ? (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th />
                  {corr.instruments.map((i) => (
                    <th key={i} className="py-1.5 px-2 text-mute font-medium">{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corr.instruments.map((a) => (
                  <tr key={a}>
                    <td className="py-1.5 px-2 text-mute font-medium">{a}</td>
                    {corr.instruments.map((b) => {
                      const v = corr.matrix[a][b];
                      const bg =
                        v === null ? 'transparent'
                        : v > 0 ? `rgba(0, 217, 127, ${Math.abs(v) * 0.35})`
                        : `rgba(255, 107, 107, ${Math.abs(v) * 0.35})`;
                      return (
                        <td key={b} className="py-1.5 px-2 text-center rounded" style={{ background: bg }}>
                          {v === null ? '·' : v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState>Trade at least 2 instruments on overlapping days to see correlations.</EmptyState>
          )}
          <p className="text-[11px] text-mute mt-3">· = fewer than 3 shared trading days for this pair.</p>
        </Card>

        <Card title="Macro Regime Edge">
          {macroRows.length ? (
            <div className="space-y-4">
              {macroRows.map(({ field, rows }) => (
                <div key={field.key}>
                  <div className="text-xs text-mute uppercase tracking-wide mb-1.5">{field.label}</div>
                  <div className="space-y-1">
                    {rows.map((r) => (
                      <div key={r.key} className="flex items-center gap-3 text-sm">
                        <span className="w-24 capitalize">{r.key}</span>
                        <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden">
                          <div className="h-full" style={{ width: `${r.winRate}%`, background: r.winRate >= 50 ? 'var(--success)' : 'var(--error)' }} />
                        </div>
                        <span className="w-32 text-right text-xs text-mute">
                          {fmtPct(r.winRate)} · {r.count} trades · {fmtSignedMoney(r.pnl)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Tag trades with macro context (in the trade form) to see which regimes your edge depends on.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
