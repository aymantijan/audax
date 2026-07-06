// Moteur d'observations & alertes cross-domaine.
// Chaque donnée du site compte : ce module condense les signaux importants de
// la Finance (comptabilité, budget, objectifs), du Trading, des Habitudes, de
// l'Apprentissage, des Skills et des Lectures en un flux unique, trié par
// sévérité (danger > warning > success > info). Toutes les entrées sont
// optionnelles — un domaine absent ne produit simplement aucune observation.

const SEVERITY_ORDER = { danger: 0, warning: 1, success: 2, info: 3 };

function push(list, level, domain, message) {
  list.push({ id: `${domain}-${list.length}-${message.slice(0, 12)}`, level, domain, message });
}

export function buildObservations({ accounting, trading, habits, learning, skills, readings } = {}) {
  const obs = [];

  // ── Finance : équilibre financier, ratios, ESG, budget, objectifs ──
  if (accounting) {
    const { analysis, esg, budgetVariance, goalRows } = accounting;
    if (analysis) {
      if (analysis.tresorerieNette < 0) {
        push(obs, 'danger', 'Finance', `Trésorerie nette négative (${Math.round(analysis.tresorerieNette)} DH) — le fonds de roulement ne couvre pas le besoin en fonds de roulement.`);
      }
      if (analysis.fondsRoulement < 0) {
        push(obs, 'danger', 'Finance', 'Fonds de roulement négatif — des emplois durables sont financés par des ressources court terme.');
      }
      if (analysis.ratios?.endettement != null && analysis.ratios.endettement > 50) {
        push(obs, 'warning', 'Finance', `Endettement élevé : ${analysis.ratios.endettement.toFixed(0)}% du passif total.`);
      }
      if (analysis.ratios?.liquiditeGenerale != null && analysis.ratios.liquiditeGenerale < 1) {
        push(obs, 'warning', 'Finance', 'Liquidité générale sous 1 : les dettes court terme dépassent les actifs mobilisables.');
      }
    }
    if (esg && esg.tauxEpargne != null) {
      if (esg.tauxEpargne < 0) push(obs, 'danger', 'Finance', `Taux d'épargne négatif ce mois (${esg.tauxEpargne.toFixed(1)}%).`);
      else if (esg.tauxEpargne < 10) push(obs, 'warning', 'Finance', `Taux d'épargne faible ce mois (${esg.tauxEpargne.toFixed(1)}%), sous le seuil recommandé de 10-20%.`);
      else if (esg.tauxEpargne >= 30) push(obs, 'success', 'Finance', `Excellent taux d'épargne ce mois : ${esg.tauxEpargne.toFixed(1)}%.`);
    }
    for (const v of budgetVariance || []) {
      if (v.cls === 6 && !v.favorable && v.amount > 0) {
        push(obs, v.reel > v.amount * 1.25 ? 'danger' : 'warning', 'Budget', `${v.label} : ${Math.round(v.reel)} DH dépensés pour ${Math.round(v.amount)} DH budgétés.`);
      }
    }
    for (const g of goalRows || []) {
      if (g.achieved) continue;
      if (g.onTrack === false) push(obs, 'warning', 'Objectifs', `Objectif « ${g.name} » hors rythme — projection ${Math.round(g.projected)} DH à l'échéance pour une cible de ${Math.round(g.targetAmount)} DH.`);
      else if (g.onTrack === true && g.progress >= 90) push(obs, 'success', 'Objectifs', `Objectif « ${g.name} » presque atteint (${Math.round(g.progress)}%).`);
    }
  }

  // ── Trading : drawdown, dormance, dérive du taux de réussite ──
  if (trading) {
    const { maxDrawdownPct, tradesCount, daysSinceLastTrade, winRate, baselineWinRate } = trading;
    if (maxDrawdownPct != null && maxDrawdownPct > 20) {
      push(obs, 'danger', 'Trading', `Drawdown maximum élevé : ${maxDrawdownPct.toFixed(1)}% — revoir la taille des positions.`);
    } else if (maxDrawdownPct != null && maxDrawdownPct > 10) {
      push(obs, 'warning', 'Trading', `Drawdown maximum : ${maxDrawdownPct.toFixed(1)}%.`);
    }
    if (tradesCount > 0 && daysSinceLastTrade != null && daysSinceLastTrade > 14) {
      push(obs, 'info', 'Trading', `Aucun trade depuis ${daysSinceLastTrade} jours — journal en pause.`);
    }
    if (winRate != null && baselineWinRate != null && baselineWinRate - winRate > 15) {
      push(obs, 'warning', 'Trading', `Taux de réussite en baisse : ${winRate.toFixed(0)}% contre ${baselineWinRate.toFixed(0)}% habituellement.`);
    }
  }

  // ── Habitudes : conformité, burnout ──
  if (habits) {
    const { complianceRate, burnout } = habits;
    if (complianceRate != null && complianceRate < 30) {
      push(obs, 'warning', 'Habitudes', `Conformité aux habitudes sous 30% cette semaine.`);
    } else if (complianceRate != null && complianceRate >= 90) {
      push(obs, 'success', 'Habitudes', `Conformité aux habitudes excellente : ${Math.round(complianceRate)}%.`);
    }
    for (const t of burnout?.triggers || []) {
      push(obs, t.severity === 'high' ? 'danger' : 'warning', 'Bien-être', t.message);
    }
  }

  // ── Apprentissage : GPA, cours à l'arrêt ──
  if (learning) {
    const { gpa, stalledCourses } = learning;
    if (gpa != null && gpa < 2.0) push(obs, 'warning', 'Apprentissage', `GPA en dessous de 2.0 (${gpa.toFixed(2)}).`);
    if (stalledCourses > 0) push(obs, 'info', 'Apprentissage', `${stalledCourses} cours actif${stalledCourses > 1 ? 's' : ''} sans progression récente.`);
  }

  // ── Skills : décroissance, verrous ──
  if (skills) {
    const { decayedCount, warningCount } = skills;
    if (decayedCount > 0) push(obs, 'warning', 'Skills', `${decayedCount} compétence${decayedCount > 1 ? 's ont' : ' a'} régressé par manque de pratique récente.`);
    if (warningCount > 0) push(obs, 'info', 'Skills', `${warningCount} compétence${warningCount > 1 ? 's' : ''} sans pratique depuis 60+ jours — bientôt en régression.`);
  }

  // ── Lectures : streak, activité ──
  if (readings) {
    const { streak, inProgressCount } = readings;
    if (streak === 0 && inProgressCount === 0) push(obs, 'info', 'Lecture', 'Aucune lecture en cours — reprenez un livre pour relancer la série.');
    else if (streak >= 7) push(obs, 'success', 'Lecture', `Série de lecture de ${streak} jours — excellente régularité.`);
  }

  return obs.sort((a, b) => SEVERITY_ORDER[a.level] - SEVERITY_ORDER[b.level]);
}
