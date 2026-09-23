import { useMemo, useState } from 'react';
import { Crosshair, TrendingUp, TrendingDown } from 'lucide-react';
import { tradeRMultiple } from '../../utils/risk-management';
import { mistakesOf } from '../../utils/trading-journal';
import { fmtMoney, fmtSignedMoney, fmtPct, todayKey } from '../../utils/formatters';
import { Card, EmptyState } from '../common/ui';

const fmtR = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${(Math.round(r * 100) / 100).toFixed(2)}R`);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const holdBucket = (m) => { const n = Number(m); if (!n && n !== 0) return null; if (n < 5) return '< 5 min'; if (n < 30) return '5–30 min'; if (n < 120) return '30 min–2 h'; if (n < 1440) return '2 h–1 day'; return '> 1 day'; };
const HOLD_ORDER = ['< 5 min', '5–30 min', '30 min–2 h', '2 h–1 day', '> 1 day'];

// Each dimension returns the segment label(s) of a trade (null = not known).
const DIMENSIONS = [
  { key: 'setup', label: 'Setup', get: (t) => t.strategy },
  { key: 'session', label: 'Session', get: (t) => t.session || null },
  { key: 'hour', label: 'Entry hour', get: (t) => (t.entryTime ? `${t.entryTime.slice(0, 2)}:00` : null), sort: 'label' },
  { key: 'weekday', label: 'Weekday', get: (t) => (t.date ? WEEKDAYS[new Date(`${t.date}T12:00:00`).getDay()] : null), sort: 'weekday' },
  { key: 'instrument', label: 'Instrument', get: (t) => t.instrument },
  { key: 'direction', label: 'Direction', get: (t) => (t.direction === 'short' ? 'Short' : 'Long') },
  { key: 'hold', label: 'Holding time', get: (t) => holdBucket(t.holdingTime), sort: 'hold' },
  { key: 'emotion', label: 'Emotion', get: (t) => (t.source === 'mt5' && t.journal?.emotion === 'neutral' ? null : t.journal?.emotion || null) },
  { key: 'mistake', label: 'Mistake', get: (t) => { const m = mistakesOf(t); return m.length ? m : (t.mistakes || t.followedPlan != null ? 'No mistake' : null); } },
  { key: 'plan', label: 'Plan', get: (t) => (t.followedPlan === true ? 'On plan' : t.followedPlan === false ? 'Off plan' : null) },
];

function segments(trades, dim) {
  const map = {};
  for (const t of trades) {
    const v = dim.get(t);
    for (const label of Array.isArray(v) ? v : [v]) {
      if (label == null || label === '') continue;
      (map[label] = map[label] || []).push(t);
    }
  }
  return Object.entries(map).map(([label, ts]) => {
    const rs = ts.map(tradeRMultiple).filter((r) => r != null);
    const pnl = ts.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
    return { label, count: ts.length, pnl, avg: pnl / ts.length, winRate: (ts.filter((t) => t.pnl > 0).length / ts.length) * 100, expR: rs.length >= Math.ceil(ts.length * 0.6) ? rs.reduce((a, b) => a + b, 0) / rs.length : null };
  });
}

const PERIODS = [{ key: 'all', label: 'All time' }, { key: '90', label: '90 days' }, { key: '30', label: '30 days' }];

export default function EdgeFinder({ trades, currency }) {
  const [dimKey, setDimKey] = useState('setup');
  const [period, setPeriod] = useState('all');
  const scoped = useMemo(() => {
    if (period === 'all') return trades;
    const d = new Date(`${todayKey()}T12:00:00`); d.setDate(d.getDate() - Number(period));
    const from = d.toLocaleDateString('sv-SE');
    return trades.filter((t) => t.date >= from);
  }, [trades, period]);
  const minN = Math.max(5, Math.round(scoped.length * 0.08));

  // Strengths & leaks across every dimension (enough trades, clear sign).
  const insights = useMemo(() => {
    const all = [];
    for (const dim of DIMENSIONS) {
      if (dim.key === 'plan' || dim.key === 'mistake') continue;
      const segs = segments(scoped, dim);
      if (segs.length < 2) continue;
      for (const s of segs) if (s.count >= minN) all.push({ ...s, dim: dim.label });
    }
    const score = (s) => (s.expR != null ? s.expR : s.avg);
    const strengths = all.filter((s) => s.pnl > 0 && score(s) > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 3);
    const leaks = all.filter((s) => s.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 3);
    return { strengths, leaks };
  }, [scoped, minN]);

  const dim = DIMENSIONS.find((d) => d.key === dimKey);
  const rows = useMemo(() => {
    const segs = segments(scoped, dim);
    if (dim.sort === 'weekday') return segs.sort((a, b) => ((WEEKDAYS.indexOf(a.label) + 6) % 7) - ((WEEKDAYS.indexOf(b.label) + 6) % 7));
    if (dim.sort === 'hold') return segs.sort((a, b) => HOLD_ORDER.indexOf(a.label) - HOLD_ORDER.indexOf(b.label));
    if (dim.sort === 'label') return segs.sort((a, b) => a.label.localeCompare(b.label));
    return segs.sort((a, b) => b.pnl - a.pnl);
  }, [scoped, dim]);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  const total = scoped.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const worst = insights.leaks[0];

  // Risk per trade all over the place → $ results follow the biggest positions, not the edge.
  const sizing = useMemo(() => {
    const risks = scoped.map((t) => Number(t.riskAmount) || 0).filter((r) => r > 0).sort((a, b) => a - b);
    if (risks.length < 10) return null;
    const med = risks[Math.floor(risks.length / 2)];
    const p10 = risks[Math.floor(risks.length * 0.1)]; const p90 = risks[Math.floor(risks.length * 0.9)];
    if (!med || p90 / Math.max(p10, 1e-9) < 5) return null;
    const bySize = [...scoped].filter((t) => Number(t.riskAmount) > 0).sort((a, b) => b.riskAmount - a.riskAmount);
    const top = bySize.slice(0, Math.max(1, Math.round(bySize.length * 0.2)));
    const topPnl = top.reduce((a, t) => a + t.pnl, 0);
    return { min: risks[0], max: risks[risks.length - 1], med, topCount: top.length, topPnl };
  }, [scoped]);

  return (
    <Card title="Edge finder" action={
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-2 py-0.5 rounded-md text-[11px] cursor-pointer ${period === p.key ? 'bg-accent/15 text-accent' : 'text-mute hover:text-ink'}`}>{p.label}</button>
        ))}
      </div>
    }>
      {scoped.length < 10 ? (
        <EmptyState>Needs at least 10 trades{period !== 'all' ? ' in this period' : ''} — import your MT5 history or keep logging.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border p-3" style={{ borderColor: 'color-mix(in srgb, var(--success) 35%, transparent)' }}>
              <div className="text-xs font-semibold text-good flex items-center gap-1.5 mb-2"><TrendingUp size={14} /> Where your edge is</div>
              {insights.strengths.length ? insights.strengths.map((s) => (
                <div key={`${s.dim}-${s.label}`} className="text-sm flex justify-between gap-2 py-0.5">
                  <span className="min-w-0 truncate"><span className="text-mute text-xs">{s.dim}:</span> {s.label} <span className="text-mute text-xs">({s.count})</span></span>
                  <span className="tabular-nums font-semibold text-good shrink-0">{fmtSignedMoney(s.pnl, currency)} · {s.expR != null ? fmtR(s.expR) : `${fmtSignedMoney(s.avg, currency)}/t`}</span>
                </div>
              )) : <div className="text-xs text-mute">No segment with {minN}+ trades is clearly profitable yet.</div>}
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'color-mix(in srgb, var(--error) 35%, transparent)' }}>
              <div className="text-xs font-semibold text-bad flex items-center gap-1.5 mb-2"><TrendingDown size={14} /> Where you leak money</div>
              {insights.leaks.length ? insights.leaks.map((s) => (
                <div key={`${s.dim}-${s.label}`} className="text-sm flex justify-between gap-2 py-0.5">
                  <span className="min-w-0 truncate"><span className="text-mute text-xs">{s.dim}:</span> {s.label} <span className="text-mute text-xs">({s.count})</span></span>
                  <span className="tabular-nums font-semibold text-bad shrink-0">{fmtSignedMoney(s.pnl, currency)} · {s.expR != null ? fmtR(s.expR) : `${fmtSignedMoney(s.avg, currency)}/t`}</span>
                </div>
              )) : <div className="text-xs text-mute">No losing segment with {minN}+ trades.</div>}
            </div>
          </div>
          {sizing && (
            <div className="text-xs rounded-lg px-3 py-2 text-warn" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }}>
              <b>Inconsistent risk per trade</b> — from {fmtMoney(sizing.min, 0, currency)} to {fmtMoney(sizing.max, 0, currency)} (median {fmtMoney(sizing.med, 0, currency)}). Your {sizing.topCount} biggest-risk trades alone made <b>{fmtSignedMoney(sizing.topPnl, currency)}</b>, so $ results follow position size more than edge — that's why a segment can be green in $ but negative in R. A fixed risk per trade (e.g. 0.5–1% of the account) makes R and $ tell the same story.
            </div>
          )}
          {worst && <p className="text-xs text-mute"><Crosshair size={12} className="inline -mt-0.5 mr-1 text-accent" />Without “{worst.dim}: {worst.label}”, this period would be <b className="text-ink">{fmtSignedMoney(total - worst.pnl, currency)}</b> instead of {fmtSignedMoney(total, currency)}. Segments need {minN}+ trades; it’s a correlation, check it before cutting anything.</p>}

          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {DIMENSIONS.map((d) => (
                <button key={d.key} onClick={() => setDimKey(d.key)} className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${dimKey === d.key ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>{d.label}</button>
              ))}
            </div>
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-mute border-b border-line">
                      <th className="py-1.5 pr-3">{dim.label}</th><th className="py-1.5 pr-3 text-right">Trades</th><th className="py-1.5 pr-3 text-right">Win rate</th>
                      <th className="py-1.5 pr-3 text-right">Expectancy</th><th className="py-1.5 pr-3 text-right">Net P&L</th><th className="py-1.5 w-1/4" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} className={`border-b border-line/50 ${r.count < minN ? 'opacity-60' : ''}`}>
                        <td className={`py-1.5 pr-3 ${dim.key === 'emotion' ? 'capitalize' : ''}`}>{r.label}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.count}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{fmtPct(r.winRate)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.expR != null ? fmtR(r.expR) : `${fmtSignedMoney(r.avg, currency)}/t`}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums font-medium" style={{ color: r.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(r.pnl, currency)}</td>
                        <td className="py-1.5">
                          <div className="h-2 rounded-full" style={{ width: `${(Math.abs(r.pnl) / maxAbs) * 100}%`, background: r.pnl >= 0 ? 'var(--success)' : 'var(--error)', opacity: 0.7 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-mute mt-1.5">Faded rows have fewer than {minN} trades — not enough to conclude.</p>
              </div>
            ) : <EmptyState>No data for this dimension yet{dim.key === 'session' || dim.key === 'hour' ? ' — add the entry time when logging, or import from MT5' : ''}.</EmptyState>}
          </div>
        </div>
      )}
    </Card>
  );
}
