// ─────────────────────────────────────────────────────────────────────────────
// TRAINING PROGRAM GENERATOR — deterministic, rule-based (no LLM dependency),
// same spirit as health-science.js: documented heuristics, not a black box.
// Turns a questionnaire answer set into a periodized 8-week block built from
// the existing EXERCISE_LIBRARY, with a simple/robust progression model
// (double progression) rather than RPE-autoregulation, per user preference.
// ─────────────────────────────────────────────────────────────────────────────
import { EXERCISE_LIBRARY } from './exercise-library';
import { uid } from './formatters';

// daysPerWeek × experienceLevel → split. Beginners never land on a bro-split
// regardless of days available — full-body/upper-lower keeps compound-lift
// frequency high, which is what actually drives early beginner progress.
export function chooseSplit(daysPerWeek, experienceLevel) {
  if (daysPerWeek <= 3) return 'full_body';
  if (daysPerWeek === 4) return 'upper_lower';
  if (experienceLevel === 'beginner') return 'upper_lower';
  return 'push_pull_legs';
}

const SPLIT_DAY_LABELS = {
  full_body: ['Full Body A', 'Full Body B', 'Full Body C'],
  upper_lower: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'],
  push_pull_legs: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
};

// Which muscle groups each split-day label targets (drives exercise selection).
const SPLIT_DAY_MUSCLES = {
  'Full Body A': ['chest', 'back', 'quads', 'core'],
  'Full Body B': ['shoulders', 'back', 'hamstrings', 'core'],
  'Full Body C': ['chest', 'back', 'glutes', 'core'],
  'Upper A': ['chest', 'back', 'shoulders', 'triceps', 'biceps'],
  'Upper B': ['back', 'chest', 'shoulders', 'biceps', 'triceps'],
  'Upper C': ['shoulders', 'chest', 'back', 'triceps', 'biceps'],
  'Lower A': ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
  'Lower B': ['glutes', 'hamstrings', 'quads', 'calves', 'core'],
  'Lower C': ['hamstrings', 'quads', 'glutes', 'calves', 'core'],
  Push: ['chest', 'shoulders', 'triceps'],
  Pull: ['back', 'biceps', 'forearms'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
};

// Objective → rep range / rest / set count / progression scheme. Kept simple
// and explainable per the user's "simple and robust" progression choice —
// double progression: add load once every top set hits the top of the rep
// range, no RPE autoregulation required.
const GOAL_PROFILES = {
  strength: { repRange: [3, 6], sets: 4, restSec: 180, accessorySets: 3, accessoryReps: [8, 12] },
  hypertrophy: { repRange: [8, 12], sets: 3, restSec: 90, accessorySets: 3, accessoryReps: [10, 15] },
  fat_loss: { repRange: [10, 15], sets: 3, restSec: 60, accessorySets: 3, accessoryReps: [12, 15] },
  endurance: { repRange: [15, 20], sets: 3, restSec: 45, accessorySets: 2, accessoryReps: [15, 20] },
  general_fitness: { repRange: [8, 12], sets: 3, restSec: 90, accessorySets: 2, accessoryReps: [10, 15] },
  recomposition: { repRange: [6, 10], sets: 3, restSec: 90, accessorySets: 3, accessoryReps: [10, 15] },
};

// Injury area → substring/muscleGroup exclusions + a substitute suggestion.
// Framed explicitly as a training-programming caution, NOT medical clearance —
// the generator ships a disclaimer alongside every exclusion it applies.
export const INJURY_EXCLUSION_MAP = {
  lower_back: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/deadlift/i, /good morning/i, /bent-over row/i, /back squat/i],
    substitute: 'leg press, chest-supported row, or trap bar deadlift (more upright torso, less axial shear)',
  },
  knee: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/pistol squat/i, /jump/i, /lunge/i, /box squat/i],
    substitute: 'leg press, hip thrust, or a limited-range leg extension',
  },
  shoulder: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/behind-the-neck/i, /upright row/i, /dip/i, /overhead/i],
    substitute: 'landmine press or neutral-grip machine press (less end-range shoulder stress)',
  },
  wrist: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/push-up/i, /front squat/i],
    substitute: 'machine press or dumbbell variation with a neutral wrist',
  },
  hip: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/sumo deadlift/i, /pistol squat/i, /curtsy lunge/i],
    substitute: 'leg press or hip abduction machine',
  },
  ankle: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/jump/i, /box jump/i, /lunge/i],
    substitute: 'seated calf raise or leg press',
  },
  neck: {
    excludeMuscleGroups: [],
    excludeNameMatch: [/behind-the-neck/i, /shrug/i],
    substitute: 'a strict-form dumbbell shoulder press',
  },
};

