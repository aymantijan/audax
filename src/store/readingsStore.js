import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { BOOK_CATALOG } from '../utils/book-catalog';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });
const DEFAULT_SKILL = 'learning-discipline-lv1';

// XP economy: small per-10-pages tick + a completion bonus, so a single long
// book doesn't trivially max out a skill the way per-page XP would.
const XP_PER_10_PAGES = 2;
const XP_ON_COMPLETE = 30;

export const useReadingsStore = create(
  persist(
    (set, get) => ({
      library: [], // master catalog: [{ id, title, author, genre, pages, words, description, year, popularity, linkedSkills, addedAt }]
      progress: [], // reading state: [{ id, bookId, pagesRead, customPages, customWords, status, startedAt, completedAt, updatedAt }]
      readLog: [], // [{ date: 'YYYY-MM-DD' }] one entry per day any page was read — powers the streak
      catalogSeeded: false, // one-shot: BOOK_CATALOG merged once, then user deletions stick

      // Merge the built-in catalog into the library (skips titles already present).
      // Runs once — the persisted flag means books the user later deletes stay deleted.
      seedCatalog: () => {
        if (get().catalogSeeded) return;
        const have = new Set(get().library.map((b) => `${b.title}|${b.author}`.toLowerCase()));
        const now = Date.now();
        const added = BOOK_CATALOG.filter((c) => !have.has(`${c.title}|${c.author}`.toLowerCase())).map((c) => ({
          ...c,
          id: uid(),
          words: Math.round(c.pages * 250),
          linkedSkills: [],
          addedAt: now,
          updatedAt: now,
        }));
        set({ library: [...get().library, ...added], catalogSeeded: true });
        if (added.length) toast(`Library seeded: ${added.length} books across all genres`, 'success');
      },

      // ─────────── Library (catalog) ───────────
      addBookToLibrary: (data) => {
        const book = {
          ...data,
          id: uid(),
          pages: Number(data.pages) || 0,
          words: Number(data.words) || Math.round((Number(data.pages) || 0) * 250), // ~250 words/page default estimate
          popularity: Math.max(0, Math.min(100, Number(data.popularity) || 50)),
          linkedSkills: data.linkedSkills || [],
          addedAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ library: [...get().library, book] });
        toast(`Added to library: ${book.title}`, 'success');
        return book.id;
      },
      editBook: (id, updates) =>
        set({
          library: get().library.map((b) =>
            b.id === id
              ? stamp({ ...b, ...updates, pages: Number(updates.pages ?? b.pages), words: Number(updates.words ?? b.words), popularity: Number(updates.popularity ?? b.popularity) })
              : b
          ),
        }),
      deleteBook: (id) => {
        set({ library: get().library.filter((b) => b.id !== id), progress: get().progress.filter((p) => p.bookId !== id) });
        toast('Book removed from library', 'info');
      },

      // ─────────── Reading progress ───────────
      isReading: (bookId) => get().progress.some((p) => p.bookId === bookId),

      addToReading: (bookId) => {
        if (get().isReading(bookId)) return;
        const book = get().library.find((b) => b.id === bookId);
        if (!book) return;
        const entry = {
          id: uid(),
          bookId,
          pagesRead: 0,
          customPages: null, // null = use book.pages
          customWords: null,
          status: 'reading',
          startedAt: Date.now(),
          completedAt: null,
          updatedAt: Date.now(),
        };
        set({ progress: [...get().progress, entry] });
        toast(`Started reading: ${book.title}`, 'success');
      },

      removeFromReading: (progressId) => set({ progress: get().progress.filter((p) => p.id !== progressId) }),

      // Adjust real page/word counts for THIS reading (per spec: "adjustable to
      // adjust the real book pages number or the real number of words").
      adjustBookCounts: (progressId, { customPages, customWords }) =>
        set({
          progress: get().progress.map((p) =>
            p.id === progressId
              ? stamp({ ...p, customPages: customPages !== undefined ? (customPages === '' ? null : Number(customPages)) : p.customPages, customWords: customWords !== undefined ? (customWords === '' ? null : Number(customWords)) : p.customWords })
              : p
          ),
        }),

      totalPagesFor: (p) => {
        const book = get().library.find((b) => b.id === p.bookId);
        return p.customPages ?? book?.pages ?? 0;
      },
      totalWordsFor: (p) => {
        const book = get().library.find((b) => b.id === p.bookId);
        return p.customWords ?? book?.words ?? 0;
      },

      // +1 page. Awards XP every 10 pages; awards completion bonus + marks
      // completed the moment pagesRead reaches the total. Logs today for streak.
      addPage: (progressId) => {
        const p = get().progress.find((x) => x.id === progressId);
        if (!p || p.status === 'completed') return;
        const total = get().totalPagesFor(p);
        const pagesRead = total > 0 ? Math.min(total, p.pagesRead + 1) : p.pagesRead + 1;
        const justCompleted = total > 0 && pagesRead >= total && p.status !== 'completed';

        set({
          progress: get().progress.map((x) =>
            x.id === progressId
              ? stamp({ ...x, pagesRead, status: justCompleted ? 'completed' : x.status, completedAt: justCompleted ? Date.now() : x.completedAt })
              : x
          ),
        });

        // Log today for the streak (idempotent per day)
        const today = todayKey();
        if (!get().readLog.some((l) => l.date === today)) set({ readLog: [...get().readLog, { date: today }] });

        const book = get().library.find((b) => b.id === p.bookId);
        const skillIds = book?.linkedSkills?.length ? book.linkedSkills : [DEFAULT_SKILL];
        const award = useSkillStore.getState().awardXP;
        if (pagesRead % 10 === 0) {
          for (const sid of skillIds) award(sid, XP_PER_10_PAGES, `reading: ${book?.title || 'book'}`);
        }
        if (justCompleted) {
          for (const sid of skillIds) award(sid, XP_ON_COMPLETE, `completed: ${book?.title || 'book'}`);
          toast(`📖 Finished "${book?.title}"! +${XP_ON_COMPLETE} XP`, 'success');
        }
      },

      // -1 page. Reverses XP crossed on the way down (mirrors addPage's award points).
      removePage: (progressId) => {
        const p = get().progress.find((x) => x.id === progressId);
        if (!p || p.pagesRead <= 0) return;
        const wasCompleted = p.status === 'completed';
        const pagesRead = p.pagesRead - 1;
        const total = get().totalPagesFor(p);

        set({
          progress: get().progress.map((x) =>
            x.id === progressId ? stamp({ ...x, pagesRead, status: 'reading', completedAt: null }) : x
          ),
        });

        const book = get().library.find((b) => b.id === p.bookId);
        const skillIds = book?.linkedSkills?.length ? book.linkedSkills : [DEFAULT_SKILL];
        const remove = useSkillStore.getState().removeXP;
        if (p.pagesRead % 10 === 0) {
          for (const sid of skillIds) remove(sid, XP_PER_10_PAGES, `reading undo: ${book?.title || 'book'}`);
        }
        if (wasCompleted && total > 0 && pagesRead < total) {
          for (const sid of skillIds) remove(sid, XP_ON_COMPLETE, `completion undo: ${book?.title || 'book'}`);
        }
      },

      // Consecutive-day reading streak, counting back from today (or yesterday
      // if today has no entry yet) — same convention as habitStreak().
      getStreak: () => {
        const done = new Set(get().readLog.map((l) => l.date));
        let streak = 0;
        const d = new Date(todayKey() + 'T00:00:00');
        const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        if (!done.has(iso(d))) d.setDate(d.getDate() - 1);
        while (done.has(iso(d))) {
          streak++;
          d.setDate(d.getDate() - 1);
        }
        return streak;
      },

      resetAll: () => set({ library: [], progress: [], readLog: [], catalogSeeded: false }),
    }),
    { name: 'audax-readings' }
  )
);
