import { useEffect, useState } from 'react';
import { Activity, Dumbbell, Moon, Salad, AlertTriangle, Award, Bell, BellOff, Sparkles, Send } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { readinessBand } from '../../utils/health-science';
import { todayKey } from '../../utils/formatters';
import { Card, Stat, Button, Input, Badge, ProgressBar, EmptyState } from '../../components/common/ui';

export default function Dashboard({ goTo }) {
  const { getReadiness, getCoachRecommendation, refreshAICoach, askHealthQuestion, getOvertrainingAlerts, getTodayNutrition, getBadges, workouts, logWorkout, getWeeklyDigest, reminders, setRemindersEnabled } = useHealthStore();
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const today = todayKey();
  const todayLog = energyLogs.find((l) => l.date === today);
  const digest = getWeeklyDigest();

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
      setAskError("AI coach isn't available right now (not configured or offline) — try again later.");
    } finally {
      setAsking(false);
    }
  };

  const toneColor = { danger: 'var(--error)', warning: 'var(--warning)', success: 'var(--success)', info: 'var(--accent-primary)' };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={toggleReminders}>
          <span className="flex items-center gap-2">
            {reminders.enabled ? <Bell size={13} /> : <BellOff size={13} />}
            {reminders.enabled ? 'Reminders on' : 'Enable reminders'}
          </span>
        </Button>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke={band.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(readiness.score / 100) * 326.7} 326.7`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{readiness.score}</span>
              <span className="text-[11px] font-semibold" style={{ color: band.color }}>{band.label}</span>
            </div>
          </div>
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(readiness.breakdown).map(([k, v]) => (
              <div key={k} className="text-center">
                <div className="text-xs text-mute capitalize mb-1">{k}</div>
                <div className="text-sm font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="border border-line rounded-xl p-4 flex items-start gap-3" style={{ borderColor: toneColor[coach.tone], background: `color-mix(in srgb, ${toneColor[coach.tone]} 8%, transparent)` }}>
        <Activity size={18} style={{ color: toneColor[coach.tone] }} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: toneColor[coach.tone] }}>Coach</div>
            {coach.source === 'ai' && (
              <span className="flex items-center gap-1 text-[10px] text-accent"><Sparkles size={10} /> AI</span>
            )}
          </div>
          <div className="text-sm">{coach.text}</div>
        </div>
      </div>

      <Card title="Ask the Health AI">
        <form onSubmit={submitQuestion} className="flex gap-2 mb-3">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Why is my energy low this week?" className="flex-1" />
          <Button type="submit" disabled={asking}>
            <span className="flex items-center gap-2">{asking ? 'Thinking…' : <><Send size={13} /> Ask</>}</span>
          </Button>
        </form>
        {answer && <div className="text-sm bg-surface border border-line rounded-lg p-3">{answer}</div>}
        {askError && <div className="text-sm text-bad">{askError}</div>}
        {!answer && !askError && !asking && <div className="text-xs text-mute">Ask anything about your own logged health data — requires the AI coach to be configured on this deployment.</div>}
      </Card>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 ${a.level === 'danger' ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`}>
              <AlertTriangle size={14} /> {a.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Sleep" value={todayLog ? `${todayLog.sleepData.sleepHours}h · ${todayLog.sleepData.sleepQualityScore}/10` : '—'} />
        <Stat label="Energy" value={todayLog ? `${todayLog.energyStartLevel}/10` : '—'} />
        <Stat label="Stress" value={todayLog ? `${todayLog.stressLevel}/10` : '—'} />
        <Stat label="Nutrition quality" value={nutrition.quality != null ? `${nutrition.quality}%` : '—'} sub={`${Math.round(nutrition.totals.protein)}g protein today`} />
      </div>

      <Card title="Workout of the Day" action={<Badge>{todayWorkouts.length ? 'Logged' : 'Not logged'}</Badge>}>
        {todayWorkouts.length ? (
          <ul className="space-y-1.5">
            {todayWorkouts.map((w) => (
              <li key={w.id} className="text-sm flex items-center gap-2">
                <Dumbbell size={13} className="text-mute" /> {w.exercise || w.type} {w.durationMin ? `· ${w.durationMin}m` : ''} {w.quality ? `· quality ${w.quality}/10` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => goTo?.('workout')}>Start a workout</Button>
            <Button variant="secondary" onClick={() => logWorkout({ type: 'cardio', exercise: 'Rest day', durationMin: 0, quality: null, notes: 'Skipped' })}>Skip today</Button>
          </div>
        )}
      </Card>

      <Card title="This Week" action={<Badge>Last 7 days</Badge>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div><div className="text-xs text-mute mb-1">Days logged</div><div className="text-lg font-semibold">{digest.daysLogged}/7</div></div>
          <div><div className="text-xs text-mute mb-1">Workouts</div><div className="text-lg font-semibold">{digest.totalWorkouts}</div></div>
          <div><div className="text-xs text-mute mb-1">Avg sleep</div><div className="text-lg font-semibold">{digest.avgSleepQuality ?? '—'}/10</div></div>
          <div><div className="text-xs text-mute mb-1">Avg energy</div><div className="text-lg font-semibold">{digest.avgEnergy ?? '—'}/10</div></div>
        </div>
      </Card>

      <Card title="Badges">
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${b.earned ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute opacity-50'}`}>
              <Award size={12} /> {b.name}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
