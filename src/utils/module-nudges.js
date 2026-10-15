// Module suggestions (étape 3 "au fil du temps"): after a few weeks, suggest
// hiding a module that is switched on but never used, or trying one that
// matches what the person already tracks by hand in a habit. Suggestions
// only — nothing changes without a tap. Pure: tests/module-nudges.test.mjs.
import { MODULES, isModuleEnabled } from './navigation.js';
import { t } from '../i18n/index.js';

const DAY = 86400000;
export const NUDGE_MIN_AGE_DAYS = 21;

// Habit name → the module that does it properly.
export const HABIT_HINTS = [
  { re: /d[ée]pens|budget|argent|[ée]pargn/i, module: 'finance', countKey: 'journal', text: 'Tu suis ton argent dans une habitude : Finances le fait en détail (budget, catégories, épargne).' },
  { re: /sport|s[ée]ance|muscu|course à pied|cardio/i, module: 'health', countKey: 'workouts', text: 'Tu suis le sport dans une habitude : Santé enregistre tes séances et tes progrès.' },
  { re: /lecture|\blire\b|livre/i, module: 'readings', countKey: 'library', text: 'Tu lis régulièrement : Lectures suit tes livres et tes pages.' },
  { re: /deep work|concentration|pomodoro|focus/i, module: 'focus', countKey: 'sessions', text: 'Tu travailles en sessions de concentration : le Minuteur les chronomètre et garde l’historique.' },
];

// Records that prove a module is used.
const USAGE_KEYS = { focus: ['sessions'], creative: ['works'] };

export function moduleNudges({ user, counts = {}, habitNames = [], now = Date.now() }) {
  const dismissed = new Set(user?.dismissedNudges || []);
  const ageDays = user?.createdAt ? (now - user.createdAt) / DAY : 0;
  const out = [];

  for (const hint of HABIT_HINTS) {
    if (!habitNames.some((n) => hint.re.test(n))) continue;
    const enabled = isModuleEnabled(user, hint.module);
    if (enabled && (counts[hint.countKey] || 0) > 0) continue; // already used
    const id = `try-${hint.module}`;
    if (dismissed.has(id)) continue;
    const name = t(MODULES[hint.module].label);
    out.push({ id, text: t(hint.text), action: enabled ? { type: 'open', to: MODULES[hint.module].to, label: t('Ouvrir {module}', { module: name }) } : { type: 'enable', module: hint.module, label: t('Activer {module}', { module: name }) } });
  }

  if (ageDays >= NUDGE_MIN_AGE_DAYS) {
    for (const [module, keys] of Object.entries(USAGE_KEYS)) {
      if (!isModuleEnabled(user, module)) continue;
      if (keys.some((k) => (counts[k] || 0) > 0)) continue;
      const id = `hide-${module}`;
      if (dismissed.has(id)) continue;
      out.push({ id, text: t('Tu n’as encore rien noté dans {module}. Le masquer pour alléger le menu ?', { module: t(MODULES[module].label) }), action: { type: 'hide', module, label: t('Masquer') } });
    }
  }
  return out;
}
