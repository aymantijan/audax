import { useTradingStore } from '../store/tradingStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHabitStore } from '../store/habitStore';
import { useLearningStore } from '../store/learningStore';
import { useReadingsStore } from '../store/readingsStore';
import { useDealsStore } from '../store/dealsStore';
import { SKILL_MAP } from '../utils/constants';

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

  const trading = useTradingStore.getState();
  for (const acc of trading.accounts) {
    items.push({ id: `acct-${acc.id}`, domain: 'Trading', label: acc.name, sub: `${acc.type} account`, to: `/trading/account/${acc.id}` });
  }
  for (const t of trading.trades.slice(-300)) {
    items.push({ id: `trade-${t.id}`, domain: 'Trading', label: `${t.instrument} ${t.direction || ''}`.trim(), sub: `${t.date} · ${t.strategy || ''}`, to: '/trading' });
  }

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

  const deals = useDealsStore.getState().deals;
  for (const d of deals) {
    items.push({ id: `deal-${d.id}`, domain: 'Deals', label: d.name, sub: d.stageStatus, to: `/deals/${d.id}` });
  }

  for (const skill of Object.values(SKILL_MAP)) {
    items.push({ id: `skill-${skill.id}`, domain: 'Skills', label: skill.name, sub: skill.track || skill.category || '', to: '/skills' });
  }

  return items;
}

export function searchIndex(index, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index
    .filter((item) => item.label?.toLowerCase().includes(q) || item.sub?.toLowerCase().includes(q))
    .slice(0, 60);
}