function isExcluded(exercise, injuries) {
  for (const inj of injuries || []) {
    const rule = INJURY_EXCLUSION_MAP[inj.area];
    if (!rule) continue;
    if (rule.excludeMuscleGroups.includes(exercise.muscleGroup)) return true;
    if (rule.excludeNameMatch.some((re) => re.test(exercise.name))) return true;
  }
  return false;
}

// Roughly how many exercises fit a session length: ~9 min per compound
// (incl. rest), ~5 min per isolation/accessory — a coarse but transparent budget.
function exerciseBudget(sessionLengthMin) {
  const compounds = Math.max(1, Math.round((sessionLengthMin * 0.55) / 9));
  const accessories = Math.max(1, Math.round((sessionLengthMin * 0.45) / 5));
  return { compounds, accessories };
}

function pickExercisesForDay(muscleGroups, equipmentAccess, injuries, budget) {
  const pool = EXERCISE_LIBRARY.filter(
    (ex) => muscleGroups.includes(ex.muscleGroup) && (!equipmentAccess?.length || equipmentAccess.includes(ex.equipment)) && !isExcluded(ex, injuries)
  );
  const compoundPool = pool.filter((ex) => ex.mechanic === 'compound');
  const isolationPool = pool.filter((ex) => ex.mechanic === 'isolation');

  const chosen = [];
  const seenGroups = new Set();
  // Prioritize one compound per targeted muscle group first (round-robin over
  // muscleGroups so every day's primary groups each get a compound lift),
  // then fill remaining compound slots, then accessories.
  for (const g of muscleGroups) {
    const ex = compoundPool.find((e) => e.muscleGroup === g && !chosen.includes(e));
    if (ex && chosen.length < budget.compounds) { chosen.push(ex); seenGroups.add(g); }
  }
  for (const ex of compoundPool) {
    if (chosen.length >= budget.compounds) break;
    if (!chosen.includes(ex)) chosen.push(ex);
  }
  const accessoryChosen = [];
  for (const g of muscleGroups) {
    const ex = isolationPool.find((e) => e.muscleGroup === g && !accessoryChosen.includes(e));
    if (ex && accessoryChosen.length < budget.accessories) accessoryChosen.push(ex);
  }
  for (const ex of isolationPool) {
    if (accessoryChosen.length >= budget.accessories) break;
    if (!accessoryChosen.includes(ex)) accessoryChosen.push(ex);
  }
  return { compounds: chosen, accessories: accessoryChosen };
}

export function generateTrainingProgram({ experienceLevel = 'beginner', trainingGoal = 'general_fitness', daysPerWeek = 3, sessionLengthMin = 60, equipmentAccess = [], injuries = [] } = {}) {
  const splitType = chooseSplit(daysPerWeek, experienceLevel);
  const dayLabels = SPLIT_DAY_LABELS[splitType].slice(0, daysPerWeek);
  const profile = GOAL_PROFILES[trainingGoal] || GOAL_PROFILES.general_fitness;
  const budget = exerciseBudget(sessionLengthMin);

  const injuredAreas = (injuries || []).map((i) => i.area).filter((a) => INJURY_EXCLUSION_MAP[a]);
  const notes = [
    'Programming caution, not medical advice — if any movement causes pain (not normal training fatigue), stop and consult a professional.',
    `Split: ${splitType.replace('_', ' ')}, ${daysPerWeek}x/week, ~${sessionLengthMin} min/session.`,
    `Progression: double progression — once every top set hits the top of the rep range (${profile.repRange[0]}-${profile.repRange[1]}) at your planned reps, add the smallest available load increment next session.`,
  ];
  for (const area of injuredAreas) {
    notes.push(`Excluded high-risk movements for ${area.replace('_', ' ')}: try ${INJURY_EXCLUSION_MAP[area].substitute} instead.`);
  }

  const weeklyPlan = dayLabels.map((label, dayIndex) => {
    const muscleGroups = SPLIT_DAY_MUSCLES[label] || ['full_body'];
    const { compounds, accessories } = pickExercisesForDay(muscleGroups, equipmentAccess, injuries, budget);
    const exercises = [
      ...compounds.map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        mechanic: 'compound',
        targetSets: profile.sets,
        targetRepRange: profile.repRange,
        restSec: profile.restSec,
        progressionRule: 'double_progression',
      })),
      ...accessories.map((ex) => ({
        exerciseId: ex.id,
        name: ex.name,
        mechanic: 'isolation',
        targetSets: profile.accessorySets,
        targetRepRange: profile.accessoryReps,
        restSec: Math.round(profile.restSec * 0.6),
        progressionRule: 'double_progression',
      })),
    ];
    return { dayIndex, label, muscleGroups, exercises };
  });

  return {
    id: uid(),
    generatedAt: Date.now(),
    weeks: 8,
    splitType,
    trainingGoal,
    experienceLevel,
    daysPerWeek,
    deload: { everyNWeeks: 4 },
    weeklyPlan,
    progressionModel: 'double_progression',
    notes,
    active: true,
  };
}
