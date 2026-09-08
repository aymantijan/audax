// Injury area → substring/muscleGroup exclusions + a substitute suggestion.
// Framed explicitly as a training-programming caution, NOT medical clearance.
// Extracted from the retired training-program-generator.js so GymLogging.jsx
// (which shows injury caution icons) keeps working independently.

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
