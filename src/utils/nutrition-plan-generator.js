// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION PLAN GENERATOR — wires the existing (previously dead) computeBMR/
// computeTDEE from health-science.js to a real profile, then builds a
// budget-tiered (Morocco) sample day using the existing FOOD_DB/estimateMacros
// from nutrition-db.js. Deterministic, no LLM dependency.
// ─────────────────────────────────────────────────────────────────────────────
import { computeBMR, computeTDEE } from './health-science';
import { estimateMacros } from './nutrition-db';
import { foodsForBudget } from './morocco-food-budget';
import { uid } from './formatters';

const DIET_GOAL_ADJUST = {
  cut: -0.18,       // -18% from TDEE
  bulk: 0.12,        // +12% from TDEE
  maintain: 0,
  recomp: -0.08,      // mild deficit, protein-prioritized so lean mass is preserved
};

const RESTRICTION_EXCLUDES = {
  vegetarian: ['Chicken breast', 'Chicken thigh', 'Beef (lean)', 'Beef (ground, 90/10)', 'Sardines (canned)', 'Tuna (canned)', 'Shrimp'],
  vegan: ['Chicken breast', 'Chicken thigh', 'Beef (lean)', 'Beef (ground, 90/10)', 'Sardines (canned)', 'Tuna (canned)', 'Shrimp', 'Eggs', 'Greek yogurt (plain)', 'Cottage cheese', 'Milk (whole)', 'Lben (Moroccan buttermilk)', 'Cheese (cheddar)', 'Mozzarella'],
  lactose_free: ['Milk (whole)', 'Lben (Moroccan buttermilk)', 'Greek yogurt (plain)', 'Cottage cheese', 'Cheese (cheddar)', 'Mozzarella'],
  no_pork: [],
  halal_only: [], // FOOD_DB has no pork-derived items beyond generic "Pork chop"/"Bacon"/"Ham", excluded below explicitly
};

function applyRestrictions(foods, restrictions) {
  const excluded = new Set();
  for (const r of restrictions || []) for (const name of RESTRICTION_EXCLUDES[r] || []) excluded.add(name);
  if ((restrictions || []).includes('halal_only')) ['Pork chop', 'Bacon', 'Ham'].forEach((n) => excluded.add(n));
  return foods.filter((f) => !excluded.has(f.name));
}

// A single food beyond this many grams in one meal reads as an unrealistic
// portion (e.g. 300g of eggs — ~5-6 eggs in one sitting) — real people don't
// eat a whole macro target from one item, they combine 2 lighter sources.
const REALISTIC_MAX_G = 220;

// Grams of `food` needed to hit `targetG` of `macroKey`, clamped to a
// realistic single-portion range.
function gramsForMacroTarget(food, targetG, macroKey) {
  const per100 = estimateMacros(food.name, 100, 'g');
  const needed = per100?.[macroKey] ? (targetG / per100[macroKey]) * 100 : 120;
  return Math.max(30, Math.min(REALISTIC_MAX_G, Math.round(needed)));
}

// Builds 1-2 protein items for a meal slot: a single source normally, but
// split across two sources (half the target each) when one food alone would
// need more than REALISTIC_MAX_G to hit the slot's protein target.
function buildProteinItems(foods, slotIndex, targetG) {
  if (!foods.length) return [];
  const primary = foods[slotIndex % foods.length];
  const per100 = estimateMacros(primary.name, 100, 'g');
  const neededGrams = per100?.protein ? (targetG / per100.protein) * 100 : 120;
  if (neededGrams <= REALISTIC_MAX_G || foods.length < 2) {
    return [{ name: primary.name, grams: gramsForMacroTarget(primary, targetG, 'protein'), unit: 'g', category: 'protein' }];
  }
  const secondary = foods[(slotIndex + 1) % foods.length];
  const half = targetG / 2;
  return [
    { name: primary.name, grams: gramsForMacroTarget(primary, half, 'protein'), unit: 'g', category: 'protein' },
    { name: secondary.name, grams: gramsForMacroTarget(secondary, half, 'protein'), unit: 'g', category: 'protein' },
  ];
}

