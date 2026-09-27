// Activity taxonomy for the Workout tab. Three top-level categories:
// 'cardio' (duration-based, zone/intensity subtype), 'gym' (a session built
// from multiple EXERCISE_LIBRARY picks, each with its own sets), and
// 'sport' (duration-based, like cardio, but not counted as lifting/aerobic
// training in the same bucket — see healthStore#logWorkout's `type: 'sport'`).

// Heart-rate zone training + common cardio modalities. Zone defs follow the
// standard 5-zone %HRmax model used by most wearables (Zone 2 ≈ 60-70%,
// Zone 3 ≈ 70-80%, etc.) — kept as a label hint, not enforced (no HR input
// in this app yet).
export const CARDIO_TYPES = [
  { value: 'zone1', label: 'Zone 1 — Récupération (très facile)' },
  { value: 'zone2', label: 'Zone 2 — Endurance fondamentale' },
  { value: 'zone3', label: 'Zone 3 — Tempo' },
  { value: 'zone4', label: 'Zone 4 — Seuil' },
  { value: 'zone5', label: 'Zone 5 — VO2 max / sprints' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'liss', label: 'LISS (basse intensité continue)' },
  { value: 'running', label: 'Course à pied' },
  { value: 'cycling', label: 'Vélo' },
  { value: 'rowing', label: 'Rameur' },
  { value: 'swimming', label: 'Natation' },
  { value: 'stairmaster', label: 'Simulateur d’escalier' },
  { value: 'elliptical', label: 'Vélo elliptique' },
  { value: 'jump_rope', label: 'Corde à sauter' },
  { value: 'other_cardio', label: 'Autre cardio' },
];

// Session type = which split you're running today. `muscleGroups` pre-filters
// the exercise picker toward relevant movements (the picker itself always
// lets you search the full library, so this is a convenience default, not a
// restriction). Mirrors the standard splits (PPL / Upper-Lower / Bro split).
export const GYM_SESSION_TYPES = [
  { value: 'push', label: 'Push (pectoraux / épaules / triceps)', muscleGroups: ['chest', 'shoulders', 'triceps'] },
  { value: 'pull', label: 'Pull (dos / biceps)', muscleGroups: ['back', 'biceps', 'forearms'] },
  { value: 'legs', label: 'Jambes', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { value: 'upper', label: 'Haut du corps', muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
  { value: 'lower', label: 'Bas du corps', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { value: 'full_body', label: 'Corps entier', muscleGroups: [] },
  { value: 'chest', label: 'Muscu — pectoraux', muscleGroups: ['chest'] },
  { value: 'back', label: 'Muscu — dos', muscleGroups: ['back'] },
  { value: 'shoulders', label: 'Muscu — épaules', muscleGroups: ['shoulders'] },
  { value: 'arms', label: 'Muscu — bras', muscleGroups: ['biceps', 'triceps', 'forearms'] },
  { value: 'core', label: 'Muscu — abdos / gainage', muscleGroups: ['core'] },
  { value: 'olympic', label: 'Haltérophilie / fonctionnel', muscleGroups: ['full_body'] },
  { value: 'custom_gym', label: 'Personnalisée', muscleGroups: [] },
];

// Small accessory muscles commonly tacked onto a bigger session (e.g. biceps
// after a Back day, abs after almost anything) — offered as an optional
// multi-select alongside the session type, not a separate session of their
// own. Selecting one just widens the exercise picker's default suggestions
// (see WorkoutLogging.jsx) to include that muscle's movements too.
export const SMALL_MUSCLE_OPTIONS = [
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'core', label: 'Abdos' },
  { value: 'calves', label: 'Mollets' },
  { value: 'forearms', label: 'Avant-bras' },
];

export const SPORT_TYPES = [
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'padel', label: 'Padel' },
  { value: 'boxing', label: 'Boxe' },
  { value: 'martial_arts', label: 'Arts martiaux / lutte' },
  { value: 'swimming_sport', label: 'Natation (longueurs)' },
  { value: 'climbing', label: 'Escalade' },
  { value: 'cycling_sport', label: 'Vélo (sortie)' },
  { value: 'running_race', label: 'Course (compétition / loisir)' },
  { value: 'golf', label: 'Golf' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'skiing', label: 'Ski / snowboard' },
  { value: 'hiking', label: 'Randonnée' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'crossfit', label: 'CrossFit / cours HIIT' },
  { value: 'other_sport', label: 'Autre sport' },
];

export const labelFor = (list, value) => list.find((o) => o.value === value)?.label || value;
