import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_DEMO = () => ({
  accountType: 'demo',
  initialBalance: 52000,
  brokerName: 'Demo Sim',
  createdAt: Date.now(),
});

// Ensure a rehydrated user has the account/career fields added in this version.
function withDefaults(user) {
  if (!user) return user;
  return {
    ...user,
    careerGoal: user.careerGoal || 'Hybrid',
    activeAccount: user.activeAccount || 'demo',
    accounts: user.accounts || { demo: DEFAULT_DEMO(), real: null },
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
            theme: 'dark',
            activeAccount: 'demo',
            accounts: { demo: DEFAULT_DEMO(), real: null },
            createdAt: Date.now(),
          },
        }),

      updateProfile: (updates) => set({ user: { ...get().user, ...updates } }),

      setActiveAccount: (type) => {
        const user = get().user;
        if (type === 'real' && !user?.accounts?.real) return; // must create real account first
        set({ user: { ...user, activeAccount: type } });
      },

      createRealAccount: ({ initialBalance, brokerName, accountNumber, leverage }) => {
        const user = get().user;
        set({
          user: {
            ...user,
            accounts: {
              ...user.accounts,
              real: {
                accountType: 'real',
                initialBalance: Number(initialBalance) || 0,
                brokerName: brokerName || '',
                accountNumber: accountNumber || '',
                leverage: Number(leverage) || 1,
                riskWarningAcknowledged: true,
                createdAt: Date.now(),
              },
            },
            activeAccount: 'real',
          },
        });
      },

      // Update a trading account's initial balance (deposit/withdraw/adjust). Trades
      // stay untouched, so metrics recalc naturally on the next render. Adjustment
      // history stays on the account for audit.
      adjustAccountBalance: (type, newInitialBalance, reason) => {
        const user = get().user;
        const acct = user?.accounts?.[type];
        if (!acct) return;
        const prev = acct.initialBalance;
        const adj = { date: Date.now(), previousBalance: prev, newBalance: Number(newInitialBalance), change: Number(newInitialBalance) - prev, reason: reason || '' };
        set({
          user: {
            ...user,
            accounts: {
              ...user.accounts,
              [type]: { ...acct, initialBalance: Number(newInitialBalance), balanceAdjustments: [...(acct.balanceAdjustments || []), adj] },
            },
          },
        });
      },

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
