// Slice of healthStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../healthStore.js.
import { uid, todayKey } from '../../utils/formatters';
import { getMicronutrientRDA } from '../../utils/micronutrients';
import { estimateVO2max, cyclePhaseCoachingNote, assessCycleRegularity } from '../../utils/health-science';
import { useSkillStore } from '../skillStore';
import { useAuthStore } from '../authStore';
import { useHabitStore } from '../habitStore';
import { toast } from '../uiStore';
import { buildMetricSource, evaluateMetric, weeklySlope, metricInfo as metricDef } from '../../utils/metric-engine';
import { evaluateBadges } from '../../utils/badges';
import { numOrNull, normalizeGoal, goalDirection, dayMs, r1, BADGE_DEFS } from './helpers';

export const labsSlice = (set, get) => ({
      // ─────────── Blood tests (optional, user-entered lab values) ───────────
      logBloodTest: (data) => {
        const entry = { id: uid(), date: data.date || todayKey(), ferritinNgMl: data.ferritinNgMl ?? null, hemoglobinGDl: data.hemoglobinGDl ?? null, source: data.source || 'manual', notes: data.notes || '', createdAt: Date.now() };
        set({ bloodTests: [...get().bloodTests, entry].sort((a, b) => (a.date < b.date ? -1 : 1)) });
        toast('Analyse enregistrée', 'success');
      },
      deleteBloodTest: (id) => set({ bloodTests: get().bloodTests.filter((b) => b.id !== id) }),

      // Two independent signals, surfaced together but never merged into one
      // fabricated "risk score":
      // - dietaryIron: a purely descriptive 14-day average intake vs RDA
      //   (getMicronutrientRDA), from foods that carry real micronutrient
      //   data — no claim about deficiency, just "here's what you're eating".
      // - labStatus: only appears once the user has actually entered a real
      //   lab value. THEN, and only then, it's compared to the real WHO
      //   anemia/iron-deficiency reference thresholds (hemoglobin <12g/dL
      //   non-pregnant / <11g/dL pregnant; ferritin <15ng/mL = deficiency,
      //   <30ng/mL = depleted stores, common clinical secondary cutoff) —
      //   applying an established clinical reference to a real measured
      //   value is standard, unlike inferring a "risk" from food-diary data
      //   alone, which would be fabricated. Always framed as informational,
      //   never a diagnosis.
      getIronStatus: () => {
        const globalUser = useAuthStore.getState().user;
        const rda = getMicronutrientRDA(globalUser?.gender, get().healthProfile.lifeStage, !!get().healthProfile.breastfeeding);
        const cutoffKey = todayKey(new Date(Date.now() - 14 * dayMs));
        const recentNutrition = get().nutritionLogs.filter((n) => n.date >= cutoffKey);
        const ironByDay = {};
        for (const n of recentNutrition) {
          const ironVal = n.micros?.iron?.value;
          if (ironVal != null) ironByDay[n.date] = (ironByDay[n.date] || 0) + ironVal;
        }
        const daysWithData = Object.keys(ironByDay);
        const dietaryIron = daysWithData.length >= 3
          ? { avgMgPerDay: r1(daysWithData.reduce((a, d) => a + ironByDay[d], 0) / daysWithData.length), rdaMg: rda.iron.value, daysWithData: daysWithData.length }
          : null;

        const latestTest = [...get().bloodTests].filter((b) => b.ferritinNgMl != null || b.hemoglobinGDl != null).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        let labStatus = null;
        if (latestTest) {
          const hbThreshold = get().healthProfile.lifeStage === 'pregnant' ? 11.0 : 12.0;
          const ferritinLowThreshold = 15;
          const ferritinBorderlineThreshold = 30;
          const flags = [];
          if (latestTest.hemoglobinGDl != null && latestTest.hemoglobinGDl < hbThreshold) flags.push('hemoglobin_low');
          if (latestTest.ferritinNgMl != null && latestTest.ferritinNgMl < ferritinLowThreshold) flags.push('ferritin_low');
          else if (latestTest.ferritinNgMl != null && latestTest.ferritinNgMl < ferritinBorderlineThreshold) flags.push('ferritin_borderline');
          labStatus = { date: latestTest.date, hemoglobinGDl: latestTest.hemoglobinGDl, ferritinNgMl: latestTest.ferritinNgMl, flags, hbThreshold, ferritinLowThreshold, ferritinBorderlineThreshold };
        }
        return { dietaryIron, labStatus };
      },

      // Phase-aware coaching note + a training-load hint the active program
      // (if any) can be read against — informational only, never auto-alters
      // the stored program.
      getCyclePhaseCoaching: () => {
        const phase = get().getCyclePhase();
        if (!phase) return null;
        // Hormonal contraception (pill, IUD, implant...) generally suppresses
        // ovulation, so the calendar-estimated follicular/ovulation/luteal
        // sub-phases don't correspond to real hormonal fluctuations for these
        // users — giving phase-based energy/training/nutrition advice would
        // be asserting something not biologically true. The bleed window
        // itself (withdrawal bleed or spotting) is still real, so that part
        // stays informative; everything else is replaced with an explanatory
        // note and no training-load hint.
        if (get().healthProfile.hormonalContraception) {
          if (phase.phase === 'menstrual') {
            return { phase: phase.phase, note: 'Fenêtre de saignement — les ressentis peuvent varier, écoute-toi comme d\'habitude.', trainingLoadHint: null, hormonalNote: true };
          }
          return { phase: phase.phase, note: 'Sous contraception hormonale, l\'ovulation est généralement supprimée : cette estimation de phase ne reflète pas de vraies fluctuations hormonales pour toi, donc pas de conseil basé dessus.', trainingLoadHint: null, hormonalNote: true };
        }
        return { phase: phase.phase, ...cyclePhaseCoachingNote(phase.phase) };
      },
      isCyclePhaseHormonallyReliable: () => !get().healthProfile.hormonalContraception,

      // Cycle regularity + a lifestyle-awareness (not diagnostic) energy-
      // availability caution — surfaces a pattern where an irregular/late
      // cycle coincides with a sustained caloric deficit, which is worth the
      // user knowing about (RED-S / hypothalamic amenorrhea literature),
      // framed as "worth mentioning to a professional", never a verdict.
      getCycleHealthFlag: () => {
        // Irregular/absent cycles are the expected norm during pregnancy,
        // perimenopause and menopause — flagging them as a caution here
        // would be noise, not signal.
        const stage = get().healthProfile.lifeStage;
        if (stage === 'pregnant' || stage === 'menopause' || stage === 'perimenopause') return null;
        const regularity = assessCycleRegularity(get().cycleLogs.map((c) => c.date), todayKey());
        if (!regularity || regularity.status === 'insufficient_data' || regularity.status === 'regular') {
          return { regularity, energyAvailabilityCaution: false };
        }
        const plan = get().getActiveNutritionPlan();
        const cutoffKey = todayKey(new Date(Date.now() - 14 * dayMs));
        const recentNutrition = get().nutritionLogs.filter((n) => n.date >= cutoffKey);
        const loggedDays = [...new Set(recentNutrition.map((n) => n.date))];
        let energyAvailabilityCaution = false;
        if (plan?.targetKcal && loggedDays.length >= 7) {
          const kcalByDay = {};
          for (const n of recentNutrition) kcalByDay[n.date] = (kcalByDay[n.date] || 0) + n.kcal;
          const avgKcal = Object.values(kcalByDay).reduce((a, v) => a + v, 0) / loggedDays.length;
          energyAvailabilityCaution = avgKcal < plan.targetKcal * 0.8;
        }
        return { regularity, energyAvailabilityCaution };
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

      // ─────────── Goals (unified) ───────────
      // ONE goal system for the whole app (Santé > Progrès AND Programme).
      // A goal = a metric from utils/metric-engine (body weight, 1RM on an
      // exercise, sleep quality, protein, sessions/week, manual measure…) +
      // target + direction + baseline, optionally linked to a program/phase
      // (reaching it then awards that program's trophy). Legacy goals
      // ({type:'weight'|'strength'|…}) are normalised on read — nothing lost.
      addGoal: (input) => {
        const base = normalizeGoal({ ...input });
        const def = metricDef(base.metric?.key);
        let start = input.start != null ? Number(input.start) : null;
        if (start == null && def && def.agg !== 'week') {
          const src = buildMetricSource(get(), useHabitStore.getState());
          start = evaluateMetric(base.metric, src, { manualValues: base.manualValues }).current;
        }
        const entry = {
          id: uid(),
          title: input.title?.trim() || null,
          metric: base.metric,
          target: numOrNull(base.target),
          direction: input.direction || null,
          start,
          targetDate: input.targetDate || null,
          priority: input.priority || 'medium',
          programId: input.programId || null,
          phaseId: input.phaseId || null,
          manualValues: input.manualValues || [],
          sourceProgramGoalId: input.sourceProgramGoalId || null,
          achieved: !!input.achieved,
          achievedAt: input.achievedAt || null,
          createdAt: input.createdAt || Date.now(),
        };
        set({ goals: [...get().goals, entry] });
        if (!input.silent) toast('Objectif ajouté', 'success');
        return entry;
      },
      editGoal: (id, updates) => set({
        goals: get().goals.map((g) => {
          if (g.id !== id) return g;
          const n = normalizeGoal(g);
          return { ...n, ...updates, target: updates.target !== undefined ? numOrNull(updates.target) : n.target };
        }),
      }),
      deleteGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id) }),

      // Manual measure goals: record today's (or a given day's) value.
      logGoalValue: (id, value, date = todayKey()) => set({
        goals: get().goals.map((g) => {
          if (g.id !== id) return g;
          const vals = (g.manualValues || []).filter((v) => v.date !== date);
          return { ...normalizeGoal(g), manualValues: [...vals, { date, value: Number(value) }].sort((a, b) => (a.date < b.date ? -1 : 1)) };
        }),
      }),

      // One-shot import of Programme goals (previously a separate Supabase
      // system) — deduped by sourceProgramGoalId, the Supabase rows are left
      // untouched.
      importGoals: (list) => {
        const known = new Set(get().goals.map((g) => g.sourceProgramGoalId).filter(Boolean));
        const fresh = list.filter((g) => g.sourceProgramGoalId && !known.has(g.sourceProgramGoalId));
        for (const g of fresh) get().addGoal({ ...g, silent: true });
        return fresh.length;
      },

      // Progress for every goal from the shared metric engine; newly reached
      // goals are marked achieved once (+ a trophy event for program goals).
      getGoalsWithProgress: () => {
        const src = buildMetricSource(get(), useHabitStore.getState());
        const results = get().goals.map((raw) => {
          const g = normalizeGoal(raw);
          const def = metricDef(g.metric?.key) || { label: 'Mesure', unit: '' };
          const { series, current, unit } = evaluateMetric(g.metric, src, { manualValues: g.manualValues });
          const direction = goalDirection(g);
          const t = g.target;
          let percent = 0; let reached = false; let etaWeeks = null;
          if (current != null && t != null) {
            // Body measurements (weight, waist…) and anything that must go DOWN
            // are measured from the baseline (82 → 77 kg: 79.2 = 56 %). Records,
            // averages, frequencies and manual measures read as current/target
            // (bench 104.5 / 110 = 95 %), which is what people expect.
            const fromBaseline = direction === 'lower' || (def.agg === 'latest' && g.metric?.key !== 'manual');
            if (direction === 'lower') percent = g.start != null && g.start !== t ? ((g.start - current) / (g.start - t)) * 100 : (current <= t ? 100 : 0);
            else if (fromBaseline && g.start != null && g.start < t) percent = ((current - g.start) / (t - g.start)) * 100;
            else percent = t ? (current / t) * 100 : 0;
            percent = Math.round(Math.max(0, Math.min(100, percent)) * 10) / 10;
            reached = direction === 'lower' ? current <= t : current >= t;
            const slope = weeklySlope(series);
            const remaining = t - current;
            if (!reached && slope && Math.sign(slope) === Math.sign(remaining)) {
              const w = Math.ceil(Math.abs(remaining / slope));
              etaWeeks = w <= 104 ? w : null;
            }
          }
          const what = `${def.label}${g.metric?.exercise ? ` — ${g.metric.exercise}` : ''}`;
          const label = g.title || (t != null ? `${what} : ${t} ${unit || ''}`.trim() : what);
          return { ...g, def, what, label, unit, series, current, percent, reached, direction, etaWeeks };
        });

        const newly = results.filter((g) => g.reached && !g.achieved);
        if (newly.length) {
          // Deferred: this runs during render.
          queueMicrotask(() => {
            // Several renders can queue this before the first one lands —
            // only act on goals that are STILL unachieved (no double toast/trophy).
            const pending = newly.filter((n) => get().goals.some((g) => g.id === n.id && !g.achieved));
            if (!pending.length) return;
            const now = Date.now();
            set({ goals: get().goals.map((g) => (pending.some((n) => n.id === g.id) ? { ...g, achieved: true, achievedAt: now } : g)) });
            for (const g of pending) {
              toast(`🎯 Objectif atteint : ${g.label}`, 'success');
              if (g.programId && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('audax:goal-achieved', { detail: { ...g, series: undefined, def: undefined } }));
              }
            }
          });
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
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'health-discipline-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),
});
