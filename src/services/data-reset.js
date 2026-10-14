// « Tout effacer », made honest (chantier 2, D1/D2). Two different things:
//  - eraseThisDevice(): empties this phone/computer and signs out. The data on
//    the account is untouched and comes back at the next sign-in (a device
//    that never synced takes the server copy, see utils/sync-engine.js).
//  - eraseEverywhere(): empties the active sections on the account — every
//    signed-in device follows. The profile stays, and so does the dormant data
//    of removed modules (CLAUDE.md, decision 7).
import { DATA_STORES } from '../store/registry';
import { useAuthStore } from '../store/authStore';
import { useTrashStore } from '../store/trashStore';
import { stopCloudSync } from './cloud-sync';
import { baseStoreFor } from './sync-base-store';
import { getSession, logout as cloudLogout } from './auth-supabase';

function resetStores() {
  for (const { name, store } of DATA_STORES) {
    if (name === 'auth') continue;
    store.getState().resetAll?.();
  }
  try { localStorage.removeItem('audax-synergy-history'); } catch { /* ignore */ }
}

export async function eraseThisDevice() {
  const userId = (await getSession())?.user?.id || null;
  stopCloudSync(); // nothing below may reach the account
  resetStores();
  if (userId) {
    const bases = baseStoreFor(userId);
    for (const { name } of DATA_STORES) await bases.set(name, null);
    try { localStorage.removeItem(`audax-sync-seen:${userId}`); } catch { /* ignore */ }
  }
  try { localStorage.removeItem('audax-data-owner'); } catch { /* ignore */ }
  useTrashStore.getState().clear();
  await cloudLogout();
  useAuthStore.getState().logout();
}

export function eraseEverywhere() {
  resetStores(); // with sync running, every section pushes its empty state
  useTrashStore.getState().clear();
}
