import { useEffect, useState } from 'react';
import { Activity, Dumbbell, Moon, Salad, AlertTriangle, Bell, BellOff, Sparkles, Send, TrendingUp, ClipboardList, ArrowUp, ArrowDown, Target, ChevronRight, CalendarDays } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { readinessBand } from '../../utils/health-science';
import { todayKey } from '../../utils/formatters';
import { Card, Stat, Button, Input, Badge, ProgressBar, EmptyState } from '../../components/common/ui';
import BadgeList from '../../components/common/BadgeList';
import QuickCheckin from './QuickCheckin';
import { useProgramStore } from '../../store/programStore';
import DailyView from './program/DailyView';
import DisciplineCard from './program/DisciplineCard';
import { tierFor } from './program/ReadinessCard';

export default function Dashboard({ goTo }) {
  const { getReadiness, getCoachRecommendation, refreshAICoach, askHealthQuestion, getOvertrainingAlerts, getTodayNutrition, getBadges, workouts, logWorkout, getWeeklyDigest, reminders, setRemindersEnabled, healthProfile, getTrendAlerts, getWeekOverWeekDelta, getActivityHeatmap, nutritionPlans, proteinTargetG, waterLogs, waterTargetMl, getGoalsWithProgress } = useHealthStore();
  const programAvailable = useProgramStore((s) => s.available);
  const activeProgram = useProgramStore((s) => s.activeProgram);
  // Aujourd'hui is also the Programme's daily cockpit — make sure it's loaded.
  useEffect(() => { if (programAvailable) useProgramStore.getState().initialize(); }, [programAvailable]);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const today = todayKey();
  const todayLog = energyLogs.find((l) => l.date === today);
  const digest = getWeeklyDigest();
  const trendAlerts = getTrendAlerts();
  const weekDelta = getWeekOverWeekDelta();
  const heatmap = getActivityHeatmap(90);

  const toggleReminders = async () => {
    if (reminders.enabled) return setRemindersEnabled(false);
    if (typeof Notification === 'undefined') return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') setRemindersEnabled(true);
  };

  const readiness = getReadiness();
  const band = readinessBand(readiness.score);
  const coach = getCoachRecommendation();
  const alerts = getOvertrainingAlerts();
  const nutrition = getTodayNutrition();
  const badges = getBadges();
  const todayWorkouts = workouts.filter((w) => w.date === today);

  // Tries to upgrade the instant local heuristic to a real AI recommendation —
  // no-ops silently if the OpenRouter proxy isn't configured/reachable.
  useEffect(() => {
    refreshAICoach();
  }, [refreshAICoach]);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError('');
    setAnswer(null);
    try {
      const text = await askHealthQuestion(question.trim());
      setAnswer(text);
    } catch {
      setAskError('Le coach IA n’est pas disponible pour le moment (non configuré ou hors ligne) — réessaie plus tard.');
    } finally {
      setAsking(false);
    }
  };

  const toneColor = { danger: 'var(--error)', warning: 'var(--warning)', success: 'var(--success)', info: 'var(--accent-primary)' };

  const tier = tierFor(readiness.score);
  const activePlan = (nutritionPlans || []).find((p) => p.active);
  const waterToday = (waterLogs || []).filter((w) => w.date === today).reduce((a, w) => a + (Number(w.amountMl) || 0), 0);
  const nutritionRows = [
    { label: 'Calories', value: nutrition.totals.kcal, target: activePlan?.targetKcal, unit: 'kcal', color: 'var(--accent-primary)' },
    { label: 'Protéines', value: nutrition.totals.protein, target: activePlan?.targetMacros?.proteinG ?? proteinTargetG, unit: 'g', color: 'var(--success)' },
    { label: 'Glucides', value: nutrition.totals.carbs, target: activePlan?.targetMacros?.carbsG, unit: 'g', color: 'var(--warning)' },
    { label: 'Lipides', value: nutrition.totals.fat, target: activePlan?.targetMacros?.fatG, unit: 'g', color: 'var(--accent-secondary)' },
    { label: 'Eau', value: waterToday / 1000, target: (waterTargetMl || 0) / 1000, unit: 'L', color: '#38bdf8' },
  ].filter((r) => r.target);
  const nearGoals = getGoalsWithProgress().filter((g) => !g.achieved).sort((a, b) => b.percent - a.percent).slice(0, 3);
  const r1 = (v) => Math.round(v * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold capitalize text-ink">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="text-xs text-mute">Ta journée santé en un coup d’œil</div>
        </div>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={toggleReminders}>
          <span className="flex items-center gap-2">
            {reminders.enabled ? <Bell size={13} /> : <BellOff size={13} />}
            {reminders.enabled ? 'Rappels activés' : 'Activer les rappels'}
          </span>
        </Button>
      </div>

      {!healthProfile.completedAt && !activeProgram && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm"><ClipboardList size={16} /> Construis ton plan personnalisé (programme + nutrition) — 2 minutes.</span>
          <Button className="shrink-0 !px-3 !py-1.5 text-xs" onClick={() => goTo?.('setup')}>Commencer</Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left: the day ── */}
        <div className="min-w-0 space-y-6">
          {activeProgram ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays size={15} className="text-accent" /> Programme du jour</h3>
                <button onClick={() => goTo?.('programs')} className="flex items-center gap-0.5 text-xs text-mute hover:text-accent cursor-pointer">{activeProgram.name} <ChevronRight size={13} /></button>
              </div>
              <DailyView />
            </div>
          ) : (
            <Card title="Séance du jour" action={<Badge>{todayWorkouts.length ? 'Faite' : 'Pas encore'}</Badge>}>
              {todayWorkouts.length ? (
                <ul className="space-y-1.5">
                  {todayWorkouts.map((w) => (
                    <li key={w.id} className="flex items-center gap-2 text-sm">
                      <Dumbbell size={13} className="text-mute" /> {w.exercise || w.type} {w.durationMin ? `· ${w.durationMin} min` : ''} {w.quality ? `· ressenti ${w.quality}/10` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => goTo?.('workout')}>Commencer une séance</Button>
                  <Button variant="secondary" onClick={() => logWorkout({ type: 'cardio', exercise: 'Rest day', durationMin: 0, quality: null, notes: 'Skipped' })}>Pas de séance aujourd’hui</Button>
                </div>
              )}
            </Card>
          )}

          <QuickCheckin />

          <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: toneColor[coach.tone], background: `color-mix(in srgb, ${toneColor[coach.tone]} 8%, transparent)` }}>
            <Activity size={18} style={{ color: toneColor[coach.tone] }} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: toneColor[coach.tone] }}>Coach</div>
                {coach.source === 'ai' && <span className="flex items-center gap-1 text-[10px] text-accent"><Sparkles size={10} /> IA</span>}
              </div>
              <div className="text-sm">{coach.text}</div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${a.level === 'danger' ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`}>
                  <AlertTriangle size={14} /> {a.message}
                </div>
              ))}
            </div>
          )}

          {trendAlerts.length > 0 && (
            <Card title="Alertes de tendance" action={<TrendingUp size={14} className="text-mute" />}>
              <div className="space-y-2">
                {trendAlerts.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className={a.level === 'warning' ? 'text-warning' : 'text-ink'}>{a.message}</div>
                    {a.explanation && <div className="mt-0.5 text-xs text-mute">{a.explanation}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Nutrition du jour" action={<button onClick={() => goTo?.('nutrition')} className="flex items-center gap-0.5 text-xs text-mute hover:text-accent cursor-pointer">Ajouter un repas <ChevronRight size={13} /></button>}>
            {nutritionRows.length ? (
              <div className="space-y-3">
                {nutritionRows.map((r) => {
                  const left = r.target - r.value;
                  return (
                    <div key={r.label}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="text-ink">{r.label}</span>
                        <span className="text-xs text-mute">
                          <span className="font-semibold text-ink">{r1(r.value)}</span> / {r1(r.target)} {r.unit}
                          {' · '}{left > 0 ? `reste ${r1(left)} ${r.unit}` : 'atteint ✓'}
                        </span>
                      </div>
                      <ProgressBar value={r.value} max={r.target} color={r.color} height={6} />
                    </div>
                  );
                })}
                {nutrition.quality != null && <div className="text-xs text-mute">Qualité des aliments : {nutrition.quality} %</div>}
              </div>
            ) : (
              <EmptyState>Pas encore de cibles nutritionnelles — crée ton plan dans Nutrition.</EmptyState>
            )}
          </Card>
        </div>

        {/* ── Right: how you are ── */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={band.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(readiness.score / 100) * 326.7} 326.7`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{readiness.score}</span>
                  <span className="text-[10px] font-semibold" style={{ color: band.color }}>{band.label}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-mute">Readiness</div>
                <div className="text-sm font-semibold" style={{ color: tier.color }}>{tier.label}</div>
                <p className="mt-0.5 text-xs text-mute">{tier.action}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              <div><div className="text-[11px] text-mute">Sommeil</div><div className="text-sm font-semibold">{todayLog?.sleepData ? `${todayLog.sleepData.sleepHours} h` : '—'}</div></div>
              <div><div className="text-[11px] text-mute">Énergie</div><div className="text-sm font-semibold">{todayLog ? `${todayLog.energyStartLevel}/10` : '—'}</div></div>
              <div><div className="text-[11px] text-mute">Stress</div><div className="text-sm font-semibold">{todayLog ? `${todayLog.stressLevel}/10` : '—'}</div></div>
            </div>
          </Card>

          <Card title="Objectifs les plus proches" action={<button onClick={() => goTo?.('goals')} className="flex items-center gap-0.5 text-xs text-mute hover:text-accent cursor-pointer">Tous <ChevronRight size={13} /></button>}>
            {nearGoals.length ? (
              <ul className="space-y-3">
                {nearGoals.map((g) => (
                  <li key={g.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-ink"><Target size={12} className="shrink-0 text-accent" /> <span className="truncate">{g.title || g.what}</span></span>
                      <span className="shrink-0 text-xs font-semibold">{g.percent} %</span>
                    </div>
                    <ProgressBar value={g.percent} color={g.percent >= 90 ? 'var(--success)' : 'var(--accent-primary)'} height={6} />
                    <div className="mt-0.5 text-[11px] text-mute">{g.current ?? '—'} → {g.target} {g.unit}{g.etaWeeks != null ? ` · ≈ ${g.etaWeeks} sem.` : ''}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Aucun objectif en cours.</EmptyState>
            )}
          </Card>

          {activeProgram && <DisciplineCard />}
        </div>
      </div>

      <Card title="Cette semaine" action={<Badge>7 derniers jours</Badge>}>
        <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
          <div><div className="mb-1 text-xs text-mute">Jours renseignés</div><div className="text-lg font-semibold">{digest.daysLogged}/7</div></div>
          <div>
            <div className="mb-1 text-xs text-mute">Séances</div>
            <div className="flex items-center justify-center gap-1.5 text-lg font-semibold">{digest.totalWorkouts} <DeltaChip value={weekDelta.workouts.delta} /></div>
          </div>
          <div>
            <div className="mb-1 text-xs text-mute">Sommeil moy.</div>
            <div className="flex items-center justify-center gap-1.5 text-lg font-semibold">{digest.avgSleepQuality ?? '—'}/10 <DeltaChip value={weekDelta.avgSleepQuality.delta} /></div>
          </div>
          <div>
            <div className="mb-1 text-xs text-mute">Énergie moy.</div>
            <div className="flex items-center justify-center gap-1.5 text-lg font-semibold">{digest.avgEnergy ?? '—'}/10 <DeltaChip value={weekDelta.avgEnergy.delta} /></div>
          </div>
        </div>
      </Card>

      <Card title="Demander au coach santé IA">
        <form onSubmit={submitQuestion} className="mb-3 flex gap-2">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ex. Pourquoi mon énergie est-elle basse cette semaine ?" className="flex-1" />
          <Button type="submit" disabled={asking}>
            <span className="flex items-center gap-2">{asking ? 'Réflexion…' : <><Send size={13} /> Demander</>}</span>
          </Button>
        </form>
        {answer && <div className="rounded-lg border border-line bg-surface p-3 text-sm">{answer}</div>}
        {askError && <div className="text-sm text-bad">{askError}</div>}
        {!answer && !askError && !asking && <div className="text-xs text-mute">Pose une question sur tes propres données santé — nécessite que le coach IA soit configuré.</div>}
      </Card>

      {heatmap.some((h) => h.count > 0) && (
        <Card title="Régularité — 90 derniers jours">
          <ActivityHeatmap data={heatmap} />
        </Card>
      )}

      <BadgeList badges={badges} />
    </div>
  );
}

function DeltaChip({ value }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-good' : 'text-bad'}`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(value)}
    </span>
  );
}

// GitHub-style contribution heatmap over the trailing N days — cheap custom
// grid (no chart lib needed), colored by log-density that day.
function ActivityHeatmap({ data }) {
  const weeks = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));
  const max = Math.max(1, ...data.map((d) => d.count));
  const colorFor = (count) => {
    if (!count) return 'var(--border)';
    const pct = Math.min(1, count / max);
    return `color-mix(in srgb, var(--accent-primary) ${20 + pct * 80}%, transparent)`;
  };
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((d) => (
            <div key={d.date} title={`${d.date} : ${d.count} saisie${d.count !== 1 ? 's' : ''}`} className="w-2.5 h-2.5 rounded-sm" style={{ background: colorFor(d.count) }} />
          ))}
        </div>
      ))}
    </div>
  );
}
