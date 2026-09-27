// Slice of healthStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../healthStore.js.
import { todayKey } from '../../utils/formatters';
import { foodQualityScore } from '../../utils/nutrition-db';
import { computeReadiness, computeWeightPrediction, checkOvertrainingTriggers, generateCoachRecommendation, pearsonCorrelation, estimate1RM, bodyFatYMCA, bodyFatDeurenberg, estimateFFMI, estimateLeanMassKg, smoothedTrend } from '../../utils/health-science';
import { useHabitStore } from '../habitStore';
import { useTradingStore } from '../tradingStore';
import { detectTiltSequences, detectRevengeTrades } from '../../utils/trading-psychology';
import { useAccountingStore } from '../accountingStore';
import { predictStrengthTrajectory, detectPlateau, checkAggressiveDeficit, checkTrendingOvertrainingRisk, explainPlateau } from '../../utils/health-predictions';
import { computeFastingWindows, computeHydrationGaps, computeMealTimingConsistency, computeSleepConsistency, computeNapImpact, deriveChronoAlerts } from '../../utils/health-chrono';
import { dayMs, r1 } from './helpers';

export const analyticsSlice = (set, get) => ({
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
        const energyLogs = useHabitStore.getState().energyLogs;
        const todayLog = energyLogs.find((l) => l.date === today);
        const readiness = get().getReadiness();
        const alerts = get().getOvertrainingAlerts();
        const weekAgo = Date.now() - 7 * dayMs;
        const workoutsThisWeek = get().workouts.filter((w) => new Date(w.date).getTime() >= weekAgo).length;
        // Cached for the day, but only while the inputs are unchanged — a new
        // workout or check-in must refresh the advice (it used to say "no
        // training this week" all day after a session was logged).
        const sig = [workoutsThisWeek, todayLog?.sleepData?.sleepQualityScore, todayLog?.energyStartLevel, todayLog?.stressLevel, readiness.score, alerts.length].join('|');
        const c = get().coachCache;
        if (c?.date === today && c?.lang === 'fr' && (c.source === 'ai' || c.sig === sig)) return c;
        const rec = generateCoachRecommendation({
          sleepQuality: todayLog?.sleepData?.sleepQualityScore ?? null,
          energy: todayLog?.energyStartLevel ?? null,
          stress: todayLog?.stressLevel ?? null,
          readiness: readiness.score,
          overtrainingAlerts: alerts,
          workoutsThisWeek,
        });
        const cached = { date: today, source: 'local', lang: 'fr', sig, ...rec };
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
          const { getAIDailyRecommendation } = await import('../../services/health-coach-ai');
          const text = await getAIDailyRecommendation(get().buildCoachContext());
          set({ coachCache: { date: today, text, tone: 'info', source: 'ai', lang: 'fr' } });
        } catch {
          // AI unavailable — local heuristic (already cached) remains shown.
        }
      },

      // Free-form Q&A about the user's own health data, scoped to the Health
      // page. Throws on failure — callers should catch and show a fallback message.
      askHealthQuestion: async (question) => {
        const { askAIHealthQuestion } = await import('../../services/health-coach-ai');
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
        const adherence = null; // Old program system removed — adherence now lives in programStore discipline
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
});
