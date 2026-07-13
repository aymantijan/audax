import { useMemo, useState } from 'react';
import { Plus, Trash2, Flame, AlertTriangle, Pencil } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHabitStore } from '../store/habitStore';
import { useTradingStore } from '../store/tradingStore';
import { useSkillStore } from '../store/skillStore';
import { habitStreak, habitCompliance, isHabitDueOn } from '../utils/calculations';
import { calculateSleepScore, SLEEP_BAND_COLOR, SLEEP_BAND_LABEL } from '../utils/sleep-quality';
import { calculateStressLevel, stressLabel } from '../utils/stress-calculator';
import { checkBurnoutTriggers } from '../utils/burnout';
import { HABIT_CATEGORIES, HABIT_FREQUENCIES, WEEKDAYS, MOODS, RECOVERY_ACTIVITIES, STRESS_ITEMS, SKILL_MAP } from '../utils/constants';
import { HABIT_TEMPLATES } from '../utils/habit-templates';
import { habitSchema, validate } from '../utils/validators';
import { todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState, ProgressBar, WeekdayPicker } from '../components/common/ui';
import SkillPicker from '../components/common/SkillPicker';
import EntityFormModal from '../components/common/EntityFormModal';

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
};

const blankCheckIn = () => ({
  energyStartLevel: 6,
  sleepHours: 7,
  sleepStartTime: '23:00',
  wakeTime: '07:00',
  stressChecklist: Object.fromEntries(STRESS_ITEMS.map((i) => [i.key, 0])),
  recoveryActivities: [],
  energyEndLevel: 6,
  mood: 'okay',
});

