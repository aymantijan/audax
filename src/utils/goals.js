// Financial goal rewards.
// XP: 1 XP per 1,000 DH of target, capped at 200 (per user preference).
export function calculateGoalXP(targetAmount) {
  return Math.max(1, Math.min(200, Math.ceil((Number(targetAmount) || 0) / 1000)));
}

// Badges by target size (DH).
export function badgeForGoal(targetAmount) {
  const t = Number(targetAmount) || 0;
  if (t >= 1_000_000) return 'Millionaire';
  if (t >= 500_000) return 'Half-Century Saver';
  if (t >= 100_000) return 'Hundred-Miler';
  if (t >= 10_000) return 'First Steps';
  return 'Getting Started';
}

// Budget-overage severity classification (10% orange, 25% red — per user pref).
export function budgetSeverity(spent, budgeted) {
  if (!budgeted) return null;
  const over = ((spent - budgeted) / budgeted) * 100;
  if (over <= 10) return null;
  return { over, level: over > 25 ? 'red' : 'orange' };
}
