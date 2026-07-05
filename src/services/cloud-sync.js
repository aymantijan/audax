import { supabase, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useFinanceStore } from '../store/financeStore';
import { useDealsStore } from '../store/dealsStore';
import { useLearningStore } from '../store/learningStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useReadingsStore } from '../store/readingsStore';

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

// Fetch every synced store's cloud data for this user. Returns a map keyed by
// store name; a store absent from the map has no cloud row yet (first login).
export async function fetchCloudState(userId) {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await supabase.from(TABLE).select('store_name, data').eq('user_id', userId);
  if (error) {
    console.error('[cloud-sync] fetch failed:', error.message);
    return {};
  }
  return Object.fromEntries((data || []).map((row) => [row.store_name, row.data]));
}

let activeSubscription = null;
let unsubscribeFns = [];
let applyingRemote = false; // guards against echoing a remote update straight back up

// Call once after a Supabase auth session is confirmed. Hydrates local stores
// from the cloud (cloud wins for stores that already have a row — e.g. logging
// in on a second device); stores with no cloud row yet get seeded from local
// state instead (first-ever login populates the cloud from whatever's on this
// device already). Then attaches push-on-change + realtime pull.
export async function startCloudSync(userId) {
  if (!isSupabaseConfigured || !userId) return;
  stopCloudSync();

  const cloud = await fetchCloudState(userId);

  for (const { name, store } of REGISTRY) {
    if (cloud[name]) {
      applyingRemote = true;
      store.setState(cloud[name]);
      applyingRemote = false;
    } else {
      await pushStore(userId, name, serializableState(store.getState()));
    }
  }

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
  unsubscribeFns.forEach((fn) => fn());
  unsubscribeFns = [];
  if (activeSubscription) {
    supabase.removeChannel(activeSubscription);
    activeSubscription = null;
  }
}
