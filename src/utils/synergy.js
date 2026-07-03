import { startOfMonth } from 'date-fns';
import { INITIAL_ACCOUNT_VALUE, GRADE_POINTS } from './constants';
import { currentAccountValue, habitCompliance, weightedGPA } from './calculations';

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r1 = (n) => Math.round(n * 10) / 10;

// All five domain scores are 0-100. Weighted composite = primary*0.75 + avg(others)*0.25.
// Note: the raw spec formulas divided each weighted sum by 3, which caps scores near 33 —
// implemented here as proper 0-100 weighted averages instead so color thresholds work.
export function calculateSynergies({ trades, courses, transactions, budgets, energyLogs, habits, habitLogs, skills, primaryDomain, today }) {
  const monthStart = startOfMonth(new Date());

  const scores = {
    trading: tradingScore(trades, habits, habitLogs, monthStart, today),
    learning: learningScore(courses),
    finance: financeScore(transactions, budgets, monthStart),
    health: healthScore(energyLogs, habits, habitLogs, monthStart, today),
    growth: growthScore(skills, habits, monthStart),
  };

  const values = Object.values(scores);
  const average = r1(values.reduce((a, b) => a + b, 0) / values.length);

  const domain = scores[primaryDomain] !== undefined ? primaryDomain : 'trading';
  const primary = scores[domain];
  const otherAvg = (values.reduce((a, b) => a + b, 0) - primary) / (values.length - 1);
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
  const progress = live.reduce((a, c) => a + (c.status === 'completed' ? 100 : Number(c.progressPercent) || 0), 0) / live.length;

  const gpa = weightedGPA(courses, GRADE_POINTS);
  const gpaComponent = gpa === null ? progress : (gpa / 4) * 100;

  const readingsDone = live.flatMap((c) => c.readings || []).filter((r) => r.completed).length;
  const readingComponent = clamp(readingsDone * 10);

  return r1(clamp(progress * 0.4 + gpaComponent * 0.4 + readingComponent * 0.2));
}

function financeScore(transactions, budgets, monthStart) {
  const monthTx = transactions.filter((t) => new Date(t.date) >= monthStart);
  const income = monthTx.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  if (!budgets.length && !income && !expenses) return 0;

  let adherence = 50;
  if (budgets.length) {
    const per = budgets.map((b) => {
      const spent = monthTx.filter((t) => t.type === 'expense' && t.category === b.category).reduce((a, t) => a + t.amount, 0);
      return spent <= b.amount ? 100 : clamp(100 - ((spent - b.amount) / b.amount) * 100);
    });
    adherence = per.reduce((a, b) => a + b, 0) / per.length;
  }
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  return r1(clamp(adherence * 0.5 + clamp(savingsRate) * 0.5));
}

function healthScore(energyLogs, habits, habitLogs, monthStart, today) {
  const monthLogs = energyLogs.filter((l) => new Date(l.date + 'T00:00:00') >= monthStart);
  if (!monthLogs.length) return 0;
  const avgEnergy = monthLogs.reduce((a, l) => a + (l.energyStartLevel || 0), 0) / monthLogs.length;
  const avgSleep = monthLogs.reduce((a, l) => a + (l.sleepData?.sleepQualityScore || 0), 0) / monthLogs.length;

  const healthHabits = habits.filter((h) => (h.category === 'health' || h.category === 'recovery') && !h.archived);
  const comp = habitCompliance(healthHabits, habitLogs, 30, today);
  const habitComponent = healthHabits.length ? comp.rate * 100 : (avgEnergy / 10) * 100;

  return r1(clamp(avgEnergy * 10 * 0.3 + avgSleep * 10 * 0.4 + habitComponent * 0.3));
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

export function synergyColor(score) {
  if (score > 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}
