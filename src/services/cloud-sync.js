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

const TABLE = 'app_state';

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
];

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

async function pushStore(userId, name, data) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, store_name: name, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,store_name' });
  if (error) console.error(`[cloud-sync] push ${name} failed:`, error.message);
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
      { user_id: userId, display_name: user.name || 'Anonymous', career_goal: user.careerGoal || null, lifetime_xp: lifetimeXp, updated_at: new Date().toISOString() },
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
  const { data, error } = await supabase.from(TABLE).select('store_name, data').eq('user_id', userId);
  if (error) {
    console.error('[cloud-sync] fetch failed:', error.message);
    return { ok: false, data: {} };
  }
  return { ok: true, data: Object.fromEntries((data || []).map((row) => [row.store_name, row.data])) };
}

let activeSubscription = null;
let unsubscribeFns = [];
let applyingRemote = false; // guards against echoing a remote update straight back up
let generation = 0; // bumped by every start/stop — lets a superseded in-flight start abort itself

function teardown() {
  unsubscribeFns.forEach((fn) => fn());
  unsubscribeFns = [];
  if (activeSubscription) {
    supabase.removeChannel(activeSubscription);
    activeSubscription = null;
  }
}

// Call once after a Supabase auth session is confirmed. Hydrates local stores
// from the cloud (cloud wins for stores that already have a row — e.g. logging
// in on a second device); stores with no cloud row yet get seeded from local
// state instead (first-ever login populates the cloud from whatever's on this
// device already). Then attaches push-on-change + realtime pull.
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

  for (const { name, store } of REGISTRY) {
    if (cloud.data[name]) {
      applyingRemote = true;
      store.setState(cloud.data[name]);
      applyingRemote = false;
    } else {
      // Confirmed absent (the fetch succeeded and simply returned no row for
      // this store) — safe to seed the cloud from local.
      await pushStore(userId, name, serializableState(store.getState()));
      if (myGeneration !== generation) return;
    }
  }
  if (myGeneration !== generation) return;

  // Push-on-change, debounced per store so rapid edits (e.g. typing) coalesce
  // into one write instead of one per keystroke.
  for (const { name, store } of REGISTRY) {
    const pushDebounced = debounce((state) => pushStore(userId, name, state), 800);
    const unsub = store.subscribe((state) => {
      if (applyingRemote) return; // don't echo a just-applied remote update
      pushDebounced(serializableState(state));
    });
    unsubscribeFns.push(unsub);
  }

  // Leaderboard profile: pushed once now (so a fresh account/name/career
  // change shows up immediately) and re-pushed, debounced, whenever XP or
  // profile fields change — same pattern as the REGISTRY loop above, just
  // writing to leaderboard_profiles instead of app_state.
  await pushLeaderboardProfile(userId);
  if (myGeneration !== generation) return;
  const pushProfileDebounced = debounce(() => pushLeaderboardProfile(userId), 2000);
  unsubscribeFns.push(useSkillStore.subscribe(() => { if (!applyingRemote) pushProfileDebounced(); }));
  unsubscribeFns.push(useAuthStore.subscribe(() => { if (!applyingRemote) pushProfileDebounced(); }));

  // Realtime: pick up changes made from another device/tab.
  activeSubscription = supabase
    .channel(`app_state:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new;
        if (!row) return;
        const entry = REGISTRY.find((r) => r.name === row.store_name);
        if (!entry) return;
        applyingRemote = true;
        entry.store.setState(row.data);
        applyingRemote = false;
      }
    )
    .subscribe();
}

export function stopCloudSync() {
  generation += 1; // invalidate any in-flight startCloudSync so it can't subscribe after we've torn down
  teardown();
}
