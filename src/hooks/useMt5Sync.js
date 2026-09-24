import { useEffect } from 'react';
import { create } from 'zustand';
import { useTradingStore } from '../store/tradingStore';
import { INSTRUMENTS, STRATEGIES } from '../utils/constants';
import { INSTRUMENT_PRESETS } from '../utils/trading-journal';
import { syncPositionsToTrades, newInstrumentDefs } from '../utils/mt5-import';
import { fetchInbox, mt5SyncAvailable } from '../services/mt5-sync';

const POLL_MS = 3 * 60 * 1000;

// Last inbox seen (not persisted): terminals, their last sync, positions received.
export const useMt5SyncStatus = create(() => ({ inbox: null, checkedAt: null, busy: false }));

/**
 * Pull the MT5 inbox and import new positions into the linked accounts.
 * An MT5 login is linked automatically to the AUDAX account with the same
 * account number; other logins wait in Trading › Accounts for the user.
 * Returns the number of trades imported.
 */
export async function syncMt5Now() {
  if (!mt5SyncAvailable() || useMt5SyncStatus.getState().busy) return 0;
  useMt5SyncStatus.setState({ busy: true });
  try {
    const inbox = await fetchInbox();
    if (!inbox) return 0;
    const st = useTradingStore.getState();
    for (const login of Object.keys(inbox.accounts || {})) {
      if (st.mt5Links?.[login]) continue;
      const acc = st.accounts.find((a) => a.accountNumber === login && a.status !== 'archived');
      if (acc) st.setMt5Link(login, acc.id);
    }
    let imported = 0;
    for (const [login, accountId] of Object.entries(useTradingStore.getState().mt5Links || {})) {
      const s = useTradingStore.getState();
      if (!s.accounts.some((a) => a.id === accountId)) continue;
      const knownInstruments = [...INSTRUMENTS, ...s.customInstruments.map((c) => c.code)];
      const existingExternal = new Set(s.trades.map((t) => t.external).filter(Boolean));
      const strategy = s.mt5Strategy || STRATEGIES[0];
      const { trades, newSymbols } = syncPositionsToTrades(login, inbox.positions?.[login], { accountId, strategy, knownInstruments, existingExternal });
      if (trades.length) imported += s.importTrades(trades, newInstrumentDefs(newSymbols, INSTRUMENT_PRESETS));
    }
    useMt5SyncStatus.setState({ inbox, checkedAt: Date.now() });
    return imported;
  } finally {
    useMt5SyncStatus.setState({ busy: false });
  }
}

/** App-wide: checks the inbox on start, every 3 min while visible, and on focus. */
export function useMt5AutoSync() {
  useEffect(() => {
    if (!mt5SyncAvailable()) return undefined;
    const run = () => { if (document.visibilityState === 'visible') syncMt5Now().catch((e) => console.error('[mt5-sync]', e)); };
    const first = setTimeout(run, 4000); // after cloud-sync's initial pull
    const id = setInterval(run, POLL_MS);
    window.addEventListener('focus', run);
    return () => { clearTimeout(first); clearInterval(id); window.removeEventListener('focus', run); };
  }, []);
}
