import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { fmtMoney } from '../../utils/formatters';
import { Card, Select, EmptyState } from '../common/ui';

const TYPE_LABEL = { demo: 'Demo', broker: 'Broker', propfirm: 'Prop Firm' };
const TYPE_ORDER = ['demo', 'broker', 'propfirm'];
const WEIGHT_LABEL = { demo: 'Demo', broker: 'Broker', propfirmFunded: 'Prop Firm (funded)', propfirmEvaluation: 'Prop Firm (evaluation)' };

function ScoreDial({ score, band, size = 96 }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        {score != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={band.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{score ?? '—'}</span>
        {score != null && <span className="text-[10px] font-semibold" style={{ color: band.color }}>{band.label}</span>}
      </div>
    </div>
  );
}

// Score-3: the overall Trading-page score (see utils/trading-score.js for the
// full 3-tier design). Aggregates ACROSS all accounts, not scoped to any one
// active account — so this reads directly from tradingStore.accounts, unlike
// the rest of /trading which is scoped to the active account.
export default function ScorePanel() {
  const { scoreSettings, setScoreSettings, getOverallScore } = useTradingStore();
  const [configOpen, setConfigOpen] = useState(false);
  const result = getOverallScore();

  const toggleType = (type) => setScoreSettings({ includedTypes: { [type]: !scoreSettings.includedTypes[type] } });
  const setWeight = (key, v) => setScoreSettings({ weights: { [key]: Math.max(0, Number(v) || 0) } });

  return (
    <Card
      title="Overall Trading Score"
      action={
        <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setConfigOpen((v) => !v)} title="Configure score weights">
          <Settings2 size={15} />
        </button>
      }
    >
      {configOpen && (
        <div className="mb-4 pb-4 border-b border-line space-y-3">
          <div>
            <div className="text-xs text-mute mb-1.5">Include account types</div>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_ORDER.map((type) => {
                const active = scoreSettings.includedTypes[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${active ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}
                  >
                    {TYPE_LABEL[type]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs text-mute mb-1.5">Weighting mode</div>
            <Select
              value={scoreSettings.mode}
              onChange={(e) => setScoreSettings({ mode: e.target.value })}
              options={[
                { value: 'fixed', label: 'Fixed multipliers (capital-at-risk weighting)' },
                { value: 'capital', label: 'By literal $ capital in each group' },
              ]}
            />
          </div>
          {scoreSettings.mode === 'fixed' && (
            <div>
              <div className="text-xs text-mute mb-1.5">Fixed weights</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(WEIGHT_LABEL).map(([key, label]) => (
                  <div key={key}>
                    <div className="text-[11px] text-mute mb-1">{label}</div>
                    <input
                      type="number" step="0.1" min="0" value={scoreSettings.weights[key]}
                      onChange={(e) => setWeight(key, e.target.value)}
                      className="w-full bg-surface border border-line rounded-lg px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {result.insufficientData ? (
        <EmptyState>Log trades on at least one included account type to compute a score.</EmptyState>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreDial score={result.overallScore} band={result.band} />
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
            {result.groups.map((g) => (
              <div key={g.key} className="text-center">
                <div className="text-xs text-mute mb-1">{g.label}</div>
                <div className="text-sm font-semibold" style={{ color: g.band.color }}>{g.score}</div>
                <div className="text-[10px] text-mute">{g.accountCount} acct · weight {scoreSettings.mode === 'capital' ? fmtMoney(g.weight) : g.weight.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
