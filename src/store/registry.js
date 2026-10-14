// Every store that holds the person's data, in one list: cloud sync, undo and
// the trash (services/undo.js) and "Tout effacer" (Settings) all read it, so a
// store added here is covered everywhere at once.
//
// Removed modules (2026-10-09: trading, deals, business, career, networking,
// content, freelance, fundraising, realestate, engineering) are simply absent:
// their app_state rows and audax-* keys stay untouched, dormant.
import { useAuthStore } from './authStore';
import { useFinanceStore } from './financeStore';
import { useLearningStore } from './learningStore';
import { useHabitStore } from './habitStore';
import { useSkillStore } from './skillStore';
import { useReadingsStore } from './readingsStore';
import { useAccountingStore } from './accountingStore';
import { useHealthStore } from './healthStore';
import { useFocusStore } from './focusStore';
import { useFlashcardStore } from './flashcardStore';
import { useCreativeStore } from './creativeStore';

export const DATA_STORES = [
  { name: 'auth', store: useAuthStore },
  { name: 'finance', store: useFinanceStore },
  { name: 'learning', store: useLearningStore },
  { name: 'habits', store: useHabitStore },
  { name: 'skills', store: useSkillStore },
  { name: 'readings', store: useReadingsStore },
  { name: 'accounting', store: useAccountingStore },
  { name: 'health', store: useHealthStore },
  // Focus/study sessions (+ the running timer) — was local-only before the
  // Apprentissage study timer; synced so study time follows the user.
  { name: 'focus', store: useFocusStore },
  { name: 'flashcards', store: useFlashcardStore },
  // Added 2026-09-27 — was local-only. Each device may already hold its own
  // data for it, so its FIRST sync on a device merges instead of letting
  // the cloud copy win (see mergeFirstSync).
  { name: 'creative', store: useCreativeStore, mergeOnFirstSync: true },
];

export const storeByName = (name) => DATA_STORES.find((s) => s.name === name)?.store || null;
