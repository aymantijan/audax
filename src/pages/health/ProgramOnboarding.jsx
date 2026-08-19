import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Calendar, RefreshCw } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useAuthStore } from '../../store/authStore';
import { Card, Button, Wizard, Field, Input } from '../../components/common/ui';
import FreeTimeBlockPicker from '../../components/health/FreeTimeBlockPicker';
import { NUTRITION_STEPS } from './nutrition-wizard-steps';
import { generateProgramSchedule } from '../../utils/program-schedule-generator';
import { pushScheduleToCalendar } from '../../services/program-schedule-calendar';
import { bestSleepWindow } from '../../utils/health-science';
import { todayKey } from '../../utils/formatters';
import { useHabitStore } from '../../store/habitStore';

const EMPTY_WINDOWS = { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [], dimanche: [] };

function RecapStep({ data, set }) {
  const { getOnboardingRecap, logBodyComp } = useHealthStore();
  const gender = useAuthStore((s) => s.user?.gender);
  const recap = getOnboardingRecap();
  const [quickWeight, setQuickWeight] = useState('');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-line rounded-lg p-3">
          <div className="text-xs text-mute mb-1">Poids actuel</div>
          {recap.weightKg ? (
            <div className="text-sm font-semibold">{recap.weightKg} kg <span className="text-mute font-normal">({recap.weightDate})</span></div>
          ) : (
            <div className="flex gap-2 mt-1">
              <Input type="number" step="0.1" className="!py-1 !text-xs" value={quickWeight} onChange={(e) => setQuickWeight(e.target.value)} placeholder="kg" />
              <Button className="!px-2 !py-1 text-xs" onClick={() => quickWeight && logBodyComp({ weightKg: quickWeight, sex: gender || 'male' })}>OK</Button>
            </div>
          )}
        </div>
        <div className="bg-surface border border-line rounded-lg p-3">
          <div className="text-xs text-mute mb-1">Readiness (sommeil/énergie)</div>
          <div className="text-sm font-semibold">{recap.readinessScore}/100</div>
        </div>
      </div>
      <div className="bg-surface border border-line rounded-lg p-3">
        <div className="text-xs text-mute mb-2">Meilleurs 1RM connus</div>
        {recap.topPRs.length ? (
          <ul className="text-sm space-y-1">
            {recap.topPRs.map((p) => <li key={p.exercise}>{p.exercise} — {p.weight}kg</li>)}
          </ul>
        ) : (
          <div className="text-xs text-mute">Aucune donnée de force encore — pas bloquant, le planning n'en a pas besoin.</div>
        )}
      </div>
      <p className="text-xs text-mute">Ces données sont déjà connues — rien à ressaisir, juste une vérification avant de construire ton planning.</p>
    </div>
  );
}

const RECAP_STEP = { key: 'recap', title: 'Où tu en es', render: (d, set) => <RecapStep data={d} set={set} /> };

const AVAILABILITY_STEP = {
  key: 'availability', title: 'Tes disponibilités',
  validate: (d) => (Object.values(d.freeWindows || {}).every((r) => !r.length) ? 'Déclare au moins un créneau libre.' : null),
  render: (d, set) => (
    <>
      <p className="text-xs text-mute mb-3">Pour chaque jour, ajoute les créneaux où tu es réellement libre — le planning y placera cardio, séances et repas.</p>
      <FreeTimeBlockPicker value={d.freeWindows || EMPTY_WINDOWS} onChange={(freeWindows) => set({ freeWindows })} />
    </>
  ),
};

