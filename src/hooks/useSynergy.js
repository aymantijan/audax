import { useMemo, useEffect } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHabitStore } from '../store/habitStore';
import { useHealthStore } from '../store/healthStore';
import { useEngineeringStore } from '../store/engineeringStore';
import { useBusinessStore } from '../store/businessStore';
import { useNetworkingStore } from '../store/networkingStore';
import { useCareerStore } from '../store/careerStore';
import { useContentStore } from '../store/contentStore';
import { useFocusStore } from '../store/focusStore';
import { useFundraisingStore } from '../store/fundraisingStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useCreativeStore } from '../store/creativeStore';
import { useRealEstateStore } from '../store/realEstateStore';
import { useSkillStore } from '../store/skillStore';
import { useAuthStore } from '../store/authStore';
import { calculateSynergies } from '../utils/synergy';
import { foodQualityScore } from '../utils/nutrition-db';
import { computeReadiness } from '../utils/health-science';
import { todayKey } from '../utils/formatters';
import { startOfMonth } from 'date-fns';

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
  // Raw slices from the double-entry accounting store (not a getter — see the
  // useSyncExternalStore infinite-loop note in project memory) — feeds the
  // real finance score instead of the legacy financeStore transactions/budgets.
  const journal = useAccountingStore((s) => s.journal);
  const accountingBudgets = useAccountingStore((s) => s.budgets);
  const corrections = useAccountingStore((s) => s.corrections);
  const echeances = useAccountingStore((s) => s.echeances);
  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const skills = useSkillStore((s) => s.skills);
  const primaryDomain = useAuthStore((s) => s.user?.primaryDomain || 'trading');
  const engineeringEnabled = useAuthStore((s) => s.user?.enabledModules?.engineering ?? false);
  const tradingEnabled = useAuthStore((s) => s.user?.enabledModules?.trading ?? true);
  const labEntries = useEngineeringStore((s) => s.labEntries);
  const engineeringProjects = useEngineeringStore((s) => s.projects);
  const businesses = useBusinessStore((s) => s.businesses);
  // Deals (PE) is deliberately excluded from the synergy score (2026-08-27,
  // user request) — only Business Projects activity feeds it.
  const businessEnabled = useAuthStore((s) => s.user?.enabledModules?.business ?? s.user?.enabledModules?.deals ?? true);
  const contacts = useNetworkingStore((s) => s.contacts);
  const applications = useCareerStore((s) => s.applications);
  const posts = useContentStore((s) => s.posts);
  const networkingEnabled = useAuthStore((s) => s.user?.enabledModules?.networking ?? false);
  const careerEnabled = useAuthStore((s) => s.user?.enabledModules?.career ?? false);
  const contentEnabled = useAuthStore((s) => s.user?.enabledModules?.content ?? false);
  const focusSessions = useFocusStore((s) => s.sessions);
  const focusEnabled = useAuthStore((s) => s.user?.enabledModules?.focus ?? false);
  const investors = useFundraisingStore((s) => s.investors);
  const engagements = useFreelanceStore((s) => s.engagements);
  const creativeWorks = useCreativeStore((s) => s.works);
  const creativeShowcases = useCreativeStore((s) => s.showcases);
  const properties = useRealEstateStore((s) => s.properties);
  const fundraisingEnabled = useAuthStore((s) => s.user?.enabledModules?.fundraising ?? false);
  const freelanceEnabled = useAuthStore((s) => s.user?.enabledModules?.freelance ?? false);
  const creativeEnabled = useAuthStore((s) => s.user?.enabledModules?.creative ?? false);
  const realEstateEnabled = useAuthStore((s) => s.user?.enabledModules?.realEstate ?? false);

  // Raw slices only (never a store getter returning a fresh object) — see the
  // useSyncExternalStore infinite-loop note in project memory. Derived values
  // are computed below in a useMemo instead.
  const workouts = useHealthStore((s) => s.workouts);
  const nutritionLogs = useHealthStore((s) => s.nutritionLogs);
  const recoveryLogs = useHealthStore((s) => s.recoveryLogs);

  const healthExtras = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    const today = todayKey();
    const workoutsThisMonth = workouts.filter((w) => new Date(w.date).getTime() >= monthStart).length;
    const todayNutrition = nutritionLogs.filter((n) => n.date === today);
    const avgNutritionQuality = todayNutrition.length ? foodQualityScore(todayNutrition) : null;
    const todayLog = energyLogs.find((l) => l.date === today);
    const recovery = recoveryLogs.find((r) => r.date === today);
    const avgReadiness = todayLog
      ? computeReadiness({
          sleepQuality: todayLog.sleepData?.sleepQualityScore ?? 5,
          energy: todayLog.energyStartLevel ?? 5,
          stress: todayLog.stressLevel ?? 5,
          recoveryCount: recovery?.activities?.length ?? 0,
          recoveryMax: 5,
          streak: 0,
        }).score
      : null;
    return { workoutsThisMonth, avgNutritionQuality, avgReadiness };
  }, [workouts, nutritionLogs, recoveryLogs, energyLogs]);

  const result = useMemo(
    () =>
      calculateSynergies({
        trades,
        courses,
        journal,
        accountingBudgets,
        corrections,
        echeances,
        energyLogs,
        habits,
        habitLogs,
        skills,
        primaryDomain,
        today: todayKey(),
        healthExtras,
        labEntries,
        engineeringProjects,
        engineeringEnabled,
        tradingEnabled,
        businesses,
        businessEnabled,
        contacts,
        applications,
        posts,
        networkingEnabled,
        careerEnabled,
        contentEnabled,
        focusSessions,
        focusEnabled,
        investors,
        engagements,
        creativeWorks,
        creativeShowcases,
        properties,
        fundraisingEnabled,
        freelanceEnabled,
        creativeEnabled,
        realEstateEnabled,
      }),
    [
      trades, courses, journal, accountingBudgets, corrections, echeances, energyLogs, habits, habitLogs, skills, primaryDomain, healthExtras,
      labEntries, engineeringProjects, engineeringEnabled, tradingEnabled, businesses, businessEnabled,
      contacts, applications, posts, networkingEnabled, careerEnabled, contentEnabled,
      focusSessions, focusEnabled,
      investors, engagements, creativeWorks, creativeShowcases, properties,
      fundraisingEnabled, freelanceEnabled, creativeEnabled, realEstateEnabled,
    ]
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
