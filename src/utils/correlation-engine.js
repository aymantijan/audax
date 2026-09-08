/**
 * correlation-engine.js — Cross-module correlation analysis for Programme.
 *
 * Computes Pearson correlation coefficients between pairs of metrics
 * drawn from different health subsections (gym, cardio, nutrition,
 * sleep, recovery, habits, discipline, body composition).
 *
 * 24+ predefined correlation pairs grouped by insight category.
 */

// ─────────── Pearson correlation ───────────

/**
 * Compute Pearson correlation coefficient between two arrays.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {{ r: number, n: number, significant: boolean }}
 */
export function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 5) return { r: 0, n, significant: false };

  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return { r: 0, n, significant: false };

  const r = Math.round((sumXY / denom) * 10000) / 10000;

  // Simple significance test: |r| > 2/√n for p < 0.05 approximation
  const significant = Math.abs(r) > 2 / Math.sqrt(n);

  return { r, n, significant };
}

/**
 * Strength label for a correlation coefficient.
 */
export function correlationStrength(r) {
  const abs = Math.abs(r);
  if (abs >= 0.8) return 'très forte';
  if (abs >= 0.6) return 'forte';
  if (abs >= 0.4) return 'modérée';
  if (abs >= 0.2) return 'faible';
  return 'négligeable';
}

/**
 * Direction label.
 */
export function correlationDirection(r) {
  if (r > 0.05) return 'positive';
  if (r < -0.05) return 'négative';
  return 'neutre';
}

// ─────────── Predefined correlation pairs ───────────

/**
 * Each pair defines two metrics to correlate.
 * The `extract` function pulls aligned time-series from the stores.
 *
 * Categories:
 *   performance  — training ↔ output
 *   recovery     — sleep/recovery ↔ performance
 *   nutrition    — nutrition ↔ body/performance
 *   discipline   — discipline ↔ outcomes
 *   habits       — habits ↔ performance/wellness
 *   body         — body composition ↔ training
 */

