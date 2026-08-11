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
  { value: 'zone1', label: 'Zone 1 — Recovery (very easy)' },
  { value: 'zone2', label: 'Zone 2 — Aerobic / Fat-burn' },
  { value: 'zone3', label: 'Zone 3 — Tempo' },
  { value: 'zone4', label: 'Zone 4 — Threshold' },
  { value: 'zone5', label: 'Zone 5 — VO2 Max / Sprints' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'liss', label: 'LISS (Low-Intensity Steady State)' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'stairmaster', label: 'Stairmaster' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'jump_rope', label: 'Jump Rope' },
  { value: 'other_cardio', label: 'Other Cardio' },
];

// Session type = which split you're running today. `muscleGroups` pre-filters
// the exercise picker toward relevant movements (the picker itself always
// lets you search the full library, so this is a convenience default, not a
// restriction). Mirrors the standard splits (PPL / Upper-Lower / Bro split).
export const GYM_SESSION_TYPES = [
  { value: 'push', label: 'Push (Chest/Shoulders/Triceps)', muscleGroups: ['chest', 'shoulders', 'triceps'] },
  { value: 'pull', label: 'Pull (Back/Biceps)', muscleGroups: ['back', 'biceps', 'forearms'] },
  { value: 'legs', label: 'Legs', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { value: 'upper', label: 'Upper Body', muscleGroups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
  { value: 'lower', label: 'Lower Body', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { value: 'full_body', label: 'Full Body', muscleGroups: [] },
  { value: 'chest', label: 'Gym Session — Chest', muscleGroups: ['chest'] },
  { value: 'back', label: 'Gym Session — Back', muscleGroups: ['back'] },
  { value: 'shoulders', label: 'Gym Session — Shoulders', muscleGroups: ['shoulders'] },
  { value: 'arms', label: 'Gym Session — Arms', muscleGroups: ['biceps', 'triceps', 'forearms'] },
  { value: 'core', label: 'Gym Session — Core / Abs', muscleGroups: ['core'] },
  { value: 'olympic', label: 'Olympic / Functional', muscleGroups: ['full_body'] },
  { value: 'custom_gym', label: 'Custom', muscleGroups: [] },
];

export const SPORT_TYPES = [
  { value: 'football', label: 'Football (Soccer)' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'padel', label: 'Padel' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'martial_arts', label: 'Martial Arts / Grappling' },
  { value: 'swimming_sport', label: 'Swimming (Sport/Laps)' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'cycling_sport', label: 'Cycling (Sport)' },
  { value: 'running_race', label: 'Running (Race/Casual)' },
  { value: 'golf', label: 'Golf' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'skiing', label: 'Skiing / Snowboarding' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'crossfit', label: 'CrossFit / HIIT Class' },
  { value: 'other_sport', label: 'Other Sport' },
];

export const labelFor = (list, value) => list.find((o) => o.value === value)?.label || value;
