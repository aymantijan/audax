import { calculateBurnRate } from '../../utils/calculations';
import { fmtMoney, fmtPct } from '../../utils/formatters';
import { Card } from '../common/ui';

const LEVEL_COLOR = { green: 'var(--success)', yellow: 'var(--warning)', red: 'var(--error)' };

export default function BurnRateTracker({ trades, accountValue }) {
  const br = calculateBurnRate(trades, accountValue);
  const noLosses = br.avgDailyLoss === 0;

  return (
    <Card title="Burn Rate (7-day window)">
      {noLosses ? (
        <div className="text-sm text-good">No losses in the last 7 days. Burn rate: $0.</div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-3xl font-bold" style={{ color: LEVEL_COLOR[br.level] }}>
              {fmtMoney(br.avgDailyLoss, 0)}
              <span className="text-sm font-normal text-mute"> / day avg loss</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-mute">Monthly projection</div>
              <div className="font-semibold">{fmtMoney(br.monthlyLossProjection)}</div>
            </div>
            <div>
              <div className="text-xs text-mute">Monthly burn</div>
              <div className="font-semibold" style={{ color: LEVEL_COLOR[br.level] }}>
                {fmtPct(br.monthlyLossPct, 1)}
              </div>
            </div>
          </div>
          {isFinite(br.runwayMonths) && (
            <div className="text-xs text-mute">
              At this rate, account depletes in ~{Math.round(br.runwayMonths)} months.
            </div>
          )}
          {br.level === 'red' && (
            <div className="text-sm text-bad font-medium">Burn rate critical — consider reducing position size.</div>
          )}
          {br.level === 'yellow' && <div className="text-sm text-warn">Burn rate elevated — watch your sizing.</div>}
        </div>
      )}
    </Card>
  );
}
