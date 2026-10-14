// « Lisible par tous » (chantier 4): text size, contrast and theme.
// Saved on the profile (every device follows) and on this device, so the very
// first screen — before any account exists — already uses them.
// The CSS lives in styles/globals.css ([data-text], [data-contrast], [data-theme]).

export const TEXT_SIZES = [
  { value: 'normal', label: 'Normal', sample: 'Aa' },
  { value: 'grand', label: 'Grand', sample: 'Aa' },
  { value: 'tres-grand', label: 'Très grand', sample: 'Aa' },
];

const KEY = 'audax-display';

export function readLocalDisplay() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function saveLocalDisplay(patch) {
  const next = { ...readLocalDisplay(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

// Profile values win; the device values cover the time before an account.
export function resolveDisplay(user) {
  const local = readLocalDisplay();
  return {
    theme: user?.theme || local.theme || 'dark',
    textSize: user?.textSize || local.textSize || 'normal',
    contrast: user?.contrast || local.contrast || 'normal',
  };
}

export function applyDisplay({ theme, textSize, contrast }) {
  const root = document.documentElement;
  root.dataset.theme = theme || 'dark';
  root.dataset.text = textSize || 'normal';
  root.dataset.contrast = contrast || 'normal';
}
