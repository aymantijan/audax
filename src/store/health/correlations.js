// Slice of healthStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../healthStore.js.
import { todayKey } from '../../utils/formatters';
import { pearsonCorrelation, bestSleepWindow, getSleepLoadTarget, estimate1RM } from '../../utils/health-science';
import { useHabitStore } from '../habitStore';
import { useTradingStore } from '../tradingStore';
import { useAccountingStore } from '../accountingStore';
import { dayMs, r1 } from './helpers';

export const correlationsSlice = (set, get) => ({
      // ─────────── Custom correlation picker (Analytics: "pick any two") ───────────
      getMetricRegistry: () => [
        { value: 'sleepQuality', label: 'Qualité du sommeil' },
        { value: 'stress', label: 'Stress' },
        { value: 'energy', label: 'Énergie' },
        { value: 'strengthVolume', label: 'Volume de musculation (kg)' },
        { value: 'cardioMinutes', label: 'Minutes de cardio' },
        { value: 'workoutQuality', label: 'Qualité de la séance' },
        { value: 'spending', label: 'Dépenses' },
        { value: 'tradingWinRate', label: 'Taux de réussite (trading)' },
        { value: 'tradingPnl', label: 'Résultat trading' },
        { value: 'waterMl', label: 'Eau bue (ml)' },
        { value: 'weightKg', label: 'Poids (kg)' },
        { value: 'proteinG', label: 'Protéines (g)' },
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

      // Cardio sessions as a flat time-series — each entry carries its captured
      // metrics (duration, distance, avgHr, zone…) so a trend chart can plot
      // evolution per modality. Sorted oldest→newest for charting.
      getCardioSessions: () =>
        get()
          .workouts.filter((w) => w.type === 'cardio')
          .map((w) => ({
            id: w.id,
            date: w.date,
            modality: w.cardio?.modalityName || w.exercise || 'Cardio',
            modalityId: w.cardio?.modalityId || null,
            durationMin: Number(w.durationMin) || 0,
            distance: w.cardio?.distance != null && w.cardio.distance !== '' ? Number(w.cardio.distance) : null,
            avgHr: w.cardio?.avgHr != null && w.cardio.avgHr !== '' ? Number(w.cardio.avgHr) : null,
            zone: w.cardio?.zone != null ? Number(w.cardio.zone) : null,
            cardio: w.cardio || null,
          }))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),

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
        // (The old curated-program sleepFloor source was removed with that
        // system — calling it crashed the whole Sleep page.)
        const cycleCoaching = get().getCyclePhaseCoaching();
        const floorParts = [];
        // Luteal-phase floor assumes a real progesterone rise, which hormonal
        // contraception generally suppresses — the bleed-window (menstrual)
        // floor stays regardless, since that discomfort is independent of
        // contraceptive method.
        const hormonallyReliable = get().isCyclePhaseHormonallyReliable();
        if (cycleCoaching?.phase === 'menstrual' || (hormonallyReliable && cycleCoaching?.phase === 'luteal')) {
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
          workouts: [], nutritionLogs: [], proteinTargetG: 140, mealTemplates: [], customFoods: [], foodPrices: {}, foodOverrides: {}, bodyComp: [], activityDays: [], recoveryLogs: [],
          checkins: [], pendingPrompts: [], awardedBadges: [], coachCache: null, cycleLogs: [], bloodTests: [], goals: [],
          customCycleSymptoms: [], customRecoveryActivities: [], waterTargetMl: 2500, weightUnit: 'kg',
          reminders: {
        enabled: false, lastMorningReminderDate: null, lastWorkoutReminderDate: null,
        lastWaterReminderAt: null, lastMealReminderKey: null, lastBedtimeReminderDate: null,
      },
          trainingPrograms: [], nutritionPlans: [], waterLogs: [], performanceLogs: [],
          activeCuratedProgramId: null, programVariants: [], programOverrides: {}, programSchedule: null, curatedSessionProgress: {},
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
});
