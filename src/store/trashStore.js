import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// The trash (chantier 2, « rien n'est définitif »): what each deletion removed,
// kept 30 days on this device so it can be restored (services/undo.js). Not
// synced and not in backups: it only holds copies of records that are gone.
export const TRASH_DAYS = 30;
const MAX_ENTRIES = 150;
const DAY = 86400000;

let seq = 0;
const fresh = (entries, now = Date.now()) => entries.filter((e) => now - e.at < TRASH_DAYS * DAY).slice(0, MAX_ENTRIES);

export const useTrashStore = create(
  persist(
    (set, get) => ({
      // [{ id, at, label, stores: [{ name, removals }] }], newest first
      entries: [],
      add: (entry) => {
        const id = `t${Date.now().toString(36)}${(seq++).toString(36)}`;
        set({ entries: fresh([{ id, at: Date.now(), ...entry }, ...get().entries]) });
        return id;
      },
      get: (id) => get().entries.find((e) => e.id === id) || null,
      remove: (id) => set({ entries: get().entries.filter((e) => e.id !== id) }),
      clear: () => set({ entries: [] }),
      purge: () => set({ entries: fresh(get().entries) }),
    }),
    {
      name: 'audax-trash',
      // A full localStorage must never block a deletion: keep the newest half.
      storage: {
        getItem: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
        setItem: (k, v) => {
          for (let entries = v.state.entries; ; entries = entries.slice(0, Math.floor(entries.length / 2))) {
            try { localStorage.setItem(k, JSON.stringify({ ...v, state: { ...v.state, entries } })); return; } catch { if (!entries.length) return; }
          }
        },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
      },
      onRehydrateStorage: () => (state) => state?.purge(),
    }
  )
);
