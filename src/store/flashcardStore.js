import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { newCardState, schedule } from '../utils/fsrs';
import { useLearningStore } from './learningStore';
import { addDays } from '../utils/study';
import { toast } from './uiStore';

/**
 * Flashcards with spaced repetition (FSRS) — Apprentissage step 3.
 * A deck can be tied to a course/subject (cards then optionally tagged with
 * one of its chapters) or stand alone (languages, trading concepts, anything).
 * Cloud-synced via services/cloud-sync REGISTRY ('flashcards').
 */
export const useFlashcardStore = create(
  persist(
    (set, get) => ({
      decks: [], // [{ id, name, courseId, description, createdAt }]
      cards: [], // [{ id, deckId, chapterId, front, back, createdAt, updatedAt, ...fsrs state }]
      reviewLog: [], // [{ d: 'YYYY-MM-DD', t: ms, c: cardId, r: 1-4, n: wasNew, s: stateBefore }] — last 5000
      settings: { newPerDay: 20, retention: 0.9 },

      addDeck: (data) => {
        const deck = { id: uid(), name: data.name?.trim() || 'Paquet', courseId: data.courseId || null, description: data.description || '', createdAt: Date.now() };
        set({ decks: [...get().decks, deck] });
        return deck.id;
      },
      editDeck: (id, updates) => set({ decks: get().decks.map((d) => (d.id === id ? { ...d, ...updates } : d)) }),
      deleteDeck: (id) => {
        set({ decks: get().decks.filter((d) => d.id !== id), cards: get().cards.filter((c) => c.deckId !== id) });
        toast('Paquet supprimé', 'info');
      },
      // One deck per subject, created on demand.
      ensureCourseDeck: (courseId) => {
        const existing = get().decks.find((d) => d.courseId === courseId);
        if (existing) return existing.id;
        const course = useLearningStore.getState().courses.find((c) => c.id === courseId);
        return get().addDeck({ name: course?.name || 'Paquet', courseId });
      },

      addCard: ({ deckId, front, back, chapterId = null, reverse = false }) => {
        const f = (front || '').trim();
        const b = (back || '').trim();
        if (!f || !b) return 0;
        const now = Date.now();
        const mk = (x, y) => ({ id: uid(), deckId, chapterId, front: x, back: y, createdAt: now, updatedAt: now, ...newCardState() });
        const add = reverse ? [mk(f, b), mk(b, f)] : [mk(f, b)];
        set({ cards: [...get().cards, ...add] });
        return add.length;
      },
      addCards: (deckId, rows, { chapterId = null, reverse = false } = {}) => {
        const now = Date.now();
        const add = [];
        for (const { front, back } of rows) {
          add.push({ id: uid(), deckId, chapterId, front, back, createdAt: now, updatedAt: now, ...newCardState() });
          if (reverse) add.push({ id: uid(), deckId, chapterId, front: back, back: front, createdAt: now, updatedAt: now, ...newCardState() });
        }
        set({ cards: [...get().cards, ...add] });
        toast(`${add.length} fiche(s) ajoutée(s)`, 'success');
        return add.length;
      },
      editCard: (id, updates) => set({ cards: get().cards.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)) }),
      deleteCard: (id) => set({ cards: get().cards.filter((c) => c.id !== id) }),
      resetCard: (id) => set({ cards: get().cards.map((c) => (c.id === id ? { ...c, ...newCardState() } : c)) }),

      rateCard: (id, rating) => {
        const now = Date.now();
        const card = get().cards.find((c) => c.id === id);
        if (!card) return null;
        const next = schedule(card, rating, now, get().settings.retention);
        const entry = { d: todayKey(), t: now, c: id, r: rating, n: card.state === 'new', s: card.state };
        set({
          cards: get().cards.map((c) => (c.id === id ? { ...c, ...next } : c)),
          reviewLog: [...get().reviewLog, entry].slice(-5000),
        });
        return { ...card, ...next };
      },

      updateSettings: (updates) => set({ settings: { ...get().settings, ...updates } }),

      resetAll: () => set({ decks: [], cards: [], reviewLog: [], settings: { newPerDay: 20, retention: 0.9 } }),
    }),
    { name: 'audax-flashcards' }
  )
);

// ── Selectors / helpers (pure) ──────────────────────────────────────────
export function newIntroducedToday(reviewLog, today = todayKey()) {
  return reviewLog.filter((e) => e.d === today && e.n).length;
}

/**
 * Cards to study now for the given decks (null = all): every due card, then
 * new cards up to the daily allowance.
 */
export function buildQueue({ cards, decks, deckIds = null, reviewLog, settings, now = Date.now() }) {
  const allowed = deckIds ? new Set(deckIds) : new Set(decks.map((d) => d.id));
  const inScope = cards.filter((c) => allowed.has(c.deckId));
  const due = inScope.filter((c) => c.state !== 'new' && c.due <= now).sort((a, b) => a.due - b.due);
  const newLeft = Math.max(0, (settings.newPerDay ?? 20) - newIntroducedToday(reviewLog));
  const fresh = inScope.filter((c) => c.state === 'new').sort((a, b) => a.createdAt - b.createdAt).slice(0, newLeft);
  return [...due, ...fresh];
}

export function deckStats(deckId, cards, now = Date.now()) {
  const list = cards.filter((c) => c.deckId === deckId);
  return {
    total: list.length,
    due: list.filter((c) => c.state !== 'new' && c.due <= now).length,
    fresh: list.filter((c) => c.state === 'new').length,
    mature: list.filter((c) => c.state === 'review' && (c.stability || 0) >= 21).length,
  };
}

// Share of reviews (not first sight) answered without "À revoir" over the last N days.
export function retentionRate(reviewLog, days = 30, today = todayKey()) {
  const from = addDays(today, -days);
  // Only genuine spaced reviews count (not first sight nor same-day learning steps).
  const rel = reviewLog.filter((e) => e.d >= from && (e.s ? e.s === 'review' : !e.n));
  if (!rel.length) return null;
  return Math.round((rel.filter((e) => e.r > 1).length / rel.length) * 100);
}

export function reviewStreak(reviewLog, today = todayKey()) {
  const days = new Set(reviewLog.map((e) => e.d));
  const prev = (d) => addDays(d, -1);
  let d = days.has(today) ? today : prev(today);
  let n = 0;
  while (days.has(d)) { n += 1; d = prev(d); }
  return n;
}

/**
 * Bulk import — one card per line: "recto ; verso" (also tab or " - "
 * separators, i.e. Anki / Quizlet text exports).
 */
export function parseCardLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // Split once, on the first separator kind present (tab > ";" > " - "),
      // so the answer itself may contain the other separators.
      const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(' - ') ? ' - ' : null;
      if (!sep) return null;
      const i = line.indexOf(sep);
      return { front: line.slice(0, i).trim(), back: line.slice(i + sep.length).trim() };
    })
    .filter((r) => r && r.front && r.back);
}
