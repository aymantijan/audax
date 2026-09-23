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
      message: 'Énergie dangereusement basse depuis 3 jours ou plus',
      recommendation: 'Prenez un jour de repos, priorité au sommeil',
    });
  }
  if (last7.filter((l) => l.stressLevel > 7).length >= 5) {
    triggers.push({
      trigger: 'HIGH_STRESS_5DAYS',
      severity: 'high',
      message: 'Stress élevé (> 7) sur au moins 5 des 7 derniers jours',
      recommendation: 'Méditation, réduisez le volume de trading',
    });
  }
  if (last7.filter((l) => (l.sleepData?.sleepQualityScore ?? 10) < 5).length >= 5) {
    triggers.push({
      trigger: 'POOR_SLEEP_5DAYS',
      severity: 'high',
      message: 'Qualité de sommeil très basse sur au moins 5 des 7 derniers jours',
      recommendation: 'Rétablissez vos horaires de sommeil au plus vite, pas de trading',
    });
  }
  if (compliance && compliance.total >= 7 && compliance.rate < 0.3) {
    triggers.push({
      trigger: 'LOW_HABIT_COMPLIANCE',
      severity: 'medium',
      message: 'Moins de 30 % des habitudes tenues cette semaine',
      recommendation: 'Simplifiez vos habitudes, gardez l’essentiel',
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
        message: `Taux de réussite tombé à ${Math.round(winRate * 100)} % (habituel : ${Math.round(baselineWinRate * 100)} %)`,
        recommendation: 'Revoyez vos derniers trades, vérifiez s’il y a du trading émotionnel',
      });
    }
  }

  return {
    burnoutRisk: triggers.length > 0,
    triggers,
    overallSeverity: triggers.some((t) => t.severity === 'high') ? 'high' : triggers.length ? 'medium' : 'none',
  };
}
