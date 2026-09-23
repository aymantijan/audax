/**
 * Spaced repetition — FSRS-4.5 (Free Spaced Repetition Scheduler, the model
 * Anki adopted in 23.10) with its published default parameters, plus short
 * learning steps for new / forgotten cards.
 *
 * Card scheduling state:
 *   { state: 'new'|'learning'|'review'|'relearning', due (ms), stability,
 *     difficulty, reps, lapses, lastReview (ms), step }
 * Ratings: 1 = À revoir, 2 = Difficile, 3 = Bien, 4 = Facile.
 */

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81; // so that R(S, S) = 0.9
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const RATINGS = [
  { value: 1, label: 'À revoir', key: '1', color: 'var(--error)' },
  { value: 2, label: 'Difficile', key: '2', color: 'var(--warning)' },
  { value: 3, label: 'Bien', key: '3', color: 'var(--success)' },
  { value: 4, label: 'Facile', key: '4', color: 'var(--accent-primary)' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const newCardState = () => ({ state: 'new', due: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReview: null, step: 0 });

export function retrievability(elapsedDays, stability) {
  if (!stability) return 0;
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

function intervalDays(stability, retention) {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, 36500);
}

const initStability = (g) => Math.max(0.1, W[g - 1]);
const initDifficulty = (g) => clamp(W[4] - (g - 3) * W[5], 1, 10);

function nextDifficulty(d, g) {
  const d1 = d - W[6] * (g - 3);
  return clamp(W[7] * initDifficulty(3) + (1 - W[7]) * d1, 1, 10);
}

function recallStability(d, s, r, g) {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
}

function forgetStability(d, s, r) {
  return Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
}

/**
 * Returns the card's new scheduling state after a rating at time `now`.
 * `retention` = desired recall probability (0.9 default → interval ≈ stability).
 */
export function schedule(card, rating, now = Date.now(), retention = 0.9) {
  const c = { ...newCardState(), ...card };
  const g = rating;
  const out = { ...c, reps: c.reps + 1, lastReview: now };

  if (c.state === 'new') {
    out.stability = initStability(g);
    out.difficulty = initDifficulty(g);
    if (g === 1) return { ...out, state: 'learning', step: 0, due: now + 1 * MIN };
    if (g === 2) return { ...out, state: 'learning', step: 0, due: now + 6 * MIN };
    if (g === 3) return { ...out, state: 'learning', step: 1, due: now + 10 * MIN };
    return { ...out, state: 'review', step: 0, due: now + intervalDays(out.stability, retention) * DAY };
  }

  if (c.state === 'learning' || c.state === 'relearning') {
    // Short-term steps: keep memory estimates, only move through the steps.
    out.difficulty = nextDifficulty(c.difficulty || initDifficulty(3), g);
    if (g === 1) return { ...out, step: 0, due: now + (c.state === 'relearning' ? 10 : 1) * MIN };
    if (g === 2) return { ...out, due: now + (c.state === 'relearning' ? 10 : 6) * MIN };
    if (g === 3 && c.state === 'learning' && c.step < 1) return { ...out, step: 1, due: now + 10 * MIN };
    if (g === 4) out.stability = Math.max(c.stability || initStability(3), initStability(4));
    return { ...out, state: 'review', step: 0, due: now + intervalDays(out.stability || initStability(3), retention) * DAY };
  }

  // Review
  const elapsed = Math.max(0, (now - (c.lastReview || now)) / DAY);
  const r = retrievability(elapsed, c.stability);
  out.difficulty = nextDifficulty(c.difficulty, g);
  if (g === 1) {
    out.stability = forgetStability(c.difficulty, c.stability, r);
    return { ...out, state: 'relearning', step: 0, lapses: c.lapses + 1, due: now + 10 * MIN };
  }
  out.stability = recallStability(c.difficulty, c.stability, r, g);
  let days = intervalDays(out.stability, retention);
  // Keep Hard ≤ Good ≤ Easy spacing sensible.
  if (g === 2) days = Math.max(1, Math.min(days, Math.round(intervalDays(c.stability, retention) * 1.2) || 1));
  return { ...out, state: 'review', due: now + days * DAY };
}

export function fmtInterval(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))} min`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))} h`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)} j`;
  if (d < 365) return `${Math.round(d / 30)} mois`;
  return `${(d / 365).toFixed(1).replace('.', ',')} an(s)`;
}

// Interval each button would give — shown under the rating buttons.
export function previewIntervals(card, now = Date.now(), retention = 0.9) {
  return RATINGS.map((r) => ({ ...r, interval: fmtInterval(schedule(card, r.value, now, retention).due - now) }));
}

export const isDue = (card, now = Date.now()) => card.state !== 'new' && card.due <= now;
