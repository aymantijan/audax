// What the assistant may read: a short structured summary per section, built
// on demand from the local stores (never the raw data). The person chooses
// the sections in Paramètres → Assistant; each summary is capped so the whole
// context stays small. Every section is wrapped: a failing summary is dropped,
// it never blocks the question.
import { useAuthStore } from '../store/authStore';
import { useHabitStore } from '../store/habitStore';
import { useLearningStore } from '../store/learningStore';
import { useFlashcardStore } from '../store/flashcardStore';
import { useFocusStore } from '../store/focusStore';
import { useReadingsStore } from '../store/readingsStore';
import { useHealthStore } from '../store/healthStore';
import { useAccountingStore } from '../store/accountingStore';
import { useTradingStore } from '../store/tradingStore';
import { useCareerStore } from '../store/careerStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useBusinessStore } from '../store/businessStore';
import { isAcademic, subjectResult, upcomingEvaluations } from './academic';
import { classesOn, dayAttendance } from './attendance';
import { isDue } from './fsrs';
import { habitStreak, isHabitShownOn } from './calculations';
import { getBaseCurrency, todayKey } from './formatters';
import { isModuleEnabled } from './navigation';

export const ASSISTANT_SCOPES = [
  { key: 'today', label: 'Aujourd’hui (habitudes, objectifs)' },
  { key: 'etudes', label: 'Études & savoir' },
  { key: 'sante', label: 'Santé' },
  { key: 'patrimoine', label: 'Patrimoine' },
  { key: 'carriere', label: 'Carrière & entreprise' },
];
export const DEFAULT_SCOPES = ASSISTANT_SCOPES.map((s) => s.key);

const round1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayKey(d); };

function todaySummary(goals) {
  const today = todayKey();
  const { habits, logs, objectives = [] } = useHabitStore.getState();
  const due = habits.filter((h) => !h.archived && isHabitShownOn(h, logs, today));
  return {
    date: today,
    habits: due.slice(0, 15).map((h) => ({
      name: h.name,
      doneToday: logs.some((l) => l.habitId === h.id && l.date === today && l.completed),
      streak: habitStreak(h.id, logs, today, h),
    })),
    plan: objectives.filter((o) => !o.done).slice(0, 15).map((o) => ({ horizon: o.horizon, period: o.period, title: o.title })),
    goals: (goals || []).slice(0, 12).map((g) => ({ domain: g.domain, title: g.title, progress: g.progress, status: g.status, targetDate: g.targetDate || null })),
  };
}

