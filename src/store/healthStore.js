import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { estimateMacros, setCustomFoods, setFoodOverrides, getServingOptions } from '../utils/nutrition-db';
import { toast } from './uiStore';
import { foodsForBudget } from '../utils/morocco-food-budget';
import { profileSlice } from './health/profile';
import { workoutsSlice } from './health/workouts';
import { dailySlice } from './health/daily';
import { labsSlice } from './health/labs';
import { analyticsSlice } from './health/analytics';
import { correlationsSlice } from './health/correlations';

// Split into slices under ./health/ (F3): each file holds whole sections of
// the original store, verbatim; they are spread back into one store here.
export const useHealthStore = create(
  persist(
    (set, get) => ({
      workouts: [], // [{ id, date, type:'cardio'|'strength', exercise, sets:[{reps,weight,rpe,form}], durationMin, avgRpe, quality, notes }]
      nutritionLogs: [], // [{ id, date, name, grams, protein, carbs, fat, kcal, whole, proteinTargetMet }]
      proteinTargetG: 140, // daily protein target used for "target met" + Protein Perfect badge
      mealTemplates: [], // [{ id, name, items:[{name,grams}] }]
      // User-added foods — manually entered or saved from a barcode scan.
      // Same per-100g macro shape as FOOD_DB, plus pricePerGram (that
      // person's real local price, not a generic tier) and an optional
      // category so the plan generator can slot them alongside the curated
      // Morocco list. Kept in sync with nutrition-db.js's lookup registry by
      // a store subscription set up right after this store is created (see
      // bottom of file) — every logMeal/estimateMacros/getServingOptions
      // call anywhere in the app can already resolve these by name for free.
      customFoods: [], // [{id, name, category, protein, carbs, fat, kcal, whole, servings?, pricePerGram, barcode?}]
      addCustomFood: (food) => {
        const entry = { id: uid(), whole: false, servings: null, pricePerGram: null, barcode: null, ...food };
        set({ customFoods: [...get().customFoods, entry] });
        toast('Aliment ajouté à tes aliments', 'success');
        return entry;
      },
      deleteCustomFood: (id) => set({ customFoods: get().customFoods.filter((f) => f.id !== id) }),
      // { [foodName]: pricePerGram } — the user's own real local price for
      // ANY food (curated Morocco list, FOOD_DB, or a custom food), in
      // DH/gram. Overrides the generic MOROCCO_FOOD_COST_TIERS tier system
      // for that specific person's actual cost of living: foodsForBudget()
      // sorts by known price first when any prices are set, tier order
      // otherwise (see morocco-food-budget.js).
      foodPrices: {},
      setFoodPrice: (foodName, pricePerGram) => set({ foodPrices: { ...get().foodPrices, [foodName]: Number(pricePerGram) || 0 } }),
      deleteFoodPrice: (foodName) => set({ foodPrices: Object.fromEntries(Object.entries(get().foodPrices).filter(([n]) => n !== foodName)) }),
      // { [foodName]: { protein?, carbs?, fat?, kcal?, unitLabel?, unitGrams? } } — user
      // corrections to a food's generic macros (per 100g) and/or the real net
      // weight of its purchase unit (e.g. a specific can of sardines nets
      // 55g, not the generic 106g assumed — which silently makes an 8Dh can
      // look cheap when it's actually ~14.5Dh/100g). Applied by nutrition-
      // db.js's lookupFood on top of either a built-in or custom food, kept
      // in sync via the same store-subscription pattern as customFoods.
      foodOverrides: {},
      setFoodOverride: (foodName, patch) => {
        const existing = get().foodOverrides[foodName] || {};
        const merged = { ...existing, ...patch };
        // Drop keys explicitly cleared back to null so an old correction
        // doesn't linger once the user removes it.
        for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];
        set({ foodOverrides: { ...get().foodOverrides, [foodName]: merged } });
      },
      deleteFoodOverride: (foodName) => set({ foodOverrides: Object.fromEntries(Object.entries(get().foodOverrides).filter(([n]) => n !== foodName)) }),
      bodyComp: [], // [{ id, date, weightKg, waistCm, neckCm, hipCm, heightCm, sex, absRating, bodyFatPct, bodyFatMethod, photo }]
      activityDays: [], // [{ date, steps, distanceKm, activeKcal, source: 'apple'|'googlefit' }] — imported (components/health/HealthImportCard.jsx)
      recoveryLogs: [], // [{ id, date, activities:['sleep8','meditation','stretching','cold','massage'] }]
      checkins: [], // [{ id, date, slot:'morning'|'postWorkout'|'afternoon'|'evening', energy, stress, note }]
      pendingPrompts: [], // [{ id, habitId, habitName, type, duration, createdAt }] — habit→Health "log it?" queue
      awardedBadges: [], // badge ids already toasted, so we don't re-fire every render
      coachCache: null, // { date, text, tone } — 1x/day
      cycleLogs: [], // [{ id, date, flow:'light'|'medium'|'heavy', symptoms:[...], notes }] — one per period start date
      bloodTests: [], // [{ id, date, ferritinNgMl, hemoglobinGDl, source:'manual'|'ocr', notes }] — user-entered lab values, optional
      goals: [], // [{ id, type:'weight'|'strength'|'sleep', targetKg?, exercise?, targetScore?, startWeightKg?, achieved, createdAt }]
      reminders: {
        enabled: false, lastMorningReminderDate: null, lastWorkoutReminderDate: null,
        lastWaterReminderAt: null, lastMealReminderKey: null, lastBedtimeReminderDate: null,
      },
      weightUnit: 'kg', // 'kg' | 'lb' — display/input preference only; all workout/body-comp data is stored in kg
      setWeightUnit: (unit) => set({ weightUnit: unit === 'lb' ? 'lb' : 'kg' }),

      ...profileSlice(set, get),
      ...workoutsSlice(set, get),
      ...dailySlice(set, get),
      ...labsSlice(set, get),
      ...analyticsSlice(set, get),
      ...correlationsSlice(set, get),
    }),
    { name: 'audax-health' }
  )
);

// Keeps nutrition-db.js's custom-food lookup registry in sync with the
// persisted store — fires on every change (cheap, a plain array assignment)
// and, crucially, on the internal set() the persist middleware issues once
// localStorage rehydration completes, so this is correct from first paint
// without a separate app-startup effect.
useHealthStore.subscribe((state) => setCustomFoods(state.customFoods));
useHealthStore.subscribe((state) => setFoodOverrides(state.foodOverrides));
