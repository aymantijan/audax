// Slice of healthStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../healthStore.js.
import { uid, todayKey } from '../../utils/formatters';
import { estimateMacros, getServingOptions } from '../../utils/nutrition-db';
import { getFoodMicros } from '../../utils/food-micronutrients';
import { useSkillStore } from '../skillStore';
import { useAuthStore } from '../authStore';
import { toast } from '../uiStore';
import { generateNutritionPlan } from '../../utils/nutrition-plan-generator';
import { foodsForBudget } from '../../utils/morocco-food-budget';
import { HEALTH_LINK_SKILLS } from './helpers';

export const profileSlice = (set, get) => ({
      // ─────────── Health profile (questionnaire-driven) ───────────
      healthProfile: {
        version: 1,
        // sex/dobYear/heightCm moved to authStore.user (global profile, reused
        // across the whole app) — read via useAuthStore.getState().user.*.
        experienceLevel: null, trainingGoal: null, daysPerWeek: null, sessionLengthMin: null,
        equipmentAccess: [], injuries: [],
        activityLevel: null, dietGoal: null, budgetTier: null, dietaryRestrictions: [], mealsPerDay: null,
        cycleTrackingEnabled: null, maleTrackingEnabled: null, hormonalContraception: false,
        // 'none' | 'pregnant' | 'postpartum' | 'perimenopause' | 'menopause'.
        // pregnancyStartDate is the LMP (last menstrual period) date, the
        // standard clinical convention for dating gestational age in weeks.
        // postpartumStartDate is the birth date; breastfeeding is null until
        // explicitly answered (postpartum alone doesn't imply it either way).
        lifeStage: 'none', pregnancyStartDate: null, postpartumStartDate: null, breastfeeding: null,
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
          cycleTrackingEnabled: null, maleTrackingEnabled: null, hormonalContraception: false,
          lifeStage: 'none', pregnancyStartDate: null, postpartumStartDate: null, breastfeeding: null,
          reminderPrefs: { weighInTime: null, mealWindows: [], waterReminderGapMin: 180, bedtimeTarget: null },
          completedAt: null, lastRecomputedAt: null,
        },
      }),

      // ─────────── Old program system removed (2026-09-08) ───────────
      // trainingPrograms, activeCuratedProgramId, programOverrides,
      // programVariants, curatedSessionProgress, programSchedule and all
      // their getters/actions have been deleted. Programmes are now managed
      // by the Supabase-backed programStore (src/store/programStore.js).
      // Legacy keys may still exist in persisted localStorage — they are
      // harmless dead weight and will be ignored by the store.
      _migrated_program_v2: true,

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
        // Only used for the luteal-phase calorie bump downstream, which
        // assumes a real progesterone rise — skip it under hormonal
        // contraception (ovulation generally suppressed, no natural luteal
        // surge to compensate for).
        const cyclePhase = globalUser?.gender === 'female' && get().isCyclePhaseHormonallyReliable() ? get().getCyclePhase()?.phase : null;
        const pregnancyTrimester = profile.lifeStage === 'pregnant' ? get().getPregnancyInfo()?.trimester ?? null : null;
        const breastfeedingKcalBump = profile.lifeStage === 'postpartum' ? get().getPostpartumInfo()?.kcalBump ?? 0 : 0;
        const plan = generateNutritionPlan({
          weightKg: latestBodyComp?.weightKg ?? overrides?.weightKg,
          heightCm: globalUser?.heightCm ?? overrides?.heightCm,
          age, sex: globalUser?.gender ?? null,
          activityLevel: profile.activityLevel, dietGoal: profile.dietGoal,
          budgetTier: profile.budgetTier, dietaryRestrictions: profile.dietaryRestrictions,
          mealsPerDay: profile.mealsPerDay, cyclePhase, pregnancyTrimester, breastfeedingKcalBump, dislikedFoods: profile.dislikedFoods,
          customFoods: get().customFoods, foodPrices: get().foodPrices,
          ...overrides,
        });
        if (plan.error) { toast('Complète ton profil (poids, taille, année de naissance dans Réglages) pour générer un plan nutritionnel.', 'warning'); return plan; }
        set({ nutritionPlans: [...get().nutritionPlans.map((p) => ({ ...p, active: false })), plan], proteinTargetG: plan.targetMacros.proteinG });
        toast('Plan nutritionnel généré', 'success');
        return plan;
      },
      // Direct manual override of kcal + macro targets — for someone who
      // already knows the numbers they want (a coach gave them a target, they
      // did the math themselves, etc.) and doesn't want to run the full
      // questionnaire in PlanSetup.jsx just to set 4 numbers. Updates the
      // active plan's targets in place if one exists (sampleMeals/budgetTier/
      // etc. untouched — they may now target a slightly different kcal figure
      // than before, same drift as passing `overrides` to generatePlan
      // already accepted); otherwise creates a minimal plan with no sample
      // meals (source:'manual') so downstream selectors that read
      // getActiveNutritionPlan() (energy-availability caution, PDF export,
      // etc.) have something to work from.
      setManualNutritionTarget: ({ kcal, proteinG, carbsG, fatG }) => {
        const targetKcal = Math.round(Number(kcal)) || 0;
        const targetMacros = { proteinG: Math.round(Number(proteinG)) || 0, carbsG: Math.round(Number(carbsG)) || 0, fatG: Math.round(Number(fatG)) || 0 };
        if (!targetKcal || (!targetMacros.proteinG && !targetMacros.carbsG && !targetMacros.fatG)) {
          toast('Indique au moins les calories et un macro.', 'warning');
          return;
        }
        const active = get().getActiveNutritionPlan();
        if (active) {
          set({ nutritionPlans: get().nutritionPlans.map((p) => (p.id === active.id ? { ...p, targetKcal, targetMacros, source: 'manual' } : p)) });
        } else {
          const plan = {
            id: uid(), generatedAt: Date.now(), targetKcal, targetMacros,
            budgetTier: null, dietGoal: null, activityLevel: null,
            sampleMeals: [], explanationNotes: [], source: 'manual', active: true,
          };
          set({ nutritionPlans: [...get().nutritionPlans.map((p) => ({ ...p, active: false })), plan] });
        }
        set({ proteinTargetG: targetMacros.proteinG });
        toast('Cibles nutritionnelles mises à jour', 'success');
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
        const opts = { customFoods: get().customFoods, foodPrices: get().foodPrices };
        return foodsForBudget(budgetTier || 'moderate', item.category, opts).filter((f) => f.name !== item.name && !disliked.has(f.name));
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
            // Round to a whole serving unit for foods only sold/eaten as
            // discrete pieces (eggs, cans…) — same rule as generation, so a
            // swap can't reintroduce "2.6 eggs".
            const discrete = getServingOptions(newFoodName).find((o) => o.grams > 1 && o.label !== 'cup' && o.label !== 'tbsp' && o.label !== 'slice' && o.label !== 'glass' && o.label !== 'loaf' && o.label !== 'handful' && o.label !== 'poignée');
            if (discrete) newGrams = Math.max(1, Math.round(newGrams / discrete.grams)) * discrete.grams;
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
});
