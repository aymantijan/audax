// Maps every skill to one of the 5 synergy-score life domains (trading /
// finance / health / learning / growth — same 5 as utils/synergy.js) via its
// skill-tree `category`. Used for the Leaderboard's informational Domain
// Balance breakdown ("where is my XP coming from") — grade progression
// itself uses raw Lifetime XP (see grades.js/Leaderboard.jsx); an earlier
// diminishing-returns-per-domain grading mechanic (balancedGradeXp) was
// tried and explicitly rejected by the user as too opaque/punishing, and
// removed.

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
