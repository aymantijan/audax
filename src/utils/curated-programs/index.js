// ─────────────────────────────────────────────────────────────────────────────
// CURATED PROGRAMS REGISTRY — complete, hand-authored (or imported from a
// user-supplied document) training programs that bundle training + nutrition
// + cardio + agility/mobility + monitoring guidance in one package.
//
// These are DELIBERATELY READ-ONLY: unlike the questionnaire-driven
// generator (training-program-generator.js), a curated program's content
// here must never be mutated at runtime. A user who wants to change an
// exercise saves a *variant* instead (see healthStore.saveProgramVariant /
// getEffectiveExercises) — the original curated data always stays intact so
// it can be reverted to at any time, and so re-importing an updated PDF
// later is a clean file swap, not a diff against user edits.
//
// To add a new curated program: create curated-programs/<slug>.js following
// the same shape as programme-extreme.js (see its file for the full field
// reference), export the object, then register it below.
// ─────────────────────────────────────────────────────────────────────────────
import { PROGRAMME_EXTREME } from './programme-extreme';
import { PROGRAMME_DEBUTANT } from './programme-debutant';

export const CURATED_PROGRAMS = [PROGRAMME_EXTREME, PROGRAMME_DEBUTANT];

// Dev-time guard rail: every `blocks[].sessionKey` referenced in a training
// block must exist in that same program's `sessions{}` — catches a typo or a
// drifted edit in a hand-authored program file immediately, at import time,
// rather than as a silent `undefined` deep in the schedule generator.
if (import.meta.env?.DEV) {
  for (const program of CURATED_PROGRAMS) {
    const ws = program.weeklyStructure || {};
    for (const key of Object.keys(ws)) {
      const days = ws[key];
      if (!Array.isArray(days) || !days[0]?.day) continue;
      for (const day of days) {
        for (const block of day.blocks || []) {
          if (block.type === 'training' && block.sessionKey) {
            console.assert(!!program.sessions?.[block.sessionKey], `[curated-programs] "${program.id}" weeklyStructure.${key} day "${day.day}" references unknown sessionKey "${block.sessionKey}"`);
          }
        }
      }
    }
  }
}

export const getCuratedProgram = (id) => CURATED_PROGRAMS.find((p) => p.id === id) || null;

// Weekday keys used throughout (French, matches weeklyStructure[].day).
export const WEEKDAY_KEYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const todayWeekdayKey = () => WEEKDAY_KEYS[(new Date().getDay() + 6) % 7]; // getDay(): 0=Sunday
