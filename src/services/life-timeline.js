// Gathers, from the stores, what the Chronologie reads (utils/life-timeline.js).
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { useFocusStore } from '../store/focusStore';
import { useLearningStore } from '../store/learningStore';

export function timelineData() {
  const h = useHealthStore.getState();
  const hb = useHabitStore.getState();
  const l = useLearningStore.getState();
  return {
    journal: useAccountingStore.getState().journal,
    workouts: h.workouts, bodyComp: h.bodyComp,
    energyLogs: hb.energyLogs, habits: hb.habits, habitLogs: hb.logs,
    sessions: useFocusStore.getState().sessions,
    courses: l.courses, attendance: l.attendance,
  };
}
