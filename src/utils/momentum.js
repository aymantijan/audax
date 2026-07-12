// ─────────────────────────────────────────────────────────────────────────────
// MOMENTUM ENGINE — a generic day-based streak/decay calculator shared by two
// independent systems in AUDAX:
//
//  1. Learning momentum (learningStore) — makes a course's displayed SCORE a
//     "reasonable" reflection of sustained study, not just raw checklist
//     completion. You cannot cram a course to 100% in one sitting and keep a
//     top score forever: the multiplier only reaches 1.0 through consecutive
//     days of activity, and drops the moment a day is skipped.
//
//  2. Consistency multiplier (skillStore) — applied to EVERY xp award app-wide
//     (trades, courses, readings, habits, journal entries — anything that
//     calls awardXP). Steady daily engagement compounds your XP; bursts after
//     a long gap are dampened. This is what makes "work like the disciplined
//     personalities on the Leaderboard" the actually-optimal strategy: their
//     defining trait is consistency sustained over years, not sporadic effort.
//
// Both are one small state machine: { lastActivityDate, momentum, streak }.
// `advance()` commits a new activity event (call when the user actually does
// something). `preview()` is a pure read: what the multiplier would be RIGHT
// NOW, including decay accrued since the last recorded event — used so the
// UI reflects an overdue drop even before the next action is recorded.
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const dayKeyToDate = (k) => new Date(k + 'T00:00:00').getTime();
const daysBetween = (a, b) => Math.round((dayKeyToDate(b) - dayKeyToDate(a)) / MS_PER_DAY);

export const LEARNING_MOMENTUM_CONFIG = {
  max: 1.0,      // full credit — a course score = 100% of raw checklist progress
  step: 0.08,    // +8 points of multiplier per consecutive active day, rebuilding after a break
  floor: 0.4,    // never drops below 40% credit — tasks you did still count for something
  decayRate: 0.82, // each fully-skipped day multiplies momentum by 0.82 (an 18% cut, compounding)
};

export const CONSISTENCY_CONFIG = {
  max: 1.25,     // sustained daily engagement earns up to a 25% XP bonus
  step: 0.05,
  floor: 0.7,    // a long-abandoned-then-binged session still earns XP, just at a 30% discount
  decayRate: 0.9,
};

export function freshMomentumState() {
  return { lastActivityDate: null, momentum: 1, streak: 0 };
}

// Commit one activity event as having happened on `today` (a 'YYYY-MM-DD' key).
// Idempotent within a single day — calling it twice on the same day is a no-op
// after the first call, so completing 5 tasks in one sitting only counts once
// toward the streak (you can't fake consistency by batching).
export function advance(state, today, config) {
  const { lastActivityDate, momentum, streak } = state;
  if (lastActivityDate === today) return state;
  if (!lastActivityDate) return { lastActivityDate: today, momentum, streak: 1 };

  const gap = daysBetween(lastActivityDate, today);
  if (gap === 1) {
    // Yesterday was the last activity — the streak lives on and momentum recovers.
    return { lastActivityDate: today, momentum: Math.min(config.max, momentum + config.step), streak: streak + 1 };
  }
  // At least one full day passed with zero activity — the streak breaks and
  // momentum decays once per skipped day (today itself isn't a skipped day,
  // since activity is happening on it right now).
  const missedDays = gap - 1;
  return {
    lastActivityDate: today,
    momentum: Math.max(config.floor, momentum * Math.pow(config.decayRate, missedDays)),
    streak: 1,
  };
}

// Read-only projection as of `today`, without persisting — reflects decay that
// has accrued even if no activity has been recorded yet today.
export function preview(state, today, config) {
  const { lastActivityDate, momentum, streak } = state;
  if (!lastActivityDate) return { momentum, streak: 0, missedDays: 0 };
  const gap = daysBetween(lastActivityDate, today);
  if (gap <= 0) return { momentum, streak, missedDays: 0 };
  return { momentum: Math.max(config.floor, momentum * Math.pow(config.decayRate, gap)), streak: 0, missedDays: gap };
}