export default function Habits() {
  const { habits, logs, energyLogs, addHabit, editHabit, deleteHabit, toggleHabit, saveEnergyLog } = useHabitStore();
  const [editing, setEditing] = useState(null);
  const trades = useTradingStore((s) => s.trades);
  const skills = useSkillStore((s) => s.skills);

  const today = todayKey();
  const blankHabit = { name: '', category: 'trading', xpReward: 5, linkedSkill: '', mandatory: false, frequency: 'daily', weekdays: [], duration: 15, targetStreak: 30 };
  const [habitModal, setHabitModal] = useState(false);
  const [habitForm, setHabitForm] = useState(blankHabit);
  const [habitError, setHabitError] = useState('');
  const [habitTemplate, setHabitTemplate] = useState('');

  const applyHabitTemplate = (value) => {
    setHabitTemplate(value);
    if (!value) return;
    const [group, name] = value.split('||');
    const tpl = HABIT_TEMPLATES.find((g) => g.group === group)?.items.find((i) => i.name === name);
    if (tpl) {
      const linkedSkill = tpl.linkedSkill && skills[tpl.linkedSkill] && !skills[tpl.linkedSkill].locked ? tpl.linkedSkill : '';
      setHabitForm({ ...blankHabit, ...tpl, linkedSkill });
    }
  };

  const existing = energyLogs.find((l) => l.date === today);
  const [checkIn, setCheckIn] = useState(() =>
    existing
      ? {
          energyStartLevel: existing.energyStartLevel,
          sleepHours: existing.sleepData.sleepHours,
          sleepStartTime: existing.sleepData.sleepStartTime,
          wakeTime: existing.sleepData.wakeTime,
          stressChecklist: existing.stressChecklist,
          recoveryActivities: existing.recoveryActivities || [],
          energyEndLevel: existing.energyEndLevel,
          mood: existing.mood,
        }
      : blankCheckIn()
  );

  const sleepEval = calculateSleepScore(checkIn.sleepStartTime, checkIn.wakeTime) || { score: 0, durationHours: 0, durationScore: 0, timingScore: 0, band: 'critical' };
  const sleepScore = sleepEval.score;
  const stressLevel = calculateStressLevel(checkIn.stressChecklist);

  const active = habits.filter((h) => !h.archived);
  const dueToday = active.filter((h) => isHabitDueOn(h, today)); // e.g. hides a Mon/Wed/Fri habit on a Tuesday
  const compliance = habitCompliance(active, logs, 7, today);
  const burnout = useMemo(
    () => checkBurnoutTriggers({ energyLogs, compliance, trades }),
    [energyLogs, compliance, trades]
  );

  const trend = useMemo(
    () =>
      [...energyLogs]
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .slice(-30)
        .map((l) => ({
          date: l.date.slice(5),
          energy: l.energyStartLevel,
          sleep: l.sleepData?.sleepQualityScore,
          stress: l.stressLevel,
        })),
    [energyLogs]
  );

  const submitHabit = (e) => {
    e.preventDefault();
    const res = validate(habitSchema, { ...habitForm, linkedSkill: habitForm.linkedSkill || undefined });
    if (!res.ok) return setHabitError(res.error);
    addHabit({
      ...res.data,
      frequency: habitForm.frequency,
      weekdays: habitForm.frequency === 'custom' ? habitForm.weekdays : [],
      duration: Number(habitForm.duration) || 15,
      targetStreak: Number(habitForm.targetStreak) || 30,
    });
    setHabitModal(false);
    setHabitForm(blankHabit);
    setHabitTemplate('');
    setHabitError('');
  };

  // Compliance by category over the last 30 days (daily habits only)
  const categoryCompliance = useMemo(
    () =>
      HABIT_CATEGORIES.map((cat) => {
        const catHabits = active.filter((h) => h.category === cat && h.frequency !== 'weekly');
        if (!catHabits.length) return null;
        const c = habitCompliance(catHabits, logs, 30, today);
        return { category: cat, rate: c.rate * 100, habits: catHabits.length };
      }).filter(Boolean),
    [active, logs, today]
  );

  const submitCheckIn = () => {
    saveEnergyLog({
      date: today,
      energyStartLevel: Number(checkIn.energyStartLevel),
      sleepData: {
        sleepHours: Number(sleepEval.durationHours.toFixed(2)),
        sleepStartTime: checkIn.sleepStartTime,
        wakeTime: checkIn.wakeTime,
        sleepQualityScore: sleepScore,
      },
      stressLevel,
      stressChecklist: checkIn.stressChecklist,
      recoveryActivities: checkIn.recoveryActivities,
      energyEndLevel: Number(checkIn.energyEndLevel),
      mood: checkIn.mood,
    });
  };

  const toggleRecovery = (act) =>
    setCheckIn((c) => ({
      ...c,
      recoveryActivities: c.recoveryActivities.includes(act)
        ? c.recoveryActivities.filter((a) => a !== act)
        : [...c.recoveryActivities, act],
    }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Habits & Energy</h1>
          <p className="text-mute text-sm mt-1">Daily systems and burnout early warning.</p>
        </div>
        <Button onClick={() => setHabitModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Habit</span>
        </Button>
      </div>

      {burnout.burnoutRisk && (
        <div className="border border-bad/50 bg-bad/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-bad font-semibold">
            <AlertTriangle size={18} /> Burnout risk ({burnout.overallSeverity})
          </div>
          {burnout.triggers.map((t) => (
            <div key={t.trigger} className="text-sm">
              <span className="text-ink">{t.message}</span> <span className="text-mute">— {t.recommendation}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Habits today" value={`${dueToday.filter((h) => logs.some((l) => l.habitId === h.id && l.date === today && l.completed)).length}/${dueToday.length}`} />
        <Stat label="7-day compliance" value={compliance.total ? `${Math.round(compliance.rate * 100)}%` : '—'} />
        <Stat label="Sleep quality today" value={existing ? `${existing.sleepData.sleepQualityScore}/10` : '—'} />
        <Stat label="Stress today" value={existing ? `${existing.stressLevel}/10` : '—'} sub={existing ? stressLabel(existing.stressLevel) : ''} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Today's Habits">
          {dueToday.length ? (
            <ul className="space-y-2.5">
              {dueToday.map((h) => {
                const done = logs.some((l) => l.habitId === h.id && l.date === today && l.completed);
                const streak = habitStreak(h.id, logs, today, h);
                const scheduleLabel =
                  h.frequency === 'weekly' ? 'weekly' : h.frequency === 'custom' && h.weekdays?.length ? h.weekdays.map((w) => WEEKDAYS.find((d) => d.value === w)?.label).join('/') : null;
                return (
                  <li key={h.id} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-3">
                    <input type="checkbox" checked={done} onChange={() => toggleHabit(h.id)} className="w-4 h-4 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${done ? 'line-through text-mute' : ''}`}>{h.name}</div>
                      <div className="text-[11px] text-mute">
                        {h.category}{scheduleLabel ? ` · ${scheduleLabel}` : ''}{h.duration ? ` · ${h.duration}m` : ''} · +{h.xpReward} XP
                        {h.linkedSkill ? ` → ${SKILL_MAP[h.linkedSkill]?.name}` : ''}
                        {h.mandatory ? ' · mandatory' : ''}
                      </div>
                    </div>
                    {streak > 0 && (
                      <Badge color="var(--warning)">
                        <span className="flex items-center gap-1"><Flame size={11} /> {streak}</span>
                      </Badge>
                    )}
                    <button className="text-mute hover:text-accent cursor-pointer mr-1" onClick={() => setEditing(h)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Delete habit "${h.name}"?`)) deleteHabit(h.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>No habits yet. Start with one keystone habit.</EmptyState>
          )}
        </Card>

        <Card title="Energy Check-in" action={existing && <Badge color="var(--success)">Logged today</Badge>}>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Morning</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Energy: ${checkIn.energyStartLevel}/10`}>
                  <input type="range" min="1" max="10" value={checkIn.energyStartLevel} onChange={(e) => setCheckIn({ ...checkIn, energyStartLevel: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label="Bedtime">
                  <Input type="time" value={checkIn.sleepStartTime} onChange={(e) => setCheckIn({ ...checkIn, sleepStartTime: e.target.value })} />
                </Field>
                <Field label="Wake time">
                  <Input type="time" value={checkIn.wakeTime} onChange={(e) => setCheckIn({ ...checkIn, wakeTime: e.target.value })} />
                </Field>
                <div className="text-xs text-mute self-end pb-2">
                  Duration: <span className="text-ink font-medium">{sleepEval.durationHours.toFixed(1)}h</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2">
                <div className="text-2xl font-bold" style={{ color: SLEEP_BAND_COLOR[sleepEval.band] }}>
                  {sleepScore}/10
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ color: SLEEP_BAND_COLOR[sleepEval.band] }}>{SLEEP_BAND_LABEL[sleepEval.band]}</div>
                  <div className="text-[11px] text-mute">
                    Duration {sleepEval.durationScore}/5 · Timing {sleepEval.timingScore}/5
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">
                Stress check ({stressLevel}/10 — {stressLabel(stressLevel)})
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {STRESS_ITEMS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-mute">{item.label}</span>
                    <select
                      className="bg-surface border border-line rounded px-1.5 py-0.5 text-xs"
                      value={checkIn.stressChecklist[item.key]}
                      onChange={(e) =>
                        setCheckIn({ ...checkIn, stressChecklist: { ...checkIn.stressChecklist, [item.key]: Number(e.target.value) } })
                      }
                    >
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Recovery today</div>
              <div className="flex flex-wrap gap-2">
                {RECOVERY_ACTIVITIES.map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => toggleRecovery(act)}
                    className={`px-3 py-1 rounded-full text-xs border capitalize cursor-pointer ${
                      checkIn.recoveryActivities.includes(act) ? 'border-good text-good bg-good/10' : 'border-line text-mute'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Evening energy: ${checkIn.energyEndLevel}/10`}>
                <input type="range" min="1" max="10" value={checkIn.energyEndLevel} onChange={(e) => setCheckIn({ ...checkIn, energyEndLevel: Number(e.target.value) })} className="w-full" />
              </Field>
              <Field label="Mood">
                <Select value={checkIn.mood} onChange={(e) => setCheckIn({ ...checkIn, mood: e.target.value })} options={MOODS} />
              </Field>
            </div>

            <Button className="w-full" onClick={submitCheckIn}>
              {existing ? 'Update check-in' : 'Save check-in'}
            </Button>
          </div>
        </Card>
      </div>

      {categoryCompliance.length > 0 && (
        <Card title="30-Day Compliance by Category">
          <div className="space-y-3">
            {categoryCompliance.map((c) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{c.category} <span className="text-mute text-xs">({c.habits} habits)</span></span>
                  <span className="text-mute">{Math.round(c.rate)}%</span>
                </div>
                <ProgressBar value={c.rate} color={c.rate >= 70 ? 'var(--success)' : c.rate >= 40 ? 'var(--warning)' : 'var(--error)'} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="30-Day Trends">
        {trend.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="energy" stroke="#00d9ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sleep" stroke="#00d97f" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="stress" stroke="#ff6b6b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log a few check-ins to see trends.</EmptyState>
        )}
      </Card>

      <Modal open={habitModal} onClose={() => setHabitModal(false)} title="Add Habit">
        <form onSubmit={submitHabit} className="space-y-3">
          <Field label="Template (optional)" hint="55+ templates — picking one prefills everything below.">
            <Select value={habitTemplate} onChange={(e) => applyHabitTemplate(e.target.value)}>
              <option value="">— Start from scratch —</option>
              {HABIT_TEMPLATES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((i) => (
                    <option key={i.name} value={`${g.group}||${i.name}`}>{i.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Habit name">
            <Input value={habitForm.name} onChange={(e) => setHabitForm({ ...habitForm, name: e.target.value })} placeholder="e.g. Journal every trade" />
          </Field>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Category">
              <Select value={habitForm.category} onChange={(e) => setHabitForm({ ...habitForm, category: e.target.value })} options={HABIT_CATEGORIES} />
            </Field>
            <Field label="Frequency" hint="Pick 'Specific days' to choose exact weekdays, e.g. Mon/Wed/Fri">
              <Select value={habitForm.frequency} onChange={(e) => setHabitForm({ ...habitForm, frequency: e.target.value })} options={HABIT_FREQUENCIES} />
            </Field>
            {habitForm.frequency === 'custom' && (
              <Field label="Repeats on" hint="Click each day this habit repeats">
                <WeekdayPicker value={habitForm.weekdays} onChange={(v) => setHabitForm({ ...habitForm, weekdays: v })} options={WEEKDAYS} />
              </Field>
            )}
            <Field label="XP per completion">
              <Input type="number" min="0" max="50" value={habitForm.xpReward} onChange={(e) => setHabitForm({ ...habitForm, xpReward: e.target.value })} />
            </Field>
            <Field label="Duration (min)">
              <Input type="number" min="1" value={habitForm.duration} onChange={(e) => setHabitForm({ ...habitForm, duration: e.target.value })} />
            </Field>
            <Field label="Target streak (days)">
              <Input type="number" min="1" value={habitForm.targetStreak} onChange={(e) => setHabitForm({ ...habitForm, targetStreak: e.target.value })} />
            </Field>
            <Field label="Mandatory">
              <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer">
                <input type="checkbox" checked={habitForm.mandatory} onChange={(e) => setHabitForm({ ...habitForm, mandatory: e.target.checked })} />
                Blocks trading if missed
              </label>
            </Field>
          </div>
          <Field label="Linked skill (optional — earns XP on completion)">
            <SkillPicker multi={false} value={habitForm.linkedSkill} onChange={(id) => setHabitForm({ ...habitForm, linkedSkill: id })} />
          </Field>
          {habitError && <p className="text-bad text-sm">{habitError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setHabitModal(false)}>Cancel</Button>
            <Button type="submit">Add habit</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit habit"
          fields={(values) => [
            { name: 'name', label: 'Habit name', type: 'text' },
            { name: 'category', label: 'Category', type: 'select', options: HABIT_CATEGORIES },
            { name: 'frequency', label: 'Frequency', type: 'select', options: HABIT_FREQUENCIES },
            ...(values.frequency === 'custom'
              ? [{ name: 'weekdays', label: 'Repeats on', type: 'weekday-picker', options: WEEKDAYS, hint: 'e.g. Mon/Wed/Fri' }]
              : []),
            { name: 'xpReward', label: 'XP per completion', type: 'number', min: 0, max: 50 },
            { name: 'duration', label: 'Duration (min)', type: 'number', min: 1 },
            { name: 'targetStreak', label: 'Target streak (days)', type: 'number', min: 1 },
            { name: 'mandatory', label: 'Mandatory', type: 'checkbox', checkboxLabel: 'Blocks trading if missed' },
          ]}
          initial={editing}
          wide
          onSave={(values) => editHabit(editing.id, values)}
          onDelete={() => deleteHabit(editing.id)}
        />
      )}
    </div>
  );
}