export default function ProgramOnboarding({ program, onCancel, onDone }) {
  const { getActiveNutritionPlan, generatePlan, completeHealthProfile, getEffectiveExercises, programSchedule, saveProgramSchedule, mergeScheduleCalendarResult } = useHealthStore();
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const activePlan = getActiveNutritionPlan();
  const [schedule, setSchedule] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [pushResults, setPushResults] = useState([]);
  const [forcePush, setForcePush] = useState(false);

  const buildSchedule = (data) => {
    const sleep = bestSleepWindow(energyLogs);
    const sleepWindow = { bedtime: data.bedtime || sleep?.bedtime || '23:00', wakeTime: data.wakeTime || sleep?.wakeTime || '07:00' };
    const plan = getActiveNutritionPlan();
    const mealsPerDay = data.mealsPerDay || plan?.sampleMeals?.length || 3;
    const estimateTrainingDuration = (programId, sessionKey) => {
      const eff = getEffectiveExercises(programId, sessionKey);
      return Math.max(30, (eff?.exercises.length || 6) * 8);
    };
    const result = generateProgramSchedule({
      program, phaseKey: resolvePhaseKeyClient(program), freeWindows: data.freeWindows || EMPTY_WINDOWS,
      mealsPerDay, sleepWindow, estimateTrainingDuration,
    });
    setSchedule(result);
    return result;
  };

  // Same phaseA/phaseB-by-date logic as healthStore's resolvePhaseKey — kept
  // here too since this component builds the schedule before anything is
  // saved to the store (nothing to call get() against yet for this program).
  function resolvePhaseKeyClient(p) {
    const ws = p.weeklyStructure;
    if (ws.phaseA && ws.phaseB) return ws.phaseSwitchDate && todayKey() >= ws.phaseSwitchDate ? 'phaseB' : 'phaseA';
    return Object.keys(ws).find((k) => Array.isArray(ws[k]) && ws[k][0]?.day) || 'main';
  }

  const steps = [
    ...(activePlan ? [] : NUTRITION_STEPS),
    AVAILABILITY_STEP,
    RECAP_STEP,
    {
      key: 'schedule', title: 'Ton planning',
      validate: () => (!schedule ? 'Génère le planning avant de continuer.' : null),
      render: (d, set) => {
        if (!schedule) {
          return (
            <div className="text-center py-6">
              <p className="text-sm text-mute mb-3">Prêt à générer ton planning à partir de tes disponibilités.</p>
              <Button onClick={() => buildSchedule(d)}>Générer mon planning</Button>
            </div>
          );
        }
        const hasUnresolvedWarnings = Object.values(schedule.days).some((day) => day.warnings.length > 0);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-mute">Ajuste les horaires si besoin avant de pousser vers Google Calendar.</p>
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setSchedule(null)}>
                <span className="flex items-center gap-1"><RefreshCw size={12} /> Recalculer</span>
              </Button>
            </div>
            {Object.entries(schedule.days).map(([dayKey, day]) => (
              <div key={dayKey} className="border border-line rounded-lg p-3">
                <div className="text-sm font-medium mb-2">{day.label}</div>
                <div className="grid grid-cols-2 gap-3">
                  {day.cardio && (
                    <div>
                      <div className="text-xs text-mute mb-1">Cardio {day.cardio.status === 'skipped' && '(non casé)'}</div>
                      {day.cardio.status !== 'skipped' ? (
                        <div className="flex gap-1.5">
                          <Input type="time" className="!py-1 !text-xs" value={day.cardio.start} onChange={(e) => setSchedule({ ...schedule, days: { ...schedule.days, [dayKey]: { ...day, cardio: { ...day.cardio, start: e.target.value } } } })} />
                          <Input type="time" className="!py-1 !text-xs" value={day.cardio.end} onChange={(e) => setSchedule({ ...schedule, days: { ...schedule.days, [dayKey]: { ...day, cardio: { ...day.cardio, end: e.target.value } } } })} />
                        </div>
                      ) : <span className="text-xs text-warning">{day.cardio.reason}</span>}
                    </div>
                  )}
                  {day.training && (
                    <div>
                      <div className="text-xs text-mute mb-1">{program.sessions[day.training.sessionKey]?.label || 'Séance'} {day.training.status === 'skipped' && '(non casée)'}</div>
                      {day.training.status !== 'skipped' ? (
                        <div className="flex gap-1.5">
                          <Input type="time" className="!py-1 !text-xs" value={day.training.start} onChange={(e) => setSchedule({ ...schedule, days: { ...schedule.days, [dayKey]: { ...day, training: { ...day.training, start: e.target.value } } } })} />
                          <Input type="time" className="!py-1 !text-xs" value={day.training.end} onChange={(e) => setSchedule({ ...schedule, days: { ...schedule.days, [dayKey]: { ...day, training: { ...day.training, end: e.target.value } } } })} />
                        </div>
                      ) : <span className="text-xs text-warning">{day.training.reason}</span>}
                    </div>
                  )}
                </div>
                {day.meals.length > 0 && <div className="text-[11px] text-mute mt-2">Repas : {day.meals.map((m) => m.time).join(' · ')}</div>}
                {day.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-warning mt-1"><AlertTriangle size={11} /> {w.message}</div>
                ))}
              </div>
            ))}
            {hasUnresolvedWarnings && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={forcePush} onChange={(e) => setForcePush(e.target.checked)} />
                Pousser quand même malgré les créneaux non résolus ci-dessus
              </label>
            )}
            {pushResults.length > 0 && (
              <div className="text-xs text-mute">{pushResults.filter((r) => r.status === 'ok').length}/{pushResults.length} événements créés dans Google Calendar.</div>
            )}
          </div>
        );
      },
    },
  ];

  const finish = async (data) => {
    if (!activePlan && data.dietGoal) {
      completeHealthProfile(data);
      generatePlan();
    }
    const finalSchedule = schedule || buildSchedule(data);

    // Feeds Tier 1 (foreground, useHealthReminders.js) + Tier 2 (cron,
    // best-effort) of the notification scheduler — meals/water/bedtime are
    // never Google Calendar events (see plan), just reminder preferences.
    const firstDayWithMeals = Object.values(finalSchedule.days).find((d) => d.meals.length);
    useHealthStore.getState().setHealthProfile({
      reminderPrefs: {
        ...useHealthStore.getState().healthProfile.reminderPrefs,
        mealWindows: (firstDayWithMeals?.meals || []).map((m) => m.time),
        bedtimeTarget: finalSchedule.sleepWindow.bedtime,
        weighInTime: finalSchedule.sleepWindow.wakeTime,
        // Captured so the server-side cron (api/reminders-cron.js, which has
        // no browser context of its own) can convert its UTC "now" into each
        // user's local time before comparing against these HH:MM targets.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    setPushing(true);
    saveProgramSchedule({
      curatedProgramId: program.id, generatedAt: Date.now(), phaseKey: finalSchedule.phaseKey,
      freeWindows: data.freeWindows, sleepWindow: finalSchedule.sleepWindow, mealsPerDay: finalSchedule.mealsPerDay,
      days: finalSchedule.days, calendarEventIds: {},
    });
    try {
      const results = await pushScheduleToCalendar(program, finalSchedule, { onProgress: mergeScheduleCalendarResult });
      setPushResults(results);
    } catch (err) {
      setPushResults([{ status: 'error', error: err.message }]);
    } finally {
      setPushing(false);
      onDone?.();
    }
  };

  return (
    <div>
      <Wizard steps={steps} initialData={{ freeWindows: EMPTY_WINDOWS }} onComplete={finish} onCancel={onCancel} />
      {pushing && <p className="text-xs text-mute mt-3 flex items-center gap-2"><Calendar size={12} /> Envoi vers Google Calendar…</p>}
    </div>
  );
}
