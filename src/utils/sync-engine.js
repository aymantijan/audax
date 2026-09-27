/**
 * Per-store sync engine (F2 · synchronisation sans perte). Transport-agnostic:
 * src/services/cloud-sync.js plugs Supabase in, tests plug an in-memory server.
 *
 * Each store keeps a BASE: { version, data } = the last server row this device
 * saw. It is persisted (IndexedDB in the app), so edits made offline or just
 * before closing the app survive to the next start.
 *
 *  - initial(row):  merge3(base, local, server) → apply → push if different.
 *  - push():        conditional write ("only if the server is still at my base
 *                   version"). On conflict: fetch, merge3, apply, retry.
 *  - onRemote(row): another device wrote → merge3 with local edits → apply.
 * Pushes are single-flight per store and read the state at send time, so a
 * slow network can never send a stale snapshot over newer data.
 *
 * transport: { fetch() → { row } | { error }, insert(data) → { version } | { conflict } | { error },
 *              update(data, version) → { version } | { conflict } | { error } }
 * baseStore: { get(name) → Promise<base|null>, set(name, base) → Promise }
 */
import { merge3, deepEqual } from './merge3.js';
import { mergeFirstSync } from './fill-defaults.js';

// Versions are row timestamps; REST and realtime format them differently.
const sameVersion = (a, b) => a === b || (a != null && b != null && !Number.isNaN(Date.parse(a)) && Date.parse(a) === Date.parse(b));

export function createStoreSync({ name, store, transport, baseStore, serialize, prepare = (d) => d, onApply, onError = () => {}, debounceMs = 800, mergeOnFirstSync = false }) {
  let base = null;
  let loaded = false;
  let inFlight = null;
  let dirtyAgain = false;
  let timer = null;
  let applying = false;

  const local = () => serialize(store.getState());
  const hasOwnData = () => !deepEqual(local(), serialize(store.getInitialState?.() || {}));
  const setBase = async (b) => { base = b; try { await baseStore.set(name, b); } catch (e) { onError(e); } };
  const loadBase = async () => { if (!loaded) { try { base = (await baseStore.get(name)) || null; } catch { base = null; } loaded = true; } };

  function apply(data) {
    applying = true;
    try { store.setState(prepare(data)); onApply?.(); } finally { applying = false; }
  }

  async function doPush() {
    await loadBase();
    for (let attempt = 0; attempt < 5; attempt++) {
      const data = local();
      if (base && deepEqual(data, base.data)) return { ok: true, noop: true };
      const res = base ? await transport.update(data, base.version) : await transport.insert(data);
      if (res.version) { await setBase({ version: res.version, data }); return { ok: true }; }
      if (res.conflict) {
        const f = await transport.fetch();
        if (f.error) { onError(f.error); return { ok: false }; }
        if (!f.row) { await setBase(null); continue; } // row vanished: insert next round
        apply(base ? merge3(base.data, local(), f.row.data) : mergeFirstSync(f.row.data, local()));
        await setBase({ version: f.row.version, data: f.row.data });
        continue;
      }
      onError(res.error); return { ok: false };
    }
    onError(new Error(`[sync] ${name}: too many conflicts`));
    return { ok: false };
  }

  async function push() {
    if (inFlight) { dirtyAgain = true; return inFlight; }
    inFlight = (async () => {
      let r;
      do { dirtyAgain = false; r = await doPush(); } while (dirtyAgain && r.ok);
      return r;
    })();
    try { return await inFlight; } finally { inFlight = null; }
  }

  function schedulePush() {
    clearTimeout(timer);
    timer = setTimeout(() => { push(); }, debounceMs);
  }

  async function initial(row, { firstTimeOnDevice = false } = {}) {
    await loadBase();
    if (!row) return push(); // no server copy yet: seed it from this device
    const mine = local();
    let merged;
    if (base) merged = merge3(base.data, mine, row.data); // offline / unsynced edits survive
    else if (mergeOnFirstSync && firstTimeOnDevice && hasOwnData()) merged = mergeFirstSync(row.data, mine);
    else merged = row.data; // device never synced this store: the server is the truth
    apply(merged);
    await setBase({ version: row.version, data: row.data });
    if (!deepEqual(local(), row.data)) return push();
    return { ok: true };
  }

  async function onRemote(row) {
    await loadBase();
    if (base && sameVersion(row.version, base.version)) return; // our own write echoing back
    const merged = base ? merge3(base.data, local(), row.data) : row.data;
    apply(merged);
    await setBase({ version: row.version, data: row.data });
    if (!deepEqual(local(), row.data)) schedulePush();
  }

  const unsubscribe = store.subscribe(() => { if (!applying) schedulePush(); });

  return {
    initial, push, onRemote, schedulePush,
    isApplying: () => applying,
    getBase: () => base,
    stop() { clearTimeout(timer); unsubscribe(); },
    flush: () => { clearTimeout(timer); return push(); },
  };
}
