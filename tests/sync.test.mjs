// F2 · synchronisation sans perte: three-way merge + two simulated devices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from 'zustand/vanilla';
import { merge3 } from '../src/utils/merge3.js';
import { createStoreSync } from '../src/utils/sync-engine.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const serialize = (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function'));

function makeServer() {
  let row = null; let n = 0; let online = true;
  const transport = {
    fetch: async () => (online ? { row: row && { data: clone(row.data), version: row.version } } : { error: 'offline' }),
    insert: async (data) => {
      if (!online) return { error: 'offline' };
      if (row) return { conflict: true };
      row = { data: clone(data), version: `v${++n}` };
      return { version: row.version };
    },
    update: async (data, version) => {
      if (!online) return { error: 'offline' };
      if (!row || row.version !== version) return { conflict: true };
      row = { data: clone(data), version: `v${++n}` };
      return { version: row.version };
    },
  };
  return { transport, get row() { return row && { data: clone(row.data), version: row.version }; }, setOnline(v) { online = v; } };
}

function makeDevice(server, persisted = new Map()) {
  const store = createStore(() => ({ courses: [], settings: { scale: 20, arrive: 5 }, log: [] }));
  const baseStore = { get: async (k) => persisted.get(k) ?? null, set: async (k, v) => { persisted.set(k, clone(v)); } };
  const sync = createStoreSync({ name: 'learning', store, transport: server.transport, baseStore, serialize, debounceMs: 0, onError: () => {} });
  return { store, sync, persisted, set: (fn) => store.setState(fn(store.getState())) };
}

const ids = (d) => d.store.getState().courses.map((c) => c.id).sort();

test('merge3: additions from both sides kept, deletions applied, field-level merge', () => {
  const base = { courses: [{ id: 'a', t: 'A', done: false }, { id: 'x', t: 'X' }], s: { scale: 20, arrive: 5 } };
  const local = { courses: [{ id: 'a', t: 'A2', done: false }, { id: 'l', t: 'L' }], s: { scale: 20, arrive: 10 } }; // edit a.t, delete x, add l
  const remote = { courses: [{ id: 'a', t: 'A', done: true }, { id: 'x', t: 'X' }, { id: 'r', t: 'R' }], s: { scale: 10, arrive: 5 } }; // edit a.done, add r
  const m = merge3(base, local, remote);
  assert.deepEqual(m.courses, [{ id: 'a', t: 'A2', done: true }, { id: 'r', t: 'R' }, { id: 'l', t: 'L' }]);
  assert.deepEqual(m.s, { scale: 10, arrive: 10 });
});

test('merge3: plain logs behave as sets; same field changed on both sides → server value', () => {
  assert.deepEqual(merge3({ log: [1, 2] }, { log: [1, 2, 3] }, { log: [2, 4] }), { log: [2, 4, 3] }); // 1 removed remotely, 3 and 4 added
  assert.deepEqual(merge3({ v: 1 }, { v: 2 }, { v: 3 }), { v: 3 });
});

test('two devices adding at the same time keep everything', async () => {
  const server = makeServer();
  const A = makeDevice(server); const B = makeDevice(server);
  await A.sync.initial(null); await B.sync.initial(server.row);
  A.set((s) => ({ courses: [...s.courses, { id: 'c1', name: 'IFRS' }] }));
  B.set((s) => ({ courses: [...s.courses, { id: 'c2', name: 'Finance' }] }));
  await A.sync.flush(); await B.sync.flush(); // B hits a conflict, merges, retries
  await A.sync.onRemote(server.row); // realtime delivers B's merged write to A
  assert.deepEqual(ids(A), ['c1', 'c2']);
  assert.deepEqual(ids(B), ['c1', 'c2']);
  assert.deepEqual(server.row.data.courses.map((c) => c.id).sort(), ['c1', 'c2']);
});

test('a deletion on one device and an edit on the other are both kept', async () => {
  const server = makeServer();
  const A = makeDevice(server); const B = makeDevice(server);
  A.set(() => ({ courses: [{ id: 'k', name: 'Keep' }, { id: 'd', name: 'Delete me' }] }));
  await A.sync.initial(null); await B.sync.initial(server.row);
  A.set((s) => ({ courses: s.courses.filter((c) => c.id !== 'd') }));
  B.set((s) => ({ courses: s.courses.map((c) => (c.id === 'k' ? { ...c, name: 'Kept & edited' } : c)) }));
  await A.sync.flush(); await B.sync.flush(); await A.sync.onRemote(server.row);
  for (const d of [A, B]) assert.deepEqual(d.store.getState().courses, [{ id: 'k', name: 'Kept & edited' }]);
});

test('an edit made offline survives a restart and merges with the other device', async () => {
  const server = makeServer();
  const persisted = new Map();
  const A = makeDevice(server, persisted); const B = makeDevice(server);
  await A.sync.initial(null); await B.sync.initial(server.row);
  server.setOnline(false);
  A.set((s) => ({ courses: [...s.courses, { id: 'offline', name: 'Noted in the metro' }] }));
  await A.sync.flush(); // fails: still offline
  server.setOnline(true);
  B.set((s) => ({ settings: { ...s.settings, arrive: 10 } }));
  await B.sync.flush();
  // A restarts: same local data and persisted base, fresh engine.
  const localState = serialize(A.store.getState());
  A.sync.stop();
  const A2 = makeDevice(server, persisted);
  A2.store.setState(localState);
  await A2.sync.initial(server.row);
  assert.deepEqual(ids(A2), ['offline']);
  assert.equal(A2.store.getState().settings.arrive, 10);
  assert.deepEqual(server.row.data.courses.map((c) => c.id), ['offline']);
});

test('without a stored base, the first sync keeps the server as the truth (unchanged behaviour)', async () => {
  const server = makeServer();
  const A = makeDevice(server);
  A.set(() => ({ courses: [{ id: 's', name: 'Server' }] }));
  await A.sync.initial(null);
  const C = makeDevice(server);
  C.set(() => ({ courses: [{ id: 'stale', name: 'Old local copy' }] }));
  await C.sync.initial(server.row);
  assert.deepEqual(ids(C), ['s']);
});

test('our own write echoing back through realtime is ignored, whatever the timestamp format', async () => {
  const server = makeServer();
  const A = makeDevice(server);
  await A.sync.initial(null);
  A.set((s) => ({ courses: [...s.courses, { id: 'n', name: 'New' }] }));
  await A.sync.flush();
  let applied = 0;
  const unsub = A.store.subscribe(() => { applied += 1; });
  await A.sync.onRemote(server.row); // echo, same version
  unsub();
  assert.equal(applied, 0);
});
