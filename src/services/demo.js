// « Voir un exemple » (chantier 8, A5/V2): a filled-in profile to look around
// before signing up, then wiped in one tap. Offered only on a device that holds
// nobody's data (local data survives sign-out, see cloud-sync OWNER), so a
// visitor never sees someone else's entries, and nothing is ever synced
// (no account, no session).
import { useAuthStore } from '../store/authStore';
import { useHabitStore } from '../store/habitStore';
import { useHealthStore } from '../store/healthStore';
import { useAccountingStore } from '../store/accountingStore';
import { HABIT_TEMPLATES } from '../utils/habit-templates';
import { uid, todayKey } from '../utils/formatters';
import { eraseThisDevice } from './data-reset';
import { t } from '../i18n';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayKey(d); };
const tpl = (name) => HABIT_TEMPLATES.flatMap((g) => g.items).find((i) => i.name === name);

export function canOfferDemo() {
  try {
    if (localStorage.getItem('audax-data-owner')) return false;
  } catch { return false; }
  return !useHabitStore.getState().habits.length && !useAccountingStore.getState().journal.length && !useHealthStore.getState().workouts.length;
}

export const isDemo = (user) => !!user?.demo;

export function startDemo() {
  const auth = useAuthStore.getState();
  auth.register({ name: t('Exemple'), primaryDomain: 'health' });
  auth.updateProfile({ demo: true, onboarded: true, tourSeen: true, uiLevel: 'simple', occupation: '' });

  const names = ['Marcher 20 minutes', 'Prendre mes médicaments', 'Lecture quotidienne (30 min)', 'Boire 8 verres d’eau'];
  const habits = names.map((n, i) => ({ ...tpl(n), name: t(n), id: uid(), startDate: daysAgo(30), createdAt: Date.now() - 30 * 86400000, order: i, archived: false }));
  const logs = [];
  for (let d = 1; d <= 21; d += 1) {
    habits.forEach((h, i) => { if ((d + i) % 4 !== 0) logs.push({ habitId: h.id, date: daysAgo(d), completed: true, value: h.kind === 'quantity' ? h.target : undefined }); });
  }
  logs.push({ habitId: habits[1].id, date: todayKey(), completed: true });
  const energyLogs = Array.from({ length: 10 }, (_, i) => ({ date: daysAgo(i + 1), energyStartLevel: 6 + (i % 3), stressLevel: 3 + (i % 2), sleepData: { sleepQualityScore: 6 + (i % 3), hours: 7 } }));
  useHabitStore.setState({ habits, logs, energyLogs });

  const med = { id: uid(), name: t('Vitamine D'), dose: t('1 comprimé'), times: ['08:00'], frequency: 'daily', weekdays: [], startDate: daysAgo(30), endDate: null, stock: 12, stockDate: daysAgo(5), perDose: 1, notes: '', remind: false, active: true };
  useHealthStore.setState({
    medications: [med],
    medLogs: Array.from({ length: 5 }, (_, i) => ({ id: uid(), medId: med.id, date: daysAgo(i + 1), time: '08:00', status: 'taken', at: Date.now() })),
    vitals: [
      { id: uid(), type: 'bp', date: daysAgo(1), time: '08:30', systolic: 128, diastolic: 82, notes: '' },
      { id: uid(), type: 'bp', date: daysAgo(8), time: '08:30', systolic: 134, diastolic: 85, notes: '' },
    ],
    appointments: [{ id: uid(), date: daysAgo(-3), time: '10:00', title: t('Médecin traitant'), place: '', who: '', notes: '', done: false }],
    workouts: [3, 6, 10].map((n) => ({ id: uid(), date: daysAgo(n), type: 'sport', category: 'sport', sessionType: 'gentle', exercise: t('Marche douce'), durationMin: 14, sets: [], quality: 7, notes: '', createdAt: Date.now() })),
  });

  const entry = (n, label, debit, credit, amount) => ({ id: uid(), date: daysAgo(n), ref: `D${n}`, label, lines: [{ account: debit, debit: amount, credit: 0 }, { account: credit, debit: 0, credit: amount }], createdAt: Date.now(), updatedAt: Date.now() });
  useAccountingStore.setState({
    journal: [entry(25, t('Salaire'), '511', '711', 2000), entry(12, t('Courses'), '621', '511', 85), entry(6, t('Pharmacie'), '641', '511', 23), entry(2, t('Courses'), '621', '511', 64)],
  });
}

export async function endDemo() {
  await eraseThisDevice(); // empties every section and signs the example profile out
}
