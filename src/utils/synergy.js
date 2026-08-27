import { startOfMonth } from 'date-fns';
import { INITIAL_ACCOUNT_VALUE, GRADE_POINTS } from './constants';
import { currentAccountValue, habitCompliance, weightedGPA } from './calculations';
import { calculateCourseProgress } from './course-progress';
import { esg, budgetVariance, financialAnalysis, netWorthHistory, paceFromEdges, echeanceOccurrences } from './accounting-engine';
import { DEAL_STAGES } from './constants';

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r1 = (n) => Math.round(n * 10) / 10;

// All five domain scores are 0-100. Weighted composite = primary*0.75 + avg(others)*0.25.
// Note: the raw spec formulas divided each weighted sum by 3, which caps scores near 33 —
// implemented here as proper 0-100 weighted averages instead so color thresholds work.
export function calculateSynergies({
  trades, courses, journal, accountingBudgets, corrections, echeances, energyLogs, habits, habitLogs, skills, primaryDomain, today,
  healthExtras, labEntries, engineeringProjects, engineeringEnabled, tradingEnabled = true, deals, businesses, dealsEnabled = true,
  contacts, applications, posts, personalProjects, networkingEnabled = false, careerEnabled = false, contentEnabled = false, projectsEnabled = false,
  focusSessions, focusEnabled = false,
}) {
  const monthStart = startOfMonth(new Date());

  const scores = {
    learning: learningScore(courses),
    finance: financeScore(journal, accountingBudgets, corrections, echeances, monthStart, today),
    health: healthScore(energyLogs, habits, habitLogs, monthStart, today, healthExtras),
    growth: growthScore(skills, habits, monthStart),
  };
  // Same reasoning as the engineering gate below, but inverted: Trading
  // defaults to ENABLED (it's an original, always-on domain — see
  // authStore's enabledModules default), so this only ever DROPS the score
  // for someone who explicitly opted out during onboarding. Without this, a
  // user who never chose Trading still had a permanent 0-ish "trading"
  // score (an empty account, no trades) silently dragging their composite
  // average/weighted score down for a domain they never asked to be judged on.
  if (tradingEnabled) scores.trading = tradingScore(trades, habits, habitLogs, monthStart, today);
  // Only scored for accounts that actually turned Engineering on — otherwise
  // it would silently pull the composite average/weighted score of every
  // other user down toward 0 (an untouched, brand-new domain) the moment
  // this shipped, for a module they never opted into.
  if (engineeringEnabled) scores.engineering = engineeringScore(labEntries || [], engineeringProjects || [], habits, habitLogs, monthStart, today);
  // BUGFIX (2026-08-26): Deals/Business Projects had NO synergy domain at all —
  // unlike every other section, working PE deals or running a business never
  // moved the composite score. `dealsEnabled` = pe OR business turned on (see
  // useSynergy.js), same opt-out-aware gating as Trading/Engineering above.
  if (dealsEnabled) scores.deals = dealsScore(deals || [], businesses || [], monthStart, today);
  // Networking/Career/Content/Projects (2026-08-27) — four new domains, same
  // opt-in-aware gating as Engineering (default false: never silently pulls
  // an existing/uninterested user's composite score toward 0).
  if (networkingEnabled) scores.networking = networkingScore(contacts || [], monthStart);
  if (careerEnabled) scores.career = careerScore(applications || [], monthStart);
  if (contentEnabled) scores.content = contentScore(posts || [], monthStart);
  if (projectsEnabled) scores.projects = projectsScore(personalProjects || [], monthStart);
  if (focusEnabled) scores.focus = focusScore(focusSessions || [], monthStart);

  const values = Object.values(scores);
  const average = r1(values.reduce((a, b) => a + b, 0) / values.length);

  // Fall back to whichever domain is actually scored for this account — never
  // hardcode 'trading', which may not even be in `scores` if disabled.
  const domain = scores[primaryDomain] !== undefined ? primaryDomain : Object.keys(scores)[0];
  const primary = scores[domain];
  const otherAvg = values.length > 1 ? (values.reduce((a, b) => a + b, 0) - primary) / (values.length - 1) : primary;
  const weighted = r1(primary * 0.75 + otherAvg * 0.25);

  return { scores, average, weighted, primaryDomain: domain };
}

