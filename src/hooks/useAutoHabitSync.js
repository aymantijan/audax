import { useEffect } from 'react';
import { useHabitStore } from '../store/habitStore';
import { sourceValue, SOURCE_STORES } from '../utils/habit-sources';
import { todayKey } from '../utils/formatters';

/**
 * Keeps measured habits in step with the rest of the app:
 *  - auto-tracked ones read their value from their source (pages read, study
 *    minutes, water, trades journaled…);
 *  - "au plus" habits (≤ 2 cafés, ≤ 0 DH de dépenses superflues) are judged
 *    once each day is over.
 * Runs over the last `days` days; idempotent (setHabitValue is a no-op when
 * nothing changes), so re-running on every store change is cheap and safe.
 */
export function syncAutoHabits(days = 3) {
  const st = useHabitStore.getState();
  const targets = st.habits.filter((h) => !h.archived && h.kind === 'quantity' && (h.source || h.direction === 'atMost'));
  if (!targets.length) return;
  const today = todayKey();
  for (let i = 0; i < days; i++) {
    const date = todayKey(new Date(Date.now() - i * 86400000));
    for (const h of targets) {
      if (h.startDate && date < h.startDate) continue;
      const existing = useHabitStore.getState().logs.find((l) => l.habitId === h.id && l.date === date);
      if (existing?.joker && !existing.completed && date !== today) continue;
      const value = h.source ? sourceValue(h, date) : existing?.value ?? 0;
      useHabitStore.getState().setHabitValue(h.id, date, value, { auto: !!h.source });
    }
  }
}

export function useAutoHabitSync() {
  useEffect(() => {
    syncAutoHabits(14);
    let t = null;
    const schedule = () => { clearTimeout(t); t = setTimeout(() => syncAutoHabits(3), 600); };
    const unsubs = SOURCE_STORES.map((store) => store.subscribe(schedule));
    return () => { clearTimeout(t); unsubs.forEach((u) => u()); };
  }, []);
}
