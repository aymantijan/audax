/**
 * kpi-library.js — 30+ predefined KPI definitions for Programme.
 *
 * Each library KPI has:
 *   key        — unique identifier (matches program_kpis.kpi_key)
 *   name       — display name (FR)
 *   unit       — display unit
 *   category   — grouping for UI
 *   direction  — 'higher' | 'lower' | 'range' — what "better" means
 *   compute(healthStore, date) → number | null
 *     Auto-computes the KPI value from healthStore data for a given date.
 *     Returns null if data is unavailable.
 */

// ─────────── Categories ───────────
export const KPI_CATEGORIES = [
  { key: 'gym', label: 'Gym / Force', icon: '🏋️' },
  { key: 'cardio', label: 'Cardio', icon: '🏃' },
  { key: 'body', label: 'Composition corporelle', icon: '📏' },
  { key: 'nutrition', label: 'Nutrition', icon: '🥗' },
  { key: 'sleep', label: 'Sommeil', icon: '😴' },
  { key: 'recovery', label: 'Récupération', icon: '🧊' },
  { key: 'habits', label: 'Habitudes', icon: '✅' },
  { key: 'discipline', label: 'Discipline', icon: '🎯' },
];

// ─────────── Helpers ───────────
const dayKey = (d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10));

function getGymLogsForDate(store, date) {
  const dk = dayKey(date);
  return (store.gymSessions || []).filter((s) => dayKey(s.date) === dk);
}

function getCardioLogsForDate(store, date) {
  const dk = dayKey(date);
  return (store.cardioSessions || []).filter((s) => dayKey(s.date) === dk);
}

function getNutritionForDate(store, date) {
  const dk = dayKey(date);
  return (store.nutritionLogs || []).filter((n) => dayKey(n.date) === dk);
}

function getBodyCompForDate(store, date) {
  const dk = dayKey(date);
  return (store.bodyCompositionLogs || []).find((b) => dayKey(b.date) === dk);
}

function getSleepForDate(store, date) {
  const dk = dayKey(date);
  return (store.sleepLogs || []).find((s) => dayKey(s.date) === dk);
}

function getRecoveryForDate(store, date) {
  const dk = dayKey(date);
  return (store.recoveryLogs || []).find((r) => dayKey(r.date) === dk);
}

