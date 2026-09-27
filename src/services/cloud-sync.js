import { supabase, isSupabaseConfigured } from './supabase';
import { toast } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useFinanceStore } from '../store/financeStore';
import { useDealsStore } from '../store/dealsStore';
import { useLearningStore } from '../store/learningStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useReadingsStore } from '../store/readingsStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useBusinessStore } from '../store/businessStore';
import { useFocusStore } from '../store/focusStore';
import { useFlashcardStore } from '../store/flashcardStore';
import { fillDefaults } from '../utils/fill-defaults.js';
import { createStoreSync } from '../utils/sync-engine.js';
import { baseStoreFor, backupOnce } from './sync-base-store';
import { makeTransport, SYNC_TABLE } from './sync-transport.js';
import { useCareerStore } from '../store/careerStore';
import { useNetworkingStore } from '../store/networkingStore';
import { useContentStore } from '../store/contentStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useFundraisingStore } from '../store/fundraisingStore';
import { useCreativeStore } from '../store/creativeStore';
import { useRealEstateStore } from '../store/realEstateStore';
import { useEngineeringStore } from '../store/engineeringStore';

const TABLE = SYNC_TABLE;

// Registry of every Zustand store that should sync to the cloud. `auth` maps
// to the local profile store (name/careerGoal/accounts/activeAccount) — that's
// the one piece of "auth" data that lives outside Supabase's own session.
const REGISTRY = [
  { name: 'auth', store: useAuthStore },
  { name: 'trading', store: useTradingStore },
  { name: 'finance', store: useFinanceStore },
  { name: 'deals', store: useDealsStore },
  { name: 'learning', store: useLearningStore },
  { name: 'habits', store: useHabitStore },
  { name: 'skills', store: useSkillStore },
  { name: 'readings', store: useReadingsStore },
  { name: 'accounting', store: useAccountingStore },
  { name: 'health', store: useHealthStore },
  { name: 'business', store: useBusinessStore },
  // Focus/study sessions (+ the running timer) — was local-only before the
  // Apprentissage study timer; synced so study time follows the user.
  { name: 'focus', store: useFocusStore },
  { name: 'flashcards', store: useFlashcardStore },
  // Added 2026-09-27 — were local-only. Each device may already hold its own
  // data for them, so their FIRST sync on a device merges instead of letting
  // the cloud copy win (see mergeFirstSync).
  { name: 'career', store: useCareerStore, mergeOnFirstSync: true },
  { name: 'networking', store: useNetworkingStore, mergeOnFirstSync: true },
  { name: 'content', store: useContentStore, mergeOnFirstSync: true },
  { name: 'freelance', store: useFreelanceStore, mergeOnFirstSync: true },
  { name: 'fundraising', store: useFundraisingStore, mergeOnFirstSync: true },
  { name: 'creative', store: useCreativeStore, mergeOnFirstSync: true },
  { name: 'realestate', store: useRealEstateStore, mergeOnFirstSync: true },
  { name: 'engineering', store: useEngineeringStore, mergeOnFirstSync: true },
];

// ── Per-device bookkeeping (localStorage; lost storage = safe defaults) ──
// OWNER: the account the local data belongs to. Local data survives logout,
// so without this a different account signing in on the same device would get
// the previous user's local data seeded into (or merged with) its own cloud.
// SEEN: stores this device already synced once for that account.
const OWNER_KEY = 'audax-data-owner';
const seenKey = (userId) => `audax-sync-seen:${userId}`;
const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

// Strip actions (functions) off a store's state — same filter zustand/persist
// applies implicitly when serializing to localStorage.
function serializableState(state) {
  const out = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof v !== 'function') out[k] = v;
  }
  return out;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Keeps the public `leaderboard_profiles` row (see supabase/schema.sql) in
