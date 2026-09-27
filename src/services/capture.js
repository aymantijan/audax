// Universal capture (the + button): builds the context the parser needs from
// the person's own data, and saves a CONFIRMED draft in the store that owns it.
// Parsing lives in utils/quick-capture.js; nothing here guesses.
import { useAccountingStore } from '../store/accountingStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { useLearningStore } from '../store/learningStore';
import { useFocusStore } from '../store/focusStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/uiStore';
import { guessCategory, lastCashAccount } from '../utils/bank-import';
import { rateFor, formatMoney } from '../utils/currency';
import { todayKey } from '../utils/formatters';

export function captureContext() {
  const habits = useHabitStore.getState().habits
    .filter((h) => !h.archived && h.kind !== 'quit')
    .map((h) => ({ id: h.id, name: h.name, kind: h.kind, target: h.target }));
  const courses = useLearningStore.getState().courses
    .filter((c) => c.status !== 'dropped' && c.name)
    .map((c) => ({ id: c.id, name: c.name }));
  const clients = useFreelanceStore.getState().engagements
    .filter((e) => e.status !== 'Terminé' && e.clientName)
    .map((e) => ({ id: e.id, name: e.clientName }));
  return {
    today: todayKey(),
    habits, courses, clients,
    weightUnit: useHealthStore.getState().weightUnit || 'kg',
    currency: useAccountingStore.getState().baseCurrency,
  };
}

// Default money accounts for a draft: category guessed from the label (own
// history first), and the account used last time.
export function moneyAccounts(draft) {
  const { journal } = useAccountingStore.getState();
  return { category: guessCategory(journal, draft.label, draft.kind).account, cash: lastCashAccount(journal, draft.kind) };
}

// Saves a confirmed draft. `extra` carries what the person changed on the card
// (money: category, cash). Returns { ok, error?, to } — `to` = where to look.
export function saveDraft(d, extra = {}) {
  switch (d.kind) {
    case 'expense':
    case 'income': {
      const acc = useAccountingStore.getState();
      const base = acc.baseCurrency;
      const foreign = d.currency && d.currency !== base;
      const rate = foreign ? rateFor(d.currency, base, acc.fxRates) : 1;
      const amt = Math.round(d.amount * rate * 100) / 100;
      const { category, cash } = { ...moneyAccounts(d), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) };
      const lines = d.kind === 'expense'
        ? [{ account: category, debit: amt, credit: 0 }, { account: cash, debit: 0, credit: amt }]
        : [{ account: cash, debit: amt, credit: 0 }, { account: category, debit: 0, credit: amt }];
      const res = acc.addEntry({ date: d.date, label: d.label, lines, fx: foreign ? { currency: d.currency, amount: d.amount, rate } : null });
      if (!res.ok) return res;
      toast(`${d.kind === 'expense' ? 'Dépense' : 'Revenu'} enregistré : ${d.label} · ${formatMoney(amt, base)}`, 'success');
      return { ok: true, to: '/finance?tab=journal' };
    }
    case 'freelance':
      useFreelanceStore.getState().logPayment(d.clientId, { date: d.date, amount: d.amount, note: d.label, account: extra.cash || '511' });
      return { ok: true, to: '/freelance' };
    case 'workout':
      useHealthStore.getState().logWorkout({
        date: d.date, type: d.type, category: d.type, exercise: d.exercise, durationMin: d.durationMin,
        cardio: d.type === 'cardio' ? { modalityName: d.exercise, ...(d.distanceKm ? { distance: d.distanceKm } : {}) } : null,
      });
      return { ok: true, to: '/health' };
    case 'weight': {
      const h = useHealthStore.getState();
      const sameDay = h.bodyComp.find((b) => b.date === d.date);
      const latest = [...h.bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      const sex = sameDay?.sex || latest?.sex || (useAuthStore.getState().user?.gender === 'female' ? 'female' : 'male');
      h.logBodyComp({ ...(sameDay || {}), heightCm: sameDay?.heightCm || latest?.heightCm, sex, weightKg: d.weightKg, date: d.date });
      return { ok: true, to: '/health' };
    }
    case 'sleep':
      useHabitStore.getState().saveEnergyLog({ date: d.date, sleepData: { sleepHours: d.hours } });
      return { ok: true, to: '/health' };
    case 'water':
      useHealthStore.getState().logWater(d.ml, d.date);
      toast(`Eau notée : ${d.ml >= 1000 ? `${String(d.ml / 1000).replace('.', ',')} L` : `${d.ml} ml`}`, 'success');
      return { ok: true, to: '/health' };
    case 'study': {
      const res = useFocusStore.getState().logSession({ domain: 'Learning', courseId: d.courseId || undefined, courseLabel: d.course || d.label || undefined, durationMinutes: d.minutes, date: d.date, notes: d.label || '' });
      return res.ok ? { ok: true, to: '/learning' } : res;
    }
    case 'habit': {
      const hs = useHabitStore.getState();
      const habit = hs.habits.find((h) => h.id === d.habitId);
      if (!habit) return { ok: false, error: 'Habitude introuvable.' };
      if (habit.kind === 'quantity') {
        if (habit.source) return { ok: false, error: 'Cette habitude se met à jour toute seule.' };
        hs.setHabitValue(habit.id, d.date, d.value ?? habit.target);
      } else if (!hs.logs.some((l) => l.habitId === habit.id && l.date === d.date && l.completed)) {
        hs.toggleHabit(habit.id, d.date);
      } else {
        toast(`${habit.name} : déjà cochée ce jour-là`, 'info');
        return { ok: true, to: '/habits' };
      }
      toast(`Habitude cochée : ${habit.name}`, 'success');
      return { ok: true, to: '/habits' };
    }
    default:
      return { ok: false, error: 'Type inconnu.' };
  }
}
