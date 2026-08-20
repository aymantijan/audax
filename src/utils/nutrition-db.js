// A hardcoded food DB (macros per 100g) for quick meal logging without a
// network call. Not a full USDA-scale database, but covers common whole-food
// staples, produce, dairy, and processed items across categories so the
// "food quality score" has real contrast and most everyday meals can be
// logged without hitting "unrecognized food".
//
// `servings` (optional): common non-gram units for a food (e.g. "1 egg" ≈
// 50g) — lets logging use natural units instead of forcing the user to know
// a food's weight in grams. Every food can still be logged in grams
// regardless of whether it has servings defined.
// { name, protein, carbs, fat, kcal (per 100g), whole: true|false, servings?: [{label, grams}] }
export const FOOD_DB = [
  // ── Protein sources ──
  { name: 'Chicken breast', protein: 31, carbs: 0, fat: 3.6, kcal: 165, whole: true, servings: [{ label: 'breast', grams: 174 }] },
  { name: 'Chicken thigh', protein: 24, carbs: 0, fat: 9.6, kcal: 179, whole: true, servings: [{ label: 'cuisse', grams: 150 }] },
  { name: 'Salmon', protein: 20, carbs: 0, fat: 13, kcal: 208, whole: true, servings: [{ label: 'fillet', grams: 150 }] },
  { name: 'Tuna (canned)', protein: 26, carbs: 0, fat: 1, kcal: 116, whole: true, servings: [{ label: 'can', grams: 142 }] },
  { name: 'Shrimp', protein: 24, carbs: 0.2, fat: 0.3, kcal: 99, whole: true, servings: [{ label: 'grosse crevette', grams: 12 }] },
  { name: 'Cod', protein: 18, carbs: 0, fat: 0.7, kcal: 82, whole: true },
  { name: 'Pork chop', protein: 27, carbs: 0, fat: 14, kcal: 231, whole: true },
  { name: 'Lamb', protein: 25, carbs: 0, fat: 21, kcal: 294, whole: true },
  { name: 'Bacon', protein: 37, carbs: 1.4, fat: 42, kcal: 541, whole: false, servings: [{ label: 'slice', grams: 8 }] },
  { name: 'Ham', protein: 21, carbs: 1.5, fat: 5, kcal: 145, whole: false },
  { name: 'Eggs', protein: 13, carbs: 1.1, fat: 11, kcal: 155, whole: true, servings: [{ label: 'egg', grams: 50 }] },
  { name: 'Egg whites', protein: 11, carbs: 0.7, fat: 0.2, kcal: 52, whole: true, servings: [{ label: 'egg white', grams: 33 }] },
  { name: 'Greek yogurt (plain)', protein: 10, carbs: 3.6, fat: 0.4, kcal: 59, whole: true, servings: [{ label: 'cup', grams: 245 }] },
  { name: 'Cottage cheese', protein: 11, carbs: 3.4, fat: 4.3, kcal: 98, whole: true, servings: [{ label: 'cup', grams: 226 }] },
  { name: 'Beef (lean)', protein: 26, carbs: 0, fat: 15, kcal: 250, whole: true, servings: [{ label: 'steak', grams: 170 }] },
  { name: 'Beef (ground, 90/10)', protein: 20, carbs: 0, fat: 10, kcal: 176, whole: true, servings: [{ label: 'portion', grams: 150 }] },
  { name: 'Turkey breast', protein: 29, carbs: 0, fat: 1, kcal: 135, whole: true },
  { name: 'Whey protein (scoop, 30g)', protein: 24, carbs: 3, fat: 1.5, kcal: 120, whole: false, servings: [{ label: 'scoop', grams: 30 }] },
  { name: 'Tofu', protein: 8, carbs: 1.9, fat: 4.8, kcal: 76, whole: true },
  { name: 'Tempeh', protein: 19, carbs: 9, fat: 11, kcal: 195, whole: true },
  { name: 'Edamame', protein: 11, carbs: 10, fat: 5, kcal: 121, whole: true },
  { name: 'Lentils (cooked)', protein: 9, carbs: 20, fat: 0.4, kcal: 116, whole: true, servings: [{ label: 'cup', grams: 198 }] },
  { name: 'Chickpeas (cooked)', protein: 8.9, carbs: 27, fat: 2.6, kcal: 164, whole: true, servings: [{ label: 'cup', grams: 164 }] },
  { name: 'Black beans (cooked)', protein: 8.9, carbs: 24, fat: 0.5, kcal: 132, whole: true, servings: [{ label: 'cup', grams: 172 }] },
  { name: 'Kidney beans (cooked)', protein: 8.7, carbs: 23, fat: 0.5, kcal: 127, whole: true },

  // ── Carb sources ──
  { name: 'White rice (cooked)', protein: 2.7, carbs: 28, fat: 0.3, kcal: 130, whole: true, servings: [{ label: 'cup', grams: 158 }] },
  { name: 'Brown rice (cooked)', protein: 2.6, carbs: 23, fat: 0.9, kcal: 111, whole: true, servings: [{ label: 'cup', grams: 195 }] },
  { name: 'Oats (dry)', protein: 13, carbs: 68, fat: 7, kcal: 389, whole: true, servings: [{ label: 'cup', grams: 81 }] },
  { name: 'Sweet potato', protein: 1.6, carbs: 20, fat: 0.1, kcal: 86, whole: true, servings: [{ label: 'medium', grams: 130 }] },
  { name: 'Potato', protein: 2, carbs: 17, fat: 0.1, kcal: 77, whole: true, servings: [{ label: 'medium', grams: 173 }] },
  { name: 'Whole wheat bread', protein: 13, carbs: 41, fat: 3.4, kcal: 247, whole: true, servings: [{ label: 'slice', grams: 32 }] },
  { name: 'White bread', protein: 9, carbs: 49, fat: 3.2, kcal: 265, whole: false, servings: [{ label: 'slice', grams: 28 }] },
  { name: 'Pasta (cooked)', protein: 5.8, carbs: 25, fat: 0.9, kcal: 131, whole: true, servings: [{ label: 'cup', grams: 140 }] },
  { name: 'Quinoa (cooked)', protein: 4.4, carbs: 21, fat: 1.9, kcal: 120, whole: true, servings: [{ label: 'cup', grams: 185 }] },
  { name: 'Couscous (cooked)', protein: 3.8, carbs: 23, fat: 0.2, kcal: 112, whole: true },
  { name: 'Bulgur (cooked)', protein: 3.1, carbs: 19, fat: 0.2, kcal: 83, whole: true, servings: [{ label: 'cup', grams: 182 }] },
  { name: 'Corn', protein: 3.3, carbs: 19, fat: 1.4, kcal: 96, whole: true, servings: [{ label: 'ear', grams: 90 }] },
  { name: 'Cereal (bran flakes)', protein: 8, carbs: 82, fat: 1.5, kcal: 320, whole: false, servings: [{ label: 'cup', grams: 39 }] },
  { name: 'Granola', protein: 10, carbs: 64, fat: 15, kcal: 471, whole: false, servings: [{ label: 'cup', grams: 122 }] },
  { name: 'Tortilla (flour)', protein: 8, carbs: 46, fat: 8, kcal: 300, whole: false, servings: [{ label: 'tortilla', grams: 45 }] },

  // ── Fruits ──
  { name: 'Banana', protein: 1.1, carbs: 23, fat: 0.3, kcal: 89, whole: true, servings: [{ label: 'medium', grams: 118 }] },
  { name: 'Apple', protein: 0.3, carbs: 14, fat: 0.2, kcal: 52, whole: true, servings: [{ label: 'medium', grams: 182 }] },
  { name: 'Orange', protein: 0.9, carbs: 12, fat: 0.1, kcal: 47, whole: true, servings: [{ label: 'medium', grams: 131 }] },
  { name: 'Berries (mixed)', protein: 0.7, carbs: 14, fat: 0.3, kcal: 57, whole: true, servings: [{ label: 'cup', grams: 148 }] },
  { name: 'Strawberries', protein: 0.7, carbs: 8, fat: 0.3, kcal: 32, whole: true, servings: [{ label: 'cup', grams: 152 }] },
  { name: 'Grapes', protein: 0.7, carbs: 18, fat: 0.2, kcal: 69, whole: true, servings: [{ label: 'cup', grams: 151 }] },
  { name: 'Mango', protein: 0.8, carbs: 15, fat: 0.4, kcal: 60, whole: true, servings: [{ label: 'medium', grams: 200 }] },
  { name: 'Pineapple', protein: 0.5, carbs: 13, fat: 0.1, kcal: 50, whole: true, servings: [{ label: 'cup', grams: 165 }] },
  { name: 'Watermelon', protein: 0.6, carbs: 8, fat: 0.2, kcal: 30, whole: true, servings: [{ label: 'cup', grams: 152 }] },
  { name: 'Dates', protein: 2.5, carbs: 75, fat: 0.4, kcal: 282, whole: true, servings: [{ label: 'date', grams: 24 }] },
  { name: 'Pear', protein: 0.4, carbs: 15, fat: 0.1, kcal: 57, whole: true, servings: [{ label: 'medium', grams: 178 }] },
  { name: 'Kiwi', protein: 1.1, carbs: 15, fat: 0.5, kcal: 61, whole: true, servings: [{ label: 'kiwi', grams: 76 }] },

  // ── Vegetables ──
  { name: 'Broccoli', protein: 2.8, carbs: 7, fat: 0.4, kcal: 34, whole: true, servings: [{ label: 'cup', grams: 91 }] },
  { name: 'Spinach', protein: 2.9, carbs: 3.6, fat: 0.4, kcal: 23, whole: true, servings: [{ label: 'cup', grams: 30 }] },
  { name: 'Kale', protein: 4.3, carbs: 9, fat: 0.9, kcal: 49, whole: true },
  { name: 'Mixed salad greens', protein: 1.4, carbs: 2.9, fat: 0.2, kcal: 15, whole: true },
  { name: 'Carrots', protein: 0.9, carbs: 10, fat: 0.2, kcal: 41, whole: true, servings: [{ label: 'carrot', grams: 61 }] },
  { name: 'Tomato', protein: 0.9, carbs: 3.9, fat: 0.2, kcal: 18, whole: true, servings: [{ label: 'medium', grams: 123 }] },
  { name: 'Cucumber', protein: 0.7, carbs: 3.6, fat: 0.1, kcal: 15, whole: true, servings: [{ label: 'concombre', grams: 200 }] },
  { name: 'Bell pepper', protein: 1, carbs: 6, fat: 0.3, kcal: 31, whole: true, servings: [{ label: 'pepper', grams: 119 }] },
  { name: 'Onion', protein: 1.1, carbs: 9, fat: 0.1, kcal: 40, whole: true, servings: [{ label: 'medium', grams: 110 }] },
  { name: 'Garlic', protein: 6.4, carbs: 33, fat: 0.5, kcal: 149, whole: true, servings: [{ label: 'clove', grams: 3 }] },
  { name: 'Cauliflower', protein: 1.9, carbs: 5, fat: 0.3, kcal: 25, whole: true },
  { name: 'Zucchini', protein: 1.2, carbs: 3.1, fat: 0.3, kcal: 17, whole: true, servings: [{ label: 'courgette', grams: 196 }] },
  { name: 'Mushroom', protein: 3.1, carbs: 3.3, fat: 0.3, kcal: 22, whole: true, servings: [{ label: 'champignon', grams: 18 }] },
  { name: 'Green beans', protein: 1.8, carbs: 7, fat: 0.2, kcal: 31, whole: true },
  { name: 'Asparagus', protein: 2.2, carbs: 3.9, fat: 0.1, kcal: 20, whole: true, servings: [{ label: 'pointe', grams: 16 }] },

  // ── Fats & nuts/seeds ──
  { name: 'Avocado', protein: 2, carbs: 9, fat: 15, kcal: 160, whole: true, servings: [{ label: 'avocado', grams: 150 }] },
  { name: 'Almonds', protein: 21, carbs: 22, fat: 50, kcal: 579, whole: true, servings: [{ label: 'handful (~23)', grams: 28 }] },
  { name: 'Walnuts', protein: 15, carbs: 14, fat: 65, kcal: 654, whole: true, servings: [{ label: 'handful', grams: 28 }] },
  { name: 'Cashews', protein: 18, carbs: 30, fat: 44, kcal: 553, whole: true, servings: [{ label: 'handful', grams: 28 }] },
  { name: 'Peanuts', protein: 26, carbs: 16, fat: 49, kcal: 567, whole: true, servings: [{ label: 'poignée', grams: 30 }] },
  { name: 'Chia seeds', protein: 17, carbs: 42, fat: 31, kcal: 486, whole: true, servings: [{ label: 'tbsp', grams: 12 }] },
  { name: 'Flaxseed', protein: 18, carbs: 29, fat: 42, kcal: 534, whole: true, servings: [{ label: 'tbsp', grams: 10 }] },
  { name: 'Peanut butter', protein: 25, carbs: 20, fat: 50, kcal: 588, whole: false, servings: [{ label: 'tbsp', grams: 16 }] },
  { name: 'Almond butter', protein: 21, carbs: 19, fat: 56, kcal: 614, whole: false, servings: [{ label: 'tbsp', grams: 16 }] },
  { name: 'Olive oil', protein: 0, carbs: 0, fat: 100, kcal: 884, whole: true, servings: [{ label: 'tbsp', grams: 14 }] },
  { name: 'Butter', protein: 0.9, carbs: 0.1, fat: 81, kcal: 717, whole: false, servings: [{ label: 'tbsp', grams: 14 }] },

  // ── Dairy & alternatives ──
  { name: 'Milk (whole)', protein: 3.2, carbs: 4.8, fat: 3.3, kcal: 61, whole: true, servings: [{ label: 'cup', grams: 244 }] },
  { name: 'Milk (skim)', protein: 3.4, carbs: 5, fat: 0.1, kcal: 34, whole: true, servings: [{ label: 'cup', grams: 245 }] },
  { name: 'Almond milk (unsweetened)', protein: 0.4, carbs: 0.6, fat: 1.1, kcal: 13, whole: false, servings: [{ label: 'cup', grams: 240 }] },
  { name: 'Cheese (cheddar)', protein: 25, carbs: 1.3, fat: 33, kcal: 403, whole: true, servings: [{ label: 'slice', grams: 28 }] },
  { name: 'Mozzarella', protein: 22, carbs: 2.2, fat: 22, kcal: 300, whole: true },
  { name: 'Parmesan', protein: 38, carbs: 4.1, fat: 29, kcal: 431, whole: true, servings: [{ label: 'tbsp', grams: 5 }] },
  { name: 'Cream cheese', protein: 6, carbs: 4, fat: 34, kcal: 342, whole: false, servings: [{ label: 'tbsp', grams: 15 }] },
  { name: 'Yogurt (flavored)', protein: 3.5, carbs: 15, fat: 1.5, kcal: 89, whole: false, servings: [{ label: 'cup', grams: 245 }] },

  // ── Condiments & misc ──
  { name: 'Honey', protein: 0.3, carbs: 82, fat: 0, kcal: 304, whole: false, servings: [{ label: 'tbsp', grams: 21 }] },
  { name: 'Maple syrup', protein: 0, carbs: 67, fat: 0.1, kcal: 260, whole: false, servings: [{ label: 'tbsp', grams: 20 }] },
  { name: 'Ketchup', protein: 1.3, carbs: 26, fat: 0.1, kcal: 101, whole: false, servings: [{ label: 'tbsp', grams: 17 }] },
  { name: 'Mayonnaise', protein: 1, carbs: 0.6, fat: 75, kcal: 680, whole: false, servings: [{ label: 'tbsp', grams: 14 }] },
  { name: 'Hummus', protein: 8, carbs: 14, fat: 10, kcal: 166, whole: true, servings: [{ label: 'tbsp', grams: 15 }] },
  { name: 'Salsa', protein: 1.2, carbs: 4, fat: 0.2, kcal: 22, whole: true },

  // ── Beverages ──
  { name: 'Orange juice', protein: 0.7, carbs: 10, fat: 0.2, kcal: 45, whole: false, servings: [{ label: 'cup', grams: 248 }] },
  { name: 'Coffee (black)', protein: 0.1, carbs: 0, fat: 0, kcal: 1, whole: true, servings: [{ label: 'cup', grams: 237 }] },
  { name: 'Tea (unsweetened)', protein: 0, carbs: 0.3, fat: 0, kcal: 1, whole: true, servings: [{ label: 'cup', grams: 237 }] },
  { name: 'Beer', protein: 0.5, carbs: 3.6, fat: 0, kcal: 43, whole: false, servings: [{ label: 'can/bottle', grams: 355 }] },
  { name: 'Wine (red)', protein: 0.1, carbs: 2.6, fat: 0, kcal: 85, whole: false, servings: [{ label: 'glass', grams: 148 }] },
  { name: 'Protein bar', protein: 20, carbs: 24, fat: 9, kcal: 260, whole: false, servings: [{ label: 'bar', grams: 60 }] },

  // ── Common processed / discretionary (drag the quality score down when logged) ──
  { name: 'Pizza (slice)', protein: 11, carbs: 33, fat: 10, kcal: 266, whole: false, servings: [{ label: 'slice', grams: 107 }] },
  { name: 'Burger (fast food)', protein: 17, carbs: 30, fat: 20, kcal: 350, whole: false, servings: [{ label: 'burger', grams: 110 }] },
  { name: 'French fries', protein: 3.4, carbs: 41, fat: 15, kcal: 312, whole: false, servings: [{ label: 'small', grams: 71 }] },
  { name: 'Soda (regular)', protein: 0, carbs: 10.6, fat: 0, kcal: 41, whole: false, servings: [{ label: 'can', grams: 355 }] },
  { name: 'Chocolate bar', protein: 5, carbs: 60, fat: 30, kcal: 546, whole: false, servings: [{ label: 'bar', grams: 43 }] },
  { name: 'Ice cream', protein: 3.5, carbs: 24, fat: 11, kcal: 207, whole: false, servings: [{ label: 'scoop', grams: 66 }] },
  { name: 'Chips / crisps', protein: 6.6, carbs: 53, fat: 34, kcal: 536, whole: false, servings: [{ label: 'small bag', grams: 28 }] },
  { name: 'Instant noodles', protein: 8, carbs: 55, fat: 17, kcal: 400, whole: false, servings: [{ label: 'pack', grams: 85 }] },
  { name: 'Donut', protein: 4.9, carbs: 51, fat: 23, kcal: 452, whole: false, servings: [{ label: 'donut', grams: 60 }] },
  { name: 'Cookie', protein: 5.9, carbs: 68, fat: 22, kcal: 480, whole: false, servings: [{ label: 'cookie', grams: 16 }] },
  { name: 'Croissant', protein: 8.2, carbs: 45, fat: 21, kcal: 406, whole: false, servings: [{ label: 'croissant', grams: 57 }] },
  { name: 'Candy (gummy)', protein: 0, carbs: 78, fat: 0, kcal: 325, whole: false, servings: [{ label: 'small pack', grams: 40 }] },

  // ── Common composed dishes (rough per-100g averages — treat as approximate) ──
  { name: 'Sushi roll', protein: 6, carbs: 30, fat: 3, kcal: 160, whole: true, servings: [{ label: 'roll (8pc)', grams: 220 }] },
  { name: 'Sandwich (turkey)', protein: 12, carbs: 25, fat: 6, kcal: 200, whole: true, servings: [{ label: 'sandwich', grams: 220 }] },
  { name: 'Stir fry (chicken & veg)', protein: 12, carbs: 8, fat: 6, kcal: 140, whole: true },
  { name: 'Taco', protein: 9, carbs: 13, fat: 8, kcal: 150, whole: true, servings: [{ label: 'taco', grams: 102 }] },
  { name: 'Burrito', protein: 10, carbs: 20, fat: 8, kcal: 200, whole: true, servings: [{ label: 'burrito', grams: 300 }] },
  { name: 'Oatmeal with fruit', protein: 4, carbs: 20, fat: 2.5, kcal: 120, whole: true, servings: [{ label: 'bowl', grams: 280 }] },

  // ── Staples marocains (additif — pour le générateur de plan nutritionnel Maroc) ──
  { name: 'Khobz (Moroccan bread)', protein: 8.4, carbs: 50, fat: 1.4, kcal: 250, whole: true, servings: [{ label: 'loaf', grams: 250 }] },
  { name: 'Sardines (canned)', protein: 21, carbs: 0, fat: 11, kcal: 190, whole: true, servings: [{ label: 'can', grams: 106 }] },
  { name: 'Lben (Moroccan buttermilk)', protein: 3.1, carbs: 4.5, fat: 1.5, kcal: 45, whole: true, servings: [{ label: 'glass', grams: 250 }] },
];