// ─────────── Library KPIs ───────────
export const KPI_LIBRARY = [
  // ── Gym / Force ──
  {
    key: 'total_volume',
    name: 'Volume total (kg)',
    unit: 'kg',
    category: 'gym',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getGymLogsForDate(store, date);
      if (!sessions.length) return null;
      return sessions.reduce((sum, s) => {
        const sets = s.sets || s.exercises?.flatMap((e) => e.sets || []) || [];
        return sum + sets.reduce((v, set) => v + (set.reps || 0) * (set.weight || 0), 0);
      }, 0);
    },
  },
  {
    key: 'total_sets',
    name: 'Sets totaux',
    unit: 'sets',
    category: 'gym',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getGymLogsForDate(store, date);
      if (!sessions.length) return null;
      return sessions.reduce((sum, s) => {
        const sets = s.sets || s.exercises?.flatMap((e) => e.sets || []) || [];
        return sum + sets.length;
      }, 0);
    },
  },
  {
    key: 'avg_rpe',
    name: 'RPE moyen',
    unit: 'RPE',
    category: 'gym',
    direction: 'range', // too high = overtraining, too low = not enough
    compute: (store, date) => {
      const sessions = getGymLogsForDate(store, date);
      if (!sessions.length) return null;
      const rpes = sessions
        .flatMap((s) => s.sets || s.exercises?.flatMap((e) => e.sets || []) || [])
        .map((set) => set.rpe)
        .filter(Boolean);
      return rpes.length ? Math.round((rpes.reduce((a, b) => a + b) / rpes.length) * 10) / 10 : null;
    },
  },
  {
    key: 'session_duration_gym',
    name: 'Durée séance gym',
    unit: 'min',
    category: 'gym',
    direction: 'range',
    compute: (store, date) => {
      const sessions = getGymLogsForDate(store, date);
      if (!sessions.length) return null;
      return sessions.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    },
  },
  {
    key: 'max_weight_lifted',
    name: 'Charge max soulevée',
    unit: 'kg',
    category: 'gym',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getGymLogsForDate(store, date);
      if (!sessions.length) return null;
      const weights = sessions
        .flatMap((s) => s.sets || s.exercises?.flatMap((e) => e.sets || []) || [])
        .map((set) => set.weight || 0);
      return weights.length ? Math.max(...weights) : null;
    },
  },
  {
    key: 'estimated_1rm',
    name: '1RM estimé (meilleur set)',
    unit: 'kg',
    category: 'gym',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getGymLogsForDate(store, date);
      if (!sessions.length) return null;
      let best = 0;
      for (const s of sessions) {
        const sets = s.sets || s.exercises?.flatMap((e) => e.sets || []) || [];
        for (const set of sets) {
          if (set.weight && set.reps) {
            // Epley formula: 1RM = weight × (1 + reps/30)
            const rm = set.weight * (1 + set.reps / 30);
            if (rm > best) best = rm;
          }
        }
      }
      return best > 0 ? Math.round(best * 10) / 10 : null;
    },
  },

  // ── Cardio ──
  {
    key: 'cardio_duration',
    name: 'Durée cardio',
    unit: 'min',
    category: 'cardio',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getCardioLogsForDate(store, date);
      if (!sessions.length) return null;
      return sessions.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    },
  },
  {
    key: 'cardio_distance',
    name: 'Distance cardio',
    unit: 'km',
    category: 'cardio',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getCardioLogsForDate(store, date);
      if (!sessions.length) return null;
      return sessions.reduce((sum, s) => sum + (s.distance_km || 0), 0);
    },
  },
  {
    key: 'cardio_calories',
    name: 'Calories cardio',
    unit: 'kcal',
    category: 'cardio',
    direction: 'higher',
    compute: (store, date) => {
      const sessions = getCardioLogsForDate(store, date);
      if (!sessions.length) return null;
      return sessions.reduce((sum, s) => sum + (s.calories || 0), 0);
    },
  },
  {
    key: 'avg_heart_rate',
    name: 'FC moyenne cardio',
    unit: 'bpm',
    category: 'cardio',
    direction: 'range',
    compute: (store, date) => {
      const sessions = getCardioLogsForDate(store, date);
      const hrs = sessions.map((s) => s.avg_heart_rate).filter(Boolean);
      return hrs.length ? Math.round(hrs.reduce((a, b) => a + b) / hrs.length) : null;
    },
  },
  {
    key: 'avg_pace',
    name: 'Allure moyenne',
    unit: 'min/km',
    category: 'cardio',
    direction: 'lower',
    compute: (store, date) => {
      const sessions = getCardioLogsForDate(store, date);
      const paces = sessions.filter((s) => s.distance_km && s.duration_min)
        .map((s) => s.duration_min / s.distance_km);
      return paces.length ? Math.round((paces.reduce((a, b) => a + b) / paces.length) * 100) / 100 : null;
    },
  },

  // ── Body composition ──
  {
    key: 'body_weight',
    name: 'Poids corporel',
    unit: 'kg',
    category: 'body',
    direction: 'range',
    compute: (store, date) => getBodyCompForDate(store, date)?.weight ?? null,
  },
  {
    key: 'body_fat_pct',
    name: 'Masse grasse',
    unit: '%',
    category: 'body',
    direction: 'lower',
    compute: (store, date) => getBodyCompForDate(store, date)?.bodyFatPct ?? null,
  },
  {
    key: 'lean_mass',
    name: 'Masse maigre',
    unit: 'kg',
    category: 'body',
    direction: 'higher',
    compute: (store, date) => {
      const bc = getBodyCompForDate(store, date);
      if (!bc?.weight || bc.bodyFatPct == null) return null;
      return Math.round(bc.weight * (1 - bc.bodyFatPct / 100) * 10) / 10;
    },
  },
  {
    key: 'waist_circumference',
    name: 'Tour de taille',
    unit: 'cm',
    category: 'body',
    direction: 'lower',
    compute: (store, date) => getBodyCompForDate(store, date)?.waistCm ?? null,
  },
  {
    key: 'bmi',
    name: 'IMC',
    unit: 'kg/m²',
    category: 'body',
    direction: 'range',
    compute: (store, date) => {
      const bc = getBodyCompForDate(store, date);
      if (!bc?.weight || !bc?.heightCm) return null;
      const h = bc.heightCm / 100;
      return Math.round((bc.weight / (h * h)) * 10) / 10;
    },
  },

  // ── Nutrition ──
  {
    key: 'daily_kcal',
    name: 'Calories totales',
    unit: 'kcal',
    category: 'nutrition',
    direction: 'range',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      if (!logs.length) return null;
      return logs.reduce((sum, n) => sum + (n.kcal || 0), 0);
    },
  },
  {
    key: 'daily_protein',
    name: 'Protéines',
    unit: 'g',
    category: 'nutrition',
    direction: 'higher',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      if (!logs.length) return null;
      return Math.round(logs.reduce((sum, n) => sum + (n.protein || 0), 0) * 10) / 10;
    },
  },
  {
    key: 'daily_carbs',
    name: 'Glucides',
    unit: 'g',
    category: 'nutrition',
    direction: 'range',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      if (!logs.length) return null;
      return Math.round(logs.reduce((sum, n) => sum + (n.carbs || 0), 0) * 10) / 10;
    },
  },
  {
    key: 'daily_fat',
    name: 'Lipides',
    unit: 'g',
    category: 'nutrition',
    direction: 'range',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      if (!logs.length) return null;
      return Math.round(logs.reduce((sum, n) => sum + (n.fat || 0), 0) * 10) / 10;
    },
  },
  {
    key: 'daily_fiber',
    name: 'Fibres',
    unit: 'g',
    category: 'nutrition',
    direction: 'higher',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      if (!logs.length) return null;
      return Math.round(logs.reduce((sum, n) => sum + (n.fiber || 0), 0) * 10) / 10;
    },
  },
  {
    key: 'protein_per_kg',
    name: 'Protéines / kg',
    unit: 'g/kg',
    category: 'nutrition',
    direction: 'higher',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      const bc = getBodyCompForDate(store, date);
      if (!logs.length || !bc?.weight) return null;
      const totalP = logs.reduce((sum, n) => sum + (n.protein || 0), 0);
      return Math.round((totalP / bc.weight) * 100) / 100;
    },
  },
  {
    key: 'water_intake',
    name: 'Eau consommée',
    unit: 'L',
    category: 'nutrition',
    direction: 'higher',
    compute: (store, date) => {
      const logs = getNutritionForDate(store, date);
      if (!logs.length) return null;
      return logs.reduce((sum, n) => sum + (n.waterL || 0), 0);
    },
  },

  // ── Sleep ──
  {
    key: 'sleep_hours',
    name: 'Heures de sommeil',
    unit: 'h',
    category: 'sleep',
    direction: 'higher',
    compute: (store, date) => getSleepForDate(store, date)?.hoursSlept ?? null,
  },
  {
    key: 'sleep_quality',
    name: 'Qualité sommeil',
    unit: '/10',
    category: 'sleep',
    direction: 'higher',
    compute: (store, date) => getSleepForDate(store, date)?.sleepQualityScore ?? null,
  },
  {
    key: 'sleep_latency',
    name: 'Latence endormissement',
    unit: 'min',
    category: 'sleep',
    direction: 'lower',
    compute: (store, date) => getSleepForDate(store, date)?.latencyMin ?? null,
  },

  // ── Recovery ──
  {
    key: 'recovery_score',
    name: 'Score récupération',
    unit: '/100',
    category: 'recovery',
    direction: 'higher',
    compute: (store, date) => getRecoveryForDate(store, date)?.score ?? null,
  },
  {
    key: 'soreness_level',
    name: 'Courbatures',
    unit: '/10',
    category: 'recovery',
    direction: 'lower',
    compute: (store, date) => getRecoveryForDate(store, date)?.sorenessLevel ?? null,
  },
  {
    key: 'energy_level',
    name: 'Niveau d\'énergie',
    unit: '/10',
    category: 'recovery',
    direction: 'higher',
    compute: (store, date) => getRecoveryForDate(store, date)?.energyLevel ?? null,
  },
  {
    key: 'stress_level',
    name: 'Niveau de stress',
    unit: '/10',
    category: 'recovery',
    direction: 'lower',
    compute: (store, date) => getRecoveryForDate(store, date)?.stressLevel ?? null,
  },

  // ── Habits ──
  {
    key: 'habits_completed',
    name: 'Habitudes complétées',
    unit: '',
    category: 'habits',
    direction: 'higher',
    compute: (store, date) => {
      const dk = dayKey(date);
      const completions = store.habitCompletions || {};
      const dayCompletions = completions[dk] || {};
      return Object.values(dayCompletions).filter(Boolean).length;
    },
  },
  {
    key: 'habits_completion_rate',
    name: 'Taux habitudes',
    unit: '%',
    category: 'habits',
    direction: 'higher',
    compute: (store, date) => {
      const dk = dayKey(date);
      const completions = store.habitCompletions || {};
      const dayCompletions = completions[dk] || {};
      const total = Object.keys(dayCompletions).length;
      if (!total) return null;
      const done = Object.values(dayCompletions).filter(Boolean).length;
      return Math.round((done / total) * 10000) / 100;
    },
  },

  // ── Discipline ──
  {
    key: 'discipline_overall',
    name: 'Score discipline global',
    unit: '/100',
    category: 'discipline',
    direction: 'higher',
    // This one is computed by the discipline engine, not from healthStore directly
    compute: () => null, // populated by discipline system
  },
  {
    key: 'discipline_timing',
    name: 'Discipline — Ponctualité',
    unit: '/100',
    category: 'discipline',
    direction: 'higher',
    compute: () => null,
  },
  {
    key: 'discipline_completion',
    name: 'Discipline — Complétion',
    unit: '/100',
    category: 'discipline',
    direction: 'higher',
    compute: () => null,
  },
];

/**
 * Get a library KPI definition by key.
 */
export function getKpiDefinition(key) {
  return KPI_LIBRARY.find((k) => k.key === key) || null;
}

/**
 * Get all KPIs for a category.
 */
export function getKpisByCategory(category) {
  return KPI_LIBRARY.filter((k) => k.category === category);
}

/**
 * Auto-compute a library KPI value for a date.
 * @param {string} kpiKey
 * @param {object} healthStore — the Zustand healthStore state
 * @param {string|Date} date
 * @returns {number|null}
 */
export function computeKpiValue(kpiKey, healthStore, date) {
  const def = getKpiDefinition(kpiKey);
  if (!def?.compute) return null;
  return def.compute(healthStore, date);
}
