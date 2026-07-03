import { useMemo, useEffect } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useFinanceStore } from '../store/financeStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useAuthStore } from '../store/authStore';
import { calculateSynergies } from '../utils/synergy';
import { todayKey } from '../utils/formatters';

const HISTORY_KEY = 'audax-synergy-history';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
  } catch {
    return {};
  }
}

export function useSynergy() {
  const trades = useTradingStore((s) => s.trades);
  const courses = useLearningStore((s) => s.courses);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const skills = useSkillStore((s) => s.skills);
  const primaryDomain = useAuthStore((s) => s.user?.primaryDomain || 'trading');

  const result = useMemo(
    () =>
      calculateSynergies({
        trades,
        courses,
        transactions,
        budgets,
        energyLogs,
        habits,
        habitLogs,
        skills,
        primaryDomain,
        today: todayKey(),
      }),
    [trades, courses, transactions, budgets, energyLogs, habits, habitLogs, skills, primaryDomain]
  );

  // Persist today's snapshot so we can show day-over-day trend
  useEffect(() => {
    const history = loadHistory();
    history[todayKey()] = { scores: result.scores, average: result.average, weighted: result.weighted };
    const keys = Object.keys(history).sort();
    for (const k of keys.slice(0, -400)) delete history[k]; // keep ~400 days
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [result]);

  const { yesterday, last30 } = useMemo(() => {
    const history = loadHistory();
    const keys = Object.keys(history).sort();
    const prevKeys = keys.filter((k) => k < todayKey());
    return {
      yesterday: prevKeys.length ? history[prevKeys[prevKeys.length - 1]] : null,
      last30: keys.slice(-30).map((k) => ({ date: k.slice(5), weighted: history[k].weighted, average: history[k].average })),
    };
  }, [result]);

  return { ...result, trend: yesterday ? result.weighted - yesterday.weighted : 0, history: last30 };
}
