/**
 * Finances "Aujourd'hui" — the day-to-day money picture (Finances n°3).
 * Pure function over the accounting store state/selectors.
 */
import { echeanceOccurrences, resolveEcheanceLines, accountBalances } from '../../utils/accounting-engine';
import { classOf } from '../../utils/chart-of-accounts';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const r2 = (v) => Math.round(v * 100) / 100;

// Income / expense impact of an échéance (class 7 credited = income, class 6 debited = expense).
function echeanceImpact(ech) {
  const { debitAccount, creditAccount } = resolveEcheanceLines(ech);
  const amt = Number(ech.amount) || 0;
  if (classOf(debitAccount) === 6) return { expense: amt, income: 0 };
  if (classOf(creditAccount) === 7) return { expense: 0, income: amt };
  return { expense: 0, income: 0 };
}

export function computeToday(store, now = new Date()) {
  const today = iso(now);
  const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  const weekStart = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow));
  const weekEnd = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + 6));
  const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const in7 = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

  const journal = store.journal;
  const month = accountBalances(journal, { from: monthStart, to: monthEnd });
  let income = 0; let expense = 0;
  for (const [code, b] of Object.entries(month)) {
    if (classOf(code) === 7) income += -b.balance;
    if (classOf(code) === 6) expense += b.balance;
  }
  const spentBetween = (from, to) => {
    let s = 0;
    for (const e of journal) {
      if (e.date < from || e.date > to) continue;
      for (const l of e.lines) if (classOf(l.account) === 6) s += (Number(l.debit) || 0) - (Number(l.credit) || 0);
    }
    return r2(s);
  };

  // Échéances still to come this month (from tomorrow; today's are either
  // posted already or listed as due today) + the 7-day list.
  let upcomingIncome = 0; let upcomingExpense = 0;
  const next7 = [];
  for (const e of store.echeances.filter((x) => x.active)) {
    const imp = echeanceImpact(e);
    for (const occ of echeanceOccurrences(e, tomorrow, monthEnd)) { upcomingIncome += imp.income; upcomingExpense += imp.expense; }
    for (const occ of echeanceOccurrences(e, today, in7)) next7.push({ ...e, occurrenceDate: occ, impact: imp });
  }
  next7.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
  const overdue = store.getOverdueEcheances();

  // Savings planned this month for goals (envelope effort not yet set aside).
  const goalRows = store.getGoalRows().filter((g) => !g.achieved && g.kind === 'envelope' && g.neededPerMonth > 0);
  const savings = goalRows.map((g) => {
    const doneThisMonth = (g.contributions || []).filter((c) => c.date >= monthStart && c.date <= monthEnd && Number(c.amount) > 0).reduce((s, c) => s + Number(c.amount), 0);
    return { id: g.id, name: g.name, needed: g.neededPerMonth, done: r2(doneThisMonth), left: r2(Math.max(0, g.neededPerMonth - doneThisMonth)) };
  });
  const savingsLeft = savings.reduce((s, x) => s + x.left, 0);

  const remaining = r2(income + upcomingIncome - expense - upcomingExpense - savingsLeft);
  const daysLeft = Math.round((new Date(`${monthEnd}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000) + 1;
  const perDay = r2(remaining / Math.max(1, daysLeft));
  const weekDaysLeft = Math.min(daysLeft, 7 - dow);
  const daysInMonth = Number(monthEnd.slice(8));

  // Budgets to watch: expense budgets of the running period, most consumed first.
  const budgets = store.getBudgetVariance()
    .filter((b) => b.cls === 6 && b.amount > 0)
    .map((b) => {
      const total = Math.round((new Date(`${b.bounds.to}T12:00:00`) - new Date(`${b.bounds.from}T12:00:00`)) / 86400000) + 1;
      const elapsed = Math.min(total, Math.max(1, Math.round((new Date(`${today}T12:00:00`) - new Date(`${b.bounds.from}T12:00:00`)) / 86400000) + 1));
      return { ...b, projected: Math.round((b.reel / elapsed) * total), elapsedPct: Math.round((elapsed / total) * 100), left: r2(b.amount - b.reel) };
    })
    .sort((a, b) => (b.realisation ?? 0) - (a.realisation ?? 0));

  const todayEntries = journal.filter((e) => e.date === today).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return {
    today, monthStart, monthEnd, daysLeft, daysInMonth, dayOfMonth: now.getDate(),
    income: r2(income), expense: r2(expense), upcomingIncome: r2(upcomingIncome), upcomingExpense: r2(upcomingExpense),
    savings, savingsLeft: r2(savingsLeft), remaining, perDay, weekBudget: r2(perDay * weekDaysLeft), weekDaysLeft,
    spentToday: spentBetween(today, today), spentWeek: spentBetween(weekStart, weekEnd > today ? today : weekEnd),
    next7, overdue, budgets, todayEntries,
  };
}
