// Local rule-based trading coach heuristic (Phase 7): the instant, always-
// available fallback shown before/without the AI enrichment layer. Mirrors
// utils/health-science.js#generateCoachRecommendation's priority-ladder shape —
// hardest signal first, encouraging default last.

export function generateTradingCoachRecommendation({
  disciplineScore = null, revengeCount = 0, tiltCount = 0, monthPnl = 0,
  maxDrawdownPct = 0, riskBreaches = [], tradesThisWeek = 0,
} = {}) {
  const hardBreach = riskBreaches.find((b) => b.level === 'danger');
  if (hardBreach) return { text: `${hardBreach.message} Stop trading for today.`, tone: 'danger' };
  if (revengeCount > 0 || tiltCount > 0) {
    return { text: `${revengeCount + tiltCount} revenge/tilt pattern(s) detected recently — step away from the screen before the next trade.`, tone: 'danger' };
  }
  if (maxDrawdownPct > 15) {
    return { text: `Drawdown is at ${Math.round(maxDrawdownPct)}% — cut position size until the equity curve stabilizes.`, tone: 'warning' };
  }
  if (disciplineScore !== null && disciplineScore < 50) {
    return { text: 'Discipline score is low — tighten stop-loss usage and journal every trade before adding size.', tone: 'warning' };
  }
  if (tradesThisWeek === 0) {
    return { text: "No trades logged this week — if you traded, log them; if you didn't, that's a valid, disciplined choice too.", tone: 'info' };
  }
  if (disciplineScore !== null && disciplineScore >= 80 && monthPnl >= 0) {
    return { text: `Process is strong (discipline ${disciplineScore}/100) and P&L is positive this month — stay the course.`, tone: 'success' };
  }
  return { text: 'Signals look balanced — keep following your process, the edge shows up over a large sample, not any single trade.', tone: 'info' };
}