// sync — just a display name, career track, and a lifetime XP number, NOT a
// copy of app_state (that stays private, per-user-only via RLS). Cheap
// enough to recompute from scratch on every call: getLifetimeXP() is a
// single reduce over already-in-memory skills.
async function pushLeaderboardProfile(userId) {
  if (!isSupabaseConfigured) return;
  const user = useAuthStore.getState().user;
  if (!user) return;
  const lifetimeXp = useSkillStore.getState().getLifetimeXP();
  const { error } = await supabase
    .from('leaderboard_profiles')
    .upsert(
      { user_id: userId, display_name: user.name || 'Anonymous', career_goal: user.occupation || null, lifetime_xp: lifetimeXp, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) console.error('[cloud-sync] push leaderboard profile failed:', error.message);
}

// Every other user's public leaderboard row (see supabase/schema.sql) — this
// is the ONLY cross-user read anywhere in the app, deliberately scoped to
// this one minimal table. Called from Leaderboard.jsx, not part of the
// per-device sync cycle above (no realtime subscription — a leaderboard is
// fine refreshing on page load rather than staying live-subscribed).
export async function fetchLeaderboardProfiles() {
  if (!isSupabaseConfigured) return { ok: true, profiles: [] };
  const { data, error } = await supabase.from('leaderboard_profiles').select('user_id, display_name, career_goal, lifetime_xp');
  if (error) {
    console.error('[cloud-sync] fetch leaderboard profiles failed:', error.message);
    return { ok: false, profiles: [] };
  }
  return { ok: true, profiles: data || [] };
}

// Fetch every synced store's cloud data for this user. `data` is a map keyed
// by store name; a store absent from the map has no cloud row yet (first
// login for that store). `ok: false` means the fetch itself failed (network/DB
// error) — callers MUST NOT treat that as "no cloud rows exist", or a transient
// blip looks identical to a genuinely empty account and local (possibly
// default/empty) state gets pushed up over real cloud data. See startCloudSync.
export async function fetchCloudState(userId) {
  if (!isSupabaseConfigured) return { ok: true, data: {} };
  const { data, error } = await supabase.from(TABLE).select('store_name, data, updated_at').eq('user_id', userId);
  if (error) {
    console.error('[cloud-sync] fetch failed:', error.message);
    return { ok: false, data: {} };
  }
  return { ok: true, data: Object.fromEntries((data || []).map((row) => [row.store_name, { data: row.data, version: row.updated_at }])) };
}

let activeSubscription = null;
let unsubscribeFns = [];
let engines = []; // one sync engine per store (utils/sync-engine.js)
const applyingRemote = () => engines.some((e) => e.isApplying());
const onOnline = () => engines.forEach((e) => e.push());
let generation = 0; // bumped by every start/stop — lets a superseded in-flight start abort itself

function teardown() {
  engines.forEach((e) => e.stop());
  engines = [];
  if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
  unsubscribeFns.forEach((fn) => fn());
  unsubscribeFns = [];
  if (activeSubscription) {
    supabase.removeChannel(activeSubscription);
    activeSubscription = null;
  }
}

// Call once after a Supabase auth session is confirmed. For each store: merge
// the cloud row with local data (three-way, against the last version this
// device synced — see utils/sync-engine.js); a store with no cloud row yet is
// seeded from this device. Then pushes on change and merges realtime updates
// from other devices.
//
// App.jsx can legitimately call this twice in quick succession on load (the
// initial getSession() check, plus onAuthChange firing immediately with the
// same session) — without the generation guard below, both calls would race
// to open a Realtime channel on the same topic and the second `.on()` call
// would throw "cannot add postgres_changes callbacks ... after subscribe()".
// Tracking a generation token lets the *earlier* call detect it's been
// superseded (after its awaits) and bail out before touching the channel, so
// only the latest call ever actually subscribes.
export async function startCloudSync(userId) {
  if (!isSupabaseConfigured || !userId) return;
  const myGeneration = ++generation;
  teardown();

  let cloud = await fetchCloudState(userId);
  if (myGeneration !== generation) return;

  // A failed fetch is NOT the same as "this account has no cloud data yet" —
  // treating it that way is exactly how a flaky connection used to cause data
  // loss (a real cloud row silently overwritten by empty/default local state,
  // see project memory). Ride out one transient blip with a short retry, then
  // refuse to sync at all this session rather than guess.
  if (!cloud.ok) {
    await new Promise((r) => setTimeout(r, 3000));
    if (myGeneration !== generation) return;
    cloud = await fetchCloudState(userId);
    if (myGeneration !== generation) return;
  }
  if (!cloud.ok) {
    console.error('[cloud-sync] could not confirm cloud state after retry — refusing to sync this session (local data is safe, but this device stays unsynced until the next successful login).');
    toast('Cloud sync unavailable right now — working offline this session', 'warning');
    return;
  }

  // Local data from ANOTHER account: never push or merge it into this one —
  // start this account from its defaults (its cloud rows are applied below).
  const owner = readLS(OWNER_KEY, null);
  const foreignLocal = owner != null && owner !== userId;
  if (foreignLocal) {
    // Not 'auth': the sign-up / sign-in flow has just written this account's profile there.
    for (const { name, store } of REGISTRY) if (name !== 'auth' && store.getInitialState) store.setState(store.getInitialState(), true);
    console.warn('[cloud-sync] local data belonged to another account — reset before syncing this one.');
  }
  writeLS(OWNER_KEY, userId);
  const seen = new Set(readLS(seenKey(userId), []));

  // One engine per store: three-way merge with the last server version this
  // device saw (persisted in IndexedDB), conditional writes, single-flight
  // pushes. Edits made offline or on two devices at once are merged, not lost.
  const baseStore = baseStoreFor(userId);
  const created = REGISTRY.map(({ name, store, mergeOnFirstSync }) => ({
    name,
    engine: createStoreSync({
      name, store, baseStore, mergeOnFirstSync,
      transport: makeTransport(supabase, userId, name),
      serialize: serializableState,
      prepare: (data) => fillDefaults(data, store.getInitialState?.() || {}),
      onError: () => {},
    }),
  }));
  engines = created.map((c) => c.engine);
  for (const { name, engine } of created) {
    const store = REGISTRY.find((r) => r.name === name).store;
    if (!(await baseStore.get(name))) await backupOnce(userId, name, serializableState(store.getState()));
    await engine.initial(cloud.data[name] || null, { firstTimeOnDevice: !seen.has(name) });
    if (myGeneration !== generation) return;
  }
  writeLS(seenKey(userId), REGISTRY.map((r) => r.name));
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

  // Leaderboard profile: pushed once now (so a fresh account/name/career
  // change shows up immediately) and re-pushed, debounced, whenever XP or
  // profile fields change — same pattern as the REGISTRY loop above, just
  // writing to leaderboard_profiles instead of app_state.
  await pushLeaderboardProfile(userId);
  if (myGeneration !== generation) return;
  const pushProfileDebounced = debounce(() => pushLeaderboardProfile(userId), 2000);
  unsubscribeFns.push(useSkillStore.subscribe(() => { if (!applyingRemote()) pushProfileDebounced(); }));
  unsubscribeFns.push(useAuthStore.subscribe(() => { if (!applyingRemote()) pushProfileDebounced(); }));

  // Realtime: pick up changes made from another device/tab.
  activeSubscription = supabase
    .channel(`app_state:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        const i = REGISTRY.findIndex((r) => r.name === row.store_name);
        if (i < 0 || !engines[i]) return;
        engines[i].onRemote({ data: row.data, version: row.updated_at });
      }
    )
    .subscribe();
}

export function stopCloudSync() {
  generation += 1; // invalidate any in-flight startCloudSync so it can't subscribe after we've torn down
  teardown();
}
