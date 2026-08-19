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

// Portions a category's food list to hit a target gram-equivalent of macros,
// splitting evenly across however many items are picked for that slot.
function portionCategory(foods, targetGrams, count) {
  const picks = foods.slice(0, count);
  if (!picks.length) return [];
  const perItemGrams = Math.round(targetGrams / picks.length);
  return picks.map((f) => ({ name: f.name, grams: perItemGrams, unit: 'g' }));
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
  const proteinFoods = applyRestrictions(foodsForBudget(budgetTier, 'protein'), dietaryRestrictions);
  const carbFoods = applyRestrictions(foodsForBudget(budgetTier, 'carb'), dietaryRestrictions);
  const fatFoods = applyRestrictions(foodsForBudget(budgetTier, 'fat'), dietaryRestrictions);
  const vegFoods = applyRestrictions(foodsForBudget(budgetTier, 'veg'), dietaryRestrictions);

  const slots = Math.max(3, Math.min(6, mealsPerDay));
  const sampleMeals = Array.from({ length: slots }, (_, i) => {
    const slotProteinG = Math.round(proteinG / slots);
    const slotCarbsG = Math.round((carbsG / slots) * 4); // rough gram estimate via estimateMacros lookup below (not exact, illustrative)
    const proteinItem = proteinFoods[i % proteinFoods.length];
    const carbItem = carbFoods[i % carbFoods.length];
    const vegItem = vegFoods[i % vegFoods.length];
    const items = [];
    if (proteinItem) {
      const est = estimateMacros(proteinItem.name, 100, 'g');
      const grams = est?.protein ? Math.round((slotProteinG / est.protein) * 100) : 120;
      items.push({ name: proteinItem.name, grams: Math.max(30, Math.min(400, grams)), unit: 'g' });
    }
    if (carbItem) items.push({ name: carbItem.name, grams: 150, unit: 'g' });
    if (vegItem) items.push({ name: vegItem.name, grams: 100, unit: 'g' });
    if (i === 0 && fatFoods[0]) items.push({ name: fatFoods[0].name, grams: 15, unit: 'g' });
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