function tradingScore(trades, habits, habitLogs, monthStart, today) {
  const account = currentAccountValue(trades);
  const growthPct = ((account - INITIAL_ACCOUNT_VALUE) / INITIAL_ACCOUNT_VALUE) * 100;
  const growthComponent = clamp(50 + growthPct * 5); // +10% account growth → 100

  const monthTrades = trades.filter((t) => new Date(t.date) >= monthStart);
  const winRate = monthTrades.length ? (monthTrades.filter((t) => t.pnl > 0).length / monthTrades.length) * 100 : 50; // neutral if no trades yet

  const tradingHabits = habits.filter((h) => h.category === 'trading' && !h.archived);
  const comp = habitCompliance(tradingHabits, habitLogs, 30, today);
  const habitComponent = tradingHabits.length ? comp.rate * 100 : 50;

  return r1(clamp(growthComponent * 0.3 + winRate * 0.5 + habitComponent * 0.2));
}

function learningScore(courses) {
  const live = courses.filter((c) => c.status !== 'dropped');
  if (!live.length) return 0;
  // Chapter/checklist-based courses track completion in their chapters, not the
  // legacy `progressPercent` field — calculateCourseProgress() reads whichever
  // is actually populated, so real task progress is never left out here.
  const progress = live.reduce((a, c) => a + (c.status === 'completed' ? 100 : calculateCourseProgress(c)), 0) / live.length;

  const gpa = weightedGPA(courses, GRADE_POINTS);
  const gpaComponent = gpa === null ? progress : (gpa / 4) * 100;

  const readingsDone = live.flatMap((c) => c.readings || []).filter((r) => r.completed).length;
  const readingComponent = clamp(readingsDone * 10);

  return r1(clamp(progress * 0.4 + gpaComponent * 0.4 + readingComponent * 0.2));
}

