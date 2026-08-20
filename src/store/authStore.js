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
    // `??` (not `||`) so an explicit `false` (mid-onboarding) survives rehydration —
    // only truly-missing (pre-onboarding-feature accounts) defaults to true, so
    // existing users are never retroactively shown the wizard.
    onboarded: user.onboarded ?? true,
    // Global profile fields (added for cross-domain reuse — Health used to ask
    // for these itself). `dobYear`/`heightCm` default to null (unset, fillable
    // later in Settings); `gender` is NOT defaulted here — it's required at
    // signup going forward, but a pre-existing local account with none on file
    // stays null rather than being silently assigned one.
    dobYear: user.dobYear ?? null,
    heightCm: user.heightCm ?? null,
    // Which top-level sections show in the nav — asked once during
    // Onboarding.jsx, editable later in Settings. Existing accounts default
    // both to true (unchanged behavior) rather than being retroactively
    // hidden from a section they were already using.
    enabledModules: { trading: user.enabledModules?.trading ?? true, deals: user.enabledModules?.deals ?? true },
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
            // Gender is required at signup going forward (Welcome.jsx/
            // CloudAuthPanel.jsx enforce a choice before submit) — still
            // nullable here defensively for any caller that skips validation.
            gender: profile.gender || null,
            dobYear: profile.dobYear || null,
            heightCm: profile.heightCm || null,
            theme: 'dark',
            createdAt: Date.now(),
            onboarded: false, // gates App.jsx into the Onboarding wizard until completeOnboarding()
            enabledModules: { trading: true, deals: true }, // asked/confirmed in Onboarding.jsx step 1
          },
        }),

      updateProfile: (updates) => set({ user: { ...get().user, ...updates } }),
      completeOnboarding: () => set({ user: { ...get().user, onboarded: true } }),

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
