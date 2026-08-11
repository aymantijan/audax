// Curated strength-exercise library — English names as commonly used in gyms
// (not machine-translated), grouped by primary muscle. Taxonomy (muscleGroup /
// equipment / mechanic compound-vs-isolation) mirrors the shape used by the
// well-known open exercise datasets (yuhonas/free-exercise-db, exercemus) —
// primaryMuscles/equipment/mechanic — so this stays swappable for a bigger
// dataset later without touching call sites, just the source array.
//
// Not exhaustive (a full open DB runs 800-1000+ entries) — this covers every
// major muscle group with the movements someone would actually recognize and
// pick from a dropdown, biased toward what a home/commercial-gym lifter can
// do with barbell/dumbbell/cable/machine/bodyweight equipment.

export const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core / Abs' },
  { value: 'full_body', label: 'Full Body / Olympic' },
];

export const EQUIPMENT_OPTIONS = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'smith_machine', label: 'Smith Machine' },
];

const e = (name, muscleGroup, equipment, mechanic = 'isolation', secondaryMuscles = []) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  muscleGroup,
  secondaryMuscles,
  equipment,
  mechanic, // 'compound' | 'isolation'
});

export const EXERCISE_LIBRARY = [
  // Chest
  e('Barbell Bench Press', 'chest', 'barbell', 'compound', ['triceps', 'shoulders']),
  e('Incline Barbell Bench Press', 'chest', 'barbell', 'compound', ['triceps', 'shoulders']),
  e('Decline Barbell Bench Press', 'chest', 'barbell', 'compound', ['triceps']),
  e('Dumbbell Bench Press', 'chest', 'dumbbell', 'compound', ['triceps', 'shoulders']),
  e('Incline Dumbbell Press', 'chest', 'dumbbell', 'compound', ['triceps', 'shoulders']),
  e('Dumbbell Fly', 'chest', 'dumbbell'),
  e('Cable Crossover', 'chest', 'cable'),
  e('Pec Deck / Chest Fly Machine', 'chest', 'machine'),
  e('Push-Up', 'chest', 'bodyweight', 'compound', ['triceps', 'shoulders', 'core']),
  e('Dips (Chest-Focused)', 'chest', 'bodyweight', 'compound', ['triceps']),
  e('Machine Chest Press', 'chest', 'machine', 'compound', ['triceps']),
  e('Smith Machine Bench Press', 'chest', 'smith_machine', 'compound', ['triceps']),

  // Back
  e('Pull-Up', 'back', 'bodyweight', 'compound', ['biceps', 'forearms']),
  e('Chin-Up', 'back', 'bodyweight', 'compound', ['biceps']),
  e('Lat Pulldown', 'back', 'cable', 'compound', ['biceps']),
  e('Barbell Row (Bent-Over)', 'back', 'barbell', 'compound', ['biceps']),
  e('Pendlay Row', 'back', 'barbell', 'compound', ['biceps']),
  e('T-Bar Row', 'back', 'machine', 'compound', ['biceps']),
  e('Seated Cable Row', 'back', 'cable', 'compound', ['biceps']),
  e('Single-Arm Dumbbell Row', 'back', 'dumbbell', 'compound', ['biceps']),
  e('Chest-Supported Row', 'back', 'machine', 'compound', ['biceps']),
  e('Deadlift', 'back', 'barbell', 'compound', ['hamstrings', 'glutes', 'forearms']),
  e('Rack Pull', 'back', 'barbell', 'compound', ['hamstrings', 'forearms']),
  e('Face Pull', 'back', 'cable', 'isolation', ['shoulders']),
  e('Straight-Arm Pulldown', 'back', 'cable'),
  e('Hyperextension / Back Extension', 'back', 'bodyweight', 'isolation', ['glutes', 'hamstrings']),

  // Shoulders
  e('Overhead Barbell Press', 'shoulders', 'barbell', 'compound', ['triceps']),
  e('Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'compound', ['triceps']),
  e('Arnold Press', 'shoulders', 'dumbbell', 'compound', ['triceps']),
  e('Lateral Raise', 'shoulders', 'dumbbell'),
  e('Cable Lateral Raise', 'shoulders', 'cable'),
  e('Front Raise', 'shoulders', 'dumbbell'),
  e('Rear Delt Fly', 'shoulders', 'dumbbell'),
  e('Reverse Pec Deck', 'shoulders', 'machine'),
  e('Upright Row', 'shoulders', 'barbell', 'isolation', ['back']),
  e('Shrugs', 'shoulders', 'dumbbell'),

  // Biceps
  e('Barbell Curl', 'biceps', 'barbell'),
  e('EZ-Bar Curl', 'biceps', 'barbell'),
  e('Dumbbell Curl', 'biceps', 'dumbbell'),
  e('Hammer Curl', 'biceps', 'dumbbell', 'isolation', ['forearms']),
  e('Incline Dumbbell Curl', 'biceps', 'dumbbell'),
  e('Preacher Curl', 'biceps', 'machine'),
  e('Concentration Curl', 'biceps', 'dumbbell'),
  e('Cable Curl', 'biceps', 'cable'),

  // Triceps
  e('Close-Grip Bench Press', 'triceps', 'barbell', 'compound', ['chest']),
  e('Tricep Pushdown (Rope)', 'triceps', 'cable'),
  e('Tricep Pushdown (Bar)', 'triceps', 'cable'),
  e('Skull Crushers', 'triceps', 'barbell'),
  e('Overhead Tricep Extension', 'triceps', 'dumbbell'),
  e('Dips (Triceps-Focused)', 'triceps', 'bodyweight', 'compound', ['chest']),
  e('Kickback', 'triceps', 'dumbbell'),

  // Forearms
  e('Wrist Curl', 'forearms', 'barbell'),
  e('Reverse Wrist Curl', 'forearms', 'barbell'),
  e('Farmer\'s Carry', 'forearms', 'dumbbell', 'compound', ['full_body']),
  e('Dead Hang', 'forearms', 'bodyweight'),

  // Quads
  e('Back Squat', 'quads', 'barbell', 'compound', ['glutes', 'hamstrings']),
  e('Front Squat', 'quads', 'barbell', 'compound', ['glutes', 'core']),
  e('Goblet Squat', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Leg Press', 'quads', 'machine', 'compound', ['glutes']),
  e('Hack Squat', 'quads', 'machine', 'compound', ['glutes']),
  e('Bulgarian Split Squat', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Walking Lunge', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Leg Extension', 'quads', 'machine'),

  // Hamstrings
  e('Romanian Deadlift', 'hamstrings', 'barbell', 'compound', ['glutes']),
  e('Stiff-Leg Deadlift', 'hamstrings', 'dumbbell', 'compound', ['glutes']),
  e('Lying Leg Curl', 'hamstrings', 'machine'),
  e('Seated Leg Curl', 'hamstrings', 'machine'),
  e('Nordic Curl', 'hamstrings', 'bodyweight'),
  e('Good Morning', 'hamstrings', 'barbell', 'compound', ['glutes', 'back']),

  // Glutes
  e('Hip Thrust', 'glutes', 'barbell', 'compound', ['hamstrings']),
  e('Glute Bridge', 'glutes', 'bodyweight'),
  e('Cable Kickback', 'glutes', 'cable'),
  e('Hip Abduction Machine', 'glutes', 'machine'),
  e('Sumo Deadlift', 'glutes', 'barbell', 'compound', ['hamstrings', 'quads']),
  e('Step-Up', 'glutes', 'dumbbell', 'compound', ['quads']),

  // Calves
  e('Standing Calf Raise', 'calves', 'machine'),
  e('Seated Calf Raise', 'calves', 'machine'),
  e('Donkey Calf Raise', 'calves', 'machine'),
  e('Calf Press (Leg Press)', 'calves', 'machine'),

  // Core
  e('Plank', 'core', 'bodyweight'),
  e('Hanging Leg Raise', 'core', 'bodyweight'),
  e('Cable Crunch', 'core', 'cable'),
  e('Ab Wheel Rollout', 'core', 'bodyweight'),
  e('Russian Twist', 'core', 'bodyweight'),
  e('Sit-Up', 'core', 'bodyweight'),
  e('Bicycle Crunch', 'core', 'bodyweight'),
  e('Side Plank', 'core', 'bodyweight'),
  e('Weighted Decline Sit-Up', 'core', 'bodyweight'),

  // Full body / Olympic / functional
  e('Barbell Clean', 'full_body', 'barbell', 'compound', ['quads', 'back', 'shoulders']),
  e('Power Clean', 'full_body', 'barbell', 'compound', ['quads', 'back']),
  e('Snatch', 'full_body', 'barbell', 'compound', ['shoulders', 'back', 'quads']),
  e('Clean and Jerk', 'full_body', 'barbell', 'compound', ['shoulders', 'quads']),
  e('Kettlebell Swing', 'full_body', 'kettlebell', 'compound', ['glutes', 'hamstrings']),
  e('Thruster', 'full_body', 'barbell', 'compound', ['quads', 'shoulders']),
  e('Box Jump', 'full_body', 'bodyweight', 'compound', ['quads', 'glutes']),
  e('Battle Ropes', 'full_body', 'bodyweight', 'compound', ['shoulders', 'core']),
  e('Burpee', 'full_body', 'bodyweight', 'compound', ['chest', 'quads', 'core']),
  e('Sled Push', 'full_body', 'machine', 'compound', ['quads', 'glutes']),
  e('Turkish Get-Up', 'full_body', 'kettlebell', 'compound', ['core', 'shoulders']),
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISE_LIBRARY.map((ex) => [ex.id, ex]));

export function exercisesForMuscleGroups(muscleGroups) {
  if (!muscleGroups?.length) return EXERCISE_LIBRARY;
  return EXERCISE_LIBRARY.filter(
    (ex) => muscleGroups.includes(ex.muscleGroup) || ex.secondaryMuscles.some((m) => muscleGroups.includes(m))
  );
}

export function searchExercises(query, muscleGroups) {
  const pool = exercisesForMuscleGroups(muscleGroups);
  if (!query?.trim()) return pool;
  const q = query.trim().toLowerCase();
  return pool.filter((ex) => ex.name.toLowerCase().includes(q));
}
