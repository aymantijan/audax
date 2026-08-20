// ─────────────────────────────────────────────────────────────────────────────
// MICRONUTRIENT RDAs — generic adult reference daily intakes (EU NRV / US RDA,
// whichever is more commonly cited, rounded for a coaching app, not a
// clinical one). Sex-adjusted only where the RDA genuinely differs materially
// (iron is the big one — ~2x higher for menstruating women). Everything here
// is informational, not a diagnostic tool — displayed as "% of a generic
// reference", never framed as a personalized clinical target.
// ─────────────────────────────────────────────────────────────────────────────

export const MICRONUTRIENT_LABELS = {
  vitaminA: 'Vitamine A', vitaminC: 'Vitamine C', vitaminD: 'Vitamine D', vitaminE: 'Vitamine E', vitaminK: 'Vitamine K',
  vitaminB1: 'Vitamine B1', vitaminB2: 'Vitamine B2', vitaminB3: 'Vitamine B3', vitaminB6: 'Vitamine B6', vitaminB9: 'Folates (B9)', vitaminB12: 'Vitamine B12',
  calcium: 'Calcium', iron: 'Fer', magnesium: 'Magnésium', zinc: 'Zinc', potassium: 'Potassium', sodium: 'Sodium',
  phosphorus: 'Phosphore', selenium: 'Sélénium', copper: 'Cuivre', manganese: 'Manganèse', iodine: 'Iode',
};

// {value, unit} — matches the unit OpenFoodFacts typically reports each
// nutrient in, so a raw sum of logged `micros[key].value` compares directly.
const BASE_RDA = {
  vitaminA: { value: 900, unit: 'µg' }, vitaminC: { value: 90, unit: 'mg' }, vitaminD: { value: 15, unit: 'µg' },
  vitaminE: { value: 15, unit: 'mg' }, vitaminK: { value: 120, unit: 'µg' },
  vitaminB1: { value: 1.2, unit: 'mg' }, vitaminB2: { value: 1.3, unit: 'mg' }, vitaminB3: { value: 16, unit: 'mg' },
  vitaminB6: { value: 1.7, unit: 'mg' }, vitaminB9: { value: 400, unit: 'µg' }, vitaminB12: { value: 2.4, unit: 'µg' },
  calcium: { value: 1000, unit: 'mg' }, iron: { value: 8, unit: 'mg' }, magnesium: { value: 400, unit: 'mg' },
  zinc: { value: 11, unit: 'mg' }, potassium: { value: 3400, unit: 'mg' }, sodium: { value: 2300, unit: 'mg' },
  phosphorus: { value: 700, unit: 'mg' }, selenium: { value: 55, unit: 'µg' }, copper: { value: 900, unit: 'µg' },
  manganese: { value: 2.3, unit: 'mg' }, iodine: { value: 150, unit: 'µg' },
};

// lifeStage overrides the menstruating-woman default where NIH ODS reference
// values genuinely differ: pregnancy raises iron/folate/B12/vitaminC demand
// (placental/fetal growth, blood volume expansion); postmenopause drops iron
// back to the non-menstruating level and raises calcium/vitaminD (bone density,
// no longer offset by estrogen). Values are the NIH Office of Dietary
// Supplements fact-sheet RDAs, not a personalized clinical target.
export function getMicronutrientRDA(sex, lifeStage = 'none') {
  const rda = { ...BASE_RDA };
  if (sex === 'female') rda.iron = { value: 18, unit: 'mg' }; // NIH: ~18mg for menstruating adult women vs ~8mg for men
  if (lifeStage === 'pregnant') {
    rda.iron = { value: 27, unit: 'mg' };
    rda.vitaminB9 = { value: 600, unit: 'µg' };
    rda.vitaminB12 = { value: 2.6, unit: 'µg' };
    rda.vitaminC = { value: 85, unit: 'mg' };
  } else if (lifeStage === 'menopause' || lifeStage === 'perimenopause') {
    rda.iron = { value: 8, unit: 'mg' };
    rda.calcium = { value: 1200, unit: 'mg' };
    rda.vitaminD = { value: 20, unit: 'µg' };
  }
  return rda;
}

const UNIT_SCALE_TO_G = { g: 1, mg: 1e-3, µg: 1e-6 };

// OpenFoodFacts and our RDA table don't always agree on which unit a given
// nutrient is reported in (e.g. sodium comes back in g from OFF, RDA is in
// mg) — convert before comparing/displaying so a value never gets labeled
// with the wrong unit's number. Returns the input unchanged if either unit
// isn't a convertible mass unit (e.g. 'UI').
export function convertMicroValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const fromScale = UNIT_SCALE_TO_G[fromUnit];
  const toScale = UNIT_SCALE_TO_G[toUnit];
  if (!fromScale || !toScale) return value;
  return (value * fromScale) / toScale;
}
