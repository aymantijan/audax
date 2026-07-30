// Trading psychology (Phase 4): revenge-trading and tilt detection, a
// discipline score, and an emotion-tag breakdown. The app logs CLOSED trades
// (no live open-position concept, no entry/exit timestamps — only a trade
// date and how long it was held), so "revenge trade" and "tilt" here are
// necessarily same-day, logging-order heuristics rather than second-by-second
// detection — documented inline so the limitation is never silently assumed away.

const r1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const IMPULSIVE_EMOTIONS = ['greedy', 'scared', 'FOMO'];

function chronological(trades) {
  return [...trades].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
}

// A trade is flagged as a likely revenge trade when it follows a loss on the
// SAME calendar day with either a bigger position size or an impulsive
// emotion tag — the classic "make it back right now" pattern.
export function detectRevengeTrades(trades) {
  const sorted = chronological(trades);
  const flags = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.pnl >= 0 || prev.date !== cur.date) continue;
    const sizedUp = Number(cur.positionSize) > Number(prev.positionSize) * 1.2;
    const impulsive = IMPULSIVE_EMOTIONS.includes(cur.journal?.emotion);
    if (sizedUp || impulsive) {
      flags.push({
        trade: cur, previousTrade: prev,
        reason: sizedUp && impulsive
          ? 'Sized up and traded on an impulsive emotion right after a same-day loss'
          : sizedUp
            ? `Position size increased ${r1((cur.positionSize / prev.positionSize - 1) * 100)}% right after a same-day loss`
            : `Logged with a "${cur.journal.emotion}" tag right after a same-day loss`,
      });
    }
  }
  return flags;
}

// Tilt: 2+ consecutive losses (chronologically) followed by a trade sized
// above the streak's average — risk escalating exactly when it shouldn't.
// Checked BEFORE updating the streak with the current trade, so a sized-up
// trade is flagged whether it goes on to win or lose (tilt often means
// "bigger AND still losing", not just "bigger").
export function detectTiltSequences(trades) {
  const sorted = chronological(trades);
  const sequences = [];
  let streak = [];
  for (const t of sorted) {
    if (streak.length >= 2) {
      const avgSize = streak.reduce((a, s) => a + Number(s.positionSize), 0) / streak.length;
      if (Number(t.positionSize) > avgSize * 1.2) {
        sequences.push({
          lossStreak: streak, streakLength: streak.length,
          streakLossTotal: r1(streak.reduce((a, s) => a + s.pnl, 0)),
          nextTrade: t, avgStreakSize: r1(avgSize),
        });
      }
    }
    streak = t.pnl < 0 ? [...streak, t] : [];
  }
  return sequences;
}

// Discipline score (0-100): four equal components — using a stop loss, writing
// a reasoning journal, staying in a calm/neutral emotional state, and process
// quality self-ratings — minus a penalty for revenge/tilt flags found above.
export function computeDisciplineScore(trades) {
  if (!trades.length) return null;
  const withStop = trades.filter((t) => Number(t.stopLoss) > 0).length;
  const withReasoning = trades.filter((t) => t.journal?.reasoning?.trim()).length;
  const calmCount = trades.filter((t) => !IMPULSIVE_EMOTIONS.includes(t.journal?.emotion)).length;
  const avgProcessQuality = trades.reduce((a, t) => a + (Number(t.journal?.processQuality) || 0), 0) / trades.length;

  const stopLossScore = clamp((withStop / trades.length) * 25);
  const journalScore = clamp((withReasoning / trades.length) * 25);
  const emotionScore = clamp((calmCount / trades.length) * 25);
  const processScore = clamp((avgProcessQuality / 10) * 25);

  const revengeFlags = detectRevengeTrades(trades);
  const tiltFlags = detectTiltSequences(trades);
  const penalty = clamp((revengeFlags.length + tiltFlags.length) * 3, 0, 30);

  const score = Math.round(clamp(stopLossScore + journalScore + emotionScore + processScore - penalty));
  const band =
    score >= 75 ? { label: 'Disciplined', color: 'var(--success)' }
    : score >= 50 ? { label: 'Inconsistent', color: 'var(--warning)' }
    : { label: 'Needs work', color: 'var(--error)' };

  return {
    score, band,
    breakdown: { stopLoss: r1(stopLossScore), journal: r1(journalScore), emotion: r1(emotionScore), process: r1(processScore), penalty: r1(penalty) },
    revengeCount: revengeFlags.length, tiltCount: tiltFlags.length,
  };
}

// Win rate / avg PnL grouped by emotion tag — surfaces which emotional states
// actually correlate with better or worse outcomes for THIS trader.
export function emotionBreakdown(trades) {
  const groups = {};
  for (const t of trades) {
    const emo = t.journal?.emotion || 'neutral';
    groups[emo] = groups[emo] || { emotion: emo, count: 0, wins: 0, pnl: 0 };
    groups[emo].count++;
    if (t.pnl > 0) groups[emo].wins++;
    groups[emo].pnl += t.pnl;
  }
  return Object.values(groups)
    .map((g) => ({ ...g, winRate: r1((g.wins / g.count) * 100), pnl: r1(g.pnl) }))
    .sort((a, b) => b.count - a.count);
}
