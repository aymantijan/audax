import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator } from 'lucide-react';
import { instrumentCorrelation } from '../../utils/analytics';
import { computePositionSize, rMultipleStats, sameDayExposureWarnings, DEFAULT_PIP_VALUE_PER_LOT } from '../../utils/risk-management';
import { INSTRUMENTS, CURRENCY_SYMBOL } from '../../utils/constants';
import { fmtMoney } from '../../utils/formatters';
import { Card, Field, Input, Select, EmptyState } from '../common/ui';

export default function RiskManagement({ trades, accountValue, currency = 'USD' }) {
  const [calc, setCalc] = useState({ riskPct: 1, instrument: 'EURUSD', stopDistancePips: 20, pipValuePerLot: DEFAULT_PIP_VALUE_PER_LOT.EURUSD });

  const sizing = computePositionSize({
    accountValue,
    riskPct: calc.riskPct,
    stopDistancePips: calc.stopDistancePips,
    pipValuePerLot: calc.pipValuePerLot,
  });

  const rStats = useMemo(() => rMultipleStats(trades), [trades]);
  const corr = useMemo(() => instrumentCorrelation(trades, INSTRUMENTS), [trades]);
  const exposureWarnings = useMemo(() => sameDayExposureWarnings(trades, corr.matrix).slice(0, 10), [trades, corr]);

  const maxBucket = rStats ? Math.max(1, ...Object.values(rStats.buckets)) : 1;

  return (
    <div className="space-y-6">
      <Card title="Position Size Calculator">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Risk (% of account)">
            <Input type="number" step="0.1" min="0" value={calc.riskPct} onChange={(e) => setCalc({ ...calc, riskPct: e.target.value })} />
          </Field>
          <Field label="Instrument">
            <Select
              value={calc.instrument}
              onChange={(e) => setCalc({ ...calc, instrument: e.target.value, pipValuePerLot: DEFAULT_PIP_VALUE_PER_LOT[e.target.value] ?? calc.pipValuePerLot })}
              options={INSTRUMENTS}
            />
          </Field>
          <Field label="Stop distance (pips)">
            <Input type="number" step="any" min="0" value={calc.stopDistancePips} onChange={(e) => setCalc({ ...calc, stopDistancePips: e.target.value })} />
          </Field>
          <Field label={`${CURRENCY_SYMBOL[currency] || currency} per pip / lot`} hint="Override if your broker quotes differently">
            <Input type="number" step="any" min="0" value={calc.pipValuePerLot} onChange={(e) => setCalc({ ...calc, pipValuePerLot: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-6 bg-surface border border-line rounded-lg px-4 py-3">
          <Calculator size={20} className="text-accent shrink-0" />
          <div>
            <div className="text-xs text-mute">Dollar risk</div>
            <div className="text-lg font-semibold">{fmtMoney(sizing.dollarRisk, 0, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-mute">Position size</div>
            <div className="text-lg font-semibold">{sizing.lots != null ? `${sizing.lots} lots` : '—'}</div>
          </div>
          <div className="text-xs text-mute ml-auto">Based on {fmtMoney(accountValue, 0, currency)} account value</div>
        </div>
      </Card>

      <Card title="R-Multiple Analysis" >
        {rStats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
              <div><div className="text-xs text-mute mb-1">Expectancy</div><div className="text-lg font-semibold" style={{ color: rStats.expectancyR >= 0 ? 'var(--success)' : 'var(--error)' }}>{rStats.expectancyR}R</div></div>
              <div><div className="text-xs text-mute mb-1">Win rate</div><div className="text-lg font-semibold">{rStats.winRate}%</div></div>
              <div><div className="text-xs text-mute mb-1">Avg win</div><div className="text-lg font-semibold text-good">+{rStats.avgWinR}R</div></div>
              <div><div className="text-xs text-mute mb-1">Avg loss</div><div className="text-lg font-semibold text-bad">{rStats.avgLossR}R</div></div>
            </div>
            <div className="space-y-1.5">
              {Object.entries(rStats.buckets).map(([label, count]) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-mute">{label}</span>
                  <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden">
                    <div className="h-full" style={{ width: `${(count / maxBucket) * 100}%`, background: label.includes('-') ? 'var(--error)' : 'var(--success)' }} />
                  </div>
                  <span className="w-6 text-right text-mute">{count}</span>
                </div>
              ))}
            </div>
            {rStats.missingRiskCount > 0 && (
              <div className="text-[11px] text-mute mt-3">{rStats.missingRiskCount} trade(s) have no logged risk amount and are excluded from R-multiples.</div>
            )}
          </>
        ) : (
          <EmptyState>Log a trade's "Risk ({currency})" field to see R-multiple analysis.</EmptyState>
        )}
      </Card>

      <Card title="Correlated Same-Day Exposure">
        {exposureWarnings.length ? (
          <div className="space-y-2">
            {exposureWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm border border-warn/50 bg-warn/10 text-warn rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="shrink-0" />
                {w.date}: traded {w.pair[0]} and {w.pair[1]} together — historical correlation {w.correlation.toFixed(2)}, watch combined risk.
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No days found where you traded two correlated instruments together.</EmptyState>
        )}
      </Card>
    </div>
  );
}
