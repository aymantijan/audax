import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { estimateMacros, foodQualityScore } from '../utils/nutrition-db';
import { getFoodMicros } from '../utils/food-micronutrients';
import {
  computeReadiness, bodyFatNavyMale, bodyFatNavyFemale, computeWeightPrediction,
  checkOvertrainingTriggers, generateCoachRecommendation, pearsonCorrelation,
  bestSleepWindow, getSleepLoadTarget, computeCyclePhase, computeGoalProgress, estimate1RM,
  bodyFatYMCA, bodyFatDeurenberg, estimateFFMI, estimateLeanMassKg, smoothedTrend,
  estimateVO2max, cyclePhaseCoachingNote,
} from '../utils/health-science';
import { useSkillStore } from './skillStore';
import { useAuthStore } from './authStore';
import { useHabitStore } from './habitStore';
import { useTradingStore } from './tradingStore';
import { detectTiltSequences, detectRevengeTrades } from '../utils/trading-psychology';
import { useAccountingStore } from './accountingStore';
import { toast } from './uiStore';
import { generateTrainingProgram } from '../utils/training-program-generator';
import { getCuratedProgram, todayWeekdayKey } from '../utils/curated-programs';
import { generateNutritionPlan } from '../utils/nutrition-plan-generator';
import { foodsForBudget } from '../utils/morocco-food-budget';
import {
  predictStrengthTrajectory, detectPlateau, checkAggressiveDeficit,
  checkTrendingOvertrainingRisk, explainPlateau,
} from '../utils/health-predictions';
import {
  computeFastingWindows, computeHydrationGaps, computeMealTimingConsistency,
  computeSleepConsistency, computeNapImpact, deriveChronoAlerts,
} from '../utils/health-chrono';

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });
const dayMs = 86400000;
const r1 = (n) => Math.round(n * 10) / 10;
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// Which weeklyStructure key is "active" today — phaseA/phaseB switched by
// date, or the single `main` phase for a simpler curated program. Shared by
// every selector that needs "this week's real schedule" for a program.
function resolvePhaseKey(program) {
  const ws = program.weeklyStructure;
  if (ws.phaseA && ws.phaseB) return ws.phaseSwitchDate && todayKey() >= ws.phaseSwitchDate ? 'phaseB' : 'phaseA';
  return Object.keys(ws).find((k) => Array.isArray(ws[k]) && ws[k][0]?.day) || 'main';
}

// Ordered list of distinct training sessionKeys across the phase's week (rest
// days and cardio-only days excluded) — e.g. ['push1','pull1','legs1'] — the
// rotation getNextGymSession() advances through. Order follows the week's
// day order, not alphabetical, so "push before pull" stays intact.
function getSessionRotation(program, phaseKey) {
  const days = program.weeklyStructure[phaseKey] || [];
  const seen = new Set();
  const rotation = [];
  for (const d of days) {
    if (d.session && !seen.has(d.session)) { seen.add(d.session); rotation.push(d.session); }
  }
  return rotation;
}

// Habit → Health activity link types (see utils/constants.js#HEALTH_LINK_TYPES).
// Each maps to the skill(s) awarded when the resulting Health entry is logged.
const HEALTH_LINK_SKILLS = {
  cardio: { skill: 'aerobic-capacity-lv1', xp: 10 },
  strength: { skill: 'strength-training-lv1', xp: 20 },
  recovery: { skill: 'health-discipline-lv1', xp: 10 },
  mindfulness: { skill: 'stress-management-lv1', xp: 10 },
  nutrition: { skill: 'nutrition-discipline-lv1', xp: 5 },
  sleep: { skill: 'sleep-optimization-lv1', xp: 10 },
  reflection: { skill: 'health-discipline-lv1', xp: 5 },
};

const BADGE_DEFS = [
  { id: 'cardio-king', name: 'Cardio King', check: (s) => s.workouts.filter((w) => w.type === 'cardio').length >= 20 },
  { id: 'iron', name: 'Iron', check: (s) => s.workouts.filter((w) => w.type === 'strength').length >= 20 },
  { id: 'deadlift-king', name: 'Deadlift King', check: (s) => s.workouts.some((w) => w.exercise && /deadlift/i.test(w.exercise) && Number(w.weight) >= 140) },
  { id: 'sleep-champion', name: 'Sleep Champion', check: (s) => {
      const logs = useHabitStore.getState().energyLogs;
      return logs.filter((l) => (l.sleepData?.sleepQualityScore ?? 0) >= 8).length >= 14;
    } },
  { id: 'protein-perfect', name: 'Protein Perfect', check: (s) => s.nutritionLogs.filter((n) => n.proteinTargetMet).length >= 14 },
  { id: 'recovery-master', name: 'Recovery Master', check: (s) => s.recoveryLogs.length >= 20 },
];

