// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION PLAN GENERATOR — wires the existing (previously dead) computeBMR/
// computeTDEE from health-science.js to a real profile, then builds a
// budget-tiered (Morocco) sample day using the existing FOOD_DB/estimateMacros
// from nutrition-db.js. Deterministic, no LLM dependency.
// ─────────────────────────────────────────────────────────────────────────────
import { computeBMR, computeTDEE } from './health-science';
import { estimateMacros, getServingOptions } from './nutrition-db';
import { foodsForBudget } from './morocco-food-budget';
import { uid } from './formatters';

const DIET_GOAL_ADJUST = {
  cut: -0.18,       // -18% from TDEE
  bulk: 0.12,        // +12% from TDEE
  maintain: 0,
  recomp: -0.08,      // mild deficit, protein-prioritized so lean mass is preserved
};

// Progesterone's thermogenic effect measurably raises resting metabolic rate
// during the luteal phase — commonly cited in the range of ~2.5-11%; 5% is a
// deliberately conservative middle estimate, not a precise clinical number.
// Applied on top of the diet-goal adjustment, so a cut still cuts, just from
// a slightly higher baseline that phase.
const LUTEAL_KCAL_BUMP = 0.05;

// IOM (Institute of Medicine) / ACOG pregnancy energy-requirement additions
// above a non-pregnant baseline TDEE: no additional calories needed in the
// first trimester (fetal energy demand is still minimal), then a step up
// each trimester as fetal/placental growth accelerates.
const PREGNANCY_KCAL_BUMP = { 1: 0, 2: 340, 3: 452 };

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

// Drops foods the user explicitly said they don't like/eat — but never lets
// that exclusion empty a whole category (e.g. disliking every tracked
// protein source): falls back to the unfiltered list rather than generating
// a plan with a missing food group.
function applyDislikes(foods, dislikedFoods) {
  if (!dislikedFoods?.length) return foods;
  const filtered = foods.filter((f) => !dislikedFoods.includes(f.name));
  return filtered.length ? filtered : foods;
}

// Highest DIAAS (protein quality) first — sorts the pool so the rotation in
// buildProteinItems below naturally favors higher-quality sources without
// excluding anything. See morocco-food-budget.js's proteinQuality comment
// for the DIAAS values/sources. Foods without a score (custom/user-added,
// or anything outside the curated protein list) sort after every scored one
// — unscored isn't the same as low-quality, but there's no basis to rank it
// above a known value either.
// `foods` arrives already price-sorted (ascending, priced foods first) from
// foodsForBudget when the user has entered any real prices — that ordering
// is left untouched here, since the user's own actual cost is a stronger,
// more specific signal than a generic quality heuristic. Quality only
// re-sorts the REMAINING foods with no known price, highest DIAAS first —
// it fills in a sensible default for anything price didn't already decide,
// rather than silently overriding what the user explicitly priced.
function sortByProteinQuality(foods, foodPrices) {
  const priced = foods.filter((f) => foodPrices?.[f.name] != null);
  const unpriced = foods.filter((f) => foodPrices?.[f.name] == null);
  const qualitySorted = [...unpriced].sort((a, b) => {
    if (a.proteinQuality != null && b.proteinQuality != null) return b.proteinQuality - a.proteinQuality;
    if (a.proteinQuality != null) return -1;
    if (b.proteinQuality != null) return 1;
    return 0;
  });
  return [...priced, ...qualitySorted];
}

// A single food beyond this many grams in one meal reads as an unrealistic
// portion (e.g. 300g of eggs — ~5-6 eggs in one sitting) — real people don't
// eat a whole macro target from one item, they combine 2 lighter sources.
const REALISTIC_MAX_G = 220;

// Serving labels that are legitimately fractional in real cooking (you can
// measure 1.5 cups, half a tablespoon) — everything else with a defined
// serving (egg, can, cuisse, steak, medium, carotte…) is a physical item you
// can't split, so grams gets rounded to a whole multiple of it below.
const CONTINUOUS_SERVING_LABELS = new Set(['cup', 'tbsp', 'slice', 'handful', 'handful (~23)', 'glass', 'loaf', 'poignée']);

