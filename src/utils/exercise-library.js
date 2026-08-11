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
// do with barbell/dumbbell/cable/machine/bodyweight equipment. Expanded twice
// (v1 ~110 entries, v2 ~250) at the user's request for a wider picker.

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
  e('Decline Dumbbell Press', 'chest', 'dumbbell', 'compound', ['triceps']),
  e('Dumbbell Fly', 'chest', 'dumbbell'),
  e('Incline Dumbbell Fly', 'chest', 'dumbbell'),
  e('Low-to-High Cable Fly', 'chest', 'cable'),
  e('High-to-Low Cable Fly', 'chest', 'cable'),
  e('Cable Crossover', 'chest', 'cable'),
  e('Single-Arm Cable Press', 'chest', 'cable', 'compound', ['triceps', 'core']),
  e('Pec Deck / Chest Fly Machine', 'chest', 'machine'),
  e('Machine Chest Press', 'chest', 'machine', 'compound', ['triceps']),
  e('Incline Machine Press', 'chest', 'machine', 'compound', ['triceps', 'shoulders']),
  e('Smith Machine Bench Press', 'chest', 'smith_machine', 'compound', ['triceps']),
  e('Smith Machine Incline Press', 'chest', 'smith_machine', 'compound', ['triceps', 'shoulders']),
  e('Push-Up', 'chest', 'bodyweight', 'compound', ['triceps', 'shoulders', 'core']),
  e('Wide-Grip Push-Up', 'chest', 'bodyweight', 'compound', ['shoulders']),
  e('Weighted Push-Up', 'chest', 'bodyweight', 'compound', ['triceps', 'shoulders']),
  e('Dips (Chest-Focused)', 'chest', 'bodyweight', 'compound', ['triceps']),
  e('Floor Press', 'chest', 'barbell', 'compound', ['triceps']),
  e('Landmine Press', 'chest', 'barbell', 'compound', ['shoulders', 'triceps']),
  e('Svend Press', 'chest', 'dumbbell'),
  e('Guillotine Press', 'chest', 'barbell', 'compound', ['shoulders']),
  e('Hex Press', 'chest', 'dumbbell'),

  // Back
  e('Pull-Up', 'back', 'bodyweight', 'compound', ['biceps', 'forearms']),
  e('Wide-Grip Pull-Up', 'back', 'bodyweight', 'compound', ['biceps']),
  e('Neutral-Grip Pull-Up', 'back', 'bodyweight', 'compound', ['biceps']),
  e('Weighted Pull-Up', 'back', 'bodyweight', 'compound', ['biceps', 'forearms']),
  e('Chin-Up', 'back', 'bodyweight', 'compound', ['biceps']),
  e('Lat Pulldown', 'back', 'cable', 'compound', ['biceps']),
  e('Wide-Grip Lat Pulldown', 'back', 'cable', 'compound', ['biceps']),
  e('Close-Grip Lat Pulldown', 'back', 'cable', 'compound', ['biceps']),
  e('Single-Arm Lat Pulldown', 'back', 'cable', 'compound', ['biceps']),
  e('Barbell Row (Bent-Over)', 'back', 'barbell', 'compound', ['biceps']),
  e('Pendlay Row', 'back', 'barbell', 'compound', ['biceps']),
  e('Yates Row', 'back', 'barbell', 'compound', ['biceps']),
  e('T-Bar Row', 'back', 'machine', 'compound', ['biceps']),
  e('Landmine Row', 'back', 'barbell', 'compound', ['biceps']),
  e('Meadows Row', 'back', 'barbell', 'compound', ['biceps']),
  e('Seated Cable Row', 'back', 'cable', 'compound', ['biceps']),
  e('Wide-Grip Cable Row', 'back', 'cable', 'compound', ['shoulders']),
  e('Single-Arm Dumbbell Row', 'back', 'dumbbell', 'compound', ['biceps']),
  e('Kroc Row', 'back', 'dumbbell', 'compound', ['biceps', 'forearms']),
  e('Chest-Supported Row', 'back', 'machine', 'compound', ['biceps']),
  e('Machine Row', 'back', 'machine', 'compound', ['biceps']),
  e('Inverted Row', 'back', 'bodyweight', 'compound', ['biceps', 'core']),
  e('Seal Row', 'back', 'barbell', 'compound', ['biceps']),
  e('Deadlift', 'back', 'barbell', 'compound', ['hamstrings', 'glutes', 'forearms']),
  e('Trap Bar Deadlift', 'back', 'barbell', 'compound', ['quads', 'glutes']),
  e('Rack Pull', 'back', 'barbell', 'compound', ['hamstrings', 'forearms']),
  e('Face Pull', 'back', 'cable', 'isolation', ['shoulders']),
  e('Straight-Arm Pulldown', 'back', 'cable'),
  e('Reverse Fly Machine', 'back', 'machine', 'isolation', ['shoulders']),
  e('Hyperextension / Back Extension', 'back', 'bodyweight', 'isolation', ['glutes', 'hamstrings']),
  e('Superman', 'back', 'bodyweight', 'isolation', ['glutes']),

  // Shoulders
  e('Overhead Barbell Press', 'shoulders', 'barbell', 'compound', ['triceps']),
  e('Push Press', 'shoulders', 'barbell', 'compound', ['triceps', 'quads']),
  e('Behind-the-Neck Press', 'shoulders', 'barbell', 'compound', ['triceps']),
  e('Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'compound', ['triceps']),
  e('Seated Dumbbell Press', 'shoulders', 'dumbbell', 'compound', ['triceps']),
  e('Arnold Press', 'shoulders', 'dumbbell', 'compound', ['triceps']),
  e('Machine Shoulder Press', 'shoulders', 'machine', 'compound', ['triceps']),
  e('Landmine Shoulder Press', 'shoulders', 'barbell', 'compound', ['triceps', 'core']),
  e('Cuban Press', 'shoulders', 'dumbbell'),
  e('Bradford Press', 'shoulders', 'barbell', 'compound', ['triceps']),
  e('Lateral Raise', 'shoulders', 'dumbbell'),
  e('Cable Lateral Raise', 'shoulders', 'cable'),
  e('Machine Lateral Raise', 'shoulders', 'machine'),
  e('Leaning Lateral Raise', 'shoulders', 'dumbbell'),
  e('Front Raise', 'shoulders', 'dumbbell'),
  e('Cable Front Raise', 'shoulders', 'cable'),
  e('Plate Front Raise', 'shoulders', 'barbell'),
  e('Rear Delt Fly', 'shoulders', 'dumbbell'),
  e('Bent-Over Rear Delt Raise', 'shoulders', 'dumbbell'),
  e('Cable Y-Raise', 'shoulders', 'cable'),
  e('Reverse Pec Deck', 'shoulders', 'machine'),
  e('Upright Row', 'shoulders', 'barbell', 'isolation', ['back']),
  e('Cable Upright Row', 'shoulders', 'cable', 'isolation', ['back']),
  e('Barbell Shrug', 'shoulders', 'barbell'),
  e('Dumbbell Shrug', 'shoulders', 'dumbbell'),

  // Biceps
  e('Barbell Curl', 'biceps', 'barbell'),
  e('EZ-Bar Curl', 'biceps', 'barbell'),
  e('Dumbbell Curl', 'biceps', 'dumbbell'),
  e('Alternating Dumbbell Curl', 'biceps', 'dumbbell'),
  e('Hammer Curl', 'biceps', 'dumbbell', 'isolation', ['forearms']),
  e('Cross-Body Hammer Curl', 'biceps', 'dumbbell', 'isolation', ['forearms']),
  e('Incline Dumbbell Curl', 'biceps', 'dumbbell'),
  e('Preacher Curl', 'biceps', 'machine'),
  e('Barbell Preacher Curl', 'biceps', 'barbell'),
  e('Concentration Curl', 'biceps', 'dumbbell'),
  e('Cable Curl', 'biceps', 'cable'),
  e('Cable Hammer Curl', 'biceps', 'cable', 'isolation', ['forearms']),
  e('Bayesian Cable Curl', 'biceps', 'cable'),
  e('Spider Curl', 'biceps', 'dumbbell'),
  e('Zottman Curl', 'biceps', 'dumbbell', 'isolation', ['forearms']),
  e('Drag Curl', 'biceps', 'barbell'),
  e('21s', 'biceps', 'barbell'),
  e('Machine Bicep Curl', 'biceps', 'machine'),
  e('Waiter Curl', 'biceps', 'dumbbell'),

  // Triceps
  e('Close-Grip Bench Press', 'triceps', 'barbell', 'compound', ['chest']),
  e('Diamond Push-Up', 'triceps', 'bodyweight', 'compound', ['chest']),
  e('Tricep Pushdown (Rope)', 'triceps', 'cable'),
  e('Tricep Pushdown (Bar)', 'triceps', 'cable'),
  e('Single-Arm Tricep Pushdown', 'triceps', 'cable'),
  e('Reverse-Grip Pushdown', 'triceps', 'cable'),
  e('Skull Crushers', 'triceps', 'barbell'),
  e('EZ-Bar Skull Crushers', 'triceps', 'barbell'),
  e('Overhead Tricep Extension', 'triceps', 'dumbbell'),
  e('Cable Overhead Extension', 'triceps', 'cable'),
  e('Dips (Triceps-Focused)', 'triceps', 'bodyweight', 'compound', ['chest']),
  e('Bench Dip', 'triceps', 'bodyweight', 'compound', ['chest']),
  e('Kickback', 'triceps', 'dumbbell'),
  e('Cable Kickback (Triceps)', 'triceps', 'cable'),
  e('JM Press', 'triceps', 'barbell', 'compound', ['chest']),
  e('Tate Press', 'triceps', 'dumbbell'),
  e('Machine Tricep Extension', 'triceps', 'machine'),

  // Forearms
  e('Wrist Curl', 'forearms', 'barbell'),
  e('Reverse Wrist Curl', 'forearms', 'barbell'),
  e('Dumbbell Wrist Curl', 'forearms', 'dumbbell'),
  e('Reverse Curl', 'forearms', 'barbell', 'isolation', ['biceps']),
  e('Wrist Roller', 'forearms', 'bodyweight'),
  e('Plate Pinch Hold', 'forearms', 'bodyweight'),
  e('Farmer\'s Carry', 'forearms', 'dumbbell', 'compound', ['full_body']),
  e('Dead Hang', 'forearms', 'bodyweight'),

  // Quads
  e('Back Squat', 'quads', 'barbell', 'compound', ['glutes', 'hamstrings']),
  e('Front Squat', 'quads', 'barbell', 'compound', ['glutes', 'core']),
  e('Box Squat', 'quads', 'barbell', 'compound', ['glutes']),
  e('Zercher Squat', 'quads', 'barbell', 'compound', ['glutes', 'core']),
  e('Smith Machine Squat', 'quads', 'smith_machine', 'compound', ['glutes']),
  e('Goblet Squat', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Belt Squat', 'quads', 'machine', 'compound', ['glutes']),
  e('Leg Press', 'quads', 'machine', 'compound', ['glutes']),
  e('Narrow-Stance Leg Press', 'quads', 'machine', 'compound', ['glutes']),
  e('Hack Squat', 'quads', 'machine', 'compound', ['glutes']),
  e('Bulgarian Split Squat', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Walking Lunge', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Reverse Lunge', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Curtsy Lunge', 'quads', 'dumbbell', 'compound', ['glutes']),
  e('Leg Extension', 'quads', 'machine'),
  e('Sissy Squat', 'quads', 'bodyweight'),
  e('Pistol Squat', 'quads', 'bodyweight', 'compound', ['glutes', 'core']),
  e('Wall Sit', 'quads', 'bodyweight'),

  // Hamstrings
  e('Romanian Deadlift', 'hamstrings', 'barbell', 'compound', ['glutes']),
  e('Single-Leg Romanian Deadlift', 'hamstrings', 'dumbbell', 'compound', ['glutes', 'core']),
  e('Stiff-Leg Deadlift', 'hamstrings', 'dumbbell', 'compound', ['glutes']),
  e('Lying Leg Curl', 'hamstrings', 'machine'),
  e('Seated Leg Curl', 'hamstrings', 'machine'),
  e('Standing Leg Curl', 'hamstrings', 'machine'),
  e('Nordic Curl', 'hamstrings', 'bodyweight'),
  e('Glute-Ham Raise', 'hamstrings', 'machine', 'compound', ['glutes']),
  e('Good Morning', 'hamstrings', 'barbell', 'compound', ['glutes', 'back']),
  e('Cable Pull-Through', 'hamstrings', 'cable', 'compound', ['glutes']),
  e('Reverse Hyper', 'hamstrings', 'machine', 'isolation', ['glutes']),

  // Glutes
  e('Hip Thrust', 'glutes', 'barbell', 'compound', ['hamstrings']),
  e('Single-Leg Hip Thrust', 'glutes', 'bodyweight', 'compound', ['hamstrings']),
  e('B-Stance Hip Thrust', 'glutes', 'barbell', 'compound', ['hamstrings']),
  e('Glute Bridge', 'glutes', 'bodyweight'),
  e('Frog Pump', 'glutes', 'bodyweight'),
  e('Cable Kickback', 'glutes', 'cable'),
  e('Donkey Kick', 'glutes', 'bodyweight'),
  e('Fire Hydrant', 'glutes', 'bodyweight'),
  e('Banded Lateral Walk', 'glutes', 'band'),
  e('Hip Abduction Machine', 'glutes', 'machine'),
  e('Sumo Deadlift', 'glutes', 'barbell', 'compound', ['hamstrings', 'quads']),
  e('Step-Up', 'glutes', 'dumbbell', 'compound', ['quads']),

  // Calves
  e('Standing Calf Raise', 'calves', 'machine'),
  e('Seated Calf Raise', 'calves', 'machine'),
  e('Donkey Calf Raise', 'calves', 'machine'),
  e('Calf Press (Leg Press)', 'calves', 'machine'),
  e('Single-Leg Calf Raise', 'calves', 'bodyweight'),
  e('Smith Machine Calf Raise', 'calves', 'smith_machine'),
  e('Tibialis Raise', 'calves', 'bodyweight'),

  // Core
  e('Plank', 'core', 'bodyweight'),
  e('Side Plank', 'core', 'bodyweight'),
  e('Hanging Leg Raise', 'core', 'bodyweight'),
  e('Hanging Knee Raise', 'core', 'bodyweight'),
  e('Toes to Bar', 'core', 'bodyweight', 'compound', ['forearms']),
  e('Captain\'s Chair Knee Raise', 'core', 'machine'),
  e('Cable Crunch', 'core', 'cable'),
  e('Ab Wheel Rollout', 'core', 'bodyweight'),
  e('Russian Twist', 'core', 'bodyweight'),
  e('Sit-Up', 'core', 'bodyweight'),
  e('Weighted Decline Sit-Up', 'core', 'bodyweight'),
  e('Bicycle Crunch', 'core', 'bodyweight'),
  e('V-Up', 'core', 'bodyweight'),
  e('Flutter Kicks', 'core', 'bodyweight'),
  e('Lying Leg Raise', 'core', 'bodyweight'),
  e('Mountain Climbers', 'core', 'bodyweight'),
  e('Pallof Press', 'core', 'cable'),
  e('Landmine Rotation', 'core', 'barbell'),
  e('Woodchopper', 'core', 'cable'),
  e('Dead Bug', 'core', 'bodyweight'),
  e('Stability Ball Crunch', 'core', 'bodyweight'),
  e('Dragon Flag', 'core', 'bodyweight'),

  // Full body / Olympic / functional
  e('Barbell Clean', 'full_body', 'barbell', 'compound', ['quads', 'back', 'shoulders']),
  e('Power Clean', 'full_body', 'barbell', 'compound', ['quads', 'back']),
  e('Hang Clean', 'full_body', 'barbell', 'compound', ['quads', 'back']),
  e('Snatch', 'full_body', 'barbell', 'compound', ['shoulders', 'back', 'quads']),
  e('Power Snatch', 'full_body', 'barbell', 'compound', ['shoulders', 'quads']),
  e('Clean and Jerk', 'full_body', 'barbell', 'compound', ['shoulders', 'quads']),
  e('Kettlebell Swing', 'full_body', 'kettlebell', 'compound', ['glutes', 'hamstrings']),
  e('Thruster', 'full_body', 'barbell', 'compound', ['quads', 'shoulders']),
  e('Wall Ball', 'full_body', 'kettlebell', 'compound', ['quads', 'shoulders']),
  e('Man Maker', 'full_body', 'dumbbell', 'compound', ['chest', 'back', 'shoulders']),
  e('Devil Press', 'full_body', 'dumbbell', 'compound', ['shoulders', 'quads']),
  e('Box Jump', 'full_body', 'bodyweight', 'compound', ['quads', 'glutes']),
  e('Battle Ropes', 'full_body', 'bodyweight', 'compound', ['shoulders', 'core']),
  e('Burpee', 'full_body', 'bodyweight', 'compound', ['chest', 'quads', 'core']),
  e('Bear Crawl', 'full_body', 'bodyweight', 'compound', ['core', 'shoulders']),
  e('Sled Push', 'full_body', 'machine', 'compound', ['quads', 'glutes']),
  e('Sled Pull', 'full_body', 'machine', 'compound', ['back', 'hamstrings']),
  e('Tire Flip', 'full_body', 'bodyweight', 'compound', ['back', 'quads']),
  e('Sledgehammer Slam', 'full_body', 'bodyweight', 'compound', ['core', 'shoulders']),
  e('Medicine Ball Slam', 'full_body', 'bodyweight', 'compound', ['core', 'shoulders']),
  e('Muscle-Up', 'full_body', 'bodyweight', 'compound', ['back', 'chest', 'triceps']),
  e('Rope Climb', 'full_body', 'bodyweight', 'compound', ['back', 'forearms']),
  e('Turkish Get-Up', 'full_body', 'kettlebell', 'compound', ['core', 'shoulders']),
  e('Farmer\'s Walk', 'full_body', 'dumbbell', 'compound', ['forearms', 'core']),
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

// Round-robin across each requested muscle group (by primary muscleGroup —
// not secondaryMuscles, which would just re-flood the list with the same
// compound lifts) so a big group like "back" (~30 entries) doesn't crowd out
// a small accessory addition like "biceps" within the picker's display cap.
// Used for the no-query default suggestion set; a real search query still
// goes through the simpler exercisesForMuscleGroups + substring filter above.
export function suggestExercises(muscleGroups, limit = 24) {
  if (!muscleGroups?.length) return EXERCISE_LIBRARY.slice(0, limit);
  const byGroup = muscleGroups.map((g) => EXERCISE_LIBRARY.filter((ex) => ex.muscleGroup === g));
  const out = [];
  const seen = new Set();
  let i = 0;
  while (out.length < limit && byGroup.some((list) => i < list.length)) {
    for (const list of byGroup) {
      if (i < list.length && !seen.has(list[i].id)) {
        seen.add(list[i].id);
        out.push(list[i]);
        if (out.length >= limit) break;
      }
    }
    i++;
  }
  return out;
}
