// ─────────────────────────────────────────────────────────────────────────────
// MOROCCO FOOD BUDGET — relative cost tiers, NOT live/scraped pricing. Every
// `name` below should match (or closely alias) a FOOD_DB entry in
// nutrition-db.js so macro lookup via estimateMacros() keeps working. A
// handful of Moroccan staples not in FOOD_DB are added there alongside this
// file. Tiers are ordinal (tight < moderate < comfortable) — cheaper tiers
// are always allowed for a higher-budget user, never the reverse.
// ─────────────────────────────────────────────────────────────────────────────

export const MOROCCO_BUDGET_TIERS = {
  tight: { label: 'Budget serré', order: 0, dailyFoodBudgetDH: [25, 50] },
  moderate: { label: 'Budget modéré', order: 1, dailyFoodBudgetDH: [50, 90] },
  comfortable: { label: 'Budget confortable', order: 2, dailyFoodBudgetDH: [90, 160] },
};

// category: 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' | 'dairy'
export const MOROCCO_FOOD_COST_TIERS = [
  // ── Protéines ── animales d'abord (poulet/viande/poisson/oeufs — ce que la
  // majorité mange au quotidien) ; les légumineuses (fromType: 'legume') sont
  // classées à part et ne servent de source PRINCIPALE que si l'utilisateur a
  // explicitement choisi un régime végétarien/végan — voir buildProteinItems
  // dans nutrition-plan-generator.js.
  { name: 'Eggs', category: 'protein', tier: 'tight', fromType: 'animal', costNote: 'protéine complète la moins chère au Maroc' },
  { name: 'Chicken thigh', category: 'protein', tier: 'tight', fromType: 'animal', costNote: 'avec os/peau — une des viandes les moins chères au Maroc' },
  { name: 'Sardines (canned)', category: 'protein', tier: 'tight', fromType: 'animal', costNote: 'oméga-3 bon marché, très courant au Maroc' },
  { name: 'Lentils (cooked)', category: 'protein', tier: 'tight', fromType: 'legume', costNote: 'légumineuse — protéine + glucides en un seul aliment' },
  { name: 'Chickpeas (cooked)', category: 'protein', tier: 'tight', fromType: 'legume' },
  { name: 'Black beans (cooked)', category: 'protein', tier: 'tight', fromType: 'legume' },
  { name: 'Chicken breast', category: 'protein', tier: 'moderate', fromType: 'animal' },
  { name: 'Tuna (canned)', category: 'protein', tier: 'moderate', fromType: 'animal' },
  { name: 'Greek yogurt (plain)', category: 'protein', tier: 'moderate', fromType: 'animal' },
  { name: 'Cottage cheese', category: 'protein', tier: 'moderate', fromType: 'animal' },
  { name: 'Whey protein (scoop, 30g)', category: 'protein', tier: 'moderate', fromType: 'animal', costNote: 'pratique mais plus cher au kg de protéine que les sources entières' },
  { name: 'Beef (ground, 90/10)', category: 'protein', tier: 'comfortable', fromType: 'animal' },
  { name: 'Beef (lean)', category: 'protein', tier: 'comfortable', fromType: 'animal' },
  { name: 'Salmon', category: 'protein', tier: 'comfortable', fromType: 'animal', costNote: 'importé, cher au Maroc' },
  { name: 'Shrimp', category: 'protein', tier: 'comfortable', fromType: 'animal' },

  // ── Glucides ── (couscous délibérément absent : plat traditionnel du
  // vendredi, pas un aliment quotidien — le proposer chaque jour dans un plan
  // "repas type" ne correspond à aucun usage réel)
  { name: 'Khobz (Moroccan bread)', category: 'carb', tier: 'tight' },
  { name: 'White rice (cooked)', category: 'carb', tier: 'tight' },
  { name: 'Potato', category: 'carb', tier: 'tight' },
  { name: 'Bulgur (cooked)', category: 'carb', tier: 'tight' },
  { name: 'Oats (dry)', category: 'carb', tier: 'moderate' },
  { name: 'Sweet potato', category: 'carb', tier: 'moderate' },
  { name: 'Brown rice (cooked)', category: 'carb', tier: 'moderate' },
  { name: 'Whole wheat bread', category: 'carb', tier: 'moderate' },
  { name: 'Quinoa (cooked)', category: 'carb', tier: 'comfortable', costNote: 'importé' },

  // ── Lipides ──
  { name: 'Olive oil', category: 'fat', tier: 'tight', costNote: 'produit localement, référence marocaine' },
  { name: 'Peanuts', category: 'fat', tier: 'tight' },
  { name: 'Peanut butter', category: 'fat', tier: 'moderate' },
  { name: 'Almonds', category: 'fat', tier: 'moderate' },
  { name: 'Avocado', category: 'fat', tier: 'comfortable', costNote: 'importé, prix variable' },
  { name: 'Walnuts', category: 'fat', tier: 'comfortable' },

  // ── Légumes (tous peu chers au Maroc, différenciés par disponibilité) ──
  { name: 'Tomato', category: 'veg', tier: 'tight' },
  { name: 'Onion', category: 'veg', tier: 'tight' },
  { name: 'Carrots', category: 'veg', tier: 'tight' },
  { name: 'Cucumber', category: 'veg', tier: 'tight' },
  { name: 'Bell pepper', category: 'veg', tier: 'tight' },
  { name: 'Zucchini', category: 'veg', tier: 'tight' },
  { name: 'Spinach', category: 'veg', tier: 'moderate' },
  { name: 'Broccoli', category: 'veg', tier: 'moderate' },
  { name: 'Mushroom', category: 'veg', tier: 'moderate' },
  { name: 'Asparagus', category: 'veg', tier: 'comfortable', costNote: 'plus rare/cher' },

  // ── Fruits ──
  { name: 'Banana', category: 'fruit', tier: 'tight' },
  { name: 'Orange', category: 'fruit', tier: 'tight', costNote: 'production locale abondante' },
  { name: 'Apple', category: 'fruit', tier: 'moderate' },
  { name: 'Dates', category: 'fruit', tier: 'moderate' },
  { name: 'Grapes', category: 'fruit', tier: 'moderate' },
  { name: 'Berries (mixed)', category: 'fruit', tier: 'comfortable', costNote: 'importé/saisonnier, cher' },
  { name: 'Mango', category: 'fruit', tier: 'comfortable' },

  // ── Laitier ──
  { name: 'Lben (Moroccan buttermilk)', category: 'dairy', tier: 'tight' },
  { name: 'Milk (whole)', category: 'dairy', tier: 'tight' },
  { name: 'Cheese (cheddar)', category: 'dairy', tier: 'moderate' },
  { name: 'Mozzarella', category: 'dairy', tier: 'comfortable' },
];

// Every tier at or below (cheaper than) the user's budget tier is always
// allowed — a "comfortable" budget can still eat "tight"-tier foods, never
// the reverse.
export function foodsForBudget(budgetTier, category) {
  const maxOrder = MOROCCO_BUDGET_TIERS[budgetTier]?.order ?? 0;
  return MOROCCO_FOOD_COST_TIERS.filter(
    (f) => (MOROCCO_BUDGET_TIERS[f.tier]?.order ?? 0) <= maxOrder && (!category || f.category === category)
  );
}