const norm = (s) => String(s || '').trim().toLowerCase();

// User-added foods (healthStore.customFoods — manually entered or saved from
// a barcode scan) — kept in sync by a store subscription (see healthStore.js,
// bottom of file) rather than threaded as a parameter through every call
// site, since lookupFood/estimateMacros/getServingOptions are called from
// many places (Quick Log, the plan generator, meal templates…) that would
// otherwise all need to know about custom foods individually. Same per-100g
// shape as FOOD_DB.
let CUSTOM_FOODS = [];
export function setCustomFoods(list) {
  CUSTOM_FOODS = Array.isArray(list) ? list : [];
}

// Per-food corrections to the generic FOOD_DB/Morocco-list estimates — e.g.
// a specific brand's canned sardines nets 55g, not the generic 106g assumed
// for "a can" (which silently makes a "cheap" 8Dh can actually ~14.5Dh/100g,
// the exact case that prompted this). { [foodName]: { protein?, carbs?,
// fat?, kcal?, unitGrams? } } — any field can be omitted to keep the
// default; kept in sync via a healthStore subscription, same pattern as
// CUSTOM_FOODS above.
let FOOD_OVERRIDES = {};
export function setFoodOverrides(map) {
  FOOD_OVERRIDES = map && typeof map === 'object' ? map : {};
}