export const CORRELATION_PAIRS = [
  // ── Performance ──
  {
    id: 'volume_vs_1rm',
    label: 'Volume total ↔ 1RM estimé',
    category: 'performance',
    metricA: { key: 'total_volume', label: 'Volume (kg)' },
    metricB: { key: 'estimated_1rm', label: '1RM estimé (kg)' },
    insight: 'Un volume élevé soutenu devrait faire monter le 1RM au fil du temps.',
  },
  {
    id: 'gym_duration_vs_volume',
    label: 'Durée séance ↔ Volume total',
    category: 'performance',
    metricA: { key: 'session_duration_gym', label: 'Durée (min)' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'Les séances plus longues ne donnent pas toujours plus de volume — efficacité.',
  },
  {
    id: 'rpe_vs_volume',
    label: 'RPE moyen ↔ Volume total',
    category: 'performance',
    metricA: { key: 'avg_rpe', label: 'RPE' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'Un RPE trop élevé peut réduire le volume par fatigue accumulée.',
  },
  {
    id: 'cardio_duration_vs_calories',
    label: 'Durée cardio ↔ Calories brûlées',
    category: 'performance',
    metricA: { key: 'cardio_duration', label: 'Durée (min)' },
    metricB: { key: 'cardio_calories', label: 'Calories' },
    insight: 'L\'intensité module la relation durée/calories.',
  },

  // ── Recovery ──
  {
    id: 'sleep_vs_rpe',
    label: 'Sommeil ↔ RPE perçu',
    category: 'recovery',
    metricA: { key: 'sleep_hours', label: 'Heures sommeil' },
    metricB: { key: 'avg_rpe', label: 'RPE' },
    insight: 'Moins de sommeil → RPE plus élevé (effort perçu augmenté).',
  },
  {
    id: 'sleep_vs_volume',
    label: 'Sommeil ↔ Volume gym',
    category: 'recovery',
    metricA: { key: 'sleep_hours', label: 'Heures sommeil' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'Le sommeil influence directement la capacité de travail.',
  },
  {
    id: 'sleep_quality_vs_energy',
    label: 'Qualité sommeil ↔ Énergie',
    category: 'recovery',
    metricA: { key: 'sleep_quality', label: 'Qualité (/10)' },
    metricB: { key: 'energy_level', label: 'Énergie (/10)' },
    insight: 'Qualité > quantité pour l\'énergie du lendemain.',
  },
  {
    id: 'recovery_vs_next_volume',
    label: 'Score récup ↔ Volume J+1',
    category: 'recovery',
    metricA: { key: 'recovery_score', label: 'Récupération (/100)' },
    metricB: { key: 'total_volume', label: 'Volume J+1 (kg)', offset: 1 },
    insight: 'Une bonne récupération devrait prédire de meilleures performances.',
  },
  {
    id: 'soreness_vs_volume',
    label: 'Courbatures ↔ Volume gym',
    category: 'recovery',
    metricA: { key: 'soreness_level', label: 'Courbatures (/10)' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'Trop de courbatures = volume en baisse (sous-récupération).',
  },

  // ── Nutrition ──
  {
    id: 'protein_vs_lean_mass',
    label: 'Protéines/kg ↔ Masse maigre',
    category: 'nutrition',
    metricA: { key: 'protein_per_kg', label: 'Protéines (g/kg)' },
    metricB: { key: 'lean_mass', label: 'Masse maigre (kg)' },
    insight: 'Apport protéique suffisant corrélé au maintien/gain de masse maigre.',
  },
  {
    id: 'kcal_vs_weight',
    label: 'Calories ↔ Poids corporel',
    category: 'nutrition',
    metricA: { key: 'daily_kcal', label: 'Calories' },
    metricB: { key: 'body_weight', label: 'Poids (kg)' },
    insight: 'Balance énergétique → évolution du poids.',
  },
  {
    id: 'kcal_vs_energy',
    label: 'Calories ↔ Énergie',
    category: 'nutrition',
    metricA: { key: 'daily_kcal', label: 'Calories' },
    metricB: { key: 'energy_level', label: 'Énergie (/10)' },
    insight: 'Un déficit calorique trop important affecte l\'énergie.',
  },
  {
    id: 'carbs_vs_performance',
    label: 'Glucides ↔ Volume gym',
    category: 'nutrition',
    metricA: { key: 'daily_carbs', label: 'Glucides (g)' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'Les glucides alimentent les séances de force.',
  },
  {
    id: 'fiber_vs_sleep',
    label: 'Fibres ↔ Qualité sommeil',
    category: 'nutrition',
    metricA: { key: 'daily_fiber', label: 'Fibres (g)' },
    metricB: { key: 'sleep_quality', label: 'Qualité (/10)' },
    insight: 'La santé digestive (fibres) influence la qualité du sommeil.',
  },
  {
    id: 'water_vs_energy',
    label: 'Hydratation ↔ Énergie',
    category: 'nutrition',
    metricA: { key: 'water_intake', label: 'Eau (L)' },
    metricB: { key: 'energy_level', label: 'Énergie (/10)' },
    insight: 'La déshydratation réduit la performance cognitive et physique.',
  },

  // ── Discipline ──
  {
    id: 'discipline_vs_volume',
    label: 'Discipline ↔ Volume gym',
    category: 'discipline',
    metricA: { key: 'discipline_overall', label: 'Discipline (/100)' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'La discipline (ponctualité + complétion) influence la progression.',
  },
  {
    id: 'discipline_vs_weight',
    label: 'Discipline ↔ Poids corporel',
    category: 'discipline',
    metricA: { key: 'discipline_overall', label: 'Discipline (/100)' },
    metricB: { key: 'body_weight', label: 'Poids (kg)' },
    insight: 'La discipline soutenue corrélée aux objectifs de poids.',
  },
  {
    id: 'timing_vs_completion',
    label: 'Ponctualité ↔ Complétion',
    category: 'discipline',
    metricA: { key: 'discipline_timing', label: 'Ponctualité (/100)' },
    metricB: { key: 'discipline_completion', label: 'Complétion (/100)' },
    insight: 'Arriver à l\'heure prédit-il de finir la séance complète ?',
  },

  // ── Habits ──
  {
    id: 'habits_vs_discipline',
    label: 'Taux habitudes ↔ Discipline',
    category: 'habits',
    metricA: { key: 'habits_completion_rate', label: 'Taux habitudes (%)' },
    metricB: { key: 'discipline_overall', label: 'Discipline (/100)' },
    insight: 'Les micro-habitudes soutiennent la discipline globale.',
  },
  {
    id: 'habits_vs_sleep',
    label: 'Habitudes ↔ Sommeil',
    category: 'habits',
    metricA: { key: 'habits_completion_rate', label: 'Taux habitudes (%)' },
    metricB: { key: 'sleep_hours', label: 'Heures sommeil' },
    insight: 'Les habitudes de routine favorisent un meilleur sommeil.',
  },

  // ── Body ──
  {
    id: 'bodyfat_vs_volume',
    label: 'Masse grasse ↔ Volume gym',
    category: 'body',
    metricA: { key: 'body_fat_pct', label: 'Masse grasse (%)' },
    metricB: { key: 'total_volume', label: 'Volume (kg)' },
    insight: 'L\'entraînement régulier réduit-il la masse grasse ?',
  },
  {
    id: 'weight_vs_pace',
    label: 'Poids ↔ Allure course',
    category: 'body',
    metricA: { key: 'body_weight', label: 'Poids (kg)' },
    metricB: { key: 'avg_pace', label: 'Allure (min/km)' },
    insight: 'Un poids plus léger corrélé à une meilleure allure.',
  },
  {
    id: 'bmi_vs_energy',
    label: 'IMC ↔ Énergie',
    category: 'body',
    metricA: { key: 'bmi', label: 'IMC' },
    metricB: { key: 'energy_level', label: 'Énergie (/10)' },
    insight: 'L\'IMC dans la plage optimale corrélé à plus d\'énergie.',
  },
  {
    id: 'stress_vs_bodyfat',
    label: 'Stress ↔ Masse grasse',
    category: 'body',
    metricA: { key: 'stress_level', label: 'Stress (/10)' },
    metricB: { key: 'body_fat_pct', label: 'Masse grasse (%)' },
    insight: 'Le stress chronique (cortisol) favorise le stockage adipeux.',
  },
];

export const CORRELATION_CATEGORIES = [
  { key: 'performance', label: 'Performance', icon: '💪' },
  { key: 'recovery', label: 'Récupération', icon: '🛌' },
  { key: 'nutrition', label: 'Nutrition', icon: '🥗' },
  { key: 'discipline', label: 'Discipline', icon: '🎯' },
  { key: 'habits', label: 'Habitudes', icon: '✅' },
  { key: 'body', label: 'Composition', icon: '📏' },
];

// ─────────── Time-series extraction ───────────

/**
 * Extract aligned time-series for a pair from KPI values map.
 * @param {object} kpiValuesMap — { [kpiId]: [{value_date, value}] }
 * @param {Array} kpis — program_kpis rows
 * @param {object} pair — one of CORRELATION_PAIRS
 * @param {number} days — lookback window
 * @returns {{ dates: string[], valuesA: number[], valuesB: number[] }}
 */
export function extractPairData(kpiValuesMap, kpis, pair, days = 30) {
  // Find matching KPIs
  const kpiA = kpis.find((k) => k.kpi_key === pair.metricA.key);
  const kpiB = kpis.find((k) => k.kpi_key === pair.metricB.key);
  if (!kpiA || !kpiB) return { dates: [], valuesA: [], valuesB: [] };

  const seriesA = kpiValuesMap[kpiA.id] || [];
  const seriesB = kpiValuesMap[kpiB.id] || [];

  // Build date-indexed maps
  const mapA = {};
  for (const v of seriesA) mapA[v.value_date] = v.value;
  const mapB = {};
  for (const v of seriesB) mapB[v.value_date] = v.value;

  // Offset support (e.g. "recovery today → volume tomorrow")
  const offsetB = pair.metricB.offset || 0;

  // Align on common dates
  const dates = [];
  const valuesA = [];
  const valuesB = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    const dB = offsetB
      ? new Date(now - (i - offsetB) * 86400000).toISOString().slice(0, 10)
      : d;
    if (mapA[d] != null && mapB[dB] != null) {
      dates.push(d);
      valuesA.push(mapA[d]);
      valuesB.push(mapB[dB]);
    }
  }

  return { dates, valuesA, valuesB };
}

/**
 * Compute all correlations that have sufficient data.
 * @returns {Array<{pair, r, n, significant, strength, direction}>}
 */
export function computeAllCorrelations(kpiValuesMap, kpis, days = 30) {
  const results = [];

  for (const pair of CORRELATION_PAIRS) {
    const { valuesA, valuesB } = extractPairData(kpiValuesMap, kpis, pair, days);
    if (valuesA.length < 5) continue;

    const { r, n, significant } = pearson(valuesA, valuesB);
    results.push({
      pair,
      r,
      n,
      significant,
      strength: correlationStrength(r),
      direction: correlationDirection(r),
    });
  }

  // Sort by |r| descending
  results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return results;
}
