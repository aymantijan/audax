import { Sunrise, Sun, Moon, Clock } from 'lucide-react';
import { HABIT_CATEGORY_LABELS, STRESS_ITEMS } from '../../utils/constants';

export const tint = (c, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
export const MOMENT_ICON = { morning: Sunrise, day: Sun, evening: Moon, any: Clock };
export const catLabel = (c) => HABIT_CATEGORY_LABELS[c] || c;

// ── Daily check-in (energy · sleep · stress · recovery · mood) ─────────────
export const blankStressChecklist = () => Object.fromEntries(STRESS_ITEMS.map((i) => [i.key, 0]));
// Never trust a stored log to have every field (older / partial entries,
// e.g. from Santé's quick check-in) — always merge onto known-good defaults.
export const checkInFromLog = (log) => ({
  energyStartLevel: log?.energyStartLevel ?? 6,
  sleepStartTime: log?.sleepData?.sleepStartTime ?? '23:00',
  wakeTime: log?.sleepData?.wakeTime ?? '07:00',
  stressChecklist: log?.stressChecklist || blankStressChecklist(),
  recoveryActivities: log?.recoveryActivities || [],
  energyEndLevel: log?.energyEndLevel ?? 6,
  mood: log?.mood || 'okay',
});