// Fuzzy-match a logged meal name against the DB (substring, either direction)
// — checks user-added foods first so a custom entry can intentionally
// shadow/override a built-in one of the same name. Applies any stored
// correction (macros and/or the first serving's real net weight) on top of
// whichever base entry was found, custom or built-in.
export function lookupFood(name) {
  const q = norm(name);
  if (!q) return null;
  const all = [...CUSTOM_FOODS, ...FOOD_DB];
  const exact = all.find((f) => norm(f.name) === q);
  const found = exact || all.find((f) => norm(f.name).includes(q) || q.includes(norm(f.name))) || null;
  if (!found) return null;
  const override = FOOD_OVERRIDES[found.name];
  if (!override) return found;
  const merged = { ...found };
  for (const key of ['protein', 'carbs', 'fat', 'kcal']) {
    if (override[key] != null) merged[key] = override[key];
  }
  // A user-defined unit — for the food's existing serving (correcting its
  // label and/or real net weight) OR, when it has none, creating one from
  // scratch (e.g. pricing "Chicken breast" as "1 barquette = 500g" even
  // though the generic entry only ever had per-100g figures).
  if (override.unitGrams != null || override.unitLabel != null) {
    const base = merged.servings?.[0];
    const grams = override.unitGrams ?? base?.grams;
    const label = override.unitLabel ?? base?.label;
    if (grams != null && label) {
      merged.servings = merged.servings?.length ? merged.servings.map((s, i) => (i === 0 ? { label, grams } : s)) : [{ label, grams }];
    }
  }
  return merged;
}

// Unit options for a food's quantity input — grams is always available;
// any `servings` entries (e.g. "egg", "medium", "slice") come after.
export function getServingOptions(foodName) {
  const food = lookupFood(foodName);
  const options = [{ label: 'g', grams: 1 }];
  if (food?.servings) options.push(...food.servings);
  return options;
}

// Estimate macros for a logged meal. `unit` is either 'g' (amount = grams
// directly) or a serving label from that food's `servings` list (amount =
// how many of that unit, e.g. amount=2, unit='egg' → 2 eggs). Falls back to
// treating an unrecognized unit as grams so a stale/renamed serving label on
// an old entry never throws.
export function estimateMacros(foodName, amount = 100, unit = 'g') {
  const food = lookupFood(foodName);
  if (!food) return null;
  const qty = Number(amount) || (unit === 'g' ? 100 : 1);
  const serving = unit !== 'g' ? food.servings?.find((s) => s.label === unit) : null;
  const grams = serving ? qty * serving.grams : qty;
  const factor = grams / 100;
  return {
    matchedName: food.name,
    whole: food.whole,
    grams: Math.round(grams * 10) / 10,
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
