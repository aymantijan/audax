// Journal analysis (Phase 5): mines the trade journal's own fields (process
// quality rating, exit reason, free-text lessons) for patterns that help
// improve strategy, risk, and psychology going forward — distinct from Phase 3
// (risk sizing/R) and Phase 4 (emotion/discipline), this is about what the
// journal ITSELF says when reviewed in aggregate.

const r1 = (n) => Math.round(n * 10) / 10;

// ---- Process quality vs. outcome ----
// Buckets self-rated execution quality (1-10) into bands and checks whether
// higher self-ratings actually predict better results — a sanity check on the
// trader's own self-assessment.
const QUALITY_BANDS = [
  { label: '1-3', test: (q) => q <= 3 },
  { label: '4-6', test: (q) => q >= 4 && q <= 6 },
  { label: '7-8', test: (q) => q >= 7 && q <= 8 },
  { label: '9-10', test: (q) => q >= 9 },
];

export function processQualityCorrelation(trades) {
  return QUALITY_BANDS.map((band) => {
    const ts = trades.filter((t) => band.test(Number(t.journal?.processQuality) || 0));
    const wins = ts.filter((t) => t.pnl > 0);
    return {
      label: band.label,
      count: ts.length,
      winRate: ts.length ? r1((wins.length / ts.length) * 100) : 0,
      avgPnl: ts.length ? r1(ts.reduce((a, t) => a + t.pnl, 0) / ts.length) : 0,
    };
  }).filter((b) => b.count > 0);
}

// ---- Exit reason categorization ----
// exitReason is free text in the trade form, so this buckets it by keyword —
// approximate by nature, but enough to reveal patterns like "I exit winners
// early but let losers run" (the classic disposition-effect mistake).
const EXIT_KEYWORDS = [
  { label: 'Take Profit', words: ['tp', 'target', 'profit'] },
  { label: 'Stop Loss', words: ['stop', 'sl'] },
  { label: 'Discretionary / Early', words: ['early', 'discretion', 'manual', 'closed', 'nervous', 'fear'] },
];

function categorizeExit(reason) {
  const text = String(reason || '').toLowerCase().trim();
  if (!text) return 'Not logged';
  for (const cat of EXIT_KEYWORDS) {
    if (cat.words.some((w) => text.includes(w))) return cat.label;
  }
  return 'Other';
}

export function exitReasonBreakdown(trades) {
  const groups = {};
  for (const t of trades) {
    const cat = categorizeExit(t.journal?.exitReason);
    groups[cat] = groups[cat] || { category: cat, count: 0, wins: 0, pnl: 0 };
    groups[cat].count++;
    if (t.pnl > 0) groups[cat].wins++;
    groups[cat].pnl += t.pnl;
  }
  return Object.values(groups)
    .map((g) => ({ ...g, winRate: r1((g.wins / g.count) * 100), pnl: r1(g.pnl), avgPnl: r1(g.pnl / g.count) }))
    .sort((a, b) => b.count - a.count);
}

// ---- Lessons learned feed ----
export function lessonsFeed(trades, limit = 20) {
  return [...trades]
    .filter((t) => t.lesson?.trim())
    .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit)
    .map((t) => ({ date: t.date, instrument: t.instrument, pnl: t.pnl, lesson: t.lesson, emotion: t.journal?.emotion }));
}

// ---- Journaling consistency trend (last N weeks) ----
export function journalingConsistencyTrend(trades, weeks = 12) {
  const now = new Date();
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const weekStart = new Date(now.getTime() - (weeks - 1 - i) * 7 * 86400000);
    weekStart.setHours(0, 0, 0, 0);
    return { weekStart: weekStart.getTime(), label: weekStart.toISOString().slice(5, 10), total: 0, journaled: 0 };
  });
  for (const t of trades) {
    const time = new Date(t.date).getTime();
    const bucket = buckets.find((b, i) => time >= b.weekStart && (i === buckets.length - 1 || time < buckets[i + 1].weekStart));
    if (!bucket) continue;
    bucket.total++;
    if (t.journal?.reasoning?.trim()) bucket.journaled++;
  }
  return buckets.map((b) => ({ label: b.label, pct: b.total ? r1((b.journaled / b.total) * 100) : null, total: b.total }));
}