function studiesSummary() {
  const today = todayKey();
  const { courses, academic, attendance } = useLearningStore.getState();
  const settings = academic?.settings;
  const subjects = courses.filter((c) => isAcademic(c) && c.status !== 'dropped');
  const results = subjects.slice(0, 20).map((c) => {
    const r = subjectResult(c, settings);
    return { subject: c.name, average: round1(r.current), coefficient: c.coefficient || 1 };
  });
  const upcoming = upcomingEvaluations(courses, today).filter((x) => !x.past).slice(0, 8)
    .map((x) => ({ subject: x.course.name, evaluation: x.ev.name || x.ev.type, date: x.ev.date }));
  const classesToday = classesOn(courses, academic, today).map((o) => ({ subject: o.course.name, start: o.start, end: o.end }));
  let attendance7 = { required: 0, onTime: 0 };
  for (let i = 1; i <= 7; i += 1) {
    const d = dayAttendance(courses, academic, attendance, daysAgo(i));
    attendance7 = { required: attendance7.required + d.required, onTime: attendance7.onTime + d.onTime };
  }
  const cards = useFlashcardStore.getState().cards || [];
  const minutes7 = (useFocusStore.getState().sessions || []).filter((s) => s.date >= daysAgo(7)).reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0);
  const reading = (useReadingsStore.getState().progress || []).filter((p) => p.status === 'reading').length;
  // Latest class notes (what was seen in class), so the assistant can make flashcards from them.
  const byId = new Map(courses.map((c) => [c.id, c.name]));
  const notes = Object.values(useLearningStore.getState().classNotes || {})
    .filter((n) => n?.points?.length && byId.has(n.courseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
    .map((n) => ({ subject: byId.get(n.courseId), date: n.date, points: (Array.isArray(n.points) ? n.points.join(' · ') : String(n.points)).slice(0, 700) }));
  return {
    gradingScale: settings?.scale || null,
    subjects: results,
    upcomingEvaluations: upcoming,
    classesToday,
    attendanceLast7Days: attendance7.required ? `${attendance7.onTime}/${attendance7.required} à l’heure` : 'aucun cours',
    flashcardsDue: cards.filter((c) => isDue(c)).length,
    studyMinutesLast7Days: minutes7,
    booksInProgress: reading,
    otherCourses: courses.filter((c) => !isAcademic(c) && c.status === 'active').slice(0, 8).map((c) => c.name),
    recentClassNotes: notes,
  };
}

function healthSummary() {
  const s = useHealthStore.getState();
  return typeof s.buildCoachContext === 'function' ? s.buildCoachContext() : null;
}

function wealthSummary(user) {
  const acc = useAccountingStore.getState();
  const out = { currency: getBaseCurrency() };
  try { out.netWorth = Math.round(acc.getNetWorth().ancc); } catch { /* no ledger yet */ }
  try {
    const series = acc.getMonthlySeries(2);
    const last = Array.isArray(series) ? series[series.length - 1] : null;
    if (last) out.thisMonth = { income: Math.round(last.produits || 0), expenses: Math.round(last.charges || 0) };
  } catch { /* ignore */ }
  try {
    const variance = acc.getBudgetVariance();
    const rows = Array.isArray(variance) ? variance : variance?.rows || [];
    out.budgetsOver = rows.filter((r) => r.reel > r.amount).slice(0, 6).map((r) => ({ label: r.label, spent: Math.round(r.reel), budget: Math.round(r.amount) }));
  } catch { /* ignore */ }
  try { out.expenseCategories = Object.values(acc.getAccountMap()).filter((a) => a.cls === 6).map((a) => a.label).slice(0, 40); } catch { /* ignore */ }
  out.savingsGoals = (acc.goals || []).filter((g) => !g.achieved).slice(0, 6).map((g) => ({ name: g.name, target: g.targetAmount, targetDate: g.targetDate || null }));
  out.upcomingDueDates = (acc.echeances || []).slice(0, 8).map((e) => ({ label: e.label, amount: e.amount, next: e.nextDate || e.date || null }));
  if (isModuleEnabled(user, 'trading')) {
    const t = useTradingStore.getState();
    try { out.trading = t.buildCoachContext ? t.buildCoachContext(t.activeAccountId) : null; } catch { /* ignore */ }
  }
  return out;
}

function careerSummary(user) {
  const out = {};
  if (isModuleEnabled(user, 'career')) {
    const c = useCareerStore.getState();
    out.applications = (c.applications || []).filter((a) => !['Rejected', 'Withdrawn'].includes(a.stage)).slice(0, 12).map((a) => ({ role: a.role, company: a.company, stage: a.stage }));
    out.careerGoals = (c.plans || []).filter((p) => p.status === 'active').map((p) => p.title);
  }
  if (isModuleEnabled(user, 'freelance')) {
    const f = useFreelanceStore.getState();
    out.freelanceClients = (f.engagements || []).filter((e) => e.status !== 'Terminé').slice(0, 8)
      .map((e) => ({ client: e.clientName, status: e.status, toCollect: Math.max(0, (e.invoicedTotal || 0) - (e.paidTotal || 0)) }));
  }
  if (isModuleEnabled(user, 'business')) {
    out.projects = (useBusinessStore.getState().businesses || []).filter((b) => b.status !== 'closed').slice(0, 8)
      .map((b) => ({ name: b.name, status: b.status, openTasks: (b.tasks || []).filter((t) => t.status !== 'done').length }));
  }
  return out;
}

export function buildAssistantContext(scopes = DEFAULT_SCOPES, { goals } = {}) {
  const user = useAuthStore.getState().user;
  const ctx = { profile: { occupation: user?.occupation || null, situation: user?.situation || null, country: user?.country || null } };
  const sections = {
    today: () => todaySummary(goals),
    etudes: studiesSummary,
    sante: healthSummary,
    patrimoine: () => wealthSummary(user),
    carriere: () => careerSummary(user),
  };
  for (const key of scopes) {
    try {
      const v = sections[key]?.();
      if (v) ctx[key] = v;
    } catch (e) {
      console.warn('[assistant-context] section skipped', key, e?.message || e);
    }
  }
  return ctx;
}