// Score Finance — dérivé de la VRAIE comptabilité en partie double
// (accountingStore : journal, budgets, corrections, échéances), plus l'ancien
// financeStore à catégories simples qui restait mort dès qu'on migrait vers
// le Journal. Cinq signaux indépendants, chacun 0-100, pondérés :
//
//   1. Taux d'épargne du mois (30%) — ESG (revenus − dépenses de vie
//      courante) / revenus, calculé sur le mois en cours. Neutre (50) tant
//      qu'aucun revenu n'est encore encaissé ce mois — pas de pénalité
//      artificielle en début de mois.
//   2. Discipline budgétaire (25%) — moyenne de la réalisation de CHAQUE
//      budget de charges actif aujourd'hui (sa propre période, voir
//      getPeriodBounds) : 100 si sous le plafond, dégradé linéairement au-delà.
//      Neutre (50) si aucun budget n'est défini.
//   3. Santé bilancielle (20%) — moitié liquidité générale (créances +
//      trésorerie / dettes court terme, capée à 100 pour un ratio ≥ 2 ;
//      100 d'office si aucune dette court terme), moitié taux d'endettement
//      inversé (moins de dettes = mieux).
//   4. Progression du patrimoine (15%) — rythme mensuel de l'ANCC sur les 6
//      derniers mois, en % du patrimoine actuel (+10 %/mois → 100). Neutre
//      (50) avec moins de 2 points d'historique ou un patrimoine ≤ 0.
//   5. Discipline de paiement (10%) — pénalise les échéances actives en
//      retard (non réglées), −20 pts chacune. 100 par défaut si aucune
//      échéance en retard ou aucune échéance configurée.
//
// Retourne 0 si le journal est entièrement vide (rien à évaluer).
function financeScore(journal, budgets, corrections, echeances, monthStart, today) {
  if (!journal?.length) return 0;
  const monthFrom = monthStart.toISOString().slice(0, 10);

  // 1. Taux d'épargne du mois
  const monthEsg = esg(journal, { from: monthFrom, to: today });
  const savingsComponent = monthEsg.revenusTotaux > 0 ? clamp(monthEsg.tauxEpargne) : 50;

  // 2. Discipline budgétaire — seulement les budgets de charges dont la
  // période couvre aujourd'hui (un budget custom déjà terminé ne compte pas).
  const variance = budgetVariance(journal, budgets || [], today);
  const activeCharges = variance.filter((v) => v.cls === 6 && v.realisation !== null && v.bounds.from <= today && today <= v.bounds.to);
  const budgetComponent = activeCharges.length
    ? clamp(activeCharges.reduce((a, v) => a + (v.realisation <= 100 ? 100 : 100 - (v.realisation - 100)), 0) / activeCharges.length)
    : 50;

  // 3. Santé bilancielle — liquidité générale + endettement
  const analysis = financialAnalysis(journal);
  const liquidityComponent = analysis.bs.passif.dettesCT > 0 ? clamp((analysis.ratios.liquiditeGenerale ?? 0) * 50) : 100;
  const debtComponent = clamp(100 - (analysis.ratios.endettement ?? 0));
  const balanceSheetComponent = (liquidityComponent + debtComponent) / 2;

  // 4. Progression du patrimoine — rythme mensuel de l'ANCC sur 6 mois
  const nwHist = netWorthHistory(journal, corrections || [], 6);
  const nwCurrent = nwHist.length ? nwHist[nwHist.length - 1].ancc : 0;
  const nwPace = paceFromEdges(nwHist, 'ancc');
  const networthComponent = nwHist.length >= 2 && nwCurrent > 0 ? clamp(50 + (nwPace / nwCurrent) * 100 * 10) : 50;

  // 5. Discipline de paiement — échéances actives en retard (non réglées)
  const yesterday = new Date(new Date(`${today}T00:00:00`).getTime() - 86400000).toISOString().slice(0, 10);
  const overdueCount = (echeances || [])
    .filter((e) => e.active)
    .reduce((a, e) => a + echeanceOccurrences(e, e.dueDate, yesterday).length, 0);
  const paymentComponent = clamp(100 - overdueCount * 20);

  return r1(
    clamp(
      savingsComponent * 0.3 + budgetComponent * 0.25 + balanceSheetComponent * 0.2 + networthComponent * 0.15 + paymentComponent * 0.1
    )
  );
}

// healthExtras (optional) folds in the newer healthStore domain — workouts logged,
// nutrition quality, today's readiness — without disturbing the original
// energyLogs-only formula for anyone calling this before healthStore existed.
function healthScore(energyLogs, habits, habitLogs, monthStart, today, healthExtras = {}) {
  const monthLogs = energyLogs.filter((l) => new Date(l.date + 'T00:00:00') >= monthStart);
  if (!monthLogs.length) return 0;
  const avgEnergy = monthLogs.reduce((a, l) => a + (l.energyStartLevel || 0), 0) / monthLogs.length;
  const avgSleep = monthLogs.reduce((a, l) => a + (l.sleepData?.sleepQualityScore || 0), 0) / monthLogs.length;

  const healthHabits = habits.filter((h) => (h.category === 'health' || h.category === 'recovery') && !h.archived);
  const comp = habitCompliance(healthHabits, habitLogs, 30, today);
  const habitComponent = healthHabits.length ? comp.rate * 100 : (avgEnergy / 10) * 100;

  const legacyScore = clamp(avgEnergy * 10 * 0.3 + avgSleep * 10 * 0.4 + habitComponent * 0.3);

  const { workoutsThisMonth = 0, avgNutritionQuality = null, avgReadiness = null } = healthExtras;
  if (!workoutsThisMonth && avgNutritionQuality == null && avgReadiness == null) return r1(legacyScore);

  const workoutComponent = clamp(workoutsThisMonth * 8); // ~12+ sessions/month → near-max
  const storeScore = clamp(workoutComponent * 0.4 + (avgNutritionQuality ?? legacyScore) * 0.3 + (avgReadiness ?? legacyScore) * 0.3);
  return r1(clamp(legacyScore * 0.6 + storeScore * 0.4));
}