// "2.6 eggs" isn't something anyone can actually put on a plate — rounds to
// the nearest whole multiple of the food's discrete serving unit when it has
// one (min 1 unit), leaves continuous-measure foods (rice, oil…) untouched.
function roundToDiscreteUnit(foodName, grams) {
  const discrete = getServingOptions(foodName).find((o) => o.grams > 1 && !CONTINUOUS_SERVING_LABELS.has(o.label));
  if (!discrete) return grams;
  const units = Math.max(1, Math.round(grams / discrete.grams));
  return units * discrete.grams;
}

// Grams of `food` needed to hit `targetG` of `macroKey`, clamped to a
// realistic single-portion range, then rounded to a whole unit if the food
// is only sold/eaten as discrete pieces.
function gramsForMacroTarget(food, targetG, macroKey) {
  const per100 = estimateMacros(food.name, 100, 'g');
  const needed = per100?.[macroKey] ? (targetG / per100[macroKey]) * 100 : 120;
  const clamped = Math.max(30, Math.min(REALISTIC_MAX_G, Math.round(needed)));
  return roundToDiscreteUnit(food.name, clamped);
}

// Builds 1-2 protein items for a meal slot: a single source normally, but
// split across two sources (half the target each) when one food alone would
// need more than REALISTIC_MAX_G to hit the slot's protein target. `foods`
// is expected pre-sorted by protein quality (sortByProteinQuality) so the
// rotation favors better sources first.
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

