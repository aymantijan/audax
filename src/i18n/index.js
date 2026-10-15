// Languages (chantier 6b). French is the source: t('Texte français') returns
// the text in the chosen language, or the French text itself when a
// translation is missing. Dictionaries (en.js, es.js, ar.js) map French text →
// translation and load only when their language is chosen.
// Changing the language remounts the app (App.jsx keys the tree on it), so a
// plain t() call in render is enough — no hook needed.
// Guard: tests/i18n.test.mjs checks every t('…') of the code has its 3 translations.
import { create } from 'zustand';

export const LANGUAGES = [
  { value: 'fr', label: 'Français', locale: 'fr-FR' },
  { value: 'en', label: 'English', locale: 'en-GB' },
  { value: 'es', label: 'Español', locale: 'es-ES' },
  { value: 'ar', label: 'العربية', locale: 'ar-MA', dir: 'rtl' },
];

const LOADERS = {
  en: () => import('./en.js'),
  es: () => import('./es.js'),
  ar: () => import('./ar.js'),
};

export const useLang = create(() => ({ lang: 'fr', dict: null }));

export const langInfo = (lang) => LANGUAGES.find((l) => l.value === lang) || LANGUAGES[0];

// Fill {name}-style blanks.
export function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

export function translate(dict, text, vars) {
  return fill((dict && dict[text]) || text, vars);
}

export const t = (text, vars) => translate(useLang.getState().dict, text, vars);

// Locale for dates and numbers (toLocaleDateString…).
export const locale = () => langInfo(useLang.getState().lang).locale;

let pending = null;
export async function setLanguage(lang) {
  const info = langInfo(lang);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = info.value;
    document.documentElement.dir = info.dir || 'ltr';
  }
  if (info.value === useLang.getState().lang && (info.value === 'fr' || useLang.getState().dict)) return;
  pending = info.value;
  if (info.value === 'fr') { useLang.setState({ lang: 'fr', dict: null }); return; }
  try {
    const mod = await LOADERS[info.value]();
    if (pending === info.value) useLang.setState({ lang: info.value, dict: mod.default });
  } catch {
    // Offline before the dictionary was ever loaded: stay in French.
  }
}
