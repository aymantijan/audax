// A small hardcoded food DB (macros per 100g) for quick meal logging without a
// network call. Not exhaustive by design — covers common whole-food staples
// plus a few common processed items so the "food quality score" has contrast.
// { name, protein, carbs, fat, kcal (per 100g), whole: true|false }
export const FOOD_DB = [
  // Protein sources
  { name: 'Chicken breast', protein: 31, carbs: 0, fat: 3.6, kcal: 165, whole: true },
  { name: 'Salmon', protein: 20, carbs: 0, fat: 13, kcal: 208, whole: true },
  { name: 'Tuna (canned)', protein: 26, carbs: 0, fat: 1, kcal: 116, whole: true },
  { name: 'Eggs', protein: 13, carbs: 1.1, fat: 11, kcal: 155, whole: true },
  { name: 'Egg whites', protein: 11, carbs: 0.7, fat: 0.2, kcal: 52, whole: true },
  { name: 'Greek yogurt (plain)', protein: 10, carbs: 3.6, fat: 0.4, kcal: 59, whole: true },
  { name: 'Cottage cheese', protein: 11, carbs: 3.4, fat: 4.3, kcal: 98, whole: true },
  { name: 'Beef (lean)', protein: 26, carbs: 0, fat: 15, kcal: 250, whole: true },
  { name: 'Turkey breast', protein: 29, carbs: 0, fat: 1, kcal: 135, whole: true },
  { name: 'Whey protein (scoop, 30g)', protein: 24, carbs: 3, fat: 1.5, kcal: 120, whole: false },
  { name: 'Tofu', protein: 8, carbs: 1.9, fat: 4.8, kcal: 76, whole: true },
  { name: 'Lentils (cooked)', protein: 9, carbs: 20, fat: 0.4, kcal: 116, whole: true },
  { name: 'Chickpeas (cooked)', protein: 8.9, carbs: 27, fat: 2.6, kcal: 164, whole: true },
  { name: 'Black beans (cooked)', protein: 8.9, carbs: 24, fat: 0.5, kcal: 132, whole: true },

  // Carb sources
  { name: 'White rice (cooked)', protein: 2.7, carbs: 28, fat: 0.3, kcal: 130, whole: true },
  { name: 'Brown rice (cooked)', protein: 2.6, carbs: 23, fat: 0.9, kcal: 111, whole: true },
  { name: 'Oats (dry)', protein: 13, carbs: 68, fat: 7, kcal: 389, whole: true },
  { name: 'Sweet potato', protein: 1.6, carbs: 20, fat: 0.1, kcal: 86, whole: true },
  { name: 'Potato', protein: 2, carbs: 17, fat: 0.1, kcal: 77, whole: true },
  { name: 'Whole wheat bread', protein: 13, carbs: 41, fat: 3.4, kcal: 247, whole: true },
  { name: 'White bread', protein: 9, carbs: 49, fat: 3.2, kcal: 265, whole: false },
  { name: 'Pasta (cooked)', protein: 5.8, carbs: 25, fat: 0.9, kcal: 131, whole: true },
  { name: 'Quinoa (cooked)', protein: 4.4, carbs: 21, fat: 1.9, kcal: 120, whole: true },
  { name: 'Banana', protein: 1.1, carbs: 23, fat: 0.3, kcal: 89, whole: true },
  { name: 'Apple', protein: 0.3, carbs: 14, fat: 0.2, kcal: 52, whole: true },
  { name: 'Berries (mixed)', protein: 0.7, carbs: 14, fat: 0.3, kcal: 57, whole: true },

  // Fats
  { name: 'Avocado', protein: 2, carbs: 9, fat: 15, kcal: 160, whole: true },
  { name: 'Almonds', protein: 21, carbs: 22, fat: 50, kcal: 579, whole: true },
  { name: 'Peanut butter', protein: 25, carbs: 20, fat: 50, kcal: 588, whole: false },
  { name: 'Olive oil', protein: 0, carbs: 0, fat: 100, kcal: 884, whole: true },
  { name: 'Butter', protein: 0.9, carbs: 0.1, fat: 81, kcal: 717, whole: false },

  // Vegetables
  { name: 'Broccoli', protein: 2.8, carbs: 7, fat: 0.4, kcal: 34, whole: true },
  { name: 'Spinach', protein: 2.9, carbs: 3.6, fat: 0.4, kcal: 23, whole: true },
  { name: 'Mixed salad greens', protein: 1.4, carbs: 2.9, fat: 0.2, kcal: 15, whole: true },
  { name: 'Carrots', protein: 0.9, carbs: 10, fat: 0.2, kcal: 41, whole: true },

  // Dairy & other
  { name: 'Milk (whole)', protein: 3.2, carbs: 4.8, fat: 3.3, kcal: 61, whole: true },
  { name: 'Cheese (cheddar)', protein: 25, carbs: 1.3, fat: 33, kcal: 403, whole: true },

  // Common processed / discretionary (drag the quality score down when logged)
  { name: 'Pizza (slice)', protein: 11, carbs: 33, fat: 10, kcal: 266, whole: false },
  { name: 'Burger (fast food)', protein: 17, carbs: 30, fat: 20, kcal: 350, whole: false },
  { name: 'French fries', protein: 3.4, carbs: 41, fat: 15, kcal: 312, whole: false },
  { name: 'Soda (regular)', protein: 0, carbs: 10.6, fat: 0, kcal: 41, whole: false },
  { name: 'Chocolate bar', protein: 5, carbs: 60, fat: 30, kcal: 546, whole: false },
  { name: 'Ice cream', protein: 3.5, carbs: 24, fat: 11, kcal: 207, whole: false },
  { name: 'Chips / crisps', protein: 6.6, carbs: 53, fat: 34, kcal: 536, whole: false },
  { name: 'Instant noodles', protein: 8, carbs: 55, fat: 17, kcal: 400, whole: false },
];

const norm = (s) => String(s || '').trim().toLowerCase();

// Fuzzy-match a logged meal name against the DB (substring, either direction).
export function lookupFood(name) {
  const q = norm(name);
  if (!q) return null;
  const exact = FOOD_DB.find((f) => norm(f.name) === q);
  if (exact) return exact;
  return FOOD_DB.find((f) => norm(f.name).includes(q) || q.includes(norm(f.name))) || null;
}

// Estimate macros for a quick-logged meal: "Chicken breast 200g" style input is
// handled by the caller splitting name/grams; this just scales per-100g macros.
export function estimateMacros(foodName, grams = 100) {
  const food = lookupFood(foodName);
  if (!food) return null;
  const factor = (Number(grams) || 100) / 100;
  return {
    matchedName: food.name,
    whole: food.whole,
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
    kcal: Math.round(food.kcal * factor),
  };
}

// Food quality score = % of today's calories from whole-food items (Helms et al.
// style "food quality" framing — most of your calories from minimally processed sources).
export function foodQualityScore(entries) {
  if (!entries.length) return null;
  const totalKcal = entries.reduce((a, e) => a + (e.kcal || 0), 0);
  if (!totalKcal) return null;
  const wholeKcal = entries.filter((e) => e.whole).reduce((a, e) => a + (e.kcal || 0), 0);
  return Math.round((wholeKcal / totalKcal) * 100);
}
