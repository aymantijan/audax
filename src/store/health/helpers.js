// Shared helpers of healthStore.js (moved verbatim, F3).
import { useHabitStore } from '../habitStore';
import { metricInfo as metricDef } from '../../utils/metric-engine';

export const numOrNull = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

// Legacy goal ({type:'weight'|'strength'|'sleep'|'bodyfat'|'workoutFrequency'})
// → unified shape {metric, target, start}. Already-unified goals pass through.
export function normalizeGoal(g) {
  if (g.metric) return g;
  const legacy = {
    weight: { metric: { key: 'body_weight' }, target: g.targetKg, start: g.startWeightKg ?? null },
    strength: { metric: { key: 'max_weight_lifted', exercise: g.exercise || '' }, target: g.targetKg, start: null },
    sleep: { metric: { key: 'sleep_quality' }, target: g.targetScore, start: null },
    bodyfat: { metric: { key: 'body_fat_pct' }, target: g.targetBodyFatPct, start: g.startBodyFatPct ?? null },
    workoutFrequency: { metric: { key: 'workout_frequency' }, target: g.targetPerWeek, start: null },
  }[g.type] || { metric: { key: 'manual' }, target: null, start: null };
  return { priority: 'medium', manualValues: [], ...g, ...legacy, target: numOrNull(legacy.target), start: legacy.start != null ? Number(legacy.start) : null };
}

export function goalDirection(g) {
  if (g.direction) return g.direction;
  if (g.start != null && g.target != null && g.target !== g.start) return g.target < g.start ? 'lower' : 'higher';
  return metricDef(g.metric?.key)?.dir || 'higher';
}
// Old curated/generated program system removed (2026-09-08) — replaced by
// Supabase-backed programStore.js (see src/store/programStore.js).

export const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });
export const dayMs = 86400000;
export const r1 = (n) => Math.round(n * 10) / 10;
export const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// (Old curated program helpers — resolvePhaseKey, getSessionRotation,
// mergeWeeklyStructureOverride, applyProgramOverrides — removed 2026-09-08.
// Programmes are now fully managed via Supabase in programStore.js.)

// Habit → Health activity link types (see utils/constants.js#HEALTH_LINK_TYPES).
// Each maps to the skill(s) awarded when the resulting Health entry is logged.
export const HEALTH_LINK_SKILLS = {
  cardio: { skill: 'aerobic-capacity-lv1', xp: 10 },
  strength: { skill: 'strength-training-lv1', xp: 20 },
  recovery: { skill: 'health-discipline-lv1', xp: 10 },
  mindfulness: { skill: 'stress-management-lv1', xp: 10 },
  nutrition: { skill: 'nutrition-discipline-lv1', xp: 5 },
  sleep: { skill: 'sleep-optimization-lv1', xp: 10 },
  reflection: { skill: 'health-discipline-lv1', xp: 5 },
};

export const BADGE_DEFS = [
  { id: 'first-session', name: 'Première séance', tier: 'bronze', check: (s) => s.workouts.length >= 1 },
  { id: 'body-comp-tracker', name: 'Suivi corporel', tier: 'bronze', check: (s) => s.bodyComp.length >= 10 },
  { id: 'cardio-king', name: 'Roi du cardio', tier: 'silver', check: (s) => s.workouts.filter((w) => w.type === 'cardio').length >= 20 },
  { id: 'iron', name: 'Fonte', tier: 'silver', check: (s) => s.workouts.filter((w) => w.type === 'strength').length >= 20 },
  { id: 'deadlift-king', name: 'Roi du soulevé de terre', tier: 'gold', check: (s) => s.workouts.some((w) => w.exercise && /deadlift/i.test(w.exercise) && Number(w.weight) >= 140) },
  { id: 'sleep-champion', name: 'Champion du sommeil', tier: 'silver', check: (s) => {
      const logs = useHabitStore.getState().energyLogs;
      return logs.filter((l) => (l.sleepData?.sleepQualityScore ?? 0) >= 8).length >= 14;
    } },
  { id: 'protein-perfect', name: 'Protéines parfaites', tier: 'silver', check: (s) => s.nutritionLogs.filter((n) => n.proteinTargetMet).length >= 14 },
  { id: 'nutrition-consistent', name: 'Nutrition régulière', tier: 'silver', check: (s) => new Set(s.nutritionLogs.map((n) => n.date)).size >= 30 },
  { id: 'recovery-master', name: 'Maître de la récup', tier: 'silver', check: (s) => s.recoveryLogs.length >= 20 },
  { id: 'hydration-hero', name: 'Héros de l’hydratation', tier: 'silver', check: (s) => s.waterLogs.length >= 50 },
  { id: 'pr-hunter', name: 'Chasseur de records', tier: 'silver', check: (s) => s.getPRs().length >= 15 },
  { id: 'goal-crusher', name: 'Briseur d’objectifs', tier: 'silver', check: (s) => s.goals.some((g) => g.achieved) },
  { id: 'dedicated-30', name: 'Assidu ×30', tier: 'silver', check: (s) => s.workouts.length >= 30 },
  { id: 'century-club', name: 'Club des 100', tier: 'gold', check: (s) => s.workouts.length >= 100 },
];
