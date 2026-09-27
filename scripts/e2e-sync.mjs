// Live end-to-end check of the lossless sync (F2) against the real Supabase
// project, WITHOUT touching any real data: two simulated devices sync a
// scratch row (`store_name = '__sync_e2e__'`, never read by the app) through
// the exact transport the app uses, then the row is deleted.
//
// Usage: node scripts/e2e-sync.mjs <user-uuid>
// Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, or in the
// file named by ENV_FILE (e.g. a temporary `vercel env pull`, deleted afterwards).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createStore } from 'zustand/vanilla';
import { makeTransport } from '../src/services/sync-transport.js';
import { createStoreSync } from '../src/utils/sync-engine.js';

const parseEnv = (file) => {
  try {
    return Object.fromEntries(readFileSync(file, 'utf8')
      .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
      // `vercel env pull` quotes values and may append a literal "\n".
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '').replace(/\\n$/, '').trim()]));
  } catch { return {}; }
};
// .env.local wins for the URL (`vercel env pull` is known to mangle it); the
// service key usually only exists in the pulled file.
const env = { ...(process.env.ENV_FILE ? parseEnv(process.env.ENV_FILE) : {}), ...parseEnv(new URL('../.env.local', import.meta.url)) };
const userId = process.argv[2];
assert.ok(/^[0-9a-f-]{36}$/.test(userId || ''), 'usage: node scripts/e2e-sync.mjs <user-uuid>');
const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const NAME = '__sync_e2e__';
const serialize = (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function'));
const cleanup = () => client.from('app_state').delete().eq('user_id', userId).eq('store_name', NAME);

function device() {
  const store = createStore(() => ({ items: [], settings: { arrive: 5 } }));
  const bases = new Map();
  const sync = createStoreSync({
    name: NAME, store, serialize, debounceMs: 0, onError: (e) => console.error('  engine error:', e?.message || e),
    transport: makeTransport(client, userId, NAME),
    baseStore: { get: async (k) => bases.get(k) ?? null, set: async (k, v) => { bases.set(k, v); } },
  });
  return { store, sync, set: (fn) => store.setState(fn(store.getState())) };
}
const ids = (d) => d.store.getState().items.map((i) => i.id).sort().join(',');
const serverRow = async () => (await makeTransport(client, userId, NAME).fetch()).row;

try {
  await cleanup();
  const A = device(); const B = device();
  await A.sync.initial(null);
  const first = await serverRow();
  assert.ok(first?.version, 'the first device must have created the server row');
  await B.sync.initial(first);
  console.log('1. insert + second device load: ok');

  A.set((s) => ({ items: [...s.items, { id: 'a1', name: 'from A' }] }));
  B.set((s) => ({ items: [...s.items, { id: 'b1', name: 'from B' }] }));
  await A.sync.flush();
  await B.sync.flush(); // conditional update must fail on the real DB, then merge + retry
  await A.sync.onRemote(await serverRow());
  assert.equal(ids(A), 'a1,b1'); assert.equal(ids(B), 'a1,b1');
  assert.equal((await serverRow()).data.items.map((i) => i.id).sort().join(','), 'a1,b1');
  console.log('2. simultaneous additions on two devices: both kept');

  A.set((s) => ({ items: s.items.filter((i) => i.id !== 'a1') }));
  B.set((s) => ({ items: s.items.map((i) => (i.id === 'b1' ? { ...i, name: 'edited on B' } : i)), settings: { arrive: 10 } }));
  await A.sync.flush(); await B.sync.flush(); await A.sync.onRemote(await serverRow());
  for (const d of [A, B]) {
    assert.deepEqual(d.store.getState().items, [{ id: 'b1', name: 'edited on B' }]);
    assert.equal(d.store.getState().settings.arrive, 10);
  }
  console.log('3. deletion on A + edit on B: both applied on both devices');

  const before = await serverRow();
  const r = await makeTransport(client, userId, NAME).update({ items: [], settings: {} }, '2000-01-01T00:00:00.000Z');
  assert.deepEqual(r, { conflict: true });
  assert.deepEqual((await serverRow()).data, before.data);
  console.log('4. a write with an outdated version is refused by the database');
  console.log('ALL LIVE CHECKS PASSED');
} finally {
  const { error } = await cleanup();
  console.log(error ? `cleanup FAILED: ${error.message}` : 'scratch row deleted');
}
