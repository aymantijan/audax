import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Ensure a rehydrated user has the career fields added in this version.
// NOTE: `accounts`/`activeAccount` used to live here — they've moved to
// tradingStore (accounts[]/activeAccountId), which supports an arbitrary
// number of demo/broker/prop-firm accounts instead of a fixed demo+real pair.
// tradingStore.ensureAccounts() migrates any legacy `user.accounts` it finds
// here into the new shape once, on app mount — this store no longer reads or
// writes them itself.
function withDefaults(user) {
  if (!user) return user;
  return {
    ...user,
    careerGoal: user.careerGoal || 'Hybrid',
  };
}

// Local-first profile. Cloud auth (Supabase) layers on top via services/auth-supabase.
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,

      register: (profile) =>
        set({
          user: {
            name: profile.name,
            email: profile.email || '',
            primaryDomain: profile.primaryDomain || 'trading',
            careerGoal: profile.careerGoal || 'Hybrid',
            // null = not set (legacy accounts from before this field existed,
            // or a user who skipped it) — Health.jsx treats null the same as
            // 'female' (shows Cycle) so this is never a breaking default.
            gender: profile.gender || null,
            theme: 'dark',
            createdAt: Date.now(),
          },
        }),

      updateProfile: (updates) => set({ user: { ...get().user, ...updates } }),

      logout: () => set({ user: null }),
    }),
    {
      name: 'audax-auth',
      version: 1,
      // Older exports/devices may carry version 0 — withDefaults (via merge)
      // already upgrades the shape, so migration is a pass-through.
      migrate: (persisted) => persisted,
      merge: (persisted, current) => ({ ...current, ...persisted, user: withDefaults(persisted?.user) }),
    }
  )
);
