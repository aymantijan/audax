import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { monteCarloPropFirmPass, daysToTargetProjection, equityConfidenceBands } from '../../utils/trading-predictions';
import { computePropFirmTimeline } from '../../utils/account-type-analytics';
import { fmtMoney, fmtPct } from '../../utils/formatters';
import { Card, Stat, EmptyState } from '../common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function PredictionsPanel({ account, trades, currency = 'USD' }) {
  const bands = useMemo(() => equityConfidenceBands(trades, account?.initialBalance || 0), [trades, account]);
  const passSim = useMemo(() => monteCarloPropFirmPass(account, trades), [account, trades]);
  const daysToTarget = useMemo(() => daysToTargetProjection(account, trades), [account, trades]);
  const timeline = useMemo(() => (account ? computePropFirmTimeline(account) : null), [account]);

  if (!trades.length) return null;

  return (
    <div className="space-y-6">
      <Card title="Equity Projection (next 20 trades)">
        {!bands.insufficientData ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={bands.bands}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="step" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} label={{ value: 'Trades ahead', position: 'insideBottom', offset: -2, fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v, name) => [fmtMoney(v, 0, currency), name === 'p90' ? 'Optimistic (p90)' : name === 'p10' ? 'Pessimistic (p10)' : 'Median']} />
                <Area type="monotone" dataKey="p90" stroke="none" fill="#00d9ff" fillOpacity={0.08} />
                <Area type="monotone" dataKey="p10" stroke="none" fill="var(--bg-secondary)" fillOpacity={1} />
                <Area type="monotone" dataKey="p50" stroke="#00d9ff" strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-mute mt-2">
              Bootstrap simulation resampling your own past trade outcomes — a spread of plausible paths, not a directional forecast. Shaded band = 10th-90th percentile.
            </p>
          </>
        ) : (
          <EmptyState>Log at least 10 trades on this account for a projection.</EmptyState>
        )}
      </Card>

      {account?.type === 'propfirm' && (
        <Card title="Prop-Firm Pass Probability">
          {passSim && !passSim.insufficientData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Pass probability" value={fmtPct(passSim.passProbability)} color={passSim.passProbability >= 60 ? 'var(--success)' : passSim.passProbability >= 30 ? 'var(--warning)' : 'var(--error)'} />
                <Stat label="Fail probability" value={fmtPct(passSim.failProbability)} />
                <Stat label="Median days to target" value={passSim.medianDaysToTarget != null ? `${passSim.medianDaysToTarget}d` : '—'} />
                <Stat label="Days left in phase" value={timeline ? (timeline.overdue ? 'Overdue' : `${timeline.daysRemaining}d`) : '—'} color={timeline && !timeline.overdue && timeline.daysRemaining <= 3 ? 'var(--warning)' : undefined} />
              </div>
              {daysToTarget && !daysToTarget.insufficientData && !daysToTarget.alreadyMet && daysToTarget.daysRemaining != null && (
                <p className="text-[11px] text-mute mt-3 flex items-center gap-1.5">
                  <TrendingUp size={12} className="shrink-0" />
                  At your current avg. pace ({fmtMoney(daysToTarget.avgPerDay, 0, currency)}/trading day), reaching the profit target linearly would take ~{daysToTarget.daysRemaining} more day(s).
                </p>
              )}
              <p className="text-[11px] text-mute mt-2">
                Based on {passSim.simulations} simulated runs resampling this phase's trade history — assumes future trades keep the same statistical profile as past ones. Small samples or a strategy change make this unreliable.
              </p>
            </>
          ) : (
            <EmptyState>{passSim?.reason || 'Not enough data yet for a pass-probability estimate.'}</EmptyState>
          )}
        </Card>
      )}
    </div>
  );
}
