// Burnout early-warning triggers. Pure function over recent data (last 7 days of logs).
export function checkBurnoutTriggers({ energyLogs = [], compliance = null, trades = [], baselineWinRate = 0.55 }) {
  const triggers = [];
  const recent = [...energyLogs].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const last3 = recent.slice(0, 3);
  const last7 = recent.slice(0, 7);

  if (last3.length >= 3 && last3.every((l) => l.energyStartLevel < 5)) {
    triggers.push({
      trigger: 'LOW_ENERGY_3DAYS',
      severity: 'high',
      message: 'Energy dangerously low for 3+ consecutive days',
      recommendation: 'Take a rest day, prioritize sleep',
    });
  }
  if (last7.filter((l) => l.stressLevel > 7).length >= 5) {
    triggers.push({
      trigger: 'HIGH_STRESS_5DAYS',
      severity: 'high',
      message: 'Stress consistently high (>7) for 5+ of the last 7 days',
      recommendation: 'Meditation, reduce trading volume',
    });
  }
  if (last7.filter((l) => (l.sleepData?.sleepQualityScore ?? 10) < 5).length >= 5) {
    triggers.push({
      trigger: 'POOR_SLEEP_5DAYS',
      severity: 'high',
      message: 'Sleep quality critically low for 5+ of the last 7 days',
      recommendation: 'Fix sleep schedule ASAP, no trading',
    });
  }
  if (compliance && compliance.total >= 7 && compliance.rate < 0.3) {
    triggers.push({
      trigger: 'LOW_HABIT_COMPLIANCE',
      severity: 'medium',
      message: 'Habit compliance below 30% this week',
      recommendation: 'Simplify habits, remove non-essentials',
    });
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekTrades = trades.filter((t) => new Date(t.date).getTime() >= weekAgo);
  if (weekTrades.length >= 5) {
    const winRate = weekTrades.filter((t) => t.pnl > 0).length / weekTrades.length;
    if (baselineWinRate - winRate > 0.15) {
      triggers.push({
        trigger: 'TRADING_ACCURACY_DROP',
        severity: 'medium',
        message: `Win rate dropped to ${Math.round(winRate * 100)}% (baseline ${Math.round(baselineWinRate * 100)}%)`,
        recommendation: 'Review recent trades, check for emotional trading',
      });
    }
  }

  return {
    burnoutRisk: triggers.length > 0,
    triggers,
    overallSeverity: triggers.some((t) => t.severity === 'high') ? 'high' : triggers.length ? 'medium' : 'none',
  };
}
