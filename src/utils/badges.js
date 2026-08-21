import { useSkillStore } from '../store/skillStore';
import { toast } from '../store/uiStore';

// Shared badge-tier XP values and the generic "check unearned badges, award
// XP + toast for newly-earned ones" helper every domain store's
// checkBadges() action delegates to — the alternative was copy-pasting the
// same ~10-line loop into every domain store (health/engineering already
// had their own copy pre-existing; trading/deals/habits/finance are new).
// Badges feeding real XP (not just a cosmetic toast, which is all they did
// before) is what actually moves the needle on Leaderboard progression —
// same choke point as every other XP source (skillStore.awardXP), so badge
// XP still passes through the consistency multiplier like everything else.
export const BADGE_XP = { bronze: 15, silver: 30, gold: 60 };

// defs: [{id, name, tier, check(state)}]. state: the calling store's get().
// skillId: which skill absorbs the badge XP — awardXP no-ops on a locked
// skill, so a still-locked domain skill just means that domain's badges stay
// cosmetic-only until it unlocks; never throws or blocks earning the badge
// itself. Returns the updated awardedBadges array for the caller to `set`.
export function evaluateBadges(defs, state, skillId) {
  const newlyAwarded = [];
  for (const b of defs) {
    if (state.awardedBadges.includes(b.id)) continue;
    if (b.check(state)) newlyAwarded.push(b);
  }
  if (newlyAwarded.length) {
    const award = useSkillStore.getState().awardXP;
    for (const b of newlyAwarded) {
      const xp = BADGE_XP[b.tier] || BADGE_XP.bronze;
      award(skillId, xp, `badge: ${b.name}`);
      toast(`🏅 Badge earned: ${b.name} · +${xp} XP`, 'success');
    }
  }
  return newlyAwarded.length ? [...state.awardedBadges, ...newlyAwarded.map((b) => b.id)] : state.awardedBadges;
}
