// Maps every skill to one of the 5 synergy-score life domains (trading /
// finance / health / learning / growth — same 5 as utils/synergy.js) via its
// skill-tree `category`, and uses that to compute a domain-balanced XP figure
// for the grade ladder.
//
// WHY THIS EXISTS: grades.js's own comment says "raw grinding alone never
// carries you to the top: balance matters" — but `skillStore.getLifetimeXP()`
// just sums every skill's XP with zero regard for domain, and awardXP has no
// daily cap. In practice a single trade auto-awards ~15-25 XP across several
// trading skills with no limit on trades/day, while a habit or workout is
// naturally capped at a few log-worthy actions per day. A very active trader
// could out-grade someone who's genuinely balanced across all 5 domains,
// purely on trading VOLUME — undermining the ladder's stated design intent.
// This file is the fix, applied only to the grade calculation (see
// balancedGradeXp) — it does NOT touch per-skill leveling or the raw
// "Lifetime XP" figure shown on the Leaderboard, which stays literal so
// total-effort bragging rights aren't affected, only rank progression is.

import { SKILL_MAP } from './constants';

const CATEGORY_TO_XP_DOMAIN = {
  Trading: 'trading',
  'Advanced Trading': 'trading',
  Finance: 'finance',
  Health: 'health',
  Knowledge: 'learning',
  'Academics (ISCAE)': 'learning',
  'Soft Skills': 'growth',
  Discipline: 'growth',
  'Private Equity': 'growth',
  'Growth Equity': 'growth',
  'Venture Capital': 'growth',
  'Revenue-Based Financing': 'growth',
};

export const XP_DOMAINS = ['trading', 'finance', 'health', 'learning', 'growth'];
export const XP_DOMAIN_LABELS = { trading: 'Trading', finance: 'Finance', health: 'Health', learning: 'Learning', growth: 'Growth' };

export function domainForSkill(skillId) {
  const def = SKILL_MAP[skillId];
  return (def && CATEGORY_TO_XP_DOMAIN[def.category]) || 'growth';
}

// Sums positive XP (skips XP-removal entries, which are negative) per domain
// across every skill's xpLog.
export function domainXpBreakdown(skills) {
  const totals = Object.fromEntries(XP_DOMAINS.map((d) => [d, 0]));
  for (const skill of Object.values(skills)) {
    const domain = domainForSkill(skill.id);
    for (const entry of skill.xpLog || []) {
      if (entry.amount > 0) totals[domain] += entry.amount;
    }
  }
  return totals;
}

// Grade-ladder XP: diminishing returns PER DOMAIN (concave, exponent < 1) so
// piling XP into one domain buys progressively less grade-XP the more
// lopsided practice gets, while the SAME raw total spread evenly across all
// 5 domains yields strictly more. Example: 10,000 raw XP all in Trading →
// 10000^0.85 ≈ 3,715 grade-XP. The same 10,000 split evenly (2,000 each) →
// 5 × 2000^0.85 ≈ 4,714 grade-XP — about 27% more for identical effort, just
// because it's balanced. This is a smooth incentive, not a hard cap — no
// action is ever blocked or wasted, over-focusing just climbs the ladder slower.
const DIMINISHING_EXPONENT = 0.85;
export function balancedGradeXp(skills) {
  const totals = domainXpBreakdown(skills);
  return Math.round(Object.values(totals).reduce((a, x) => a + Math.pow(x, DIMINISHING_EXPONENT), 0));
}