function growthScore(skills, habits, monthStart) {
  const ms = monthStart.getTime();
  const skillList = Object.values(skills);
  const xpMonth = skillList.flatMap((s) => s.xpLog || []).filter((e) => e.date >= ms).reduce((a, e) => a + e.amount, 0);
  const xpComponent = clamp((xpMonth / 500) * 100);

  const levelUps = skillList.flatMap((s) => s.levelUpDates || []).filter((d) => d >= ms).length;
  const levelComponent = clamp(levelUps * 20);

  const newHabits = habits.filter((h) => !h.archived && h.createdAt >= ms).length;
  const habitComponent = clamp(newHabits * 25);

  return r1(clamp(xpComponent * 0.4 + levelComponent * 0.3 + habitComponent * 0.3));
}

// 0 if truly nothing logged yet (same convention as financeScore/healthScore —
// an empty domain reads as "not started", not a neutral 50). Three signals:
// lab-entry frequency this month, project tasks completed this month, and
// engineering-category habit compliance (neutral 50 if no such habit exists).
function engineeringScore(labEntries, projects, habits, habitLogs, monthStart, today) {
  if (!labEntries.length && !projects.length) return 0;
  const monthStartMs = monthStart.getTime();

  const monthLab = labEntries.filter((e) => new Date(e.date + 'T00:00:00') >= monthStart).length;
  const labComponent = clamp(monthLab * 15); // ~7 entries/month → near-max

  const monthTasksDone = projects.flatMap((p) => p.tasks || []).filter((t) => t.status === 'done' && t.completedAt >= monthStartMs).length;
  const taskComponent = clamp(monthTasksDone * 12);

  const engHabits = habits.filter((h) => h.category === 'engineering' && !h.archived);
  const comp = habitCompliance(engHabits, habitLogs, 30, today);
  const habitComponent = engHabits.length ? comp.rate * 100 : 50;

  return r1(clamp(labComponent * 0.35 + taskComponent * 0.35 + habitComponent * 0.3));
}

// 0 if truly nothing logged yet (same convention as the other domains). Two
// independent tracks, averaged when both are actually used, so a user who
// only does one of the two isn't scored against the other's empty state:
//   - PE deals: pipeline progress (avg stage reached across deals) + task
//     execution this month.
//   - Business projects: this month's logged activity — ideas/facts, KPI
//     readings, bookkeeping entries. (Gantt tasks aren't timestamped on
//     completion in businessStore, so they can't feed a "this month" signal
//     the way lab entries/course checklist ticks do elsewhere.)
function dealsScore(deals, businesses, monthStart, today) {
  if (!deals.length && !businesses.length) return 0;
  const monthStartMs = monthStart.getTime();

  const monthDealTasksDone = deals.flatMap((d) => d.tasks || []).filter((t) => t.status === 'done' && t.completedAt >= monthStartMs).length;
  const peTaskComponent = clamp(monthDealTasksDone * 12);
  const peStageComponent = deals.length
    ? clamp((deals.reduce((a, d) => a + (d.stageIndex || 0), 0) / deals.length / (DEAL_STAGES.length - 1)) * 100)
    : 50;
  const peComponent = r1(clamp(peTaskComponent * 0.6 + peStageComponent * 0.4));

  const monthEvents = businesses.flatMap((b) => b.events || []).filter((e) => e.createdAt >= monthStartMs).length;
  const monthKpiLogs = businesses.flatMap((b) => b.kpiLogs || []).filter((l) => l.createdAt >= monthStartMs).length;
  const monthEntries = businesses.flatMap((b) => b.journal || []).filter((e) => e.createdAt >= monthStartMs).length;
  const bizComponent = r1(clamp(monthEvents * 8 + monthKpiLogs * 8 + monthEntries * 6));

  if (deals.length && businesses.length) return r1((peComponent + bizComponent) / 2);
  return deals.length ? peComponent : bizComponent;
}

