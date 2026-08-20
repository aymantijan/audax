// ─────────────────────────────────────────────────────────────────────────────
// FOOD MICRONUTRIENTS — per-100g vitamin/mineral estimates for the curated
// Morocco food list (morocco-food-budget.js), keyed by the SAME name used in
// FOOD_DB (nutrition-db.js) so a generated meal plan's items can show a real
// vitamin/mineral breakdown, not just macros. Approximate USDA-range figures,
// not a lab analysis — same "estimation, not a clinical measure" framing as
// the rest of the app's nutrition heuristics. Deliberately a focused subset
// (10 of the 22 nutrients tracked for barcode-scanned foods in
// micronutrients.js) rather than a full panel — the ones a fitness-nutrition
// context actually cares about, kept to a size that stays maintainable by
// hand for ~45 whole foods. Units match micronutrients.js's BASE_RDA so both
// sources (this table + OpenFoodFacts scans) can share one display/summing
// path without a conversion step.
// { vitaminA(µg), vitaminC(mg), vitaminD(µg), vitaminB12(µg), iron(mg),
//   calcium(mg), magnesium(mg), zinc(mg), potassium(mg), sodium(mg) }
export const FOOD_MICRO_PROFILES = {
  // ── Protéines ──
  'Eggs': { vitaminA: 160, vitaminC: 0, vitaminD: 2, vitaminB12: 0.9, iron: 1.2, calcium: 50, magnesium: 10, zinc: 1.1, potassium: 126, sodium: 124 },
  'Chicken thigh': { vitaminA: 30, vitaminC: 0, vitaminD: 0.1, vitaminB12: 0.3, iron: 1.3, calcium: 12, magnesium: 20, zinc: 2.2, potassium: 240, sodium: 80 },
  'Sardines (canned)': { vitaminA: 32, vitaminC: 0, vitaminD: 4.8, vitaminB12: 8.9, iron: 2.9, calcium: 380, magnesium: 39, zinc: 1.3, potassium: 397, sodium: 505 },
  'Lentils (cooked)': { vitaminA: 1, vitaminC: 1.5, vitaminD: 0, vitaminB12: 0, iron: 3.3, calcium: 19, magnesium: 36, zinc: 1.3, potassium: 369, sodium: 2 },
  'Chickpeas (cooked)': { vitaminA: 1, vitaminC: 1.3, vitaminD: 0, vitaminB12: 0, iron: 2.9, calcium: 49, magnesium: 48, zinc: 1.5, potassium: 291, sodium: 7 },
  'Black beans (cooked)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 2.1, calcium: 27, magnesium: 70, zinc: 1.1, potassium: 355, sodium: 1 },
  'Chicken breast': { vitaminA: 6, vitaminC: 0, vitaminD: 0.1, vitaminB12: 0.3, iron: 0.7, calcium: 15, magnesium: 29, zinc: 1.0, potassium: 256, sodium: 74 },
  'Tuna (canned)': { vitaminA: 17, vitaminC: 0, vitaminD: 1.7, vitaminB12: 2.2, iron: 1.3, calcium: 11, magnesium: 27, zinc: 0.6, potassium: 237, sodium: 247 },
  'Greek yogurt (plain)': { vitaminA: 27, vitaminC: 0.5, vitaminD: 0, vitaminB12: 0.75, iron: 0.1, calcium: 110, magnesium: 11, zinc: 0.5, potassium: 141, sodium: 36 },
  'Cottage cheese': { vitaminA: 37, vitaminC: 0, vitaminD: 0, vitaminB12: 0.4, iron: 0.1, calcium: 83, magnesium: 8, zinc: 0.4, potassium: 104, sodium: 364 },
  'Whey protein (scoop, 30g)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 1, iron: 0.5, calcium: 130, magnesium: 25, zinc: 1.5, potassium: 180, sodium: 150 },
  'Beef (ground, 90/10)': { vitaminA: 0, vitaminC: 0, vitaminD: 0.1, vitaminB12: 2.1, iron: 2.2, calcium: 15, magnesium: 18, zinc: 4.5, potassium: 270, sodium: 66 },
  'Beef (lean)': { vitaminA: 0, vitaminC: 0, vitaminD: 0.1, vitaminB12: 2.5, iron: 2.6, calcium: 12, magnesium: 21, zinc: 4.8, potassium: 315, sodium: 60 },
  'Salmon': { vitaminA: 12, vitaminC: 0, vitaminD: 11, vitaminB12: 3.2, iron: 0.5, calcium: 12, magnesium: 27, zinc: 0.6, potassium: 384, sodium: 59 },
  'Shrimp': { vitaminA: 44, vitaminC: 2, vitaminD: 0, vitaminB12: 1.1, iron: 0.5, calcium: 70, magnesium: 39, zinc: 1.3, potassium: 259, sodium: 111 },

  // ── Glucides ──
  'Khobz (Moroccan bread)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 2.5, calcium: 40, magnesium: 30, zinc: 1.0, potassium: 130, sodium: 480 },
  'White rice (cooked)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0.2, calcium: 10, magnesium: 12, zinc: 0.5, potassium: 35, sodium: 1 },
  'Potato': { vitaminA: 0, vitaminC: 20, vitaminD: 0, vitaminB12: 0, iron: 0.8, calcium: 12, magnesium: 23, zinc: 0.3, potassium: 425, sodium: 6 },
  'Bulgur (cooked)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 1.0, calcium: 10, magnesium: 22, zinc: 0.6, potassium: 68, sodium: 5 },
  'Oats (dry)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 4.7, calcium: 54, magnesium: 177, zinc: 4.0, potassium: 429, sodium: 2 },
  'Sweet potato': { vitaminA: 709, vitaminC: 2.4, vitaminD: 0, vitaminB12: 0, iron: 0.6, calcium: 30, magnesium: 25, zinc: 0.3, potassium: 337, sodium: 55 },
  'Brown rice (cooked)': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0.4, calcium: 10, magnesium: 43, zinc: 0.6, potassium: 43, sodium: 4 },
  'Whole wheat bread': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 2.5, calcium: 100, magnesium: 60, zinc: 1.5, potassium: 230, sodium: 400 },
  'Quinoa (cooked)': { vitaminA: 1, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 1.5, calcium: 17, magnesium: 64, zinc: 1.1, potassium: 172, sodium: 7 },

  // ── Lipides ──
  'Olive oil': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0.6, calcium: 1, magnesium: 0, zinc: 0, potassium: 1, sodium: 2 },
  'Peanuts': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 4.6, calcium: 92, magnesium: 168, zinc: 3.3, potassium: 705, sodium: 18 },
  'Peanut butter': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 1.9, calcium: 43, magnesium: 154, zinc: 2.9, potassium: 649, sodium: 400 },
  'Almonds': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 3.7, calcium: 269, magnesium: 270, zinc: 3.1, potassium: 733, sodium: 1 },
  'Avocado': { vitaminA: 7, vitaminC: 10, vitaminD: 0, vitaminB12: 0, iron: 0.6, calcium: 12, magnesium: 29, zinc: 0.6, potassium: 485, sodium: 7 },
  'Walnuts': { vitaminA: 1, vitaminC: 1.3, vitaminD: 0, vitaminB12: 0, iron: 2.9, calcium: 98, magnesium: 158, zinc: 3.1, potassium: 441, sodium: 2 },

  // ── Légumes ──
  'Tomato': { vitaminA: 42, vitaminC: 14, vitaminD: 0, vitaminB12: 0, iron: 0.3, calcium: 10, magnesium: 11, zinc: 0.2, potassium: 237, sodium: 5 },
  'Onion': { vitaminA: 0, vitaminC: 7.4, vitaminD: 0, vitaminB12: 0, iron: 0.2, calcium: 23, magnesium: 10, zinc: 0.2, potassium: 146, sodium: 4 },
  'Carrots': { vitaminA: 835, vitaminC: 5.9, vitaminD: 0, vitaminB12: 0, iron: 0.3, calcium: 33, magnesium: 12, zinc: 0.2, potassium: 320, sodium: 69 },
  'Cucumber': { vitaminA: 5, vitaminC: 2.8, vitaminD: 0, vitaminB12: 0, iron: 0.3, calcium: 16, magnesium: 13, zinc: 0.2, potassium: 147, sodium: 2 },
  'Bell pepper': { vitaminA: 157, vitaminC: 128, vitaminD: 0, vitaminB12: 0, iron: 0.4, calcium: 7, magnesium: 10, zinc: 0.3, potassium: 211, sodium: 4 },
  'Zucchini': { vitaminA: 10, vitaminC: 18, vitaminD: 0, vitaminB12: 0, iron: 0.4, calcium: 16, magnesium: 18, zinc: 0.3, potassium: 261, sodium: 8 },
  'Spinach': { vitaminA: 469, vitaminC: 28, vitaminD: 0, vitaminB12: 0, iron: 2.7, calcium: 99, magnesium: 79, zinc: 0.5, potassium: 558, sodium: 79 },
  'Broccoli': { vitaminA: 31, vitaminC: 89, vitaminD: 0, vitaminB12: 0, iron: 0.7, calcium: 47, magnesium: 21, zinc: 0.4, potassium: 316, sodium: 33 },
  'Mushroom': { vitaminA: 0, vitaminC: 2.1, vitaminD: 0.2, vitaminB12: 0, iron: 0.5, calcium: 3, magnesium: 9, zinc: 0.5, potassium: 318, sodium: 5 },
  'Asparagus': { vitaminA: 38, vitaminC: 5.6, vitaminD: 0, vitaminB12: 0, iron: 2.1, calcium: 24, magnesium: 14, zinc: 0.5, potassium: 202, sodium: 2 },

  // ── Fruits ──
  'Banana': { vitaminA: 3, vitaminC: 8.7, vitaminD: 0, vitaminB12: 0, iron: 0.3, calcium: 5, magnesium: 27, zinc: 0.2, potassium: 358, sodium: 1 },
  'Orange': { vitaminA: 11, vitaminC: 53, vitaminD: 0, vitaminB12: 0, iron: 0.1, calcium: 40, magnesium: 10, zinc: 0.1, potassium: 181, sodium: 0 },
  'Apple': { vitaminA: 3, vitaminC: 4.6, vitaminD: 0, vitaminB12: 0, iron: 0.1, calcium: 6, magnesium: 5, zinc: 0.0, potassium: 107, sodium: 1 },
  'Dates': { vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0.9, calcium: 39, magnesium: 43, zinc: 0.4, potassium: 656, sodium: 1 },
  'Grapes': { vitaminA: 3, vitaminC: 3.2, vitaminD: 0, vitaminB12: 0, iron: 0.4, calcium: 10, magnesium: 7, zinc: 0.1, potassium: 191, sodium: 2 },
  'Berries (mixed)': { vitaminA: 3, vitaminC: 30, vitaminD: 0, vitaminB12: 0, iron: 0.4, calcium: 15, magnesium: 10, zinc: 0.2, potassium: 130, sodium: 2 },
  'Mango': { vitaminA: 54, vitaminC: 36, vitaminD: 0, vitaminB12: 0, iron: 0.2, calcium: 11, magnesium: 10, zinc: 0.1, potassium: 168, sodium: 1 },

  // ── Laitier ──
  'Lben (Moroccan buttermilk)': { vitaminA: 20, vitaminC: 1, vitaminD: 0, vitaminB12: 0.3, iron: 0.1, calcium: 110, magnesium: 10, zinc: 0.4, potassium: 140, sodium: 55 },
  'Milk (whole)': { vitaminA: 46, vitaminC: 0, vitaminD: 1.3, vitaminB12: 0.45, iron: 0, calcium: 113, magnesium: 10, zinc: 0.4, potassium: 132, sodium: 43 },
  'Cheese (cheddar)': { vitaminA: 265, vitaminC: 0, vitaminD: 0.6, vitaminB12: 0.8, iron: 0.7, calcium: 721, magnesium: 28, zinc: 3.1, potassium: 98, sodium: 621 },
  'Mozzarella': { vitaminA: 179, vitaminC: 0, vitaminD: 0.4, vitaminB12: 1.2, iron: 0.4, calcium: 505, magnesium: 20, zinc: 2.9, potassium: 76, sodium: 627 },
};

// Units match BASE_RDA in micronutrients.js for every key used above.
const UNIT_MAP = { vitaminA: 'µg', vitaminC: 'mg', vitaminD: 'µg', vitaminB12: 'µg', iron: 'mg', calcium: 'mg', magnesium: 'mg', zinc: 'mg', potassium: 'mg', sodium: 'mg' };

// Scales a food's per-100g profile to an actual portion, returning the same
// {value, unit} shape as OpenFoodFacts-sourced micros (openfoodfacts.js) so
// both sources can flow through the same display/summing code. Returns null
// if the food isn't in the table (e.g. a swap target outside the curated
// Morocco list, or a free-text logged food) — callers should treat that as
// "no micronutrient data available", not a zero.
export function getFoodMicros(foodName, grams) {
  const profile = FOOD_MICRO_PROFILES[foodName];
  if (!profile) return null;
  const factor = (Number(grams) || 0) / 100;
  return Object.fromEntries(
    Object.entries(profile).map(([key, v]) => [key, { value: Math.round(v * factor * 100) / 100, unit: UNIT_MAP[key] }])
  );
}
