// Financial goal rewards.
// Révisé — l'ancien barème (1 XP/1 000 DH, plafond 200) s'aplatissait dès
// 200 000 DH : au-delà, un objectif de 300k et un objectif de 10M rapportaient
// EXACTEMENT la même chose. Or un objectif financier atteint représente
// souvent des mois voire des années de discipline — un des jalons les plus
// rares et difficiles de l'app, à comparer aux autres récompenses ponctuelles :
//   échéance créée : 2 · budget défini : 3 · trade loggé : 5/skill (routinier)
//   phase Prop Firm passée : 15-20 · cours réussi (note A) : 15/skill
//   livre terminé : 30 (le jalon ponctuel le plus généreux jusqu'ici)
// Nouveau barème : 1 XP / 500 DH, plafond 2 000 — un objectif à 1M DH+ vaut
// désormais ~65× un livre terminé, ce qui reflète l'effort réel, tout en
// restant sous XP_TO_NEXT[niveau 5] (300) × quelques objectifs, pas un
// raccourci pour finir le jeu d'un coup. Repère Leaderboard (utils/grades.js,
// utils/personalities.js) : le grade 50 (fin de la 1ère ère) demande ~9 660 XP
// lifetime — même un objectif au plafond (2 000 XP) n'y contribue que pour
// ~20%, cohérent avec "rare et significatif" sans court-circuiter la
// progression construite sur des centaines de niveaux jusqu'à 2M XP.
export function calculateGoalXP(targetAmount) {
  return Math.max(10, Math.min(2000, Math.ceil((Number(targetAmount) || 0) / 500)));
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