export function generateNutritionPlan({
  weightKg, heightCm, age, sex, activityLevel = 'moderate', dietGoal = 'maintain', budgetTier = 'moderate',
  dietaryRestrictions = [], mealsPerDay = 3, cyclePhase = null, pregnancyTrimester = null, breastfeedingKcalBump = 0, dislikedFoods = [], customFoods = [], foodPrices = {},
} = {}) {
  const bmr = computeBMR({ weightKg, heightCm, age, sex });
  const tdee = bmr ? computeTDEE(bmr, activityLevel) : null;
  if (!tdee) {
    return { id: uid(), generatedAt: Date.now(), error: 'incomplete_profile', explanationNotes: ['Poids, taille et âge sont nécessaires pour calculer tes besoins caloriques.'] };
  }

  // A cut/bulk goal doesn't really apply during pregnancy — the diet-goal
  // deficit/surplus is deliberately not applied on top of the pregnancy
  // energy addition, only on the plain TDEE baseline (maintenance + the
  // trimester's actual added need).
  const adjust = pregnancyTrimester ? 0 : (DIET_GOAL_ADJUST[dietGoal] ?? 0);
  let targetKcal = Math.round(tdee * (1 + adjust));
  const lutealBump = !pregnancyTrimester && cyclePhase === 'luteal' ? Math.round(targetKcal * LUTEAL_KCAL_BUMP) : 0;
  const pregnancyBump = pregnancyTrimester ? (PREGNANCY_KCAL_BUMP[pregnancyTrimester] ?? 0) : 0;
  // Unlike pregnancy, a moderate deficit is considered safe while
  // breastfeeding (ACOG/IOM) — so this adds on top of whatever the diet
  // goal already produces rather than overriding it to maintenance.
  targetKcal += lutealBump + pregnancyBump + (breastfeedingKcalBump || 0);

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
    `Objectif "${dietGoal}" → ${Math.round(tdee * (1 + adjust))} kcal/j (${adjust === 0 ? 'maintenance' : `${adjust > 0 ? '+' : ''}${Math.round(adjust * 100)}%`}).`,
    ...(lutealBump ? [`Phase lutéale : +${Math.round(LUTEAL_KCAL_BUMP * 100)}% (+${lutealBump} kcal) — le métabolisme de repos augmente légèrement sous l'effet thermogénique de la progestérone.`] : []),
    ...(pregnancyBump ? [`Grossesse (T${pregnancyTrimester}) : +${pregnancyBump} kcal/j (IOM/ACOG) au-dessus de ta dépense de base — pas d'objectif "perte/prise de poids" appliqué par-dessus pendant la grossesse.`] : []),
    ...(pregnancyTrimester ? ['Grossesse : évite poisson cru, fromages au lait cru/non pasteurisé, charcuterie non recuite et alcool — vérifie chaque nouvel aliment ajouté manuellement avec ta sage-femme/médecin, cette liste ne filtre pas automatiquement.'] : []),
    ...(breastfeedingKcalBump ? [`Allaitement : +${breastfeedingKcalBump} kcal/j (IOM) — contrairement à la grossesse, un déficit modéré reste considéré sûr pendant l'allaitement, ce bonus s'ajoute donc à ton objectif "${dietGoal}" au lieu de l'annuler.`] : []),
    `Protéine à ${proteinGPerKg}g/kg (${proteinG}g) — priorité pour préserver la masse maigre. Sources triées par qualité protéique (score DIAAS — Herreman et al. 2020) : viande/poisson/œufs/laitier d'abord.`,
    `Graisses au plancher ~0.7g/kg (${fatG}g) pour la santé hormonale, glucides (${carbsG}g) en complément.`,
    `Repas 1 = petit-déjeuner (avec fruit), dernier repas = dîner plus léger en glucides — la tolérance au glucose est meilleure le matin et se dégrade en soirée (chrononutrition, ex. restriction glucidique au dîner vs petit-déj en type 2).`,
  ];

  // Sample day: distribute macros across mealsPerDay slots, each slot picking
  // 1-2 items per macro category from the budget-filtered food list.
  // Legumes (lentils/chickpeas/beans) are excluded from the default protein
  // pool — a plan for someone who eats meat/fish/chicken shouldn't lean on
  // legumes just because they happen to be cheap and sit early in the food
  // list; they're the primary pool only for an explicit vegetarian/vegan
  // profile (where animal sources are excluded by applyRestrictions anyway).
  const budgetOpts = { customFoods, foodPrices };
  const wantsPlantOnly = (dietaryRestrictions || []).some((r) => r === 'vegetarian' || r === 'vegan');
  const allProteinFoods = applyDislikes(applyRestrictions(foodsForBudget(budgetTier, 'protein', budgetOpts), dietaryRestrictions), dislikedFoods);
  const animalProteinFoods = allProteinFoods.filter((f) => f.fromType !== 'legume');
  const proteinFoods = sortByProteinQuality(wantsPlantOnly || !animalProteinFoods.length ? allProteinFoods : animalProteinFoods, foodPrices);
  const carbFoods = applyDislikes(applyRestrictions(foodsForBudget(budgetTier, 'carb', budgetOpts), dietaryRestrictions), dislikedFoods);
  const fatFoods = applyDislikes(applyRestrictions(foodsForBudget(budgetTier, 'fat', budgetOpts), dietaryRestrictions), dislikedFoods);
  const vegFoods = applyDislikes(applyRestrictions(foodsForBudget(budgetTier, 'veg', budgetOpts), dietaryRestrictions), dislikedFoods);
  const fruitFoods = applyDislikes(applyRestrictions(foodsForBudget(budgetTier, 'fruit', budgetOpts), dietaryRestrictions), dislikedFoods);

  const slots = Math.max(3, Math.min(6, mealsPerDay));
  const sampleMeals = Array.from({ length: slots }, (_, i) => {
    const isBreakfast = i === 0;
    const isDinner = i === slots - 1 && slots > 1;
    const slotProteinG = Math.round(proteinG / slots);
    const carbItem = carbFoods[i % carbFoods.length];
    const vegItem = vegFoods[i % vegFoods.length];
    const items = [...buildProteinItems(proteinFoods, i, slotProteinG)];
    // Dinner: carb tolerance/insulin sensitivity is worse in the evening
    // (see explanationNotes) — halve the starchy-carb portion and make up
    // volume/satiety with extra vegetables instead, rather than cutting the
    // meal down overall.
    if (carbItem) {
      const carbGrams = isDinner ? 75 : 150;
      items.push({ name: carbItem.name, grams: roundToDiscreteUnit(carbItem.name, carbGrams), unit: 'g', category: 'carb' });
    }
    if (vegItem) {
      const vegGrams = isDinner ? 130 : 100;
      items.push({ name: vegItem.name, grams: roundToDiscreteUnit(vegItem.name, vegGrams), unit: 'g', category: 'veg' });
    }
    if (isBreakfast && fatFoods[0]) items.push({ name: fatFoods[0].name, grams: roundToDiscreteUnit(fatFoods[0].name, 15), unit: 'g', category: 'fat' });
    if (isBreakfast && fruitFoods[0]) items.push({ name: fruitFoods[0].name, grams: roundToDiscreteUnit(fruitFoods[0].name, 120), unit: 'g', category: 'fruit' });
    return { mealSlot: i === 0 ? 'Petit-déjeuner' : isDinner ? 'Dîner' : `Repas ${i + 1}`, items };
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
