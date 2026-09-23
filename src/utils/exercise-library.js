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

const e = (name, muscleGroup, equipment, mechanic = 'isolation', secondaryMuscles = [], aliases = []) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  muscleGroup,
  secondaryMuscles,
  equipment,
  mechanic, // 'compound' | 'isolation'
  aliases,  // alternate names matched in search (keeps the tracking id stable)
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
  e('Machine Shoulder Press', 'shoulders', 'machine', 'compound', ['triceps'], ['Overhead Press Machine', 'Machine Overhead Press']),
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
  e('Reverse Pec Deck', 'shoulders', 'machine', 'isolation', [], ['Reverse Pec-Deck Fly', 'Rear Delt Machine']),
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
  e('Overhead Tricep Extension', 'triceps', 'dumbbell', 'isolation', [], ['Overhead Triceps Extension']),
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
  e('Back Squat', 'quads', 'barbell', 'compound', ['glutes', 'hamstrings'], ['Barbell Squat', 'Barbell Back Squat']),
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
  e('Woodchopper', 'core', 'cable', 'isolation', [], ['Cable Woodchop']),
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

  // ── Additions — Extreme Training Program (Phase A) gaps + common movements ──
  e('Hip Adduction Machine', 'quads', 'machine', 'isolation', ['glutes'], ['Adductor Machine', 'Inner Thigh Machine']),
  e('Weighted Dips', 'chest', 'bodyweight', 'compound', ['triceps', 'shoulders'], ['Weighted Dip']),
  e('Mid Cable Fly', 'chest', 'cable', 'isolation', [], ['Cable Fly', 'Cable Fly (mid height)']),
  e('Chest Press Machine', 'chest', 'machine', 'compound', ['triceps'], ['Machine Chest Press (plate-loaded)']),
  e('Dumbbell Overhead Press', 'shoulders', 'dumbbell', 'compound', ['triceps'], ['Seated Dumbbell Overhead Press']),
  e('Cable Woodchop (Low-to-High)', 'core', 'cable', 'isolation', [], ['Low Cable Woodchop']),
  e('Standing Calf Raise (Smith)', 'calves', 'smith_machine', 'isolation', [], []),
  e('Cable Crunch (Kneeling)', 'core', 'cable', 'isolation', [], ['Kneeling Cable Crunch']),
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
  // Token-based (word) matching, order-independent: every typed word must appear
  // somewhere in the name, an alias, the muscle group, or the equipment. So
  // "overhead machine press", "press machine overhead" and "machine press" all
  // find "Machine Overhead Press" — the old whole-string `includes` needed the
  // exact wording in the exact order and returned nothing for natural queries.
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return pool.filter((ex) => {
    const haystack = [
      ex.name,
      ...(ex.aliases || []),
      ex.muscleGroup,
      ex.equipment,
      ...(ex.secondaryMuscles || []),
    ].join(' ').toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
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

// ============================================================================
// CARDIO LIBRARY
// ============================================================================
// Cardio modalities are tracked the same way strength exercises are: a stable
// `id` keys the progression history (duration, distance, avg HR, zone) over
// time. Machines from the Extreme Training Program (Stairmaster, Concept2
// Rower/SkiErg, curved treadmill, elliptical, bike) plus the common modalities.
//
// `metrics` declares which fields a session logger should capture for this
// modality, so the same logger renders the right inputs for a rower (distance,
// stroke rate) vs. an incline walk (incline, speed). `zoneBased` marks the
// steady-state Zone-2 machines the program relies on for the interference
// window (Wilson et al. 2012).

export const HR_ZONES = [
  { value: 1, label: 'Zone 1 — Récupération', pct: '50-60% FCmax', color: '#94a3b8' },
  { value: 2, label: 'Zone 2 — Endurance fondamentale', pct: '60-70% FCmax', color: '#22c55e' },
  { value: 3, label: 'Zone 3 — Tempo / aérobie', pct: '70-80% FCmax', color: '#eab308' },
  { value: 4, label: 'Zone 4 — Seuil', pct: '80-90% FCmax', color: '#f97316' },
  { value: 5, label: 'Zone 5 — VO2max / anaérobie', pct: '90-100% FCmax', color: '#ef4444' },
];

const c = (name, category, metrics, opts = {}) => ({
  id: 'cardio-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  category,               // 'machine' | 'outdoor' | 'class' | 'sport'
  metrics,                // fields the logger captures, e.g. ['duration','distance','avgHr','zone']
  zoneBased: opts.zoneBased ?? true,
  defaultZone: opts.defaultZone ?? 2,
  aliases: opts.aliases ?? [],
  note: opts.note ?? '',
});

export const CARDIO_LIBRARY = [
  // Steady-state machines (the program's Zone-2 engine)
  c('Stairmaster', 'machine', ['duration', 'level', 'avgHr', 'zone'], { note: 'Pied complet sur la marche, ne pas s\'appuyer sur les rails.', aliases: ['StairMaster', 'Escalier', 'Stair Climber'] }),
  c('Rower (Concept2)', 'machine', ['duration', 'distance', 'strokeRate', 'avgHr', 'zone'], { note: 'Zone 2 : 18-22 coups/min. Jambes → dos → bras.', aliases: ['Rameur', 'Rowing', 'Concept2 Row'] }),
  c('SkiErg (Concept2)', 'machine', ['duration', 'distance', 'strokeRate', 'avgHr', 'zone'], { note: 'Hanches initient la traction, ~45-60 tractions/min.', aliases: ['Ski Erg', 'Ski'] }),
  c('Curved Treadmill', 'machine', ['duration', 'distance', 'avgHr', 'zone'], { note: 'Autopropulsé — impossible à « tricher », la FC reflète l\'effort.', aliases: ['Tapis incurvé', 'Manual Treadmill', 'Assault Runner'] }),
  c('Elliptical', 'machine', ['duration', 'level', 'avgHr', 'zone'], { note: 'Poignées mobiles pour engager le haut du corps.', aliases: ['Elliptique', 'Cross Trainer'] }),
  c('Treadmill', 'machine', ['duration', 'distance', 'speed', 'incline', 'avgHr', 'zone'], { aliases: ['Tapis de course', 'Running Machine'] }),
  c('Stationary Bike', 'machine', ['duration', 'distance', 'level', 'avgHr', 'zone'], { note: 'Zone 2 : 80-90 rpm, résistance basse-modérée.', aliases: ['Vélo', 'Bike', 'Spin Bike', 'Cycling'] }),
  c('Assault Bike', 'machine', ['duration', 'distance', 'calories', 'avgHr', 'zone'], { zoneBased: false, note: 'Air bike — excellent pour intervalles.', aliases: ['Air Bike', 'Echo Bike'] }),
  c('Incline Walk', 'machine', ['duration', 'distance', 'speed', 'incline', 'avgHr', 'zone'], { note: 'Marche inclinée — faible impact, Zone 2 fiable.', aliases: ['Marche inclinée'] }),

  // Outdoor
  c('Running (Outdoor)', 'outdoor', ['duration', 'distance', 'pace', 'avgHr', 'zone'], { aliases: ['Course', 'Run', 'Jogging'] }),
  c('Cycling (Outdoor)', 'outdoor', ['duration', 'distance', 'avgHr', 'zone'], { aliases: ['Vélo route', 'Road Cycling'] }),
  c('Swimming', 'outdoor', ['duration', 'distance', 'avgHr', 'zone'], { note: 'Introduit dans un cycle ultérieur (Jan/Fév 2027).', aliases: ['Natation', 'Swim'] }),
  c('Walking', 'outdoor', ['duration', 'distance', 'steps', 'avgHr', 'zone'], { defaultZone: 1, aliases: ['Marche'] }),

  // Interval / class / sport
  c('HIIT', 'class', ['duration', 'rounds', 'avgHr', 'zone'], { zoneBased: false, defaultZone: 4, aliases: ['Intervalles', 'Interval Training'] }),
  c('Jump Rope', 'class', ['duration', 'reps', 'avgHr', 'zone'], { zoneBased: false, aliases: ['Corde à sauter', 'Skipping'] }),
  c('Sled Push/Pull', 'class', ['duration', 'distance', 'load', 'avgHr'], { zoneBased: false, aliases: ['Prowler'] }),
  c('Boxing', 'sport', ['duration', 'rounds', 'avgHr', 'zone'], { zoneBased: false, aliases: ['Boxe'] }),
];

export const CARDIO_BY_ID = Object.fromEntries(CARDIO_LIBRARY.map((m) => [m.id, m]));

export const CARDIO_CATEGORIES = [
  { value: 'machine', label: 'Machine' },
  { value: 'outdoor', label: 'Extérieur' },
  { value: 'class', label: 'Intervalle / Cours' },
  { value: 'sport', label: 'Sport' },
];

export function searchCardio(query, category) {
  let pool = CARDIO_LIBRARY;
  if (category) pool = pool.filter((m) => m.category === category);
  if (!query?.trim()) return pool;
  const q = query.trim().toLowerCase();
  return pool.filter(
    (m) => m.name.toLowerCase().includes(q) || (m.aliases || []).some((a) => a.toLowerCase().includes(q))
  );
}

// Parse a cardio session's note ("Stairmaster · Zone 2 — free note") back into
// its modality object, target zone, and free note. Lenient: returns nulls if
// nothing matches, so a hand-typed note never breaks the logger.
export function parseCardioNote(notes) {
  if (!notes) return { modality: null, zone: 2, note: '' };
  const zoneMatch = notes.match(/Zone\s*(\d)/i);
  const zone = zoneMatch ? parseInt(zoneMatch[1]) : 2;
  const modality = CARDIO_LIBRARY.find(
    (m) => notes.includes(m.name) || (m.aliases || []).some((a) => notes.includes(a))
  ) || null;
  const note = notes.includes('—') ? notes.split('—').slice(1).join('—').trim() : '';
  return { modality, zone, note };
}

// Read a session's cardio setup: structured `config.cardio` (migration 004)
// first, falling back to the legacy notes encoding for older sessions.
export function getCardioConfig(session) {
  const c = session?.config?.cardio;
  if (c?.modality_id && CARDIO_BY_ID[c.modality_id]) {
    return { modality: CARDIO_BY_ID[c.modality_id], zone: Number(c.zone) || 2, note: session.notes || '' };
  }
  return parseCardioNote(session?.notes);
}

// Human-readable label for a metric key (for logger headers).
export const CARDIO_METRIC_LABELS = {
  duration: 'Durée (min)', distance: 'Distance', level: 'Niveau', speed: 'Vitesse',
  incline: 'Inclinaison', strokeRate: 'Coups/min', avgHr: 'FC moy (bpm)', zone: 'Zone',
  calories: 'Calories', pace: 'Allure', steps: 'Pas', rounds: 'Rounds', reps: 'Reps', load: 'Charge (kg)',
};

// ============================================================================
// AGILITY & MOBILITY LIBRARY
// ============================================================================
// Drills for 'agility' and 'mobility' sessions — includes every drill of the
// Extreme Training Program's Section 10 (morning CARs, Tue/Fri ladder +
// reactivity, evening static stretching) plus common agility work. Same shape
// as strength entries (stable `id`, aliases) so drills are tracked the same way.
// `unit` tells the builder/logger what the "reps" column means for this drill.

export const DRILL_CATEGORIES = [
  { value: 'ladder', label: 'Échelle' },
  { value: 'sprint', label: 'Sprints / direction' },
  { value: 'reactivity', label: 'Réactivité' },
  { value: 'plyo', label: 'Pliométrie' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'stretch', label: 'Étirements' },
];

export const DRILL_UNITS = {
  reps: 'reps', passes: 'passages', sec: 'sec', perSide: 'reps/côté', perJoint: 'reps/articulation',
};

const drill = (name, category, unit = 'reps', equipment = 'bodyweight', aliases = []) => ({
  id: 'drill-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  category,
  muscleGroup: category, // lets the shared picker filter/colour on it
  secondaryMuscles: [],
  equipment,
  mechanic: 'drill',
  unit,
  aliases,
});

export const DRILL_LIBRARY = [
  // Agility ladder (PDF: Tue & Fri — 4 drills × 3 passes)
  drill('Icky Shuffle', 'ladder', 'passes', 'agility ladder', ['Ickey Shuffle', 'Échelle icky']),
  drill('In-In-Out-Out', 'ladder', 'passes', 'agility ladder', ['In in out out', 'Échelle in out']),
  drill('Lateral Shuffle (Ladder)', 'ladder', 'passes', 'agility ladder', ['Lateral shuffle', 'Pas chassés échelle']),
  drill('High Knees (Ladder)', 'ladder', 'passes', 'agility ladder', ['Montées de genoux échelle']),
  drill('Single-Leg Hops (Ladder)', 'ladder', 'passes', 'agility ladder', ['Sauts unipodaux échelle']),
  drill('Carioca', 'ladder', 'passes', 'bodyweight', ['Grapevine', 'Pas croisés']),

  // Sprints & change of direction (PDF: 5-10 m, 6 reps)
  drill('Short Sprints with Direction Change (5-10 m)', 'sprint', 'reps', 'cones', ['Sprints changement de direction', 'Change of direction sprint']),
  drill('5-10-5 Pro Agility Shuttle', 'sprint', 'reps', 'cones', ['Pro agility', 'Shuttle 5-10-5', 'Navette']),
  drill('T-Drill', 'sprint', 'reps', 'cones', ['T drill', 'Test en T']),
  drill('Box Drill (Cones)', 'sprint', 'reps', 'cones', ['Carré de plots', 'Square drill']),
  drill('Cone Weave', 'sprint', 'passes', 'cones', ['Slalom plots']),
  drill('Acceleration Sprint (10-20 m)', 'sprint', 'reps', 'bodyweight', ['Accélérations']),

  // Reactivity
  drill('Reaction Ball Drops', 'reactivity', 'reps', 'reaction ball', ['Balle de réaction']),
  drill('Mirror Drill', 'reactivity', 'sec', 'bodyweight', ['Miroir', 'Shadow drill']),
  drill('Dot Drill', 'reactivity', 'sec', 'bodyweight', ['Dot drill 5 points']),
  drill('Partner Tag Reaction Starts', 'reactivity', 'reps', 'bodyweight', ['Départs réactifs']),

  // Light plyometrics
  drill('Pogo Jumps', 'plyo', 'reps', 'bodyweight', ['Sautillements chevilles']),
  drill('Skater Hops', 'plyo', 'perSide', 'bodyweight', ['Skater jumps', 'Sauts patineur']),
  drill('Lateral Bounds', 'plyo', 'perSide', 'bodyweight', ['Bonds latéraux']),
  drill('A-Skips', 'plyo', 'passes', 'bodyweight', ['A skip']),
  drill('B-Skips', 'plyo', 'passes', 'bodyweight', ['B skip']),

  // Joint mobility (PDF: morning CARs, 10 min)
  drill('Controlled Articular Rotations (CARs)', 'mobility', 'perJoint', 'bodyweight', ['CARs', 'Rotations articulaires contrôlées']),
  drill('Shoulder CARs', 'mobility', 'perSide', 'bodyweight', ['CARs épaules']),
  drill('Hip CARs', 'mobility', 'perSide', 'bodyweight', ['CARs hanches']),
  drill('Ankle CARs', 'mobility', 'perSide', 'bodyweight', ['CARs chevilles']),
  drill('Spine CARs', 'mobility', 'reps', 'bodyweight', ['CARs colonne', 'Cat-Camel']),
  drill('Leg Swings (Front-to-Back)', 'mobility', 'perSide', 'bodyweight', ['Balancements de jambe avant-arrière', 'Leg swings']),
  drill('Leg Swings (Lateral)', 'mobility', 'perSide', 'bodyweight', ['Balancements de jambe latéraux']),
  drill('Lunge with Torso Rotation', 'mobility', 'perSide', 'bodyweight', ['Fente avec rotation du buste', 'Lunge rotation']),
  drill("World's Greatest Stretch", 'mobility', 'perSide', 'bodyweight', ['WGS']),
  drill('Hip 90/90 Switches', 'mobility', 'reps', 'bodyweight', ['90/90']),
  drill('Thoracic Rotations', 'mobility', 'perSide', 'bodyweight', ['Rotations thoraciques', 'Open book']),
  drill('Ankle Dorsiflexion Rocks', 'mobility', 'perSide', 'bodyweight', ['Mobilité cheville genou au mur']),
  drill('Band Shoulder Dislocates', 'mobility', 'reps', 'band', ['Pass-through', 'Dislocations élastique']),
  drill('Deep Squat Hold', 'mobility', 'sec', 'bodyweight', ['Squat profond tenu']),

  // Static stretching (PDF: evening, 3 × 30 s per chain)
  drill('Posterior Chain Stretch', 'stretch', 'sec', 'bodyweight', ['Étirement chaîne postérieure']),
  drill('Anterior Chain Stretch', 'stretch', 'sec', 'bodyweight', ['Étirement chaîne antérieure']),
  drill('Hamstring Stretch', 'stretch', 'sec', 'bodyweight', ['Étirement ischios']),
  drill('Couch Stretch (Hip Flexors)', 'stretch', 'sec', 'bodyweight', ['Étirement psoas', 'Couch stretch']),
  drill('Pigeon Stretch', 'stretch', 'sec', 'bodyweight', ['Pigeon']),
  drill('Calf Stretch', 'stretch', 'sec', 'bodyweight', ['Étirement mollets']),
  drill('Chest Doorway Stretch', 'stretch', 'sec', 'bodyweight', ['Étirement pectoraux']),
  drill('Dead Hang (Decompression)', 'stretch', 'sec', 'bodyweight', ['Suspension barre']),
];

export const DRILL_BY_ID = Object.fromEntries(DRILL_LIBRARY.map((x) => [x.id, x]));

// Same word-based, order-independent matching as searchExercises.
export function searchDrills(query, categories) {
  let pool = DRILL_LIBRARY;
  if (categories?.length) pool = pool.filter((x) => categories.includes(x.category));
  if (!query?.trim()) return pool;
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return pool.filter((x) => {
    const hay = [x.name, ...(x.aliases || []), x.category, x.equipment].join(' ').toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}
