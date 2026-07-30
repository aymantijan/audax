import { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { processQualityCorrelation, exitReasonBreakdown, lessonsFeed, journalingConsistencyTrend } from '../../utils/journal-analysis';
import { fmtSignedMoney, fmtPct, fmtDateShort } from '../../utils/formatters';
import { Card, Select, EmptyState } from '../common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function JournalAnalysis({ trades }) {
  const [lessonFilter, setLessonFilter] = useState('all');

  const qualityCorr = useMemo(() => processQualityCorrelation(trades), [trades]);
  const exitBreakdown = useMemo(() => exitReasonBreakdown(trades), [trades]);
  const lessons = useMemo(() => lessonsFeed(trades), [trades]);
  const consistency = useMemo(() => journalingConsistencyTrend(trades), [trades]);

  const filteredLessons = lessons.filter((l) => lessonFilter === 'all' || (lessonFilter === 'wins' ? l.pnl > 0 : l.pnl <= 0));

  if (!trades.length) return null;

  return (
    <div className="space-y-6">
      <Card title="Process Quality vs. Outcome" >
        {qualityCorr.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={qualityCorr}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} label={{ value: 'Self-rated process quality', position: 'insideBottom', offset: -2, fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v, name, p) => [`${fmtPct(v)} win rate (${p.payload.count} trades, avg ${fmtSignedMoney(p.payload.avgPnl)})`, '']} />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {qualityCorr.map((d) => (
                  <Cell key={d.label} fill={d.winRate >= 50 ? '#00d97f' : '#ff6b6b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>No data yet.</EmptyState>
        )}
        <p className="text-[11px] text-mute mt-2">If higher self-ratings don't track a higher win rate, your in-the-moment quality judgment may not be reliable yet.</p>
      </Card>

      <Card title="Exit Reason Analysis">
        {exitBreakdown.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-line">
                <th className="py-2 pr-3">Exit type</th>
                <th className="py-2 pr-3 text-right">Trades</th>
                <th className="py-2 pr-3 text-right">Win rate</th>
                <th className="py-2 text-right">Total P&L</th>
              </tr>
            </thead>
            <tbody>
              {exitBreakdown.map((e) => (
                <tr key={e.category} className="border-b border-line/50">
                  <td className="py-2 pr-3">{e.category}</td>
                  <td className="py-2 pr-3 text-right">{e.count}</td>
                  <td className="py-2 pr-3 text-right">{fmtPct(e.winRate)}</td>
                  <td className="py-2 text-right font-medium" style={{ color: e.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(e.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>No data yet.</EmptyState>
        )}
      </Card>

      <Card title="Journaling Consistency (12 weeks)">
        {consistency.some((c) => c.total > 0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={consistency}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => (v == null ? 'no trades' : fmtPct(v))} />
              <Line type="monotone" dataKey="pct" stroke="#00d9ff" strokeWidth={2} dot connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>No trades in the last 12 weeks.</EmptyState>
        )}
      </Card>

      <Card
        title="Lessons Learned"
        action={
          <Select
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            options={[{ value: 'all', label: 'All' }, { value: 'wins', label: 'From wins' }, { value: 'losses', label: 'From losses' }]}
          />
        }
      >
        {filteredLessons.length ? (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {filteredLessons.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <BookOpen size={14} className="text-mute shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-mute mb-0.5">
                    {fmtDateShort(l.date)} · {l.instrument} · <span style={{ color: l.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(l.pnl)}</span> · {l.emotion}
                  </div>
                  {l.lesson}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No lessons logged yet — fill the "Lesson learned" field when logging a trade.</EmptyState>
        )}
      </Card>
    </div>
  );
}
