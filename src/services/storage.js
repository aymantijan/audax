// Local-first storage helpers.
//
// IMPORTANT: the one-time demo wipe below runs at MODULE-IMPORT time, not in a
// React effect. Zustand's persist middleware hydrates each store from
// localStorage the moment its module is imported, so a useEffect in App would
// fire *after* the user was already rehydrated into memory — too late to reset.
// main.jsx imports this file before App (and therefore before any store), so the
// wipe happens first.

const PREFIX = 'audax-';
const DEMO_FLAG = 'audax-demo-cleared';

export function clearAllData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}

// Mark data as intentionally seeded (e.g. after importing a backup) so the
// one-time wipe never touches it on a fresh browser.
export function markDataSeeded() {
  try {
    localStorage.setItem(DEMO_FLAG, 'true');
  } catch {
    /* localStorage unavailable */
  }
}

// Runs exactly once per browser: clears leftover demo data for a fresh start.
(function runOnceDemoClear() {
  try {
    if (!localStorage.getItem(DEMO_FLAG)) {
      clearAllData();
      markDataSeeded();
      // eslint-disable-next-line no-console
      console.log('AUDAX: demo data cleared. Fresh start ready.');
    }
  } catch {
    /* localStorage unavailable — nothing to clear */
  }
})();
