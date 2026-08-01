import { ProgressBar } from '../common/ui';

// Shared by the real Prop Firm phase card (TradingAccountDetail.jsx) and the
// Demo account phase-simulation card (PropFirmSimConfig.jsx) — same rule
// shape, same gauge.
export default function RuleGauge({ label, value, max, unit = '%', invert = false }) {
  if (max == null) return null;
  const pct = Math.min(100, (value / max) * 100);
  const danger = invert ? value < max * 0.3 : pct >= 100;
  const warn = invert ? value < max * 0.6 : pct >= 70;
  const color = danger ? 'var(--error)' : warn ? 'var(--warning)' : 'var(--success)';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-mute">{label}</span>
        <span style={{ color }}>{value}{unit} / {max}{unit}</span>
      </div>
      <ProgressBar value={pct} color={color} />
    </div>
  );
}
