// ─────────────────────────────────────────────────────────────────────────────
// OpenFoodFacts integration — free, no API key, community food database with
// barcode lookup and (when the product has been fully annotated by the
// community) a real vitamins/minerals panel. Chosen over a paid API per the
// user's explicit choice — trade-off documented: micronutrient coverage is
// good for scanned packaged products, close to nonexistent for anything
// entered by name only (fresh produce, home-cooked meals) since those were
// never barcode-scanned by anyone into OFF's database either.
//
// All macro/micro values are normalized to "per 100g", matching the existing
// FOOD_DB (nutrition-db.js) convention, so both sources can feed the same
// logMeal()/estimateMacros() pipeline without special-casing.
// ─────────────────────────────────────────────────────────────────────────────

// OFF's nutriment id → our micros key. OFF stores each nutrient in its own
// "canonical" unit (mg for most minerals, µg for some vitamins, g for a few)
// — we pass the raw per-100g number through with that unit attached rather
// than silently re-deriving units, since guessing wrong would be worse than
// showing OFF's own unit alongside the number.
const MICRO_FIELDS = {
  vitaminA: 'vitamin-a', vitaminC: 'vitamin-c', vitaminD: 'vitamin-d', vitaminE: 'vitamin-e', vitaminK: 'vitamin-k',
  vitaminB1: 'vitamin-b1', vitaminB2: 'vitamin-b2', vitaminB3: 'vitamin-pp', vitaminB6: 'vitamin-b6', vitaminB9: 'vitamin-b9', vitaminB12: 'vitamin-b12',
  calcium: 'calcium', iron: 'iron', magnesium: 'magnesium', zinc: 'zinc', potassium: 'potassium', sodium: 'sodium',
  phosphorus: 'phosphorus', selenium: 'selenium', copper: 'copper', manganese: 'manganese', iodine: 'iodine',
};

const UNIT_LABEL = { g: 'g', mg: 'mg', µg: 'µg', mcg: 'µg', iu: 'UI' };

function extractMicros(nutriments) {
  const micros = {};
  for (const [key, offId] of Object.entries(MICRO_FIELDS)) {
    const value = nutriments?.[`${offId}_100g`];
    if (value == null) continue;
    const unit = nutriments?.[`${offId}_unit`] || 'g';
    micros[key] = { value: Number(value), unit: UNIT_LABEL[unit.toLowerCase()] || unit };
  }
  return micros;
}

function normalizeProduct(product, barcode) {
  const n = product.nutriments || {};
  return {
    barcode,
    name: product.product_name || product.generic_name || 'Produit inconnu',
    imageUrl: product.image_front_small_url || product.image_url || null,
    kcal: n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? Math.round(n['energy_100g'] / 4.184) : 0),
    protein: n.proteins_100g ?? 0,
    carbs: n.carbohydrates_100g ?? 0,
    fat: n.fat_100g ?? 0,
    fiber: n.fiber_100g ?? null,
    sugar: n.sugars_100g ?? null,
    micros: extractMicros(n),
    servingSize: product.serving_size || null,
  };
}

// Looks up a scanned/typed barcode. Returns null if OFF has no record (not
// an error — a huge fraction of real-world products, especially local/
// unbranded ones, simply aren't in the database).
export async function lookupBarcode(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,generic_name,nutriments,image_front_small_url,image_url,serving_size`);
  if (!res.ok) throw new Error(`OpenFoodFacts request failed (${res.status}).`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return normalizeProduct(data.product, barcode);
}

// Fallback text search for a packaged product without scanning — same
// normalized shape, one result per match, capped to a manageable list.
export async function searchByName(query, limit = 10) {
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=code,product_name,generic_name,nutriments,image_front_small_url,image_url,serving_size`);
  if (!res.ok) throw new Error(`OpenFoodFacts search failed (${res.status}).`);
  const data = await res.json();
  return (data.products || []).filter((p) => p.product_name).map((p) => normalizeProduct(p, p.code));
}
