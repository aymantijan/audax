// Personal financial-management analytics — inspired by general accounting (bilan),
// cost accounting (fixed/variable/exceptional costs), budgetary control, and treasury
// management (cash flow, liquidity, runway). All pure functions — no store coupling —
// so the same math can be unit-tested and reused across Overview/Treasury/Ratios tabs.

// ---- Ratios ----
// Returns a flat set of standard personal-finance ratios. Any input that can't be
// computed (e.g. no income yet) yields `null` rather than 0/Infinity, so the UI can
// render "—" instead of a misleading number.
export function computeRatios({
  income = 0,
  expenses = 0,
  fixedExpenses = 0,
  variableExpenses = 0,
  exceptionalExpenses = 0,
  liquidAssets = 0,
  shortTermLiabilities = 0,
  totalAssets = 0,
  totalLiabilities = 0,
}) {
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : null;
  const expenseRatio = income > 0 ? (expenses / income) * 100 : null;
  const fixedCostRatio = income > 0 ? (fixedExpenses / income) * 100 : null;
  const variableCostRatio = income > 0 ? (variableExpenses / income) * 100 : null;
  const exceptionalCostRatio = income > 0 ? (exceptionalExpenses / income) * 100 : null;
  const currentRatio = shortTermLiabilities > 0 ? liquidAssets / shortTermLiabilities : liquidAssets > 0 ? null : null;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : null;
  const solvencyRatio = totalAssets > 0 ? ((totalAssets - totalLiabilities) / totalAssets) * 100 : null;
  return { savingsRate, expenseRatio, fixedCostRatio, variableCostRatio, exceptionalCostRatio, currentRatio, debtRatio, solvencyRatio };
}

// Months of liquid reserve left at the current burn rate (treasury "runway").
export function runwayMonths(liquidAssets, avgMonthlyExpenses) {
  if (!avgMonthlyExpenses || avgMonthlyExpenses <= 0) return liquidAssets > 0 ? Infinity : null;
  return liquidAssets / avgMonthlyExpenses;
}

// Simple linear treasury forecast (budget de trésorerie): projects liquid balance
// forward from committed recurring flows (or historical average net if none logged).
export function forecastCashFlow({ startBalance = 0, monthlyNet = 0, months = 6 }) {
  const series = [];
  let bal = startBalance;
  for (let i = 1; i <= months; i++) {
    bal += monthlyNet;
    series.push({ month: i, balance: bal });
  }
  return series;
}

// Severity bucket for a ratio against warn/bad thresholds. `invert` for ratios where
// LOWER is worse (e.g. current ratio, savings rate).
export function ratioSeverity(value, { warn, bad, invert = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (!invert) {
    if (value >= bad) return 'red';
    if (value >= warn) return 'orange';
    return null;
  }
  if (value <= bad) return 'red';
  if (value <= warn) return 'orange';
  return null;
}

// Consolidates budget overages + ratio thresholds + runway into one alert feed.
export function buildAlerts({ budgetWarnings = [], ratios = {}, runway = null }) {
  const alerts = [];

  for (const b of budgetWarnings) {
    alerts.push({
      id: `budget-${b.id}`,
      level: b.severity.level,
      category: 'Budget',
      message: `${b.category} : dépassement de ${b.severity.over.toFixed(1)}% du budget`,
    });
  }

  if (ratios.savingsRate !== null && ratios.savingsRate !== undefined) {
    if (ratios.savingsRate < 0) {
      alerts.push({ id: 'savings-negative', level: 'red', category: 'Trésorerie', message: `Taux d'épargne négatif (${ratios.savingsRate.toFixed(1)}%) — les dépenses dépassent les revenus ce mois-ci` });
    } else if (ratios.savingsRate < 10) {
      alerts.push({ id: 'savings-low', level: 'orange', category: 'Trésorerie', message: `Taux d'épargne faible (${ratios.savingsRate.toFixed(1)}%), sous le seuil recommandé de 10-20%` });
    }
  }

  if (runway !== null && runway !== undefined && Number.isFinite(runway)) {
    if (runway < 3) {
      alerts.push({ id: 'runway-critical', level: 'red', category: 'Trésorerie', message: `Réserve de liquidités critique : ${runway.toFixed(1)} mois de dépenses couverts` });
    } else if (runway < 6) {
      alerts.push({ id: 'runway-low', level: 'orange', category: 'Trésorerie', message: `Réserve de liquidités sous la cible : ${runway.toFixed(1)} mois (recommandé : 6)` });
    }
  }

  if (ratios.debtRatio !== null && ratios.debtRatio !== undefined) {
    if (ratios.debtRatio > 50) {
      alerts.push({ id: 'debt-high', level: 'red', category: 'Solvabilité', message: `Ratio d'endettement élevé : ${ratios.debtRatio.toFixed(1)}% de l'actif total` });
    } else if (ratios.debtRatio > 35) {
      alerts.push({ id: 'debt-mid', level: 'orange', category: 'Solvabilité', message: `Ratio d'endettement à surveiller : ${ratios.debtRatio.toFixed(1)}%` });
    }
  }

  if (ratios.currentRatio !== null && ratios.currentRatio !== undefined && ratios.currentRatio < 1) {
    alerts.push({ id: 'current-ratio-low', level: 'orange', category: 'Solvabilité', message: `Ratio de liquidité générale < 1 (${ratios.currentRatio.toFixed(2)}) — le passif court terme dépasse les actifs liquides` });
  }

  if (ratios.fixedCostRatio !== null && ratios.fixedCostRatio !== undefined && ratios.fixedCostRatio > 50) {
    alerts.push({ id: 'fixed-cost-high', level: 'orange', category: 'Coûts', message: `Charges fixes élevées : ${ratios.fixedCostRatio.toFixed(1)}% du revenu mensuel` });
  }

  const order = { red: 0, orange: 1 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}
