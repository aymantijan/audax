import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Flame, AlertTriangle, Pencil, ChevronLeft, ChevronRight, History, CalendarPlus, CalendarCheck, Check, Sunrise, Sun, Moon,
  Clock, Archive, ArchiveRestore, ShieldAlert, HeartPulse, Target, ListChecks, ChevronDown,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHabitStore } from '../store/habitStore';
import { useTradingStore } from '../store/tradingStore';
import { useSkillStore } from '../store/skillStore';
import { habitStreak, habitCompliance, isHabitShownOn, weeklyProgress, streakUnit } from '../utils/calculations';
import { calculateSleepScore, SLEEP_BAND_COLOR, SLEEP_BAND_LABEL } from '../utils/sleep-quality';
import { calculateStressLevel, stressLabel } from '../utils/stress-calculator';
import { checkBurnoutTriggers } from '../utils/burnout';
import {
  HABIT_CATEGORIES, HABIT_CATEGORY_LABELS, HABIT_FREQUENCIES, HABIT_MOMENTS, WEEKDAYS, MOODS, MOOD_LABELS, RECOVERY_ACTIVITIES, RECOVERY_LABELS,
  STRESS_ITEMS, SKILL_MAP, HEALTH_LINK_TYPES,
} from '../utils/constants';
import { HABIT_TEMPLATES } from '../utils/habit-templates';
import { habitSchema, validate } from '../utils/validators';
import { todayKey, dateKey, fmtDate } from '../utils/formatters';
import { Card, Button, Field, Input, Select, Modal, EmptyState, ProgressBar, WeekdayPicker } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';
import SkillPicker from '../components/common/SkillPicker';
import ScheduleEventModal from '../components/common/ScheduleEventModal';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const tint = (c, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const MOMENT_ICON = { morning: Sunrise, day: Sun, evening: Moon, any: Clock };
const catLabel = (c) => HABIT_CATEGORY_LABELS[c] || c;

// ── Daily check-in (energy · sleep · stress · recovery · mood) ─────────────
const blankStressChecklist = () => Object.fromEntries(STRESS_ITEMS.map((i) => [i.key, 0]));
// Never trust a stored log to have every field (older / partial entries,
// e.g. from Santé's quick check-in) — always merge onto known-good defaults.
const checkInFromLog = (log) => ({
  energyStartLevel: log?.energyStartLevel ?? 6,
  sleepStartTime: log?.sleepData?.sleepStartTime ?? '23:00',
  wakeTime: log?.sleepData?.wakeTime ?? '07:00',
  stressChecklist: log?.stressChecklist || blankStressChecklist(),
  recoveryActivities: log?.recoveryActivities || [],
  energyEndLevel: log?.energyEndLevel ?? 6,
  mood: log?.mood || 'okay',
});

function CheckinModal({ open, onClose, date }) {
  const { energyLogs, saveEnergyLog } = useHabitStore();
  const log = energyLogs.find((l) => l.date === date);
  const [c, setC] = useState(checkInFromLog(log));
  useEffect(() => { if (open) setC(checkInFromLog(energyLogs.find((l) => l.date === date))); }, [open, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const sleepEval = calculateSleepScore(c.sleepStartTime, c.wakeTime) || { score: 0, durationHours: 0, durationScore: 0, timingScore: 0, band: 'critical' };
  const stressLevel = calculateStressLevel(c.stressChecklist);
  const save = () => {
    saveEnergyLog({
      date,
      energyStartLevel: Number(c.energyStartLevel),
      sleepData: { sleepHours: Number(sleepEval.durationHours.toFixed(2)), sleepStartTime: c.sleepStartTime, wakeTime: c.wakeTime, sleepQualityScore: sleepEval.score },
      stressLevel, stressChecklist: c.stressChecklist, recoveryActivities: c.recoveryActivities,
      energyEndLevel: Number(c.energyEndLevel), mood: c.mood,
    });
    onClose();
  };
  const toggleRecovery = (act) => setC((x) => ({ ...x, recoveryActivities: x.recoveryActivities.includes(act) ? x.recoveryActivities.filter((a) => a !== act) : [...x.recoveryActivities, act] }));
  return (
    <Modal open={open} onClose={onClose} title={`Check-in · ${fmtDate(date)}`} wide>
      <div className="space-y-5">
        <p className="text-[11px] text-mute flex items-center gap-1.5"><HeartPulse size={12} className="text-accent" /> Le même check-in que dans Santé : ce que vous remplissez ici complète la version rapide, sans rien effacer.</p>
        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Matin</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={`Énergie au réveil : ${c.energyStartLevel}/10`}>
              <input type="range" min="1" max="10" value={c.energyStartLevel} onChange={(e) => setC({ ...c, energyStartLevel: Number(e.target.value) })} className="w-full accent-[var(--accent-primary)]" />
            </Field>
            <Field label="Coucher"><Input type="time" value={c.sleepStartTime} onChange={(e) => setC({ ...c, sleepStartTime: e.target.value })} /></Field>
            <Field label="Réveil"><Input type="time" value={c.wakeTime} onChange={(e) => setC({ ...c, wakeTime: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: tint(SLEEP_BAND_COLOR[sleepEval.band], 10) }}>
            <div className="text-2xl font-bold tabular-nums" style={{ color: SLEEP_BAND_COLOR[sleepEval.band] }}>{sleepEval.score}/10</div>
            <div className="flex-1">
              <div className="text-xs font-semibold" style={{ color: SLEEP_BAND_COLOR[sleepEval.band] }}>Sommeil : {SLEEP_BAND_LABEL[sleepEval.band]}</div>
              <div className="text-[11px] text-mute">{sleepEval.durationHours.toFixed(1).replace('.', ',')} h · durée {sleepEval.durationScore}/5 · horaires {sleepEval.timingScore}/5</div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Stress : {stressLevel}/10 — {stressLabel(stressLevel)}</div>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {STRESS_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-mute">{item.label}</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setC({ ...c, stressChecklist: { ...c.stressChecklist, [item.key]: n } })}
                      className={`w-6 h-6 rounded text-[11px] cursor-pointer border ${c.stressChecklist[item.key] === n ? 'border-accent bg-accent/15 text-accent' : 'border-line text-mute'}`}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-mute mt-1">0 = pas du tout · 3 = beaucoup</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Récupération aujourd’hui</div>
          <div className="flex flex-wrap gap-2">
            {RECOVERY_ACTIVITIES.map((act) => (
              <button key={act} type="button" onClick={() => toggleRecovery(act)}
                className={`px-3 py-1 rounded-full text-xs border cursor-pointer ${c.recoveryActivities.includes(act) ? 'border-good text-good bg-good/10' : 'border-line text-mute'}`}>
                {RECOVERY_LABELS[act] || act}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={`Énergie le soir : ${c.energyEndLevel}/10`}>
            <input type="range" min="1" max="10" value={c.energyEndLevel} onChange={(e) => setC({ ...c, energyEndLevel: Number(e.target.value) })} className="w-full accent-[var(--accent-primary)]" />
          </Field>
          <Field label="Humeur">
            <Select value={c.mood} onChange={(e) => setC({ ...c, mood: e.target.value })} options={MOODS.map((m) => ({ value: m, label: MOOD_LABELS[m] || m }))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save}>{log ? 'Mettre à jour' : 'Enregistrer'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add / edit a habit ───────────────────────────────────────────────────
const blankHabit = () => ({ name: '', category: 'health', moment: 'any', xpReward: 5, linkedSkill: '', healthLink: '', mandatory: false, frequency: 'daily', weekdays: [], timesPerWeek: 3, duration: 15, targetStreak: 30 });

function HabitFormModal({ open, onClose, habit }) {
  const { addHabit, editHabit } = useHabitStore();
  const skills = useSkillStore((s) => s.skills);
  const [f, setF] = useState(blankHabit());
  const [template, setTemplate] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError(''); setTemplate('');
    setF(habit ? { ...blankHabit(), ...habit, linkedSkill: habit.linkedSkill || '', healthLink: habit.healthLink || '', moment: habit.moment || 'any', timesPerWeek: habit.timesPerWeek || 1 } : blankHabit());
  }, [open, habit]);

  const applyTemplate = (value) => {
    setTemplate(value);
    const [group, name] = value.split('||');
    const tpl = HABIT_TEMPLATES.find((g) => g.group === group)?.items.find((i) => i.name === name);
    if (!tpl) return;
    const linkedSkill = tpl.linkedSkill && skills[tpl.linkedSkill] && !skills[tpl.linkedSkill].locked ? tpl.linkedSkill : '';
    setF({ ...blankHabit(), ...tpl, linkedSkill, timesPerWeek: tpl.frequency === 'weekly' ? 1 : 3 });
  };
  const submit = (e) => {
    e.preventDefault();
    const res = validate(habitSchema, { ...f, linkedSkill: f.linkedSkill || undefined, healthLink: f.healthLink || undefined });
    if (!res.ok) return setError(res.error);
    if (f.frequency === 'custom' && !f.weekdays?.length) return setError('Choisissez au moins un jour.');
    const data = {
      ...res.data, moment: f.moment, frequency: f.frequency,
      weekdays: f.frequency === 'custom' ? f.weekdays : [],
      timesPerWeek: f.frequency === 'weekly' ? Number(f.timesPerWeek) || 1 : null,
      duration: Number(f.duration) || 15, targetStreak: Number(f.targetStreak) || 30,
      healthLink: f.healthLink || '', linkedSkill: f.linkedSkill || '',
    };
    if (habit) editHabit(habit.id, data); else addHabit(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Modifier l’habitude' : 'Nouvelle habitude'} wide>
      <form onSubmit={submit} className="space-y-4">
        {!habit && (
          <Field label="Partir d’un modèle (optionnel)" hint="70 modèles : trading, apprentissage, finances, santé, réflexion…">
            <Select value={template} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Partir de zéro —</option>
              {HABIT_TEMPLATES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((i) => <option key={i.name} value={`${g.group}||${i.name}`}>{i.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Habitude"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. Lire 20 pages" autoFocus /></Field>

        <div>
          <div className="text-xs text-mute mb-1.5">Moment de la journée</div>
          <div className="grid grid-cols-4 gap-2">
            {HABIT_MOMENTS.map((m) => {
              const Icon = MOMENT_ICON[m.value];
              return (
                <button key={m.value} type="button" onClick={() => setF({ ...f, moment: m.value })}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] cursor-pointer ${f.moment === m.value ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'}`}>
                  <Icon size={15} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Catégorie"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={HABIT_CATEGORIES.map((c) => ({ value: c, label: catLabel(c) }))} /></Field>
          <Field label="Fréquence"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} options={HABIT_FREQUENCIES} /></Field>
        </div>
        {f.frequency === 'custom' && (
          <Field label="Jours"><WeekdayPicker value={f.weekdays} onChange={(v) => setF({ ...f, weekdays: v })} options={WEEKDAYS} /></Field>
        )}
        {f.frequency === 'weekly' && (
          <Field label={`Nombre de fois par semaine : ${f.timesPerWeek}`} hint="N’importe quels jours de la semaine (lundi → dimanche). La série se compte en semaines réussies.">
            <input type="range" min="1" max="7" value={f.timesPerWeek} onChange={(e) => setF({ ...f, timesPerWeek: Number(e.target.value) })} className="w-full accent-[var(--accent-primary)]" />
          </Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Durée (min)"><Input type="number" min="1" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
          <Field label={`Série visée (${f.frequency === 'weekly' ? 'semaines' : 'jours'})`}><Input type="number" min="1" value={f.targetStreak} onChange={(e) => setF({ ...f, targetStreak: e.target.value })} /></Field>
          <Field label="XP par réussite"><Input type="number" min="0" max="50" value={f.xpReward} onChange={(e) => setF({ ...f, xpReward: e.target.value })} /></Field>
        </div>
        <Field label="Compétence liée (optionnel — reçoit l’XP)">
          <SkillPicker multi={false} value={f.linkedSkill} onChange={(id) => setF({ ...f, linkedSkill: id })} />
        </Field>
        <Field label="Lien avec Santé (optionnel)" hint="Cocher l’habitude propose d’enregistrer l’activité dans Santé, et inversement.">
          <Select value={f.healthLink} onChange={(e) => setF({ ...f, healthLink: e.target.value })} options={HEALTH_LINK_TYPES} />
        </Field>
        <label className="flex items-start gap-2 text-sm cursor-pointer rounded-lg border border-line p-3">
          <input type="checkbox" className="mt-0.5 accent-[var(--accent-primary)]" checked={!!f.mandatory} onChange={(e) => setF({ ...f, mandatory: e.target.checked })} />
          <span>
            <span className="text-ink">Obligatoire avant de trader</span>
            <span className="block text-[11px] text-mute">Tant qu’elle n’est pas faite, une alerte s’affiche en haut de la page Trading.</span>
          </span>
        </label>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{habit ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function Habits() {
  const { habits, logs, energyLogs, toggleHabit, archiveHabit, unarchiveHabit, deleteHabit, editHabit, getBadges } = useHabitStore();
  const trades = useTradingStore((s) => s.trades);
  const today = todayKey();
  const [date, setDate] = useState(today);
  const isPast = date !== today;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const shift = (days) => {
    const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days);
    const next = dateKey(d);
    if (next <= today) setDate(next);
  };

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const isDone = (h, d) => logs.some((l) => l.habitId === h.id && l.date === d && l.completed);
  // A weekly habit stays on the list until its weekly quota is met (and on
  // the days it was done, so it can be unticked).
  const showOn = (h, d) => isHabitShownOn(h, logs, d);
  const dayList = active.filter((h) => showOn(h, date));
  const doneCount = dayList.filter((h) => isDone(h, date)).length;
  const pct = dayList.length ? Math.round((doneCount / dayList.length) * 100) : 0;
  const compliance = habitCompliance(active, logs, 7, today);
  const burnout = useMemo(() => checkBurnoutTriggers({ energyLogs, compliance, trades }), [energyLogs, compliance, trades]);
  const bestStreak = useMemo(() => active.map((h) => ({ h, s: habitStreak(h.id, logs, today, h) })).sort((a, b) => b.s - a.s)[0], [active, logs, today]);
  const dayLog = energyLogs.find((l) => l.date === date);
  const missedMandatory = !isPast ? dayList.filter((h) => h.mandatory && !isDone(h, today)) : [];

  const groups = HABIT_MOMENTS.map((m) => ({ ...m, items: dayList.filter((h) => (h.moment || 'any') === m.value) })).filter((g) => g.items.length);

  const rate30 = (h) => {
    const c = habitCompliance([h], logs, 30, today);
    return c.total ? Math.round(c.rate * 100) : null;
  };
  const categoryCompliance = useMemo(() => HABIT_CATEGORIES.map((cat) => {
    const hs = active.filter((h) => h.category === cat && h.frequency !== 'weekly');
    if (!hs.length) return null;
    return { category: cat, rate: habitCompliance(hs, logs, 30, today).rate * 100, n: hs.length };
  }).filter(Boolean), [active, logs, today]);
  const trend = useMemo(() => [...energyLogs].sort((a, b) => (a.date > b.date ? 1 : -1)).slice(-30)
    .map((l) => ({ date: fmtDate(l.date).replace(/ \d{4}$/, ''), 'Énergie': l.energyStartLevel, 'Sommeil': l.sleepData?.sleepQualityScore, 'Stress': l.stressLevel })), [energyLogs]);

  const freqText = (h) => (h.frequency === 'weekly' ? `${h.timesPerWeek || 1}×/semaine`
    : h.frequency === 'custom' && h.weekdays?.length ? h.weekdays.map((w) => WEEKDAYS.find((d) => d.value === w)?.label).join(' · ') : 'tous les jours');

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Habitudes</h1>
          <p className="text-mute text-sm mt-1">Vos routines quotidiennes, vos séries et votre énergie — avec une alerte précoce d’épuisement.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><span className="flex items-center gap-1.5"><Plus size={16} /> Nouvelle habitude</span></Button>
      </div>

      {burnout.burnoutRisk && (
        <div className="border border-bad/50 bg-bad/10 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-bad font-semibold"><AlertTriangle size={18} /> Risque d’épuisement ({burnout.overallSeverity === 'high' ? 'élevé' : 'modéré'})</div>
          {burnout.triggers.map((t) => <div key={t.trigger} className="text-sm"><span className="text-ink">{t.message}</span> <span className="text-mute">— {t.recommendation}</span></div>)}
        </div>
      )}

      {/* Hero */}
      <div className="rounded-2xl border border-line p-5" style={{ background: `linear-gradient(135deg, ${tint('var(--accent-primary)', 10)}, var(--bg-tertiary) 60%)` }}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct === 100 ? 'var(--success)' : 'var(--accent-primary)'} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-bold text-ink tabular-nums">{doneCount}/{dayList.length}</span></div>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{isPast ? fmtDate(date) : 'Aujourd’hui'}</div>
              <div className="text-xs text-mute">{pct === 100 && dayList.length ? 'Journée parfaite 🎉' : `${dayList.length - doneCount} restante(s)`}</div>
            </div>
          </div>
          <div className="rounded-xl bg-card/70 border border-line px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">Régularité 7 jours</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: compliance.total ? (compliance.rate >= 0.8 ? 'var(--success)' : compliance.rate >= 0.5 ? 'var(--warning)' : 'var(--error)') : undefined }}>{compliance.total ? `${Math.round(compliance.rate * 100)} %` : '—'}</div>
          </div>
          <div className="rounded-xl bg-card/70 border border-line px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">Meilleure série en cours</div>
            <div className="text-xl font-bold tabular-nums flex items-center gap-1" style={{ color: bestStreak?.s ? 'var(--warning)' : undefined }}><Flame size={17} />{bestStreak?.s || 0} {bestStreak ? streakUnit(bestStreak.h) : 'j'}</div>
            <div className="text-[11px] text-mute truncate">{bestStreak?.s ? bestStreak.h.name : 'cochez une habitude'}</div>
          </div>
          <button onClick={() => setCheckinOpen(true)} className="text-left rounded-xl bg-card/70 border border-line px-4 py-3 hover:border-accent cursor-pointer transition-colors">
            <div className="text-[11px] uppercase tracking-wide text-mute">Check-in {isPast ? 'du jour choisi' : 'du jour'}</div>
            {dayLog?.energyStartLevel != null || dayLog?.sleepData ? (
              <div className="text-sm text-ink mt-0.5">
                Énergie {dayLog.energyStartLevel ?? '—'}/10 · Sommeil {dayLog.sleepData?.sleepQualityScore ?? '—'}/10 · Stress {dayLog.stressLevel ?? '—'}/10
              </div>
            ) : <div className="text-sm text-accent mt-0.5">À faire →</div>}
          </button>
        </div>
      </div>

      {missedMandatory.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm flex items-start gap-2" style={{ borderColor: tint('var(--warning)', 45), background: tint('var(--warning)', 8) }}>
          <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
          <span className="text-mute">Obligatoire avant de trader : <b className="text-ink">{missedMandatory.map((h) => h.name).join(', ')}</b>. Une alerte reste affichée dans Trading tant que ce n’est pas fait.</span>
        </div>
      )}

      {/* Checklist */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="text-sm font-semibold text-ink flex items-center gap-2"><ListChecks size={15} className="text-accent" /> {isPast ? `Habitudes du ${fmtDate(date)}` : 'Habitudes du jour'}</div>
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-mute hover:text-ink cursor-pointer" onClick={() => shift(-1)} title="Jour précédent"><ChevronLeft size={15} /></button>
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink cursor-pointer" />
            <button className="p-1.5 text-mute hover:text-ink cursor-pointer disabled:opacity-30" onClick={() => shift(1)} disabled={!isPast} title="Jour suivant"><ChevronRight size={15} /></button>
            {isPast && <button className="text-accent hover:underline cursor-pointer text-xs ml-1" onClick={() => setDate(today)}>Aujourd’hui</button>}
          </div>
        </div>
        {isPast && <div className="flex items-center gap-2 text-[11px] text-warning rounded-lg px-3 py-1.5 mb-3" style={{ background: tint('var(--warning)', 10) }}><History size={12} /> Saisie rétroactive : l’XP et les séries sont calculées comme si c’était fait ce jour-là.</div>}
        {groups.length ? (
          <div className="space-y-4">
            {groups.map((g) => {
              const Icon = MOMENT_ICON[g.value];
              return (
                <div key={g.value}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-mute mb-2 flex items-center gap-1.5"><Icon size={12} /> {g.label}</div>
                  <div className="space-y-2">
                    {g.items.map((h) => {
                      const done = isDone(h, date);
                      const streak = habitStreak(h.id, logs, today, h);
                      const wk = h.frequency === 'weekly' ? weeklyProgress(h, logs, date) : null;
                      const target = Number(h.targetStreak) || 0;
                      return (
                        <div key={h.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${done ? 'border-good/40' : 'border-line bg-surface'}`} style={done ? { background: tint('var(--success)', 8) } : undefined}>
                          <button onClick={() => toggleHabit(h.id, date)} title={done ? 'Décocher' : 'Fait'}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${done ? 'bg-good border-good text-black' : 'border-line hover:border-accent'}`}>
                            {done && <Check size={16} strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium ${done ? 'text-mute line-through' : 'text-ink'}`}>{h.name}</div>
                            <div className="text-[11px] text-mute flex flex-wrap gap-x-2">
                              <span>{catLabel(h.category)}</span>
                              {h.duration ? <span>· {h.duration} min</span> : null}
                              {wk && <span className={wk.met ? 'text-good' : ''}>· {wk.done}/{wk.target} cette semaine</span>}
                              <span>· +{h.xpReward} XP{h.linkedSkill && SKILL_MAP[h.linkedSkill] ? ` → ${SKILL_MAP[h.linkedSkill].name}` : ''}</span>
                              {h.mandatory && <span className="text-warning">· obligatoire</span>}
                            </div>
                          </div>
                          <div className="hidden sm:block w-24 shrink-0">
                            <div className="flex items-center justify-end gap-1 text-xs font-semibold" style={{ color: streak ? 'var(--warning)' : 'var(--text-secondary)' }}><Flame size={12} /> {streak} {streakUnit(h)}</div>
                            {target > 0 && <div className="mt-1"><ProgressBar value={Math.min(100, (streak / target) * 100)} height={3} color={streak >= target ? 'var(--success)' : 'var(--warning)'} /><div className="text-[9px] text-mute text-right mt-0.5">objectif {target} {streakUnit(h)}</div></div>}
                          </div>
                          <div className="flex items-center shrink-0">
                            <button className={`p-1.5 cursor-pointer ${h.googleEventLink ? 'text-good' : 'text-mute hover:text-accent'}`} onClick={() => setScheduling(h)} title={h.googleEventLink ? 'Modifier dans Google Agenda' : 'Planifier dans Google Agenda'}>
                              {h.googleEventLink ? <CalendarCheck size={13} /> : <CalendarPlus size={13} />}
                            </button>
                            <button className="p-1.5 text-mute hover:text-accent cursor-pointer" onClick={() => { setEditing(h); setFormOpen(true); }} title="Modifier"><Pencil size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>{isPast ? 'Aucune habitude prévue ce jour-là.' : active.length ? 'Rien de prévu aujourd’hui.' : 'Aucune habitude. Commencez par une seule habitude clé, puis ajoutez-en progressivement.'}</EmptyState>
        )}
      </Card>

      {/* All habits */}
      <Card>
        <div className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><Target size={15} className="text-accent" /> Mes habitudes ({active.length})</div>
        {active.length ? (
          <div className="divide-y divide-line/60">
            {active.map((h) => {
              const streak = habitStreak(h.id, logs, today, h);
              const r = rate30(h);
              return (
                <div key={h.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink truncate">{h.name}</div>
                    <div className="text-[11px] text-mute">{catLabel(h.category)} · {freqText(h)} · {HABIT_MOMENTS.find((m) => m.value === (h.moment || 'any'))?.label}</div>
                  </div>
                  <div className="text-right text-[11px] text-mute w-28 shrink-0">
                    <div className="flex items-center justify-end gap-1" style={{ color: streak ? 'var(--warning)' : undefined }}><Flame size={11} /> {streak} {streakUnit(h)}</div>
                    <div>{r == null ? (h.frequency === 'weekly' ? 'suivi par semaine' : '—') : `${r} % sur 30 j`}</div>
                  </div>
                  <button className="p-1.5 text-mute hover:text-accent cursor-pointer" onClick={() => { setEditing(h); setFormOpen(true); }} title="Modifier"><Pencil size={13} /></button>
                  <button className="p-1.5 text-mute hover:text-ink cursor-pointer" onClick={() => archiveHabit(h.id)} title="Archiver (garde l’historique)"><Archive size={13} /></button>
                </div>
              );
            })}
          </div>
        ) : <EmptyState>Aucune habitude active.</EmptyState>}
        {archived.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line">
            <button onClick={() => setShowArchived((v) => !v)} className="text-xs text-mute hover:text-ink cursor-pointer flex items-center gap-1">
              <ChevronDown size={12} className={showArchived ? '' : '-rotate-90'} /> Archivées ({archived.length})
            </button>
            {showArchived && (
              <div className="mt-2 space-y-1">
                {archived.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-sm text-mute">
                    <span className="flex-1 truncate">{h.name}</span>
                    <button className="p-1 hover:text-accent cursor-pointer" onClick={() => unarchiveHabit(h.id)} title="Réactiver"><ArchiveRestore size={13} /></button>
                    <button className="p-1 hover:text-bad cursor-pointer" onClick={() => setDeleting(h)} title="Supprimer définitivement"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Régularité par catégorie (30 jours)">
          {categoryCompliance.length ? (
            <div className="space-y-3">
              {categoryCompliance.map((c) => (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1"><span>{catLabel(c.category)} <span className="text-mute text-xs">({c.n})</span></span><span className="text-mute tabular-nums">{Math.round(c.rate)} %</span></div>
                  <ProgressBar value={c.rate} color={c.rate >= 70 ? 'var(--success)' : c.rate >= 40 ? 'var(--warning)' : 'var(--error)'} />
                </div>
              ))}
            </div>
          ) : <EmptyState>Pas encore de données.</EmptyState>}
        </Card>
        <Card title="Énergie, sommeil et stress (30 jours)">
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Énergie" stroke="#00d9ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Sommeil" stroke="#00d97f" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Stress" stroke="#ff6b6b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState>Faites quelques check-ins pour voir l’évolution. <Link to="/health" className="text-accent underline">Check-in rapide dans Santé</Link></EmptyState>}
        </Card>
      </div>

      <BadgeList badges={getBadges()} />

      <HabitFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} habit={editing} />
      <CheckinModal open={checkinOpen} onClose={() => setCheckinOpen(false)} date={date} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Supprimer définitivement ?">
        <p className="text-sm text-mute">« {deleting?.name} » et tout son historique seront supprimés. Pour garder l’historique, laissez-la archivée.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { deleteHabit(deleting.id); setDeleting(null); }}>Supprimer</Button>
        </div>
      </Modal>
      <ScheduleEventModal
        open={!!scheduling}
        onClose={() => setScheduling(null)}
        title="cette habitude"
        defaultSummary={scheduling ? scheduling.name : ''}
        recurring
        existingEventId={scheduling?.googleEventId || null}
        existingEventLink={scheduling?.googleEventLink || null}
        onScheduled={({ eventId, htmlLink }) => editHabit(scheduling.id, { googleEventId: eventId, googleEventLink: htmlLink })}
        onUnschedule={() => editHabit(scheduling.id, { googleEventId: null, googleEventLink: null })}
      />
    </div>
  );
}
