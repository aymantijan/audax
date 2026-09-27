// Gathers, from the stores, what the Chronologie reads (utils/life-timeline.js).
// Trading only when the module is on for this person.
import { useAccountingStore } from '../store/accountingStore';
import { useTradingStore } from '../store/tradingStore';
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { useFocusStore } from '../store/focusStore';
import { useLearningStore } from '../store/learningStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useAuthStore } from '../store/authStore';
import { isModuleEnabled } from '../utils/navigation';

export function timelineData() {
  const user = useAuthStore.getState().user;
  const t = useTradingStore.getState();
  const h = useHealthStore.getState();
  const hb = useHabitStore.getState();
  const l = useLearningStore.getState();
  const trading = isModuleEnabled(user, 'trading');
  const currencyOf = new Map((t.accounts || []).map((a) => [a.id, a.currency]));
  return {
    journal: useAccountingStore.getState().journal,
    trades: trading ? (t.trades || []).map((x) => ({ ...x, currency: currencyOf.get(x.accountId) })) : [],
    workouts: h.workouts, bodyComp: h.bodyComp,
    energyLogs: hb.energyLogs, habits: hb.habits, habitLogs: hb.logs,
    sessions: useFocusStore.getState().sessions,
    courses: l.courses, attendance: l.attendance,
    payments: isModuleEnabled(user, 'freelance')
      ? useFreelanceStore.getState().engagements.flatMap((e) => (e.payments || []).map((p) => ({ ...p, client: e.clientName, currency: e.currency })))
      : [],
  };
}
