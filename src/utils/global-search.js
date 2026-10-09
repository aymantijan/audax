import { useAccountingStore } from '../store/accountingStore';
import { useHabitStore } from '../store/habitStore';
import { useLearningStore } from '../store/learningStore';
import { useReadingsStore } from '../store/readingsStore';
import { useCreativeStore } from '../store/creativeStore';
import { SKILL_MAP } from '../utils/constants';
import { MODULES, POLES, isModuleEnabled } from './navigation';

// Reads every store via `.getState()` — a one-shot imperative snapshot, NOT a
// hook subscription — so this is safe to call on every keystroke without
// tripping the useSyncExternalStore infinite-loop trap documented elsewhere
// in this codebase (that trap is specifically about selecting a fresh
// object/array INSIDE a `useStore(s => ...)` selector; a plain `.getState()`
// call outside React's render/subscription machinery has no such issue).
// Returns everything unfiltered — GlobalSearch.jsx does the text filtering,
// this just builds the flat, typed candidate list once per open.
export function buildSearchIndex() {
  const items = [];

  const journal = useAccountingStore.getState().journal;
  for (const e of journal.slice(-300)) {
    items.push({ id: `je-${e.id}`, domain: 'Finance', label: e.label || e.ref, sub: `${e.date} · ${e.ref || ''}`, to: '/finance?tab=journal' });
  }

  const habits = useHabitStore.getState().habits;
  for (const h of habits.filter((h) => !h.archived)) {
    items.push({ id: `habit-${h.id}`, domain: 'Habits', label: h.name, sub: h.category, to: '/habits' });
  }

  const courses = useLearningStore.getState().courses;
  for (const c of courses) {
    items.push({ id: `course-${c.id}`, domain: 'Learning', label: c.name, sub: c.status, to: `/learning/course/${c.id}` });
  }

  const library = useReadingsStore.getState().library;
  for (const b of library) {
    items.push({ id: `book-${b.id}`, domain: 'Reading', label: b.title, sub: b.author, to: '/learning/readings/library' });
  }

  const { works: creativeWorks, showcases } = useCreativeStore.getState();
  for (const w of creativeWorks) {
    items.push({ id: `work-${w.id}`, domain: 'Creative', label: w.title, sub: `${w.medium} · ${w.status}`, to: '/creative' });
  }
  for (const s of showcases) {
    items.push({ id: `showcase-${s.id}`, domain: 'Creative', label: s.title, sub: `${s.type}${s.venue ? ` · ${s.venue}` : ''}`, to: '/creative' });
  }


  for (const skill of Object.values(SKILL_MAP)) {
    items.push({ id: `skill-${skill.id}`, domain: 'Skills', label: skill.name, sub: skill.track || skill.category || '', to: '/skills' });
  }

  return items;
}

// Pages and quick actions, filtered by the modules this person uses.
// Actions deep-link to the page that owns the form (see QuickAdd.jsx).
const ACTIONS = [
  { id: 'act-today', label: 'Pointer mes cours et cocher mes habitudes', to: '/today' },
  { id: 'act-expense', label: 'Noter une dépense ou un revenu', to: '/finance?quickadd=journal' },
  { id: 'act-workout', label: 'Enregistrer une séance de sport', to: '/health?quickadd=workout' },
  { id: 'act-habit', label: 'Créer une habitude', to: '/habits?new=1' },
  { id: 'act-checkin', label: 'Faire mon check-in du jour', to: '/habits?checkin=1' },
  { id: 'act-timetable', label: 'Voir mon emploi du temps', to: '/learning?tab=timetable' },
  { id: 'act-review', label: 'Réviser mes fiches', to: '/learning?tab=review' },
  { id: 'act-exams', label: 'Voir mes évaluations et mes notes', to: '/learning?tab=exams' },
  { id: 'act-goal', label: 'Fixer un objectif', to: '/goals' },
  { id: 'act-focus', label: 'Lancer une session de concentration', to: '/focus', module: 'focus' },
];

export function buildNavItems(user) {
  const items = [];
  for (const pole of POLES) {
    items.push({ id: `pole-${pole.key}`, domain: 'Page', label: pole.label, sub: pole.blurb, to: pole.home, kind: 'page' });
    for (const k of pole.modules) {
      if (!isModuleEnabled(user, k) || MODULES[k].to === pole.home) continue;
      items.push({ id: `page-${k}`, domain: 'Page', label: MODULES[k].label, sub: pole.label, to: MODULES[k].to, kind: 'page' });
    }
  }
  items.push({ id: 'page-settings', domain: 'Page', label: 'Paramètres', sub: 'Profil, synchronisation, données', to: '/settings', kind: 'page' });
  items.push({ id: 'page-leaderboard', domain: 'Page', label: 'Classement', sub: 'Grades et XP', to: '/leaderboard', kind: 'page' });
  for (const a of ACTIONS) {
    if (a.module && !isModuleEnabled(user, a.module)) continue;
    items.push({ ...a, domain: 'Action', kind: 'action' });
  }
  return items;
}

// Accent- and case-insensitive: "depense" finds "Dépense".
const norm = (v) => String(v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function searchIndex(index, query) {
  const q = norm(query.trim());
  if (!q) return index.filter((i) => i.kind === 'action').slice(0, 8);
  const scored = [];
  for (const item of index) {
    const label = norm(item.label);
    const sub = norm(item.sub);
    if (!label.includes(q) && !sub.includes(q)) continue;
    // Pages and actions first, then labels that start with the query.
    const score = (item.kind ? 0 : 2) + (label.startsWith(q) || label.includes(` ${q}`) ? 0 : 1);
    scored.push([score, item]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, item]) => item).slice(0, 60);
}
