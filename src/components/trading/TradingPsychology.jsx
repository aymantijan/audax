import { useMemo } from 'react';
import { AlertTriangle, Flame } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { computeDisciplineScore, detectRevengeTrades, detectTiltSequences, emotionBreakdown } from '../../utils/trading-psychology';
import { fmtSignedMoney, fmtPct, fmtDateShort } from '../../utils/formatters';
import { Card, Badge, EmptyState } from '../common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function TradingPsychology({ trades }) {
  const discipline = useMemo(() => computeDisciplineScore(trades), [trades]);
  const revengeFlags = useMemo(() => detectRevengeTrades(trades), [trades]);
  const tiltFlags = useMemo(() => detectTiltSequences(trades), [trades]);
  const emotions = useMemo(() => emotionBreakdown(trades), [trades]);

  if (!trades.length) return null;

  return (
    <div className="space-y-6">
      <Card title="Discipline Score">
        {discipline ? (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold" style={{ color: discipline.band.color }}>{discipline.score}</div>
              <Badge color={discipline.band.color}>{discipline.band.label}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-2">
              <div><div className="text-xs text-mute mb-1">Stop loss usage</div><div className="text-sm font-semibold">{discipline.breakdown.stopLoss}/25</div></div>
              <div><div className="text-xs text-mute mb-1">Journal completeness</div><div className="text-sm font-semibold">{discipline.breakdown.journal}/25</div></div>
              <div><div className="text-xs text-mute mb-1">Emotional control</div><div className="text-sm font-semibold">{discipline.breakdown.emotion}/25</div></div>
              <div><div className="text-xs text-mute mb-1">Process quality</div><div className="text-sm font-semibold">{discipline.breakdown.process}/25</div></div>
            </div>
            {discipline.breakdown.penalty > 0 && (
              <div className="text-xs text-bad text-center">-{discipline.breakdown.penalty} pts for {discipline.revengeCount} revenge-trade + {discipline.tiltCount} tilt pattern(s) detected below.</div>
            )}
          </>
        ) : (
          <EmptyState>Not enough data yet.</EmptyState>
        )}
      </Card>

      <Card title="Revenge Trading" action={<Badge color={revengeFlags.length ? 'var(--error)' : 'var(--success)'}>{revengeFlags.length} detected</Badge>}>
        {revengeFlags.length ? (
          <ul className="space-y-2">
            {revengeFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm border border-bad/50 bg-bad/10 text-bad rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium">{fmtDateShort(f.trade.date)} · {f.trade.instrument}</span> — {f.reason}
                  <span className="block text-[11px] text-mute mt-0.5">Previous trade: {fmtSignedMoney(f.previousTrade.pnl)} on {f.previousTrade.instrument}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-good">No revenge-trading pattern detected in your logged trades.</div>
        )}
      </Card>

      <Card title="Tilt Sequences" action={<Badge color={tiltFlags.length ? 'var(--error)' : 'var(--success)'}>{tiltFlags.length} detected</Badge>}>
        {tiltFlags.length ? (
          <ul className="space-y-2">
            {tiltFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm border border-warn/50 bg-warn/10 text-warn rounded-lg px-3 py-2">
                <Flame size={14} className="shrink-0 mt-0.5" />
                <span>
                  After {f.streakLength} straight losses ({fmtSignedMoney(f.streakLossTotal)}), position size jumped to {f.nextTrade.positionSize} (avg during the streak: {f.avgStreakSize}) on {fmtDateShort(f.nextTrade.date)}.
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-good">No tilt pattern (sizing up after a losing streak) detected.</div>
        )}
      </Card>

      <Card title="Emotion Breakdown">
        {emotions.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={emotions}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="emotion" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v, name, p) => [`${fmtPct(v)} (${p.payload.count} trades, ${fmtSignedMoney(p.payload.pnl)})`, 'Win rate']} />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {emotions.map((e) => (
                  <Cell key={e.emotion} fill={e.winRate >= 50 ? '#00d97f' : '#ff6b6b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>No emotion data yet.</EmptyState>
        )}
      </Card>
    </div>
  );
}