export const useHealthStore = create(
  persist(
    (set, get) => ({
      workouts: [], // [{ id, date, type:'cardio'|'strength', exercise, sets:[{reps,weight,rpe,form}], durationMin, avgRpe, quality, notes }]
      nutritionLogs: [], // [{ id, date, name, grams, protein, carbs, fat, kcal, whole, proteinTargetMet }]
      proteinTargetG: 140, // daily protein target used for "target met" + Protein Perfect badge
      mealTemplates: [], // [{ id, name, items:[{name,grams}] }]
      bodyComp: [], // [{ id, date, weightKg, waistCm, neckCm, hipCm, heightCm, sex, absRating, bodyFatPct, bodyFatMethod, photo }]
      recoveryLogs: [], // [{ id, date, activities:['sleep8','meditation','stretching','cold','massage'] }]
      checkins: [], // [{ id, date, slot:'morning'|'postWorkout'|'afternoon'|'evening', energy, stress, note }]
      pendingPrompts: [], // [{ id, habitId, habitName, type, duration, createdAt }] — habit→Health "log it?" queue
      awardedBadges: [], // badge ids already toasted, so we don't re-fire every render
      coachCache: null, // { date, text, tone } — 1x/day
      cycleLogs: [], // [{ id, date, flow:'light'|'medium'|'heavy', symptoms:[...], notes }] — one per period start date
      goals: [], // [{ id, type:'weight'|'strength'|'sleep', targetKg?, exercise?, targetScore?, startWeightKg?, achieved, createdAt }]
      reminders: {
        enabled: false, lastMorningReminderDate: null, lastWorkoutReminderDate: null,
        lastWaterReminderAt: null, lastMealReminderKey: null, lastBedtimeReminderDate: null,
      },
      weightUnit: 'kg', // 'kg' | 'lb' — display/input preference only; all workout/body-comp data is stored in kg
      setWeightUnit: (unit) => set({ weightUnit: unit === 'lb' ? 'lb' : 'kg' }),

      // ─────────── Health profile (questionnaire-driven) ───────────
      healthProfile: {
        version: 1,
        // sex/dobYear/heightCm moved to authStore.user (global profile, reused
        // across the whole app) — read via useAuthStore.getState().user.*.
        experienceLevel: null, trainingGoal: null, daysPerWeek: null, sessionLengthMin: null,
        equipmentAccess: [], injuries: [],
        activityLevel: null, dietGoal: null, budgetTier: null, dietaryRestrictions: [], mealsPerDay: null,
        cycleTrackingEnabled: null, maleTrackingEnabled: null,
        reminderPrefs: { weighInTime: null, mealWindows: [], waterReminderGapMin: 180, bedtimeTarget: null },
        completedAt: null, lastRecomputedAt: null,
      },
      setHealthProfile: (partial) => set({ healthProfile: { ...get().healthProfile, ...partial, lastRecomputedAt: Date.now() } }),
      completeHealthProfile: (data) => {
        set({ healthProfile: { ...get().healthProfile, ...data, completedAt: Date.now(), lastRecomputedAt: Date.now() } });
        useSkillStore.getState().awardXP('health-discipline-lv1', 10, 'health profile completed');
        toast('Profil santé enregistré', 'success');
      },
      resetHealthProfile: () => set({
        healthProfile: {
          version: 1,
          experienceLevel: null, trainingGoal: null, daysPerWeek: null, sessionLengthMin: null,
          equipmentAccess: [], injuries: [],
          activityLevel: null, dietGoal: null, budgetTier: null, dietaryRestrictions: [], mealsPerDay: null,
          cycleTrackingEnabled: null, maleTrackingEnabled: null,
          reminderPrefs: { weighInTime: null, mealWindows: [], waterReminderGapMin: 180, bedtimeTarget: null },
          completedAt: null, lastRecomputedAt: null,
        },
      }),

      // ─────────── Training programs (generated) ───────────
      trainingPrograms: [], // history of generated programs; one active:true at a time
      generateProgram: (overrides) => {
        const globalUser = useAuthStore.getState().user;
        const profile = { ...get().healthProfile, sex: globalUser?.gender ?? null, ...overrides };
        const program = generateTrainingProgram(profile);
        set({ trainingPrograms: [...get().trainingPrograms.map((p) => ({ ...p, active: false })), program], activeCuratedProgramId: null });
        toast('Programme d\'entraînement généré', 'success');
        return program;
      },
      setActiveProgram: (id) => set({ trainingPrograms: get().trainingPrograms.map((p) => ({ ...p, active: p.id === id })), activeCuratedProgramId: null }),
      deleteProgram: (id) => set({ trainingPrograms: get().trainingPrograms.filter((p) => p.id !== id) }),
      getActiveProgram: () => get().trainingPrograms.find((p) => p.active) || null,

      // % of the active program's current-week planned exercises actually
      // logged (matched by lowercased name, same technique as getPRs), over
      // the program's elapsed weeks.
      getProgramAdherence: () => {
        const program = get().getActiveProgram();
        if (!program) return null;
        const startDate = new Date(program.generatedAt);
        const weeksElapsed = Math.min(program.weeks, Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (7 * dayMs))));
        const plannedNames = new Set(program.weeklyPlan.flatMap((d) => d.exercises.map((e) => e.name.toLowerCase())));
        const loggedNames = new Set(
          get().workouts
            .filter((w) => new Date(w.date).getTime() >= startDate.getTime())
            .map((w) => w.exercise?.trim().toLowerCase())
            .filter(Boolean)
        );
        let matched = 0;
        for (const n of plannedNames) if (loggedNames.has(n)) matched++;
        const pct = plannedNames.size ? r1((matched / plannedNames.size) * 100) : null;
        return { weeksElapsed, totalWeeks: program.weeks, plannedCount: plannedNames.size, matchedCount: matched, percent: pct };
      },

      // Which weeklyPlan day is "next up" — cycles through the split by
      // counting distinct strength sessions logged since the program was
      // generated (not tied to calendar weekday, since a missed/extra day
      // shouldn't permanently desync the rotation).
      getNextPlannedDay: () => {
        const program = get().getActiveProgram();
        if (!program?.weeklyPlan?.length) return null;
        const sessionsLogged = new Set(
          get().workouts
            .filter((w) => w.type === 'strength' && w.createdAt >= program.generatedAt)
            .map((w) => w.sessionId || w.id)
        ).size;
        return program.weeklyPlan[sessionsLogged % program.weeklyPlan.length];
      },

      // ─────────── Curated programs (given, read-only) + user variants ───────────
      // Curated programs (see utils/curated-programs/) are hand-authored/
      // imported content, never mutated at runtime — activating one just
      // records its id here. A user who wants to change an exercise saves a
      // *variant* (below) instead of editing the curated data itself.
      activeCuratedProgramId: null,
      setActiveCuratedProgram: (id) => {
        set({ activeCuratedProgramId: id, trainingPrograms: get().trainingPrograms.map((p) => ({ ...p, active: false })), curatedSessionProgress: {} });
        toast(id ? 'Programme activé' : 'Programme désactivé', 'success');
      },
      getActiveCuratedProgram: () => (get().activeCuratedProgramId ? getCuratedProgram(get().activeCuratedProgramId) : null),

      // { [curatedProgramId]: { lastSessionKey, lastCompletedAt } } — tracks
      // rotation position independently of the calendar. A missed day
      // shouldn't strand the user without a prescribed session: "next" means
      // "the one after whatever I actually last did", not "whatever today's
      // weekday happens to map to".
      curatedSessionProgress: {},
      markCuratedSessionDone: (programId, sessionKey) => {
        set({ curatedSessionProgress: { ...get().curatedSessionProgress, [programId]: { lastSessionKey: sessionKey, lastCompletedAt: Date.now() } } });
      },
      // The next gym session to do in the active program's rotation — advances
      // from the last COMPLETED session (see markCuratedSessionDone), not from
      // today's calendar weekday, so skipping/rescheduling a day never leaves
      // the user without a prescribed session or skips one in the rotation.
      // Brand new activation (nothing completed yet) starts from today's
      // calendar slot if one exists, else the first session in the rotation.
      getNextGymSession: () => {
        const program = get().getActiveCuratedProgram();
        if (!program) return null;
        const phaseKey = resolvePhaseKey(program);
        const rotation = getSessionRotation(program, phaseKey);
        if (!rotation.length) return null;
        const progress = get().curatedSessionProgress[program.id];
        let sessionKey;
        if (!progress) {
          const days = program.weeklyStructure[phaseKey] || [];
          const todayEntry = days.find((d) => d.day === todayWeekdayKey());
          sessionKey = todayEntry?.session || rotation[0];
        } else {
          const idx = rotation.indexOf(progress.lastSessionKey);
          sessionKey = rotation[(idx + 1 + rotation.length) % rotation.length];
        }
        const effective = get().getEffectiveExercises(program.id, sessionKey);
        if (!effective) return null;
        return { sessionKey, session: effective, phaseKey };
      },

      // [{id, curatedProgramId, sessionKey, label, exercises:[{name,setsReps,rest,note}], active, createdAt}]
      // One active variant at most per (curatedProgramId, sessionKey) pair —
      // saving a new one deactivates any prior variant for that same session.
      programVariants: [],
      saveProgramVariant: (curatedProgramId, sessionKey, exercises, label) => {
        const variant = {
          id: uid(), curatedProgramId, sessionKey,
          label: label || `Variante — ${todayKey()}`,
          exercises, active: true, createdAt: Date.now(),
        };
        set({
          programVariants: [
            ...get().programVariants.map((v) => (v.curatedProgramId === curatedProgramId && v.sessionKey === sessionKey ? { ...v, active: false } : v)),
            variant,
          ],
        });
        toast('Variante enregistrée et activée', 'success');
        return variant;
      },
      setVariantActive: (id, isActive) => {
        const target = get().programVariants.find((v) => v.id === id);
        if (!target) return;
        set({
          programVariants: get().programVariants.map((v) => {
            if (v.id === id) return { ...v, active: isActive };
            if (isActive && v.curatedProgramId === target.curatedProgramId && v.sessionKey === target.sessionKey) return { ...v, active: false };
            return v;
          }),
        });
      },
      deleteVariant: (id) => set({ programVariants: get().programVariants.filter((v) => v.id !== id) }),

      // The exercises actually to be performed for a session: the active
      // variant's if one exists, otherwise the curated original — the
      // original is NEVER mutated, so "revert to original" is just
      // deactivating the variant.
      getEffectiveExercises: (curatedProgramId, sessionKey) => {
        const program = getCuratedProgram(curatedProgramId);
        const original = program?.sessions?.[sessionKey];
        if (!original) return null;
        const variant = get().programVariants.find((v) => v.curatedProgramId === curatedProgramId && v.sessionKey === sessionKey && v.active);
        return { label: original.label, exercises: variant?.exercises || original.exercises, isVariant: !!variant, variantId: variant?.id || null };
      },

      // Picks phaseA/phaseB (by phaseSwitchDate) or `main` automatically, and
      // returns today's weeklyStructure entry + its effective session — the
      // single source WorkoutLogging's "planned session" banner reads from
      // when a curated program (rather than a generated one) is active.
      getTodayCuratedSession: () => {
        const program = get().getActiveCuratedProgram();
        if (!program) return null;
        const phaseKey = resolvePhaseKey(program);
        const days = program.weeklyStructure[phaseKey];
        if (!days) return null;
        const dayEntry = days.find((d) => d.day === todayWeekdayKey());
        if (!dayEntry?.session) return { dayEntry, session: null, phaseKey };
        const effective = get().getEffectiveExercises(program.id, dayEntry.session);
        return { dayEntry, session: effective, phaseKey };
      },

      // % of the active curated program's weekly planned exercises (across
      // every session in the current phase) logged in the last 7 days — same
      // spirit as getProgramAdherence but scoped to a repeating weekly cycle
      // instead of a fixed program start date, since curated sessions repeat
      // every week rather than progressing through numbered weeks.
      getCuratedProgramAdherence: () => {
        const program = get().getActiveCuratedProgram();
        if (!program) return null;
        const days = program.weeklyStructure[resolvePhaseKey(program)];
        const sessionKeys = [...new Set((days || []).map((d) => d.session).filter(Boolean))];
        const plannedNames = new Set();
        for (const key of sessionKeys) {
          const eff = get().getEffectiveExercises(program.id, key);
          eff?.exercises.forEach((e) => plannedNames.add(e.name.toLowerCase()));
        }
        const weekAgo = Date.now() - 7 * dayMs;
        const loggedNames = new Set(get().workouts.filter((w) => w.createdAt >= weekAgo).map((w) => w.exercise?.trim().toLowerCase()).filter(Boolean));
        let matched = 0;
        for (const n of plannedNames) if (loggedNames.has(n)) matched++;
        return { plannedCount: plannedNames.size, matchedCount: matched, percent: plannedNames.size ? r1((matched / plannedNames.size) * 100) : null };
      },

      // Connects the active program's stated objective (e.g. "maintenir 15%
      // bodyfat") to what the user has actually been doing over the last 14
      // days — nutrition-plan adherence (protein target hit rate, avg kcal
      // vs. target) and body-comp trend — rather than the objective sitting
      // as static text nothing else reads. Returns null pieces (not zeros)
      // when there isn't enough data yet, so the UI can say "pas assez de
      // données" instead of showing a misleading 0%.
      getProgramProgressionSummary: () => {
        const program = get().getActiveCuratedProgram();
        if (!program) return null;
        const cutoffKey = todayKey(new Date(Date.now() - 14 * dayMs));

        const plan = get().getActiveNutritionPlan();
        const recentNutrition = get().nutritionLogs.filter((n) => n.date >= cutoffKey);
        const loggedDays = [...new Set(recentNutrition.map((n) => n.date))];
        let nutritionAdherence = null;
        if (plan && loggedDays.length) {
          const kcalByDay = {};
          const proteinMetDays = new Set();
          for (const n of recentNutrition) {
            kcalByDay[n.date] = (kcalByDay[n.date] || 0) + n.kcal;
            if (n.proteinTargetMet) proteinMetDays.add(n.date);
          }
          const avgKcal = Object.values(kcalByDay).reduce((a, v) => a + v, 0) / loggedDays.length;
          nutritionAdherence = {
            daysLogged: loggedDays.length,
            proteinMetPercent: r1((proteinMetDays.size / loggedDays.length) * 100),
            avgKcal: Math.round(avgKcal),
            targetKcal: plan.targetKcal,
          };
        }

        const recentBodyComp = get().bodyComp.filter((b) => b.date >= cutoffKey).sort((a, b) => (a.date < b.date ? -1 : 1));
        let weightTrend = null;
        if (recentBodyComp.length >= 2) {
          const deltaKg = recentBodyComp[recentBodyComp.length - 1].weightKg - recentBodyComp[0].weightKg;
          weightTrend = { deltaKg: r1(deltaKg), entriesLogged: recentBodyComp.length };
        }

        return { objective: program.objective, nutritionAdherence, weightTrend };
      },

      // ─────────── Program schedule (onboarding-generated, per active curated program) ───────────
      // {curatedProgramId, generatedAt, phaseKey, freeWindows, sleepWindow,
      //  mealsPerDay, days: {...program-schedule-generator.js output...},
      //  calendarEventIds: {'lundi-training': {eventId,htmlLink}, ...}}
      programSchedule: null,
      saveProgramSchedule: (schedule) => set({ programSchedule: schedule }),
      // Merges one calendar-push result into the existing schedule — called
      // incrementally (per event, not once at the end) so a token expiry or
      // network blip mid-push never loses an already-created event's id.
      mergeScheduleCalendarResult: (result) => {
        const current = get().programSchedule;
        if (!current) return;
        const key = `${result.day}-${result.blockType}`;
        set({ programSchedule: { ...current, calendarEventIds: { ...current.calendarEventIds, [key]: result } } });
      },
      updateScheduleDayBlock: (day, blockType, patch) => {
        const current = get().programSchedule;
        if (!current) return;
        set({
          programSchedule: {
            ...current,
            days: { ...current.days, [day]: { ...current.days[day], [blockType]: { ...current.days[day][blockType], ...patch } } },
          },
        });
      },
      clearProgramSchedule: () => set({ programSchedule: null }),

      // Read-only recap for onboarding Step "Où tu en es" — reuses data
      // already tracked, never re-asks what's already known.
      getOnboardingRecap: () => {
        const latestBodyComp = [...get().bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const prs = get().getPRs();
        const readiness = get().getReadiness();
        return {
          weightKg: latestBodyComp?.weightKg ?? null,
          weightDate: latestBodyComp?.date ?? null,
          topPRs: prs.slice(0, 3),
          readinessScore: readiness.score,
          readinessBreakdown: readiness.breakdown,
        };
      },

      // ─────────── Nutrition plans (generated) ───────────
      nutritionPlans: [],
      generatePlan: (overrides) => {
        const latestBodyComp = [...get().bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const profile = get().healthProfile;
        const globalUser = useAuthStore.getState().user;
        const age = globalUser?.dobYear ? new Date().getFullYear() - globalUser.dobYear : null;
        const cyclePhase = globalUser?.gender === 'female' ? get().getCyclePhase()?.phase : null;
        const plan = generateNutritionPlan({
          weightKg: latestBodyComp?.weightKg ?? overrides?.weightKg,
          heightCm: globalUser?.heightCm ?? overrides?.heightCm,
          age, sex: globalUser?.gender ?? null,
          activityLevel: profile.activityLevel, dietGoal: profile.dietGoal,
          budgetTier: profile.budgetTier, dietaryRestrictions: profile.dietaryRestrictions,
          mealsPerDay: profile.mealsPerDay, cyclePhase, dislikedFoods: profile.dislikedFoods,
          ...overrides,
        });
        if (plan.error) { toast('Complète ton profil (poids, taille, année de naissance dans Réglages) pour générer un plan nutritionnel.', 'warning'); return plan; }
        set({ nutritionPlans: [...get().nutritionPlans.map((p) => ({ ...p, active: false })), plan], proteinTargetG: plan.targetMacros.proteinG });
        toast('Plan nutritionnel généré', 'success');
        return plan;
      },
      setActiveNutritionPlan: (id) => set({ nutritionPlans: get().nutritionPlans.map((p) => ({ ...p, active: p.id === id })) }),
      deleteNutritionPlan: (id) => set({ nutritionPlans: get().nutritionPlans.filter((p) => p.id !== id) }),
      getActiveNutritionPlan: () => get().nutritionPlans.find((p) => p.active) || null,
      logPlanMeal: (mealSlot, date) => {
        const plan = get().getActiveNutritionPlan();
        const meal = plan?.sampleMeals.find((m) => m.mealSlot === mealSlot);
        if (!meal) return;
        for (const item of meal.items) {
          // Attach real micros for curated Morocco-list foods (food-micronutrients.js)
          // on top of the normal FOOD_DB macro estimate — otherwise a plan-sourced
          // meal would silently count toward macros but never toward the daily
          // micronutrient summary, unlike a barcode-scanned one.
          const micros = getFoodMicros(item.name, item.grams);
          const est = micros ? { ...estimateMacros(item.name, item.grams, item.unit || 'g'), micros } : undefined;
          get().logMeal(item.name, item.grams, item.unit || 'g', undefined, date, undefined, est);
        }
      },
      // Alternatives for a plan item, filtered to the user's budget tier and
      // never above it (cheaper tiers always allowed) — for the "remplacer"
      // button when a proposed food isn't available to the user.
      getSwapOptionsForItem: (item) => {
        if (!item?.category) return [];
        const { budgetTier, dislikedFoods } = get().healthProfile;
        const disliked = new Set(dislikedFoods || []);
        return foodsForBudget(budgetTier || 'moderate', item.category).filter((f) => f.name !== item.name && !disliked.has(f.name));
      },
      // Replaces a plan item's food, re-portioning grams so the new food hits
      // the same macro target (protein g for protein items, etc.) the
      // original portion was providing — reuses estimateMacros(), no new
      // macro-calc logic.
      swapPlanMealItem: (planId, mealSlot, itemIndex, newFoodName) => {
        const plans = get().nutritionPlans;
        const plan = plans.find((p) => p.id === planId);
        const meal = plan?.sampleMeals.find((m) => m.mealSlot === mealSlot);
        const item = meal?.items[itemIndex];
        if (!item) return;
        const MACRO_BY_CATEGORY = { protein: 'protein', carb: 'carbs', fat: 'fat' };
        const macroKey = MACRO_BY_CATEGORY[item.category];
        let newGrams = item.grams;
        if (macroKey) {
          const original = estimateMacros(item.name, item.grams, item.unit || 'g');
          const per100 = estimateMacros(newFoodName, 100, 'g');
          if (original?.[macroKey] && per100?.[macroKey]) {
            // 220g caps a single-item portion at something a person would
            // actually eat — mirrors REALISTIC_MAX_G in nutrition-plan-generator.js.
            newGrams = Math.max(20, Math.min(220, Math.round((original[macroKey] / per100[macroKey]) * 100)));
          }
        }
        set({
          nutritionPlans: plans.map((p) => p.id !== planId ? p : {
            ...p,
            sampleMeals: p.sampleMeals.map((m) => m.mealSlot !== mealSlot ? m : {
              ...m,
              items: m.items.map((it, i) => i !== itemIndex ? it : { ...it, name: newFoodName, grams: newGrams }),
            }),
          }),
        });
      },

      // ─────────── Habit → Health integration ───────────
      // Called by habitStore.toggleHabit when a habit with a `healthLink` is
      // marked complete. Queues a one-tap "log it in Health" prompt.
      queueHabitPrompt: (habit) => {
        if (!habit?.healthLink || !HEALTH_LINK_SKILLS[habit.healthLink]) return;
        if (get().pendingPrompts.some((p) => p.habitId === habit.id && p.date === todayKey())) return; // already queued today
        set({
          pendingPrompts: [
            ...get().pendingPrompts,
            { id: uid(), habitId: habit.id, habitName: habit.name, type: habit.healthLink, duration: habit.duration || 15, date: todayKey(), createdAt: Date.now() },
          ],
        });
      },
      dismissPrompt: (id) => set({ pendingPrompts: get().pendingPrompts.filter((p) => p.id !== id) }),

      // ─────────── Workouts ───────────
      // type: 'cardio' | 'strength' | 'sport'. `category`/`sessionType` are
      // optional richer metadata (e.g. category:'cardio', sessionType:'zone2')
      // layered on top of the original type/exercise/sets shape so every
      // existing selector (getPRs, getEstimated1RMs, getWorkoutVolumeSeries,
      // getExerciseLibrary, correlations — all keyed on `type`/`exercise`/`sets`)
      // keeps working unchanged for cardio/strength entries logged either way.
      logWorkout: (data, fulfillsPromptId) => {
        let newPR = null;
        if (data.type === 'strength' && data.exercise && data.sets?.length) {
          const key = data.exercise.trim().toLowerCase();
          const priorBest = Math.max(0, ...get().workouts.filter((w) => w.type === 'strength' && w.exercise?.trim().toLowerCase() === key).flatMap((w) => (w.sets || []).map((s) => Number(s.weight) || 0)));
          const maxW = Math.max(0, ...data.sets.map((s) => Number(s.weight) || 0));
          if (priorBest && maxW > priorBest) newPR = { exercise: data.exercise, weight: maxW };
        }
        const w = {
          id: uid(),
          date: data.date || todayKey(),
          type: data.type, // 'cardio' | 'strength' | 'sport'
          category: data.category || data.type,
          sessionType: data.sessionType || null,
          sessionId: data.sessionId || null,
          exercise: data.exercise || '',
          durationMin: Number(data.durationMin) || 0,
          sets: data.sets || [],
          avgRpe: data.sets?.length ? Number((data.sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / data.sets.length).toFixed(1)) : Number(data.avgRpe) || null,
          quality: Number(data.quality) || null,
          notes: data.notes || '',
          createdAt: Date.now(),
        };
        set({ workouts: [...get().workouts, w] });
        const award = useSkillStore.getState().awardXP;
        const link = HEALTH_LINK_SKILLS[data.type === 'strength' ? 'strength' : 'cardio']; // sport reuses the cardio/aerobic link
        award(link.skill, link.xp, `workout: ${w.exercise || w.type}`);
        award('health-discipline-lv1', 5, `workout logged: ${w.exercise || w.type}`);
        if (w.quality >= 8 && w.type === 'strength') award('form-mastery-lv1', 5, `great form: ${w.exercise}`);
        if (fulfillsPromptId) get().dismissPrompt(fulfillsPromptId);
        get().checkBadges();
        toast(`Workout logged: ${w.exercise || w.type}`, 'success');
        if (newPR) toast(`🏆 New PR: ${newPR.exercise} — ${newPR.weight}kg!`, 'success');
      },

      // A gym session = several exercises picked from the library, each with
      // its own sets — logged as N individual `workouts` entries (so every
      // per-exercise selector above keeps working exactly as if each had been
      // logged separately) sharing one `sessionId` for grouped display, but
      // XP is awarded ONCE for the whole session, not once per exercise —
      // otherwise a 6-exercise session would be worth 6x a single-exercise log.
      logGymSession: (data, fulfillsPromptId) => {
        const sessionId = uid();
        const date = data.date || todayKey();
        const entries = (data.exercises || [])
          .filter((ex) => ex.exercise && (ex.sets || []).some((s) => s.reps || s.weight))
          .map((ex) => ({
            id: uid(),
            date,
            type: 'strength',
            category: 'gym',
            sessionType: data.sessionType || null,
            sessionId,
            exercise: ex.exercise,
            durationMin: 0,
            sets: ex.sets.filter((s) => s.reps || s.weight),
            avgRpe: ex.sets?.length ? Number((ex.sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / ex.sets.length).toFixed(1)) : null,
            quality: Number(data.quality) || null,
            notes: data.notes || '',
            createdAt: Date.now(),
          }));
        if (!entries.length) {
          toast('Add at least one exercise with a set before finishing the session.', 'warning');
          return;
        }
        // PR detection BEFORE inserting — only celebrates an exercise that
        // already had a prior best on file (an exercise's very first-ever
        // log isn't a "record", it's just a first log).
        const priorBest = {};
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          const key = w.exercise?.trim().toLowerCase();
          if (!key) continue;
          const maxW = Math.max(0, ...(w.sets || []).map((s) => Number(s.weight) || 0));
          if (!priorBest[key] || maxW > priorBest[key]) priorBest[key] = maxW;
        }
        const newPRs = [];
        for (const e of entries) {
          const key = e.exercise?.trim().toLowerCase();
          const maxW = Math.max(0, ...(e.sets || []).map((s) => Number(s.weight) || 0));
          if (key && priorBest[key] && maxW > priorBest[key]) newPRs.push({ exercise: e.exercise, weight: maxW });
        }

        set({ workouts: [...get().workouts, ...entries] });
        const award = useSkillStore.getState().awardXP;
        const link = HEALTH_LINK_SKILLS.strength;
        award(link.skill, link.xp, `gym session: ${entries.length} exercises`);
        award('health-discipline-lv1', 5, 'gym session logged');
        if (data.quality >= 8) award('form-mastery-lv1', 5, 'great gym session form');
        if (fulfillsPromptId) get().dismissPrompt(fulfillsPromptId);
        get().checkBadges();
        toast(`Session logged: ${entries.length} exercise${entries.length !== 1 ? 's' : ''}`, 'success');
        for (const pr of newPRs) toast(`🏆 New PR: ${pr.exercise} — ${pr.weight}kg!`, 'success');
      },

      deleteWorkout: (id) => set({ workouts: get().workouts.filter((w) => w.id !== id) }),
      deleteSession: (sessionId) => set({ workouts: get().workouts.filter((w) => w.sessionId !== sessionId) }),

      // Edits a standalone entry (cardio/sport, or a legacy pre-session-builder
      // strength log with no sessionId) in place. Deliberately does NOT touch
      // XP — that was already awarded at log time; re-awarding on every edit
      // would let someone farm XP by repeatedly tweaking quality/notes.
      editWorkout: (id, data) => {
        set({
          workouts: get().workouts.map((w) => {
            if (w.id !== id) return w;
            const sets = data.sets ?? w.sets;
            return {
              ...w,
              date: data.date || w.date,
              type: data.type || w.type,
              category: data.category ?? w.category,
              sessionType: data.sessionType ?? w.sessionType,
              exercise: data.exercise ?? w.exercise,
              durationMin: data.durationMin !== undefined ? Number(data.durationMin) || 0 : w.durationMin,
              sets,
              avgRpe: sets?.length ? Number((sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / sets.length).toFixed(1)) : w.avgRpe,
              quality: data.quality !== undefined ? Number(data.quality) || null : w.quality,
              notes: data.notes ?? w.notes,
            };
          }),
        });
        toast('Workout updated', 'success');
      },

      // Edits a gym session: replaces every `workouts` entry sharing this
      // sessionId with the new exercise/set list (simplest correct way to
      // reconcile exercises added/removed/reordered within the session,
      // rather than diffing). Same no-XP-on-edit rule as editWorkout above.
      editGymSession: (sessionId, data) => {
        const date = data.date || todayKey();
        const others = get().workouts.filter((w) => w.sessionId !== sessionId);
        const original = get().workouts.find((w) => w.sessionId === sessionId);
        const entries = (data.exercises || [])
          .filter((ex) => ex.exercise && (ex.sets || []).some((s) => s.reps || s.weight))
          .map((ex) => ({
            id: uid(),
            date,
            type: 'strength',
            category: 'gym',
            sessionType: data.sessionType || null,
            sessionId,
            exercise: ex.exercise,
            durationMin: 0,
            sets: ex.sets.filter((s) => s.reps || s.weight),
            avgRpe: ex.sets?.length ? Number((ex.sets.reduce((a, s) => a + (Number(s.rpe) || 0), 0) / ex.sets.length).toFixed(1)) : null,
            quality: data.quality !== undefined ? Number(data.quality) || null : original?.quality ?? null,
            notes: data.notes ?? original?.notes ?? '',
            createdAt: original?.createdAt ?? Date.now(),
          }));
        if (!entries.length) {
          toast('A session needs at least one exercise with a set.', 'warning');
          return;
        }
        set({ workouts: [...others, ...entries] });
        toast('Session updated', 'success');
      },

      // ─────────── Nutrition ───────────
      // `amount`/`unit`: unit is 'g' (amount = grams) or one of that food's
      // natural servings (e.g. amount=2, unit='egg') — see nutrition-db.js.
      // `override` (optional): a pre-computed macro/micro object from a
      // source outside FOOD_DB — e.g. an OpenFoodFacts barcode scan, already
      // portioned to the logged amount by the caller. Same shape estimateMacros()
      // returns (grams/protein/carbs/fat/kcal/whole), plus an optional `micros`
      // and `barcode`. When present, estimateMacros() (FOOD_DB lookup) is skipped.
      logMeal: (name, amount, unit = 'g', fulfillsPromptId, date, time, override) => {
        const est = override || estimateMacros(name, amount, unit);
        const entryDate = date || todayKey();
        const entry = {
          id: uid(),
          date: entryDate,
          time: time || nowHHMM(),
          name,
          amount: Number(amount) || (unit === 'g' ? 100 : 1),
          unit,
          grams: est?.grams ?? (unit === 'g' ? Number(amount) || 100 : null),
          protein: est?.protein ?? 0,
          carbs: est?.carbs ?? 0,
          fat: est?.fat ?? 0,
          kcal: est?.kcal ?? 0,
          whole: est?.whole ?? null,
          matched: !!est,
          micros: est?.micros || null,
          barcode: est?.barcode || null,
          createdAt: Date.now(),
        };
        // Backfill whether today's cumulative protein now meets the target.
        const todayTotal = get().nutritionLogs.filter((n) => n.date === entry.date).reduce((a, n) => a + n.protein, 0) + entry.protein;
        entry.proteinTargetMet = todayTotal >= get().proteinTargetG;
        set({ nutritionLogs: [...get().nutritionLogs, entry] });
        const award = useSkillStore.getState().awardXP;
        award('health-discipline-lv1', 2, `meal logged: ${name}`);
        if (entry.proteinTargetMet) award('nutrition-discipline-lv1', 5, 'protein target met');
        if (fulfillsPromptId) get().dismissPrompt(fulfillsPromptId);
        get().checkBadges();
        const dateNote = entryDate === todayKey() ? '' : ` for ${entryDate}`;
        toast(est ? `Logged ${name}${dateNote} (~${est.kcal} kcal)` : `Logged ${name}${dateNote} (unrecognized food — 0 macros, add manually)`, est ? 'success' : 'info');
        return entry;
      },
      deleteMeal: (id) => set({ nutritionLogs: get().nutritionLogs.filter((n) => n.id !== id) }),
      setProteinTarget: (g) => set({ proteinTargetG: Number(g) || 140 }),
      saveMealTemplate: (name, items) => set({ mealTemplates: [...get().mealTemplates, { id: uid(), name, items }] }),
      deleteMealTemplate: (id) => set({ mealTemplates: get().mealTemplates.filter((t) => t.id !== id) }),
      // `item.grams` (no unit/amount) is the legacy template shape from
      // before unit-based logging existed — treat it as a plain-grams entry
      // so old saved templates keep working unchanged.
      logMealTemplate: (templateId, date) => {
        const tpl = get().mealTemplates.find((t) => t.id === templateId);
        if (!tpl) return;
        for (const item of tpl.items) get().logMeal(item.name, item.amount ?? item.grams, item.unit ?? 'g', undefined, date);
      },

      // ─────────── Body composition ───────────
      logBodyComp: (data) => {
        const bodyFatPct =
          data.sex === 'female'
            ? bodyFatNavyFemale({ waistCm: data.waistCm, hipCm: data.hipCm, neckCm: data.neckCm, heightCm: data.heightCm })
            : bodyFatNavyMale({ waistCm: data.waistCm, neckCm: data.neckCm, heightCm: data.heightCm });
        const entryDate = data.date || todayKey();
        const entry = {
          id: uid(),
          date: entryDate,
          time: data.time || nowHHMM(),
          weightKg: Number(data.weightKg) || null,
          waistCm: Number(data.waistCm) || null,
          neckCm: Number(data.neckCm) || null,
          hipCm: Number(data.hipCm) || null,
          heightCm: Number(data.heightCm) || null,
          chestCm: data.chestCm ? Number(data.chestCm) : null,
          armCm: data.armCm ? Number(data.armCm) : null,
          thighCm: data.thighCm ? Number(data.thighCm) : null,
          calfCm: data.calfCm ? Number(data.calfCm) : null,
          ageYears: data.ageYears ? Number(data.ageYears) : null,
          sex: data.sex || 'male',
          absRating: data.absRating != null ? Number(data.absRating) : null,
          bodyFatPct: bodyFatPct ?? (data.visualBodyFatPct != null ? Number(data.visualBodyFatPct) : null),
          bodyFatMethod: bodyFatPct != null ? 'navy' : data.visualBodyFatPct != null ? 'visual' : null,
          photo: data.photo || null, // small base64 data URL, capped at ~1.5MB by the caller
          createdAt: Date.now(),
        };
        set({ bodyComp: [...get().bodyComp.filter((b) => b.date !== entry.date), entry] });
        useSkillStore.getState().awardXP('health-discipline-lv1', 3, 'body composition logged');
        toast(`Body composition logged${entryDate === todayKey() ? '' : ` for ${entryDate}`}`, 'success');
      },
      deleteBodyComp: (id) => set({ bodyComp: get().bodyComp.filter((b) => b.id !== id) }),

      // ─────────── Recovery activities ───────────
      customRecoveryActivities: [], // [{key, label}] — user-added, beyond the 5 built into RecoveryTracker.jsx
      addCustomRecoveryActivity: (label) => {
        const clean = (label || '').trim();
        if (!clean) return;
        const key = clean.toLowerCase().replace(/\s+/g, '-');
        if (get().customRecoveryActivities.some((a) => a.key === key)) return;
        set({ customRecoveryActivities: [...get().customRecoveryActivities, { key, label: clean }] });
      },
      removeCustomRecoveryActivity: (key) => set({ customRecoveryActivities: get().customRecoveryActivities.filter((a) => a.key !== key) }),

      // logRecovery preserves the day's already-logged water (waterMl) instead
      // of wiping it — the two are logged independently (activities via a
      // save button, water via quick-add) but share one per-day entry.
      logRecovery: (activities, fulfillsPromptId, date) => {
        const target = date || todayKey();
        const existing = get().recoveryLogs.find((r) => r.date === target);
        const entry = { id: existing?.id || uid(), date: target, activities, waterMl: existing?.waterMl || 0, createdAt: existing?.createdAt || Date.now() };
        set({ recoveryLogs: [...get().recoveryLogs.filter((r) => r.date !== target), entry] });
        useSkillStore.getState().awardXP('health-discipline-lv1', 5, 'recovery activities logged');
        if (fulfillsPromptId) get().dismissPrompt(fulfillsPromptId);
        get().checkBadges();
        toast(`Recovery logged${target === todayKey() ? '' : ` for ${target}`}`, 'success');
      },

      // ─────────── Water intake ───────────
      waterTargetMl: 2500,
      waterLogs: [], // [{id, date, time, amountMl}] — timestamped events, for chrono-hydration gap analysis; recoveryLogs.waterMl stays the derived daily total for existing UI
      setWaterTarget: (ml) => set({ waterTargetMl: Number(ml) || 2500 }),
      logWater: (ml, date) => {
        const target = date || todayKey();
        const existing = get().recoveryLogs.find((r) => r.date === target);
        const newTotal = Math.max(0, (existing?.waterMl || 0) + Number(ml));
        if (existing) {
          set({ recoveryLogs: get().recoveryLogs.map((r) => (r.id === existing.id ? { ...r, waterMl: newTotal } : r)) });
        } else {
          set({ recoveryLogs: [...get().recoveryLogs, { id: uid(), date: target, activities: [], waterMl: newTotal, createdAt: Date.now() }] });
        }
        // Only positive intake amounts become a timestamped event — a
        // negative adjustment (the Reset button) corrects the total, it
        // isn't a real hydration event to include in gap analysis.
        if (Number(ml) > 0) {
          set({ waterLogs: [...get().waterLogs, { id: uid(), date: target, time: nowHHMM(), amountMl: Number(ml) }] });
        }
      },
      // date param lets the Recovery tab's day-stepper read a past day's total; defaults to today for existing callers.
      getTodayWaterMl: (date) => get().recoveryLogs.find((r) => r.date === (date || todayKey()))?.waterMl || 0,

      // ─────────── Multi-slot energy/stress check-ins ───────────
      // Separate from habitStore's single daily energyLog (which still powers
      // burnout triggers + synergy score, untouched) — this is a finer-grained
      // additional layer: Morning / Post-workout / Afternoon / Evening.
      logCheckin: (slot, energy, stress, note = '', date) => {
        const entry = { id: uid(), date: date || todayKey(), slot, energy: Number(energy), stress: Number(stress), note, createdAt: Date.now() };
        set({ checkins: [...get().checkins.filter((c) => !(c.date === entry.date && c.slot === slot)), entry] });
      },

      // ─────────── Cycle tracking (optional) ───────────
      customCycleSymptoms: [], // user-added symptom tags, beyond the built-in list in CycleTracking.jsx
      addCustomSymptom: (name) => {
        const clean = (name || '').trim();
        if (!clean || get().customCycleSymptoms.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
        set({ customCycleSymptoms: [...get().customCycleSymptoms, clean] });
      },
      removeCustomSymptom: (name) => set({ customCycleSymptoms: get().customCycleSymptoms.filter((s) => s !== name) }),

      logCycleStart: (date, flow = 'medium', symptoms = [], notes = '') => {
        const entry = { id: uid(), date: date || todayKey(), flow, symptoms, notes, endDate: null, createdAt: Date.now() };
        set({ cycleLogs: [...get().cycleLogs.filter((c) => c.date !== entry.date), entry].sort((a, b) => (a.date < b.date ? -1 : 1)) });
        useSkillStore.getState().awardXP('health-discipline-lv1', 3, 'cycle logged');
        toast('Cycle entry logged', 'success');
      },
      // Sets an end date on the most recent OPEN (no endDate yet) cycle log —
      // period length is optional context, not required for phase estimation.
      markPeriodEnd: (id, endDate) =>
        set({ cycleLogs: get().cycleLogs.map((c) => (c.id === id ? { ...c, endDate: endDate || todayKey() } : c)) }),
      deleteCycleLog: (id) => set({ cycleLogs: get().cycleLogs.filter((c) => c.id !== id) }),
      getCyclePhase: () => computeCyclePhase(get().cycleLogs.map((c) => c.date), null, todayKey()),

      // Phase-aware coaching note + a training-load hint the active program
      // (if any) can be read against — informational only, never auto-alters
      // the stored program.
      getCyclePhaseCoaching: () => {
        const phase = get().getCyclePhase();
        if (!phase) return null;
        return { phase: phase.phase, ...cyclePhaseCoachingNote(phase.phase) };
      },

      // ─────────── Performance & Recovery (open to every account — lifestyle/
      // performance framing, explicitly non-medical: no hormonal/biomarker claims) ───────────
      performanceLogs: [], // [{id, date, restingHr, vitality, mobility, notes}]
      logPerformance: (data, date) => {
        const target = date || todayKey();
        const existing = get().performanceLogs.find((p) => p.date === target);
        const entry = {
          id: existing?.id || uid(), date: target,
          restingHr: data.restingHr != null && data.restingHr !== '' ? Number(data.restingHr) : existing?.restingHr ?? null,
          vitality: data.vitality != null && data.vitality !== '' ? Number(data.vitality) : existing?.vitality ?? null,
          mobility: data.mobility != null && data.mobility !== '' ? Number(data.mobility) : existing?.mobility ?? null,
          notes: data.notes ?? existing?.notes ?? '',
          createdAt: existing?.createdAt || Date.now(),
        };
        set({ performanceLogs: [...get().performanceLogs.filter((p) => p.date !== target), entry] });
        useSkillStore.getState().awardXP('health-discipline-lv1', 3, 'performance check-in logged');
        toast(`Performance loggée${target === todayKey() ? '' : ` pour ${target}`}`, 'success');
      },
      deletePerformance: (id) => set({ performanceLogs: get().performanceLogs.filter((p) => p.id !== id) }),

      // VO2max estimate (Uth–Sørensen–Overgaard–Pedersen) from the latest
      // logged resting HR + derived age — a fitness proxy, not a lab measurement.
      getVO2maxEstimate: () => {
        const latest = [...get().performanceLogs].filter((p) => p.restingHr).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const dobYear = useAuthStore.getState().user?.dobYear;
        const age = dobYear ? new Date().getFullYear() - dobYear : null;
        if (!latest || !age) return null;
        return { value: estimateVO2max({ age, restingHr: latest.restingHr }), date: latest.date, restingHr: latest.restingHr };
      },

      getPerformanceTrend: () =>
        [...get().performanceLogs].sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => ({ date: p.date.slice(5), restingHr: p.restingHr, vitality: p.vitality, mobility: p.mobility })),

      // ─────────── Health goals ───────────
      addGoal: (goal) => {
        const latestBodyComp = [...get().bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const entry = {
          id: uid(),
          type: goal.type,
          targetKg: goal.targetKg != null ? Number(goal.targetKg) : undefined,
          exercise: goal.exercise || undefined,
          targetScore: goal.targetScore != null ? Number(goal.targetScore) : undefined,
          targetBodyFatPct: goal.targetBodyFatPct != null ? Number(goal.targetBodyFatPct) : undefined,
          targetPerWeek: goal.targetPerWeek != null ? Number(goal.targetPerWeek) : undefined,
          startWeightKg: goal.type === 'weight' ? (latestBodyComp?.weightKg ?? null) : undefined,
          startBodyFatPct: goal.type === 'bodyfat' ? (latestBodyComp?.bodyFatPct ?? null) : undefined,
          targetDate: goal.targetDate || undefined,
          achieved: false,
          createdAt: Date.now(),
        };
        set({ goals: [...get().goals, entry] });
        toast('Goal added', 'success');
      },
      // Only the target value(s) + date are editable — type is fixed once
      // created (same reasoning as Trading account type: changing it after
      // the fact would make the stored start* baseline incoherent).
      editGoal: (id, updates) => set({ goals: get().goals.map((g) => (g.id === id ? { ...g, ...updates } : g)) }),
      deleteGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id) }),

      // Progress for every goal, computed from data the app already tracks
      // (body comp, PRs, sleep quality) — flags newly-achieved goals once.
      getGoalsWithProgress: () => {
        const bodyComp = [...get().bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1));
        const currentWeightKg = bodyComp[0]?.weightKg ?? null;
        const currentBodyFatPct = bodyComp[0]?.bodyFatPct ?? null;
        const currentPRs = get().getPRs();
        const sleepLogs = useHabitStore.getState().energyLogs;
        const prediction = get().getWeightPrediction();
        const weekAgo = Date.now() - 7 * dayMs;
        const workoutsPerWeek = get().workouts.filter((w) => new Date(w.date).getTime() >= weekAgo).length;

        const results = get().goals.map((g) => {
          const progress = computeGoalProgress(g, {
            startWeightKg: g.startWeightKg,
            currentWeightKg,
            currentPRs,
            sleepLogs,
            weeklyRateKg: prediction.weeklyRateKg.realistic,
            currentBodyFatPct,
            workoutsPerWeek,
          });
          return { ...g, ...progress };
        });

        const newlyAchieved = results.filter((g) => g.percent >= 100 && !g.achieved);
        if (newlyAchieved.length) {
          set({ goals: get().goals.map((g) => (newlyAchieved.some((n) => n.id === g.id) ? { ...g, achieved: true } : g)) });
          for (const g of newlyAchieved) toast(`🎯 Goal reached: ${g.label}`, 'success');
        }
        return results;
      },

      // ─────────── Reminders (browser notifications, local-only) ───────────
      setRemindersEnabled: (enabled) => set({ reminders: { ...get().reminders, enabled } }),
      markMorningReminderShown: () => set({ reminders: { ...get().reminders, lastMorningReminderDate: todayKey() } }),
      markWorkoutReminderShown: () => set({ reminders: { ...get().reminders, lastWorkoutReminderDate: todayKey() } }),
      markWaterReminderShown: () => set({ reminders: { ...get().reminders, lastWaterReminderAt: Date.now() } }),
      markMealReminderShown: (key) => set({ reminders: { ...get().reminders, lastMealReminderKey: key } }),
      markBedtimeReminderShown: () => set({ reminders: { ...get().reminders, lastBedtimeReminderDate: todayKey() } }),

      // ─────────── Badges ───────────
      checkBadges: () => {
        const state = get();
        const newlyAwarded = [];
        for (const b of BADGE_DEFS) {
          if (state.awardedBadges.includes(b.id)) continue;
          if (b.check(state)) newlyAwarded.push(b.id);
        }
        if (newlyAwarded.length) {
          set({ awardedBadges: [...state.awardedBadges, ...newlyAwarded] });
          for (const id of newlyAwarded) toast(`🏅 Badge earned: ${BADGE_DEFS.find((b) => b.id === id).name}`, 'success');
        }
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, earned: get().awardedBadges.includes(b.id) })),

      // ─────────── Derived / analytics selectors ───────────
      getTodayNutrition: () => {
        const today = todayKey();
        const entries = get().nutritionLogs.filter((n) => n.date === today);
        const totals = entries.reduce((a, n) => ({ protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat, kcal: a.kcal + n.kcal }), { protein: 0, carbs: 0, fat: 0, kcal: 0 });
        return { entries, totals, quality: foodQualityScore(entries), proteinTarget: get().proteinTargetG };
      },

      getReadiness: () => {
        const energyLogs = useHabitStore.getState().energyLogs;
        const today = todayKey();
        const todayLog = energyLogs.find((l) => l.date === today);
        const recovery = get().recoveryLogs.find((r) => r.date === today);
        // Streak = consecutive days with any Health activity logged (workout, nutrition, recovery, or check-in).
        let streak = 0;
        for (let i = 0; i < 60; i++) {
          const key = todayKey(new Date(Date.now() - i * dayMs));
          const active = get().workouts.some((w) => w.date === key) || get().nutritionLogs.some((n) => n.date === key) || get().recoveryLogs.some((r) => r.date === key);
          if (active) streak++;
          else break;
        }
        return computeReadiness({
          sleepQuality: todayLog?.sleepData?.sleepQualityScore ?? 5,
          energy: todayLog?.energyStartLevel ?? 5,
          stress: todayLog?.stressLevel ?? 5,
          recoveryCount: recovery?.activities?.length ?? 0,
          recoveryMax: 5,
          streak,
        });
      },

      getOvertrainingAlerts: () => checkOvertrainingTriggers({ energyLogs: useHabitStore.getState().energyLogs, workouts: get().workouts }),

      // Coach recommendation, cached once per day (mirrors the spec's "1x/day"
      // cache). This is the instant, always-available LOCAL heuristic — the
      // AI-enhanced version (source:'ai') overwrites this cache asynchronously
      // via refreshAICoach() below when the OpenRouter proxy is configured and
      // reachable; if it isn't, this local recommendation is what stays shown.
      getCoachRecommendation: () => {
        const today = todayKey();
        if (get().coachCache?.date === today) return get().coachCache;
        const energyLogs = useHabitStore.getState().energyLogs;
        const todayLog = energyLogs.find((l) => l.date === today);
        const readiness = get().getReadiness();
        const alerts = get().getOvertrainingAlerts();
        const weekAgo = Date.now() - 7 * dayMs;
        const workoutsThisWeek = get().workouts.filter((w) => new Date(w.date).getTime() >= weekAgo).length;
        const rec = generateCoachRecommendation({
          sleepQuality: todayLog?.sleepData?.sleepQualityScore ?? null,
          energy: todayLog?.energyStartLevel ?? null,
          stress: todayLog?.stressLevel ?? null,
          readiness: readiness.score,
          overtrainingAlerts: alerts,
          workoutsThisWeek,
        });
        const cached = { date: today, source: 'local', ...rec };
        set({ coachCache: cached });
        return cached;
      },

      // Aggregated (no raw per-entry data) snapshot handed to the AI coach —
      // small payload, and nothing more granular than what's already shown
      // on the Dashboard/Analytics tabs.
      buildCoachContext: () => {
        const today = todayKey();
        const energyLogs = useHabitStore.getState().energyLogs;
        const todayLog = energyLogs.find((l) => l.date === today);
        const readiness = get().getReadiness();
        const alerts = get().getOvertrainingAlerts();
        const nutrition = get().getTodayNutrition();
        const weekAgo = Date.now() - 7 * dayMs;
        const workoutsThisWeek = get().workouts.filter((w) => new Date(w.date).getTime() >= weekAgo).length;

        // Cross-domain (Phase 7): feed the active trading account's discipline
        // signals into the SAME coach that already sees sleep/energy/stress, so
        // it can connect e.g. "low energy + tilt detected" instead of treating
        // trading and health as unrelated. Read-only — never written back here.
        const tradingStore = useTradingStore.getState();
        const activeTradingAccountId = tradingStore.activeAccountId;
        const activeAccountTrades = activeTradingAccountId ? tradingStore.getAccountTrades(activeTradingAccountId) : [];
        const tradingSignals = activeTradingAccountId
          ? {
              maxDrawdownPct: r1(tradingStore.getMaxDrawdown(activeTradingAccountId)),
              tiltDetectedToday: detectTiltSequences(activeAccountTrades).some((s) => s.nextTrade.date === today),
              revengeDetectedToday: detectRevengeTrades(activeAccountTrades).some((f) => f.trade.date === today),
            }
          : null;

        return {
          readinessScore: readiness.score,
          readinessBreakdown: readiness.breakdown,
          sleepQualityToday: todayLog?.sleepData?.sleepQualityScore ?? null,
          energyToday: todayLog?.energyStartLevel ?? null,
          stressToday: todayLog?.stressLevel ?? null,
          nutritionQualityTodayPct: nutrition.quality,
          proteinTodayG: Math.round(nutrition.totals.protein),
          proteinTargetG: nutrition.proteinTarget,
          workoutsThisWeek,
          overtrainingAlerts: alerts.map((a) => a.message),
          goals: get().getGoalsWithProgress().map((g) => ({ label: g.label, percent: g.percent })),
          weeklyDigest: get().getWeeklyDigest(),
          tradingSignals,
        };
      },

      // Overwrites coachCache with an AI-generated recommendation when the
      // OpenRouter proxy is configured and reachable. Silently does nothing on
      // failure (missing key, offline, rate-limited) — the local heuristic
      // from getCoachRecommendation() above stays displayed either way.
      refreshAICoach: async () => {
        const today = todayKey();
        if (get().coachCache?.date === today && get().coachCache?.source === 'ai') return;
        try {
          const { getAIDailyRecommendation } = await import('../services/health-coach-ai');
          const text = await getAIDailyRecommendation(get().buildCoachContext());
          set({ coachCache: { date: today, text, tone: 'info', source: 'ai' } });
        } catch {
          // AI unavailable — local heuristic (already cached) remains shown.
        }
      },

      // Free-form Q&A about the user's own health data, scoped to the Health
      // page. Throws on failure — callers should catch and show a fallback message.
      askHealthQuestion: async (question) => {
        const { askAIHealthQuestion } = await import('../services/health-coach-ai');
        return askAIHealthQuestion(get().buildCoachContext(), question);
      },

      getWeightPrediction: () => {
        const days = 30;
        const cutoff = Date.now() - days * dayMs;
        const recentBodyComp = get().bodyComp.filter((b) => new Date(b.date).getTime() >= cutoff);
        const recentNutrition = get().nutritionLogs.filter((n) => new Date(n.date).getTime() >= cutoff);
        const recentWorkouts = get().workouts.filter((w) => new Date(w.date).getTime() >= cutoff);
        const energyLogs = useHabitStore.getState().energyLogs.filter((l) => new Date(l.date).getTime() >= cutoff);

        const nutritionDays = new Set(recentNutrition.map((n) => n.date));
        const avgProteinAdequacy = nutritionDays.size
          ? [...nutritionDays].reduce((a, d) => {
              const total = recentNutrition.filter((n) => n.date === d).reduce((s, n) => s + n.protein, 0);
              return a + Math.min(1.3, total / (get().proteinTargetG || 140));
            }, 0) / nutritionDays.size
          : 0.7;
        const avgSleepQuality = energyLogs.length ? energyLogs.reduce((a, l) => a + (l.sleepData?.sleepQualityScore ?? 6), 0) / energyLogs.length : 6;
        const avgStress = energyLogs.length ? energyLogs.reduce((a, l) => a + (l.stressLevel ?? 5), 0) / energyLogs.length : 5;
        const avgTrainingSessionsPerWeek = (recentWorkouts.length / days) * 7;

        // Estimate daily deficit from logged nutrition kcal vs. a Mifflin-St Jeor-ish
        // maintenance placeholder (2200 kcal) when no explicit maintenance is set —
        // this is intentionally approximate; the real signal is the trend, not the number.
        const avgKcalLogged = nutritionDays.size ? recentNutrition.reduce((a, n) => a + n.kcal, 0) / nutritionDays.size : 0;
        const assumedMaintenance = 2200;
        const avgDailyDeficit = avgKcalLogged > 0 ? assumedMaintenance - avgKcalLogged : 0;

        return computeWeightPrediction({
          avgDailyDeficit,
          avgProteinAdequacy,
          avgSleepQuality,
          avgTrainingSessionsPerWeek,
          avgStress,
          daysLogged: new Set([...recentBodyComp.map((b) => b.date), ...recentNutrition.map((n) => n.date), ...energyLogs.map((l) => l.date)]).size,
        });
      },

      // ─────────── Body composition precision (multi-method BF%, FFMI, smoothing) ───────────
      // Returns every BF% estimation method that has sufficient inputs on the
      // latest bodyComp entry, so the UI can show a comparison row instead of
      // trusting a single formula.
      getBodyCompPrecision: () => {
        const latest = [...get().bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        if (!latest) return null;
        const age = latest.ageYears;
        const methods = {
          navy: latest.bodyFatMethod === 'navy' ? latest.bodyFatPct : null,
          ymca: bodyFatYMCA({ weightKg: latest.weightKg, waistCm: latest.waistCm, sex: latest.sex }),
          deurenberg: age ? bodyFatDeurenberg({ weightKg: latest.weightKg, heightCm: latest.heightCm, age, sex: latest.sex }) : null,
        };
        const bestBf = methods.navy ?? methods.ymca ?? methods.deurenberg ?? latest.bodyFatPct;
        const ffmi = bestBf != null ? estimateFFMI({ weightKg: latest.weightKg, heightCm: latest.heightCm, bodyFatPct: bestBf }) : null;
        const leanMassKg = bestBf != null ? estimateLeanMassKg({ weightKg: latest.weightKg, bodyFatPct: bestBf }) : null;
        return { methods, ffmi, leanMassKg, latestDate: latest.date };
      },
      // Smoothed (7-day moving average) trend for weight/bodyfat/waist, for
      // overlaying on the existing trend LineChart alongside raw values.
      getSmoothedBodyCompTrend: () => ({
        weight: smoothedTrend(get().bodyComp, 'weightKg'),
        bodyFat: smoothedTrend(get().bodyComp, 'bodyFatPct'),
        waist: smoothedTrend(get().bodyComp, 'waistCm'),
      }),

      // ─────────── Real predictions + trend alerts (beyond today's snapshot) ───────────
      getStrengthPredictions: () => {
        const byExercise = {};
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          for (const st of w.sets || []) {
            const weight = Number(st.weight) || 0, reps = Number(st.reps) || 0;
            if (!weight || !reps) continue;
            const key = w.exercise?.trim();
            if (!key) continue;
            const oneRM = estimate1RM(weight, reps);
            (byExercise[key] ||= []).push({ date: w.date, value: r1(oneRM) });
          }
        }
        return Object.entries(byExercise)
          .map(([exercise, history]) => {
            const prediction = predictStrengthTrajectory(history);
            return prediction ? { exercise, ...prediction, history } : null;
          })
          .filter(Boolean);
      },

      getTrendAlerts: () => {
        const alerts = [];
        const bodyComp = get().bodyComp;
        const latest = [...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];

        const weightSeries = bodyComp.filter((b) => b.weightKg).map((b) => ({ date: b.date, value: b.weightKg }));
        const weightPlateau = detectPlateau(weightSeries);
        const adherence = get().getProgramAdherence();
        if (weightPlateau.plateaued) {
          alerts.push({
            id: 'weight-plateau', level: 'info',
            message: `Ton poids est stable depuis ~2 semaines (variation < ${weightPlateau.weeklyPctChange}%/semaine).`,
            explanation: explainPlateau({ plateauDetected: true, adherencePct: adherence?.percent }),
          });
        }
        if (latest?.weightKg) {
          const deficitAlert = checkAggressiveDeficit(bodyComp, latest.weightKg);
          if (deficitAlert) alerts.push({ id: 'aggressive-deficit', ...deficitAlert });
        }

        // Strength plateaus, one per exercise with enough history.
        for (const pred of get().getStrengthPredictions()) {
          const plateau = detectPlateau(pred.history);
          if (plateau.plateaued) {
            alerts.push({
              id: `strength-plateau-${pred.exercise}`, level: 'info',
              message: `${pred.exercise} : stagnation depuis ~2 semaines (1RM estimé).`,
              explanation: explainPlateau({ plateauDetected: true, adherencePct: adherence?.percent }),
            });
          }
        }

        // Trending overtraining risk over readiness history + volume history.
        const readinessHistory = []; // no persisted daily readiness history — approximate via workouts volume trend only
        const volumeHistory = get().getWorkoutVolumeSeries();
        alerts.push(...checkTrendingOvertrainingRisk(readinessHistory, volumeHistory));

        return alerts;
      },

      // ─────────── Chrono-Health (timing intelligence) ───────────
      getChronoSummary: (date) => {
        const target = date || todayKey();
        const fastingWindows = computeFastingWindows(get().nutritionLogs, target);
        const hydrationGaps = computeHydrationGaps(get().waterLogs, target);
        const mealConsistency = computeMealTimingConsistency(get().nutritionLogs);
        const sleepConsistency = computeSleepConsistency(useHabitStore.getState().energyLogs);
        const todayLog = useHabitStore.getState().energyLogs.find((l) => l.date === target);
        const napFlags = computeNapImpact(todayLog?.naps || []);
        const alerts = deriveChronoAlerts({
          fastingWindows, hydrationGaps, mealConsistency, sleepConsistency, napFlags,
          waterReminderGapMin: get().healthProfile.reminderPrefs?.waterReminderGapMin ?? 180,
        });
        return { fastingWindows, hydrationGaps, mealConsistency, sleepConsistency, napFlags, alerts };
      },

      // ─────────── Cross-domain correlations (spec: sleep↔strength, stress↔spending, energy↔trading accuracy).
      getCorrelations: () => {
        const energyLogs = useHabitStore.getState().energyLogs;
        const byDate = (arr, keyFn) => Object.fromEntries(arr.map((x) => [x.date, keyFn(x)]));
        const sleepByDate = byDate(energyLogs, (l) => l.sleepData?.sleepQualityScore ?? null);
        const stressByDate = byDate(energyLogs, (l) => l.stressLevel ?? null);
        const energyByDate = byDate(energyLogs, (l) => l.energyStartLevel ?? null);

        // Sleep quality vs. next-day average strength RPE-adjusted volume (proxy for performance).
        const strengthByDate = {};
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          const vol = (w.sets || []).reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
          strengthByDate[w.date] = (strengthByDate[w.date] || 0) + vol;
        }
        const sleepVsStrength = pearsonCorrelation(
          Object.keys(strengthByDate).map((d) => [sleepByDate[d] ?? null, strengthByDate[d]]).filter(([x]) => x !== null)
        );

        // Stress vs. daily spending (classe 6 charges, from the accounting journal).
        const journal = useAccountingStore.getState().journal;
        const spendByDate = {};
        for (const e of journal) {
          const spend = (e.lines || []).filter((l) => String(l.account).startsWith('6')).reduce((a, l) => a + (Number(l.debit) || 0), 0);
          if (spend > 0) spendByDate[e.date] = (spendByDate[e.date] || 0) + spend;
        }
        const stressVsSpending = pearsonCorrelation(
          Object.keys(spendByDate).map((d) => [stressByDate[d] ?? null, spendByDate[d]]).filter(([x]) => x !== null)
        );

        // Energy vs. same-day trading win rate.
        const trades = useTradingStore.getState().trades;
        const tradesByDate = {};
        for (const t of trades) {
          const d = String(t.date).slice(0, 10);
          (tradesByDate[d] ||= []).push(t);
        }
        const winRateByDate = Object.fromEntries(
          Object.entries(tradesByDate).map(([d, ts]) => [d, ts.filter((t) => t.pnl > 0).length / ts.length])
        );
        const energyVsTradingAccuracy = pearsonCorrelation(
          Object.keys(winRateByDate).map((d) => [energyByDate[d] ?? null, winRateByDate[d]]).filter(([x]) => x !== null)
        );

        // Sleep quality vs. same-day trading win rate.
        const sleepVsTradingAccuracy = pearsonCorrelation(
          Object.keys(winRateByDate).map((d) => [sleepByDate[d] ?? null, winRateByDate[d]]).filter(([x]) => x !== null)
        );

        // Sleep/energy vs. tilt-or-revenge-flagged trading days (Phase 9): reuses
        // Phase-4's detectors. Every day WITH trades gets a 0/1 flag (not just the
        // flagged days) so Pearson sees real variance instead of a degenerate
        // all-1s series.
        const riskDayFlag = Object.fromEntries(Object.keys(tradesByDate).map((d) => [d, 0]));
        for (const s of detectTiltSequences(trades)) riskDayFlag[s.nextTrade.date] = 1;
        for (const f of detectRevengeTrades(trades)) riskDayFlag[f.trade.date] = 1;
        const energyVsTiltRisk = pearsonCorrelation(
          Object.keys(riskDayFlag).map((d) => [energyByDate[d] ?? null, riskDayFlag[d]]).filter(([x]) => x !== null)
        );
        const sleepVsTiltRisk = pearsonCorrelation(
          Object.keys(riskDayFlag).map((d) => [sleepByDate[d] ?? null, riskDayFlag[d]]).filter(([x]) => x !== null)
        );

        return { sleepVsStrength, stressVsSpending, energyVsTradingAccuracy, sleepVsTradingAccuracy, energyVsTiltRisk, sleepVsTiltRisk };
      },

      // ─────────── Custom correlation picker (Analytics: "pick any two") ───────────
      getMetricRegistry: () => [
        { value: 'sleepQuality', label: 'Sleep Quality' },
        { value: 'stress', label: 'Stress' },
        { value: 'energy', label: 'Energy' },
        { value: 'strengthVolume', label: 'Strength Volume (kg)' },
        { value: 'cardioMinutes', label: 'Cardio Minutes' },
        { value: 'workoutQuality', label: 'Workout Quality' },
        { value: 'spending', label: 'Spending (DH)' },
        { value: 'tradingWinRate', label: 'Trading Win Rate' },
        { value: 'tradingPnl', label: 'Trading P&L' },
        { value: 'waterMl', label: 'Water Intake (ml)' },
        { value: 'weightKg', label: 'Body Weight (kg)' },
        { value: 'proteinG', label: 'Protein (g)' },
        { value: 'caloriesKcal', label: 'Calories (kcal)' },
      ],

      // date → value map for one metric key from the registry above.
      getMetricSeriesMap: (key) => {
        const s = get();
        const energyLogs = useHabitStore.getState().energyLogs;
        switch (key) {
          case 'sleepQuality':
            return Object.fromEntries(energyLogs.map((l) => [l.date, l.sleepData?.sleepQualityScore ?? null]).filter(([, v]) => v != null));
          case 'stress':
            return Object.fromEntries(energyLogs.map((l) => [l.date, l.stressLevel ?? null]).filter(([, v]) => v != null));
          case 'energy':
            return Object.fromEntries(energyLogs.map((l) => [l.date, l.energyStartLevel ?? null]).filter(([, v]) => v != null));
          case 'strengthVolume': {
            const m = {};
            for (const w of s.workouts.filter((w) => w.type === 'strength')) {
              m[w.date] = (m[w.date] || 0) + (w.sets || []).reduce((a, st) => a + (Number(st.reps) || 0) * (Number(st.weight) || 0), 0);
            }
            return m;
          }
          case 'cardioMinutes': {
            const m = {};
            for (const w of s.workouts.filter((w) => w.type === 'cardio')) m[w.date] = (m[w.date] || 0) + (Number(w.durationMin) || 0);
            return m;
          }
          case 'workoutQuality': {
            const byDate = {};
            for (const w of s.workouts.filter((w) => w.quality)) (byDate[w.date] ||= []).push(w.quality);
            return Object.fromEntries(Object.entries(byDate).map(([d, arr]) => [d, arr.reduce((a, b) => a + b, 0) / arr.length]));
          }
          case 'spending': {
            const journal = useAccountingStore.getState().journal;
            const m = {};
            for (const e of journal) {
              const spend = (e.lines || []).filter((l) => String(l.account).startsWith('6')).reduce((a, l) => a + (Number(l.debit) || 0), 0);
              if (spend > 0) m[e.date] = (m[e.date] || 0) + spend;
            }
            return m;
          }
          case 'tradingWinRate': {
            const trades = useTradingStore.getState().trades;
            const byDate = {};
            for (const t of trades) (byDate[String(t.date).slice(0, 10)] ||= []).push(t);
            return Object.fromEntries(Object.entries(byDate).map(([d, ts]) => [d, ts.filter((t) => t.pnl > 0).length / ts.length]));
          }
          case 'tradingPnl': {
            const trades = useTradingStore.getState().trades;
            const m = {};
            for (const t of trades) {
              const d = String(t.date).slice(0, 10);
              m[d] = (m[d] || 0) + (Number(t.pnl) || 0);
            }
            return m;
          }
          case 'waterMl':
            return Object.fromEntries(s.recoveryLogs.filter((r) => r.waterMl).map((r) => [r.date, r.waterMl]));
          case 'weightKg':
            return Object.fromEntries(s.bodyComp.filter((b) => b.weightKg).map((b) => [b.date, b.weightKg]));
          case 'proteinG': {
            const m = {};
            for (const n of s.nutritionLogs) m[n.date] = (m[n.date] || 0) + (Number(n.protein) || 0);
            return m;
          }
          case 'caloriesKcal': {
            const m = {};
            for (const n of s.nutritionLogs) m[n.date] = (m[n.date] || 0) + (Number(n.kcal) || 0);
            return m;
          }
          default:
            return {};
        }
      },

      getCustomCorrelation: (keyA, keyB) => {
        if (!keyA || !keyB) return { r: null, points: [] };
        const a = get().getMetricSeriesMap(keyA);
        const b = get().getMetricSeriesMap(keyB);
        const dates = Object.keys(a).filter((d) => b[d] != null);
        const points = dates.sort().map((d) => ({ date: d, x: r1(a[d]), y: r1(b[d]) }));
        const r = pearsonCorrelation(points.map((p) => [p.x, p.y]));
        return { r, points };
      },

      // Per-habit energy correlation: average morning energy on days the habit was
      // completed vs. days it wasn't — a simple, readable alternative to Pearson r
      // for a boolean×continuous relationship, used by the Health Analytics tab.
      getHabitEnergyCorrelations: () => {
        const { habits, logs, energyLogs } = useHabitStore.getState();
        const energyByDate = Object.fromEntries(energyLogs.map((l) => [l.date, l.energyStartLevel]));
        return habits
          .filter((h) => !h.archived)
          .map((h) => {
            const doneDates = logs.filter((l) => l.habitId === h.id && l.completed).map((l) => l.date);
            const doneEnergy = doneDates.map((d) => energyByDate[d]).filter((v) => v != null);
            const allLoggedDates = Object.keys(energyByDate);
            const notDoneEnergy = allLoggedDates
              .filter((d) => !doneDates.includes(d))
              .map((d) => energyByDate[d])
              .filter((v) => v != null);
            if (doneEnergy.length < 3 || notDoneEnergy.length < 3) return null;
            const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
            return { habitId: h.id, habitName: h.name, avgEnergyOnDays: r1(avg(doneEnergy)), avgEnergyOffDays: r1(avg(notDoneEnergy)), delta: r1(avg(doneEnergy) - avg(notDoneEnergy)) };
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      },

      // Personal-best weight per exercise, with the date it was set — powers the
      // Workout tab's PR timeline.
      getPRs: () => {
        const best = {};
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          for (const s of w.sets || []) {
            const weight = Number(s.weight) || 0;
            if (!weight) continue;
            const key = w.exercise?.trim().toLowerCase();
            if (!key) continue;
            if (!best[key] || weight > best[key].weight) {
              best[key] = { exercise: w.exercise, weight, reps: Number(s.reps) || 0, date: w.date };
            }
          }
        }
        return Object.values(best).sort((a, b) => (a.date < b.date ? 1 : -1));
      },

      // Weekly training volume (kg lifted) over the last 12 weeks — periodization view.
      getWorkoutVolumeSeries: () => {
        const weeks = 12;
        const now = new Date(todayKey() + 'T00:00:00').getTime();
        const buckets = Array.from({ length: weeks }, (_, i) => {
          const weekStart = now - (weeks - 1 - i) * 7 * dayMs;
          return { weekStart, label: new Date(weekStart).toISOString().slice(5, 10), volume: 0, sessions: 0 };
        });
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          const t = new Date(w.date + 'T00:00:00').getTime();
          const bucket = buckets.find((b) => t >= b.weekStart && t < b.weekStart + 7 * dayMs);
          if (!bucket) continue;
          bucket.volume += (w.sets || []).reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
          bucket.sessions += 1;
        }
        return buckets.map(({ label, volume, sessions }) => ({ label, volume, sessions }));
      },

      // Best estimated 1RM (Epley) per exercise, checked across every logged
      // set — a lower-weight, higher-rep set can imply a higher 1RM than the
      // outright weight PR, so this isn't just getPRs() run through the formula.
      getEstimated1RMs: () => {
        const best = {};
        for (const w of get().workouts.filter((w) => w.type === 'strength')) {
          for (const st of w.sets || []) {
            const weight = Number(st.weight) || 0;
            const reps = Number(st.reps) || 0;
            if (!weight || !reps) continue;
            const key = w.exercise?.trim().toLowerCase();
            if (!key) continue;
            const oneRM = estimate1RM(weight, reps);
            if (!best[key] || oneRM > best[key].oneRM) {
              best[key] = { exercise: w.exercise, oneRM: r1(oneRM), weight, reps, date: w.date };
            }
          }
        }
        return Object.values(best).sort((a, b) => b.oneRM - a.oneRM);
      },

      // Every distinct exercise ever logged, with session count / last-performed
      // date / best effort — powers the Workout tab's exercise library.
      getExerciseLibrary: () => {
        const byExercise = {};
        for (const w of get().workouts) {
          const key = (w.exercise?.trim() || (w.type === 'strength' ? 'Strength (unnamed)' : 'Cardio (unnamed)'));
          const entry = (byExercise[key] ||= { exercise: key, type: w.type, sessions: 0, lastDate: w.date, bestWeightKg: 0, totalMinutes: 0 });
          entry.sessions += 1;
          if (w.date > entry.lastDate) entry.lastDate = w.date;
          if (w.type === 'strength') entry.bestWeightKg = Math.max(entry.bestWeightKg, 0, ...(w.sets || []).map((s) => Number(s.weight) || 0));
          else entry.totalMinutes += Number(w.durationMin) || 0; // cardio + sport are both duration-based
        }
        return Object.values(byExercise).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
      },

      // Set-level RPE-vs-reps scatter — surfaces whether higher reps correlate
      // with higher perceived exertion for this user specifically.
      getRpeRepsScatter: () =>
        get()
          .workouts.filter((w) => w.type === 'strength')
          .flatMap((w) => (w.sets || []).filter((s) => s.reps && s.rpe).map((s) => ({ reps: Number(s.reps), rpe: Number(s.rpe), exercise: w.exercise }))),

      // Stress vs. daily spending joined series (last 30 days) — for a visual
      // dashboard, not just the single r-value in getCorrelations().
      getStressSpendingSeries: () => {
        const energyLogs = useHabitStore.getState().energyLogs;
        const stressByDate = Object.fromEntries(energyLogs.map((l) => [l.date, l.stressLevel]));
        const journal = useAccountingStore.getState().journal;
        const spendByDate = {};
        for (const e of journal) {
          const spend = (e.lines || []).filter((l) => String(l.account).startsWith('6')).reduce((a, l) => a + (Number(l.debit) || 0), 0);
          if (spend > 0) spendByDate[e.date] = (spendByDate[e.date] || 0) + spend;
        }
        const dates = [...new Set([...Object.keys(stressByDate), ...Object.keys(spendByDate)])].sort().slice(-30);
        return dates.map((d) => ({ date: d.slice(5), stress: stressByDate[d] ?? null, spend: Math.round(spendByDate[d] || 0) }));
      },

      getSleepWindow: () => bestSleepWindow(useHabitStore.getState().energyLogs),

      // Tonight's sleep-duration target given how demanding today's Gym/Cardio
      // actually was, relative to this person's own recent training (see
      // getSleepLoadTarget's comment in health-science.js for the research
      // behind the ranges). Anchors the "sleep earlier, not later" bedtime
      // suggestion to the user's own known wake time when there's enough
      // history for one. Combines two independent floor sources — the active
      // program's own intensity (sleepFloor) and, when tracked, the cycle
      // phase (menstrual/luteal are associated with more fragmented sleep —
      // a soft heuristic bump, not a hard clinical number) — taking the max
      // of each so either alone is enough to raise the target.
      getSleepTarget: () => {
        const window_ = get().getSleepWindow();
        const activeCurated = get().getActiveCuratedProgram();
        const cycleCoaching = get().getCyclePhaseCoaching();
        const floorParts = [];
        if (activeCurated?.sleepFloor) floorParts.push({ ...activeCurated.sleepFloor, reason: activeCurated.name });
        if (cycleCoaching?.phase === 'menstrual' || cycleCoaching?.phase === 'luteal') {
          floorParts.push({ min: 7, max: 9, reason: cycleCoaching.phase === 'menstrual' ? 'phase menstruelle' : 'phase lutéale' });
        }
        const combinedFloor = floorParts.length
          ? { min: Math.max(...floorParts.map((f) => f.min)), max: Math.max(...floorParts.map((f) => f.max)) }
          : null;
        const target = getSleepLoadTarget(get().workouts, todayKey(), window_?.wakeTime || null, combinedFloor);
        return { ...target, floorReasons: floorParts.map((f) => f.reason) };
      },

      // Auto-generated trailing-N-day summary — shared by the annual report and
      // the weekly digest so the two never drift out of sync.
      getPeriodReport: (days) => {
        const cutoff = Date.now() - days * dayMs;
        const energyLogs = useHabitStore.getState().energyLogs.filter((l) => new Date(l.date).getTime() >= cutoff);
        const workouts = get().workouts.filter((w) => new Date(w.date).getTime() >= cutoff);
        const bodyComp = get().bodyComp.filter((b) => new Date(b.date).getTime() >= cutoff).sort((a, b) => (a.date < b.date ? -1 : 1));
        const avg = (arr, fn) => (arr.length ? r1(arr.reduce((a, x) => a + (fn(x) ?? 0), 0) / arr.length) : null);
        const weightStart = bodyComp[0]?.weightKg ?? null;
        const weightEnd = bodyComp[bodyComp.length - 1]?.weightKg ?? null;
        return {
          days,
          daysLogged: new Set([...energyLogs.map((l) => l.date), ...workouts.map((w) => w.date)]).size,
          totalWorkouts: workouts.length,
          cardioSessions: workouts.filter((w) => w.type === 'cardio').length,
          strengthSessions: workouts.filter((w) => w.type === 'strength').length,
          avgSleepQuality: avg(energyLogs, (l) => l.sleepData?.sleepQualityScore),
          avgEnergy: avg(energyLogs, (l) => l.energyStartLevel),
          avgStress: avg(energyLogs, (l) => l.stressLevel),
          weightChangeKg: weightStart != null && weightEnd != null ? r1(weightEnd - weightStart) : null,
          badgesEarned: get().awardedBadges.length,
        };
      },
      getAnnualReport: () => get().getPeriodReport(365),
      getWeeklyDigest: () => get().getPeriodReport(7),

      // This-week vs last-week deltas for the Dashboard's quick comparison
      // chips — reuses getPeriodReport for "this week" and a manually offset
      // 7-14-days-ago window for "last week" (getPeriodReport itself only
      // supports a trailing-from-now window, not an offset one).
      getWeekOverWeekDelta: () => {
        const thisWeek = get().getWeeklyDigest();
        const cutoffStart = Date.now() - 14 * dayMs;
        const cutoffEnd = Date.now() - 7 * dayMs;
        const inWindow = (d) => { const t = new Date(d).getTime(); return t >= cutoffStart && t < cutoffEnd; };
        const energyLogs = useHabitStore.getState().energyLogs.filter((l) => inWindow(l.date));
        const workouts = get().workouts.filter((w) => inWindow(w.date));
        const avg = (arr, fn) => (arr.length ? r1(arr.reduce((a, x) => a + (fn(x) ?? 0), 0) / arr.length) : null);
        const lastWeek = {
          totalWorkouts: workouts.length,
          avgSleepQuality: avg(energyLogs, (l) => l.sleepData?.sleepQualityScore),
          avgEnergy: avg(energyLogs, (l) => l.energyStartLevel),
        };
        const delta = (a, b) => (a != null && b != null ? r1(a - b) : null);
        return {
          workouts: { current: thisWeek.totalWorkouts, delta: thisWeek.totalWorkouts - lastWeek.totalWorkouts },
          avgSleepQuality: { current: thisWeek.avgSleepQuality, delta: delta(thisWeek.avgSleepQuality, lastWeek.avgSleepQuality) },
          avgEnergy: { current: thisWeek.avgEnergy, delta: delta(thisWeek.avgEnergy, lastWeek.avgEnergy) },
        };
      },

      // Trailing-N-day activity density (any Health log that day) — powers a
      // GitHub-style contribution heatmap on the Dashboard.
      getActivityHeatmap: (days = 90) => {
        const counts = {};
        const bump = (d) => { if (d) counts[d] = (counts[d] || 0) + 1; };
        get().workouts.forEach((w) => bump(w.date));
        get().nutritionLogs.forEach((n) => bump(n.date));
        get().recoveryLogs.forEach((r) => bump(r.date));
        get().checkins.forEach((c) => bump(c.date));
        get().bodyComp.forEach((b) => bump(b.date));
        const out = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = todayKey(new Date(Date.now() - i * dayMs));
          out.push({ date: d, count: counts[d] || 0 });
        }
        return out;
      },

      resetAll: () =>
        set({
          workouts: [], nutritionLogs: [], proteinTargetG: 140, mealTemplates: [], bodyComp: [], recoveryLogs: [],
          checkins: [], pendingPrompts: [], awardedBadges: [], coachCache: null, cycleLogs: [], goals: [],
          customCycleSymptoms: [], customRecoveryActivities: [], waterTargetMl: 2500, weightUnit: 'kg',
          reminders: {
        enabled: false, lastMorningReminderDate: null, lastWorkoutReminderDate: null,
        lastWaterReminderAt: null, lastMealReminderKey: null, lastBedtimeReminderDate: null,
      },
          trainingPrograms: [], nutritionPlans: [], waterLogs: [], performanceLogs: [],
          activeCuratedProgramId: null, programVariants: [], programSchedule: null, curatedSessionProgress: {},
          healthProfile: {
            version: 1,
            experienceLevel: null, trainingGoal: null, daysPerWeek: null, sessionLengthMin: null,
            equipmentAccess: [], injuries: [],
            activityLevel: null, dietGoal: null, budgetTier: null, dietaryRestrictions: [], mealsPerDay: null,
            cycleTrackingEnabled: null, maleTrackingEnabled: null,
            reminderPrefs: { weighInTime: null, mealWindows: [], waterReminderGapMin: 180, bedtimeTarget: null },
            completedAt: null, lastRecomputedAt: null,
          },
        }),
    }),
    { name: 'audax-health' }
  )
);
