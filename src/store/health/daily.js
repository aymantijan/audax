// Slice of healthStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../healthStore.js.
import { uid, todayKey } from '../../utils/formatters';
import { estimateMacros } from '../../utils/nutrition-db';
import { bodyFatNavyMale, bodyFatNavyFemale, computeCyclePhase } from '../../utils/health-science';
import { useSkillStore } from '../skillStore';
import { useHabitStore } from '../habitStore';
import { toast } from '../uiStore';
import { dayMs, nowHHMM } from './helpers';

export const dailySlice = (set, get) => ({
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
        if (entry.proteinTargetMet) useHabitStore.getState().completeLinkedHabits('nutrition', entry.date);
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
        toast(`Mesures enregistrées${entryDate === todayKey() ? '' : ` pour le ${entryDate}`}`, 'success');
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
        if (activities?.length) useHabitStore.getState().completeLinkedHabits('recovery', target);
        get().checkBadges();
        toast(`Récupération enregistrée${target === todayKey() ? '' : ` pour le ${target}`}`, 'success');
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
        toast('Cycle enregistré', 'success');
      },
      // Sets an end date on the most recent OPEN (no endDate yet) cycle log —
      // period length is optional context, not required for phase estimation.
      markPeriodEnd: (id, endDate) =>
        set({ cycleLogs: get().cycleLogs.map((c) => (c.id === id ? { ...c, endDate: endDate || todayKey() } : c)) }),
      deleteCycleLog: (id) => set({ cycleLogs: get().cycleLogs.filter((c) => c.id !== id) }),
      // No cycle phase during pregnancy (no menstrual cycle) or menopause
      // (periods have stopped) — a calendar estimate would be meaningless,
      // not just unreliable. Perimenopause/postpartum still cycle (often
      // irregularly, which is expected) so phase estimation stays active.
      getCyclePhase: () => {
        const stage = get().healthProfile.lifeStage;
        if (stage === 'pregnant' || stage === 'menopause') return null;
        return computeCyclePhase(get().cycleLogs.map((c) => c.date), null, todayKey());
      },

      // Gestational age (LMP convention) + trimester, only when lifeStage is
      // 'pregnant' and a start date has been set.
      getPregnancyInfo: () => {
        const { lifeStage, pregnancyStartDate } = get().healthProfile;
        if (lifeStage !== 'pregnant' || !pregnancyStartDate) return null;
        const daysSince = Math.floor((new Date(todayKey() + 'T00:00:00') - new Date(pregnancyStartDate + 'T00:00:00')) / dayMs);
        if (daysSince < 0) return null;
        const weeks = Math.floor(daysSince / 7);
        const trimester = weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
        return { weeks, trimester };
      },

      // Weeks/months since birth + a breastfeeding kcal-addition tier, only
      // when lifeStage is 'postpartum' and a birth date has been set. IOM
      // (Institute of Medicine) DRI tables define the lactation energy
      // addition for 0-6 months (+330 kcal/j) and 7-12 months (+400 kcal/j)
      // of EXCLUSIVE breastfeeding — beyond 12 months there's no standard
      // DRI figure to apply, so no bump rather than a fabricated one.
      getPostpartumInfo: () => {
        const { lifeStage, postpartumStartDate, breastfeeding } = get().healthProfile;
        if (lifeStage !== 'postpartum' || !postpartumStartDate) return null;
        const daysSince = Math.floor((new Date(todayKey() + 'T00:00:00') - new Date(postpartumStartDate + 'T00:00:00')) / dayMs);
        if (daysSince < 0) return null;
        const weeks = Math.floor(daysSince / 7);
        const months = Math.floor(daysSince / 30.44);
        const kcalBump = breastfeeding && months < 6 ? 330 : breastfeeding && months < 12 ? 400 : 0;
        return { weeks, months, breastfeeding, kcalBump };
      },
});