export function generateNutritionPlan({ weightKg, heightCm, age, sex, activityLevel = 'moderate', dietGoal = 'maintain', budgetTier = 'moderate', dietaryRestrictions = [], mealsPerDay = 3 } = {}) {
  const bmr = computeBMR({ weightKg, heightCm, age, sex });
  const tdee = bmr ? computeTDEE(bmr, activityLevel) : null;
  if (!tdee) {
    return { id: uid(), generatedAt: Date.now(), error: 'incomplete_profile', explanationNotes: ['Poids, taille et âge sont nécessaires pour calculer tes besoins caloriques.'] };
  }

  const adjust = DIET_GOAL_ADJUST[dietGoal] ?? 0;
  const targetKcal = Math.round(tdee * (1 + adjust));

  // Protein prioritized first (1.6-2.2 g/kg — higher end during a cut to
  // preserve lean mass, per Helms et al. 2014), fat floor ~0.6g/kg (hormonal
  // health minimum), carbs fill the remainder.
  const proteinGPerKg = dietGoal === 'cut' ? 2.0 : dietGoal === 'bulk' ? 1.7 : 1.8;
  const proteinG = Math.round(weightKg * proteinGPerKg);
  const fatG = Math.round(weightKg * 0.7);
  const remainingKcal = Math.max(0, targetKcal - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingKcal / 4);

  const explanationNotes = [
    `TDEE estimé à ${tdee} kcal/j (BMR ${bmr} × multiplicateur d'activité "${activityLevel}").`,
    `Objectif "${dietGoal}" → ${targetKcal} kcal/j (${adjust === 0 ? 'maintenance' : `${adjust > 0 ? '+' : ''}${Math.round(adjust * 100)}%`}).`,
    `Protéine à ${proteinGPerKg}g/kg (${proteinG}g) — priorité pour préserver la masse maigre.`,
    `Graisses au plancher ~0.7g/kg (${fatG}g) pour la santé hormonale, glucides (${carbsG}g) en complément.`,
  ];

  // Sample day: distribute macros across mealsPerDay slots, each slot picking
  // 1-2 items per macro category from the budget-filtered food list.
  // Legumes (lentils/chickpeas/beans) are excluded from the default protein
  // pool — a plan for someone who eats meat/fish/chicken shouldn't lean on
  // legumes just because they happen to be cheap and sit early in the food
  // list; they're the primary pool only for an explicit vegetarian/vegan
  // profile (where animal sources are excluded by applyRestrictions anyway).
  const wantsPlantOnly = (dietaryRestrictions || []).some((r) => r === 'vegetarian' || r === 'vegan');
  const allProteinFoods = applyRestrictions(foodsForBudget(budgetTier, 'protein'), dietaryRestrictions);
  const animalProteinFoods = allProteinFoods.filter((f) => f.fromType !== 'legume');
  const proteinFoods = wantsPlantOnly || !animalProteinFoods.length ? allProteinFoods : animalProteinFoods;
  const carbFoods = applyRestrictions(foodsForBudget(budgetTier, 'carb'), dietaryRestrictions);
  const fatFoods = applyRestrictions(foodsForBudget(budgetTier, 'fat'), dietaryRestrictions);
  const vegFoods = applyRestrictions(foodsForBudget(budgetTier, 'veg'), dietaryRestrictions);

  const slots = Math.max(3, Math.min(6, mealsPerDay));
  const sampleMeals = Array.from({ length: slots }, (_, i) => {
    const slotProteinG = Math.round(proteinG / slots);
    const carbItem = carbFoods[i % carbFoods.length];
    const vegItem = vegFoods[i % vegFoods.length];
    const items = [...buildProteinItems(proteinFoods, i, slotProteinG)];
    if (carbItem) items.push({ name: carbItem.name, grams: 150, unit: 'g', category: 'carb' });
    if (vegItem) items.push({ name: vegItem.name, grams: 100, unit: 'g', category: 'veg' });
    if (i === 0 && fatFoods[0]) items.push({ name: fatFoods[0].name, grams: 15, unit: 'g', category: 'fat' });
    return { mealSlot: `Repas ${i + 1}`, items };
  });

  return {
    id: uid(),
    generatedAt: Date.now(),
    targetKcal,
    targetMacros: { proteinG, carbsG, fatG },
    budgetTier,
    dietGoal,
    activityLevel,
    sampleMeals,
    explanationNotes,
    active: true,
  };
}
