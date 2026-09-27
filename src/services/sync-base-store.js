// Persists each store's sync BASE (last server row seen) in IndexedDB — kept out
// of localStorage, whose ~5 MB are already used by the stores themselves.
// Falls back to memory when IndexedDB is unavailable (private mode): sync still
// works, only offline edits made before a restart can't be told apart then.
const DB = 'audax-sync';
const STORE = 'bases';
let dbPromise = null;
const memory = new Map();

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve) => {
    if (!db) return resolve(undefined);
    try {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
}

/** Base store scoped to one account. */
export function baseStoreFor(userId) {
  const k = (name) => `${userId}:${name}`;
  return {
    async get(name) {
      const v = await tx('readonly', (s) => s.get(k(name)));
      return v ?? memory.get(k(name)) ?? null;
    },
    async set(name, base) {
      memory.set(k(name), base);
      await tx('readwrite', (s) => (base ? s.put(base, k(name)) : s.delete(k(name))));
    },
  };
}
