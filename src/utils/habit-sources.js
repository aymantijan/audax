/**
 * Auto-tracked habits (Habitudes n°2): a habit can read its daily value from
 * what the user already records elsewhere in the app, so it ticks itself.
 * Store access happens only inside functions (getState), never at import
 * time — safe with the app's cross-store imports.
 */
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { useReadingsStore } from '../store/readingsStore';
import { useFocusStore } from '../store/focusStore';
import { useFlashcardStore } from '../store/flashcardStore';
import { useTradingStore } from '../store/tradingStore';
import { useAccountingStore } from '../store/accountingStore';
import { classOf } from './chart-of-accounts';

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

export const HABIT_SOURCES = [
  { value: 'water_glasses', label: 'Eau bue (Santé)', unit: 'verres', section: 'Santé', get: (d) => Math.floor(((useHealthStore.getState().recoveryLogs || []).find((r) => r.date === d)?.waterMl || 0) / 250) },
  { value: 'protein_g', label: 'Protéines (Santé › Nutrition)', unit: 'g', section: 'Santé', get: (d) => Math.round(sum((useHealthStore.getState().nutritionLogs || []).filter((n) => n.date === d), (n) => n.protein)) },
  { value: 'workouts', label: 'Séances de sport (Santé)', unit: 'séance(s)', section: 'Santé', get: (d) => (useHealthStore.getState().workouts || []).filter((w) => w.date === d).length },
  { value: 'workout_minutes', label: 'Minutes de sport (Santé)', unit: 'min', section: 'Santé', get: (d) => Math.round(sum((useHealthStore.getState().workouts || []).filter((w) => w.date === d), (w) => w.durationMin)) },
  { value: 'sleep_hours', label: 'Heures de sommeil (check-in)', unit: 'h', section: 'Check-in', get: (d) => Number(useHabitStore.getState().energyLogs.find((l) => l.date === d)?.sleepData?.sleepHours || 0) },
  { value: 'reading_pages', label: 'Pages lues (Lectures)', unit: 'pages', section: 'Lectures', get: (d) => (useReadingsStore.getState().pagesByDate || {})[d] || 0 },
  { value: 'study_minutes', label: 'Minutes d’étude (Apprentissage)', unit: 'min', section: 'Apprentissage', get: (d) => Math.round(sum(useFocusStore.getState().sessions.filter((s) => s.date === d && (s.domain === 'Learning' || s.courseId)), (s) => s.durationMinutes)) },
  { value: 'focus_minutes', label: 'Minutes de concentration (Deep Work)', unit: 'min', section: 'Deep Work', get: (d) => Math.round(sum(useFocusStore.getState().sessions.filter((s) => s.date === d), (s) => s.durationMinutes)) },
  { value: 'flashcards', label: 'Fiches révisées (Révisions)', unit: 'fiches', section: 'Révisions', get: (d) => (useFlashcardStore.getState().reviewLog || []).filter((e) => e.d === d).length },
  { value: 'trades_journaled', label: 'Trades journalisés (Trading)', unit: 'trade(s)', section: 'Trading', get: (d) => (useTradingStore.getState().trades || []).filter((t) => t.date === d && t.journal?.reasoning?.trim()).length },
  { value: 'trading_plan', label: 'Plan de séance écrit (Trading)', unit: 'plan(s)', section: 'Trading', get: (d) => Object.keys(useTradingStore.getState().dailyPlans || {}).filter((k) => k.endsWith(`|${d}`)).length },
  { value: 'trading_review', label: 'Revue de fin de journée (Trading)', unit: 'revue(s)', section: 'Trading', get: (d) => Object.keys(useTradingStore.getState().dayReviews || {}).filter((k) => k.endsWith(`|${d}`)).length },
  { value: 'expenses_logged', label: 'Opérations saisies (Finances)', unit: 'opération(s)', section: 'Finances', get: (d) => (useAccountingStore.getState().journal || []).filter((e) => e.date === d).length },
  { value: 'spent_amount', label: 'Montant dépensé (Finances)', unit: 'DH', section: 'Finances', get: (d) => Math.round(sum((useAccountingStore.getState().journal || []).filter((e) => e.date === d), (e) => sum(e.lines.filter((l) => classOf(l.account) === 6), (l) => (Number(l.debit) || 0) - (Number(l.credit) || 0)))) },
];
export const sourceMeta = (v) => HABIT_SOURCES.find((s) => s.value === v) || null;

/** Value of an auto source for a date (null for manual habits). */
export function sourceValue(habit, date) {
  const src = sourceMeta(habit?.source);
  if (!src) return null;
  try { return src.get(date); } catch { return 0; }
}

/** Every store an auto source depends on — subscribe to re-sync. */
export const SOURCE_STORES = [useHealthStore, useHabitStore, useReadingsStore, useFocusStore, useFlashcardStore, useTradingStore, useAccountingStore];
