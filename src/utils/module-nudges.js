// Module suggestions (étape 3 "au fil du temps"): after a few weeks, suggest
// hiding a module that is switched on but never used, or trying one that
// matches what the person already tracks by hand in a habit. Suggestions
// only — nothing changes without a tap. Pure: tests/module-nudges.test.mjs.
import { MODULES, isModuleEnabled } from './navigation.js';

const DAY = 86400000;
export const NUDGE_MIN_AGE_DAYS = 21;

// Habit name → the module that does it properly.
const HABIT_HINTS = [
  { re: /d[ée]pens|budget|argent|[ée]pargn/i, module: 'finance', countKey: 'journal', text: 'Tu suis ton argent dans une habitude : Finances le fait en détail (budget, catégories, épargne).' },
  { re: /sport|s[ée]ance|muscu|course à pied|cardio/i, module: 'health', countKey: 'workouts', text: 'Tu suis le sport dans une habitude : Santé enregistre tes séances et tes progrès.' },
  { re: /lecture|\blire\b|livre/i, module: 'readings', countKey: 'library', text: 'Tu lis régulièrement : Lectures suit tes livres et tes pages.' },
  { re: /trad(e|ing)|p&l/i, module: 'trading', countKey: 'trades', text: 'Tu tiens un journal de trading : le module Trading calcule tes statistiques et tes règles de risque.' },
  { re: /candidature|emploi|\bcv\b|entretien|stage/i, module: 'career', countKey: 'applications', text: 'Tu cherches un emploi ou un stage : Carrière suit tes candidatures et tes entretiens.' },
  { re: /deep work|concentration|pomodoro|focus/i, module: 'focus', countKey: 'sessions', text: 'Tu travailles en sessions de concentration : le Minuteur les chronomètre et garde l’historique.' },
  { re: /client|factur|freelance/i, module: 'freelance', countKey: 'engagements', text: 'Tu as des clients : Freelance suit tes heures et tes factures.' },
];

// Records that prove a module is used.
const USAGE_KEYS = {
  trading: ['trades'], pe: ['deals'], business: ['businesses'], engineering: ['engProjects', 'labEntries'],
  career: ['applications', 'contacts', 'posts'], focus: ['sessions'], fundraising: ['investors'],
  freelance: ['engagements'], creative: ['works'], realEstate: ['properties'],
};

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
    out.push({ id, text: hint.text, action: enabled ? { type: 'open', to: MODULES[hint.module].to, label: `Ouvrir ${MODULES[hint.module].label}` } : { type: 'enable', module: hint.module, label: `Activer ${MODULES[hint.module].label}` } });
  }

  if (ageDays >= NUDGE_MIN_AGE_DAYS) {
    for (const [module, keys] of Object.entries(USAGE_KEYS)) {
      if (!isModuleEnabled(user, module)) continue;
      if (keys.some((k) => (counts[k] || 0) > 0)) continue;
      const id = `hide-${module}`;
      if (dismissed.has(id)) continue;
      out.push({ id, text: `Tu n’as encore rien noté dans ${MODULES[module].label}. Le masquer pour alléger le menu ?`, action: { type: 'hide', module, label: 'Masquer' } });
    }
  }
  return out;
}
