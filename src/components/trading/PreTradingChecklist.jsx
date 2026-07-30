import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { useHabitStore } from '../../store/habitStore';
import { habitStreak } from '../../utils/calculations';
import { currentLossStreak } from '../../utils/trading-psychology';
import { todayKey } from '../../utils/formatters';
import { Card } from '../common/ui';

const DOT = { green: 'var(--success)', yellow: 'var(--warning)', red: 'var(--error)' };

// Returns { clear, overridden } via onStatus so the page can gate the Log Trade button.
export default function PreTradingChecklist({ onStatus }) {
  // Whole-store subscription (not a selector) — getAccountTrades/getPropFirmProgress
  // return a freshly-allocated array/object on every call, so selecting them via
  // useTradingStore(s => s.getX(...)) makes useSyncExternalStore see a "changed"
  // snapshot every render and loop forever. Same pattern Trading.jsx already uses.
  const tradingStore = useTradingStore();
  const trades = tradingStore.trades;
  const activeAccountId = tradingStore.activeAccountId;
  const activeAccount = tradingStore.getAccount(activeAccountId);
  const accountTrades = tradingStore.getAccountTrades(activeAccountId);
  const propFirmProgress = activeAccount?.type === 'propfirm' ? tradingStore.getPropFirmProgress(activeAccountId) : null;
  const { habits, logs, energyLogs } = useHabitStore();
  const [override, setOverride] = useState(false);

  const today = todayKey();
  const items = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const lastJournaled = trades
      .filter((t) => t.journal?.reasoning)
      .map((t) => t.createdAt)
      .sort((a, b) => b - a)[0];
    const journalFresh = lastJournaled && Date.now() - lastJournaled < dayMs;
    const noTradesYet = trades.length === 0;

    const todayLog = energyLogs.find((l) => l.date === today);
    const recentLog = todayLog || [...energyLogs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];

    const stress = recentLog?.stressLevel;
    const sleepH = recentLog?.sleepData?.sleepHours;
    const energy = recentLog?.energyStartLevel;

    const activeStreak = habits.filter((h) => !h.archived).some((h) => habitStreak(h.id, logs, today) > 0);

    // Cross-domain (Phase 9): pulls Phase-4's live loss-streak signal and
    // Phase-1's prop-firm rule breaches into the SAME pre-trade gate that
    // already checks sleep/energy/stress — a hard prop-firm breach or an
    // active tilt-risk streak is exactly the kind of thing this checklist
    // exists to catch before the next trade, not just low energy.
    const lossStreak = currentLossStreak(accountTrades);
    const lossToday = accountTrades.some((t) => t.date === today && t.pnl < 0);
    const hardBreach = propFirmProgress?.breaches?.some((b) => b.level === 'danger');

    const list = [
      {
        label: 'Journaled within last 24h',
        status: noTradesYet ? 'yellow' : journalFresh ? 'green' : 'red',
        detail: noTradesYet ? 'No trades yet' : journalFresh ? 'Fresh journal' : 'Last journal >24h ago',
      },
      {
        label: 'Stress ≤ 7',
        status: stress === undefined ? 'yellow' : stress <= 7 ? 'green' : stress <= 8 ? 'yellow' : 'red',
        detail: stress === undefined ? 'No check-in today' : `Stress ${stress}/10`,
      },
      {
        label: 'Sleep > 6h last night',
        status: sleepH === undefined ? 'yellow' : sleepH > 6 ? 'green' : 'red',
        detail: sleepH === undefined ? 'No sleep data' : `${sleepH}h`,
      },
      {
        label: 'Energy > 5',
        status: energy === undefined ? 'yellow' : energy > 5 ? 'green' : 'red',
        detail: energy === undefined ? 'No check-in today' : `${energy}/10`,
      },
      {
        label: 'Habit streak active',
        status: habits.filter((h) => !h.archived).length === 0 ? 'yellow' : activeStreak ? 'green' : 'yellow',
        detail: activeStreak ? 'At least one streak alive' : 'No active streaks',
      },
      {
        label: 'No live tilt/revenge risk',
        status: lossStreak >= 2 ? 'red' : lossToday ? 'yellow' : 'green',
        detail: lossStreak >= 2 ? `${lossStreak}-loss streak` : lossToday ? 'Loss earlier today' : 'Clear',
      },
    ];
    if (propFirmProgress) {
      list.push({
        label: 'Prop-firm rules respected',
        status: hardBreach ? 'red' : 'green',
        detail: hardBreach ? 'Hard rule breach' : 'No breach this phase',
      });
    }
    return list;
  }, [trades, accountTrades, propFirmProgress, habits, logs, energyLogs, today]);

  const allGreen = items.every((i) => i.status === 'green');
  const clear = allGreen || override;
  useEffect(() => {
    onStatus?.(clear);
  }, [clear, onStatus]);

  return (
    <Card title="Pre-Trading Checklist">
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-3 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DOT[i.status] }} />
            <span className="flex-1">{i.label}</span>
            <span className="text-xs text-mute">{i.detail}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-line">
        {allGreen ? (
          <div className="flex items-center gap-2 text-good text-sm font-medium">
            <ShieldCheck size={17} /> Clear to trade
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-warn text-sm font-medium">
              <ShieldAlert size={17} /> Warnings detected. Proceed at own risk?
            </div>
            <label className="flex items-center gap-2 text-xs text-mute cursor-pointer">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              I understand and choose to proceed
            </label>
          </div>
        )}
      </div>
    </Card>
  );
}