// 0 if truly nothing logged yet (same convention as every other domain).
// Two signals: this month's new contacts (outreach) and this month's logged
// touches (actually following up) — the latter weighted higher since a
// contact you never talk to isn't really "networking".
function networkingScore(contacts, monthStart) {
  if (!contacts.length) return 0;
  const monthStartMs = monthStart.getTime();
  const monthTouches = contacts.flatMap((c) => c.touches || []).filter((t) => t.createdAt >= monthStartMs).length;
  const monthNewContacts = contacts.filter((c) => c.createdAt >= monthStartMs).length;
  const touchComponent = clamp(monthTouches * 10);
  const contactComponent = clamp(monthNewContacts * 20);
  return r1(clamp(touchComponent * 0.6 + contactComponent * 0.4));
}

// New applications this month (outreach) + stage advances this month
// (real progress through a funnel, weighted higher than just applying).
function careerScore(applications, monthStart) {
  if (!applications.length) return 0;
  const monthStartMs = monthStart.getTime();
  const monthNew = applications.filter((a) => a.createdAt >= monthStartMs).length;
  const monthAdvances = applications
    .flatMap((a) => a.stageHistory || [])
    .filter((h) => h.stage !== 'Applied' && new Date(`${h.date}T00:00:00`).getTime() >= monthStartMs).length;
  const newComponent = clamp(monthNew * 15);
  const advanceComponent = clamp(monthAdvances * 20);
  return r1(clamp(newComponent * 0.4 + advanceComponent * 0.6));
}

// Posts published this month — publication cadence is the whole signal here,
// engagement (likes/comments) is outside the user's direct control so isn't
// scored (same reasoning healthScore avoids scoring raw outcomes over effort).
function contentScore(posts, monthStart) {
  if (!posts.length) return 0;
  const monthStartMs = monthStart.getTime();
  const monthPosts = posts.filter((p) => p.createdAt >= monthStartMs).length;
  return r1(clamp(monthPosts * 20));
}

// New projects started this month + tasks completed this month across all
// projects — same shape as engineeringScore's lab/task split.
function projectsScore(projects, monthStart) {
  if (!projects.length) return 0;
  const monthStartMs = monthStart.getTime();
  const monthNew = projects.filter((p) => p.createdAt >= monthStartMs).length;
  const monthTasksDone = projects.flatMap((p) => p.tasks || []).filter((t) => t.status === 'done' && t.completedAt >= monthStartMs).length;
  const newComponent = clamp(monthNew * 20);
  const taskComponent = clamp(monthTasksDone * 12);
  return r1(clamp(taskComponent * 0.6 + newComponent * 0.4));
}

// Minutes of deep work logged this month — ~5 hours (300 min) reaches 100.
// Unlike the other new domains, focus sessions target a real timestamp
// (createdAt) rather than a free-text date, so "this month" here means
// actually logged this month, not backdated into it.
function focusScore(sessions, monthStart) {
  if (!sessions.length) return 0;
  const monthStartMs = monthStart.getTime();
  const monthMinutes = sessions.filter((s) => s.createdAt >= monthStartMs).reduce((a, s) => a + s.durationMinutes, 0);
  return r1(clamp(monthMinutes / 3));
}

export function synergyColor(score) {
  if (score > 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}
