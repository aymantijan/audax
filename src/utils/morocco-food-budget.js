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
  //
  // `proteinQuality` — DIAAS (Digestible Indispensable Amino Acid Score),
  // the current gold-standard protein-quality metric (FAO 2013). ≥100 =
  // "excellent" (complete essential-amino-acid profile, fully absorbed);
  // 75-99 = "good"; <75 = no quality claim under FAO's own classification.
  // Sourced from Herreman et al. 2020 (comprehensive DIAAS review) and
  // FAO/WHO reference values — see the buildProteinItems comment below for
  // how this is used (sorts the pool, doesn't exclude anything).
  { name: 'Eggs', category: 'protein', tier: 'tight', fromType: 'animal', proteinQuality: 113, costNote: 'protéine complète la moins chère au Maroc' },
  { name: 'Chicken thigh', category: 'protein', tier: 'tight', fromType: 'animal', proteinQuality: 108, costNote: 'avec os/peau — une des viandes les moins chères au Maroc' },
  { name: 'Sardines (canned)', category: 'protein', tier: 'tight', fromType: 'animal', proteinQuality: 100, costNote: 'oméga-3 bon marché, très courant au Maroc' },
  { name: 'Lentils (cooked)', category: 'protein', tier: 'tight', fromType: 'legume', proteinQuality: 63, costNote: 'légumineuse — protéine + glucides en un seul aliment' },
  { name: 'Chickpeas (cooked)', category: 'protein', tier: 'tight', fromType: 'legume', proteinQuality: 70 },
  { name: 'Black beans (cooked)', category: 'protein', tier: 'tight', fromType: 'legume', proteinQuality: 60 },
  { name: 'Chicken breast', category: 'protein', tier: 'moderate', fromType: 'animal', proteinQuality: 108 },
  { name: 'Tuna (canned)', category: 'protein', tier: 'moderate', fromType: 'animal', proteinQuality: 100 },
  { name: 'Greek yogurt (plain)', category: 'protein', tier: 'moderate', fromType: 'animal', proteinQuality: 114 },
  { name: 'Cottage cheese', category: 'protein', tier: 'moderate', fromType: 'animal', proteinQuality: 114 },
  { name: 'Whey protein (scoop, 30g)', category: 'protein', tier: 'moderate', fromType: 'animal', proteinQuality: 109, costNote: 'pratique mais plus cher au kg de protéine que les sources entières' },
  { name: 'Beef (ground, 90/10)', category: 'protein', tier: 'comfortable', fromType: 'animal', proteinQuality: 111 },
  { name: 'Beef (lean)', category: 'protein', tier: 'comfortable', fromType: 'animal', proteinQuality: 111 },
  { name: 'Salmon', category: 'protein', tier: 'comfortable', fromType: 'animal', proteinQuality: 100, costNote: 'importé, cher au Maroc' },
  { name: 'Shrimp', category: 'protein', tier: 'comfortable', fromType: 'animal', proteinQuality: 90 },

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
//
// `opts.customFoods` — the user's own added foods (healthStore.customFoods),
// unioned in for this category, always allowed regardless of tier (the user
// added them themselves, so they're already known-available to them).
//
// `opts.foodPrices` — real per-gram prices the user entered for ANY food
// (Settings → "Mes aliments & prix"). When at least one price is known, the
// WHOLE returned pool is sorted by price ascending first (priced foods
// float to the front, cheapest first — "mettre les aliments à coût bas [en
// premier]" as requested) — foods with no known price keep the generic tier
// ordering and sort after every priced one, since a real number always beats
// a generic cost tier for that specific person.
export function foodsForBudget(budgetTier, category, opts = {}) {
  const { customFoods = [], foodPrices = {} } = opts;
  const maxOrder = MOROCCO_BUDGET_TIERS[budgetTier]?.order ?? 0;
  const curated = MOROCCO_FOOD_COST_TIERS.filter(
    (f) => (MOROCCO_BUDGET_TIERS[f.tier]?.order ?? 0) <= maxOrder && (!category || f.category === category)
  );
  const custom = customFoods
    .filter((f) => !category || f.category === category)
    .map((f) => ({ name: f.name, category: f.category, tier: budgetTier, fromType: 'custom' }));
  const pool = [...custom, ...curated];
  if (!Object.keys(foodPrices).length) return pool;
  return [...pool].sort((a, b) => {
    const pa = foodPrices[a.name], pb = foodPrices[b.name];
    if (pa != null && pb != null) return pa - pb;
    if (pa != null) return -1;
    if (pb != null) return 1;
    return 0;
  });
}
