import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Flame, AlertTriangle, Pencil, ChevronLeft, ChevronRight, History, CalendarPlus, CalendarCheck, Check, Sunrise, Sun, Moon,
  Clock, Archive, ArchiveRestore, ShieldAlert, HeartPulse, Target, ListChecks, ChevronDown, Snowflake, Minus, Ban, Gauge, Zap, Palmtree, Trophy,
  Bell, BellOff, Link2, CalendarDays, CornerDownRight, Sparkles, TrendingDown, TrendingUp,
} from 'lucide-react';
import { coachAdvice, habitCorrelations } from '../utils/habit-coach';
import { toast } from '../store/uiStore';
import { HABIT_SOURCES, sourceMeta } from '../utils/habit-sources';
import { baseCurrencyShort } from '../utils/formatters';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHabitStore } from '../store/habitStore';
import { useTradingStore } from '../store/tradingStore';
import { useSkillStore } from '../store/skillStore';
import { habitStreak, habitCompliance, isHabitShownOn, weeklyProgress, streakUnit, quitStreak, quitBest, habitDayStatus, habitBestStreak, habitSuccessRate } from '../utils/calculations';
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
const blankHabit = () => ({ kind: 'check', name: '', category: 'health', moment: 'any', xpReward: 5, linkedSkill: '', healthLink: '', mandatory: false, frequency: 'daily', weekdays: [], timesPerWeek: 3, duration: 15, targetStreak: 30, target: 8, unit: '', direction: 'atLeast', source: '', reminderTime: '', after: '' });
const KINDS = [
  { value: 'check', label: 'À cocher', Icon: Check, desc: 'Fait / pas fait' },
  { value: 'quantity', label: 'Mesurable', Icon: Gauge, desc: 'Verres, pages, minutes… (peut être automatique)' },
  { value: 'quit', label: 'À arrêter', Icon: Ban, desc: 'Compteur de jours sans (cigarette, réseaux…)' },
];
const unitOf = (src) => (src?.value === 'spent_amount' ? baseCurrencyShort() : src?.unit || '');

function HabitFormModal({ open, onClose, habit }) {
  const { addHabit, editHabit, habits: allHabits, habitReminders, setHabitRemindersEnabled } = useHabitStore();
  const skills = useSkillStore((s) => s.skills);
  // Anchor candidates: never itself nor a habit already chained after it (no loops).
  const anchors = allHabits.filter((h) => !h.archived && h.kind !== 'quit' && h.id !== habit?.id && (!habit || h.after !== habit.id));
  const [f, setF] = useState(blankHabit());
  const [template, setTemplate] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError(''); setTemplate('');
    setF(habit ? { ...blankHabit(), ...habit, kind: habit.kind || 'check', linkedSkill: habit.linkedSkill || '', healthLink: habit.healthLink || '', moment: habit.moment || 'any', timesPerWeek: habit.timesPerWeek || 1, source: habit.source || '', target: habit.target ?? 8, unit: habit.unit || '', direction: habit.direction || 'atLeast', reminderTime: habit.reminderTime || '', after: habit.after || '' } : blankHabit());
  }, [open, habit]);

  const applyTemplate = (value) => {
    setTemplate(value);
    const [group, name] = value.split('||');
    const tpl = HABIT_TEMPLATES.find((g) => g.group === group)?.items.find((i) => i.name === name);
    if (!tpl) return;
    const linkedSkill = tpl.linkedSkill && skills[tpl.linkedSkill] && !skills[tpl.linkedSkill].locked ? tpl.linkedSkill : '';
    setF({ ...blankHabit(), ...tpl, linkedSkill, timesPerWeek: tpl.frequency === 'weekly' ? 1 : 3, source: tpl.source || '', unit: tpl.unit || unitOf(sourceMeta(tpl.source)) });
  };
  const submit = (e) => {
    e.preventDefault();
    const res = validate(habitSchema, { ...f, linkedSkill: f.linkedSkill || undefined, healthLink: f.healthLink || undefined });
    if (!res.ok) return setError(res.error);
    if (f.kind !== 'quit' && f.frequency === 'custom' && !f.weekdays?.length) return setError('Choisissez au moins un jour.');
    if (f.kind === 'quantity' && !(Number(f.target) > 0) && f.direction === 'atLeast') return setError('Indiquez une cible supérieure à 0.');
    const data = {
      ...res.data, kind: f.kind, moment: f.kind === 'quit' ? 'any' : f.moment, frequency: f.kind === 'quit' ? 'daily' : f.frequency,
      target: f.kind === 'quantity' ? Number(f.target) : null, unit: f.kind === 'quantity' ? f.unit : null,
      direction: f.kind === 'quantity' ? f.direction : null, source: f.kind === 'quantity' ? f.source || null : null,
      weekdays: f.frequency === 'custom' ? f.weekdays : [],
      timesPerWeek: f.frequency === 'weekly' ? Number(f.timesPerWeek) || 1 : null,
      duration: Number(f.duration) || 15, targetStreak: Number(f.targetStreak) || 30,
      healthLink: f.healthLink || '', linkedSkill: f.linkedSkill || '',
      reminderTime: f.kind === 'quit' ? null : f.reminderTime || null, after: f.kind === 'quit' ? null : f.after || null,
    };
    if (data.reminderTime && !habitReminders?.enabled) enableReminders(setHabitRemindersEnabled);
    if (habit) editHabit(habit.id, data); else addHabit(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Modifier l’habitude' : 'Nouvelle habitude'} wide>
      <form onSubmit={submit} className="space-y-4">
        {!habit && (
          <Field label="Partir d’un modèle (optionnel)" hint="89 modèles : à cocher, mesurables (souvent automatiques) et à arrêter">
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
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => setF({ ...f, kind: k.value })}
              className={`rounded-xl border p-2.5 text-left cursor-pointer ${f.kind === k.value ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50'}`}>
              <k.Icon size={15} className={f.kind === k.value ? 'text-accent' : 'text-mute'} />
              <div className="text-xs font-semibold text-ink mt-1">{k.label}</div>
              <div className="text-[10px] text-mute leading-snug">{k.desc}</div>
            </button>
          ))}
        </div>
        <Field label="Habitude"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.kind === 'quit' ? 'ex. Pas de réseaux sociaux avant midi' : f.kind === 'quantity' ? 'ex. Lire 20 pages' : 'ex. Méditer 10 min'} autoFocus /></Field>

        {f.kind === 'quantity' && (
          <div className="rounded-xl border border-line p-3 space-y-3">
            <Field label="Suivi" hint={f.source ? 'La valeur du jour est lue automatiquement : rien à cocher.' : 'Vous saisissez la valeur du jour (+ / −).'}>
              <Select value={f.source} onChange={(e) => { const src = sourceMeta(e.target.value); setF({ ...f, source: e.target.value, unit: src ? unitOf(src) : f.unit }); }}>
                <option value="">Saisie manuelle</option>
                <optgroup label="Automatique, depuis vos autres sections">
                  {HABIT_SOURCES.map((src) => <option key={src.value} value={src.value}>{src.label}</option>)}
                </optgroup>
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Objectif"><Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} options={[{ value: 'atLeast', label: 'Au moins' }, { value: 'atMost', label: 'Au plus' }]} /></Field>
              <Field label="Valeur"><Input type="number" min="0" step="any" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
              <Field label="Unité"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="verres, pages, min…" /></Field>
            </div>
            {f.direction === 'atMost' && <p className="text-[11px] text-mute">« Au plus » : la journée est réussie si vous restez sous la limite ; elle est validée une fois la journée terminée.</p>}
          </div>
        )}

        {f.kind !== 'quit' && <div>
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
        </div>}

        {f.kind !== 'quit' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Rappel (optionnel)" hint="Notification à cette heure si l’habitude n’est pas encore faite.">
              <div className="flex gap-2">
                <Input type="time" value={f.reminderTime} onChange={(e) => setF({ ...f, reminderTime: e.target.value })} />
                {f.reminderTime && <Button type="button" variant="secondary" onClick={() => setF({ ...f, reminderTime: '' })}>Aucun</Button>}
              </div>
            </Field>
            <Field label="Enchaîner après (optionnel)" hint="« Après mon café, je lis 10 pages » : l’ancrage rend l’habitude automatique.">
              <Select value={f.after} onChange={(e) => setF({ ...f, after: e.target.value })}>
                <option value="">— Aucune —</option>
                {anchors.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Catégorie"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={HABIT_CATEGORIES.map((c) => ({ value: c, label: catLabel(c) }))} /></Field>
          {f.kind !== 'quit' && <Field label="Fréquence"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} options={HABIT_FREQUENCIES} /></Field>}
        </div>
        {f.kind !== 'quit' && f.frequency === 'custom' && (
          <Field label="Jours"><WeekdayPicker value={f.weekdays} onChange={(v) => setF({ ...f, weekdays: v })} options={WEEKDAYS} /></Field>
        )}
        {f.kind !== 'quit' && f.frequency === 'weekly' && (
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

// ── Measured habit: value vs target (+/− for manual, read-only when auto) ──
function QuantityControl({ h, value, date }) {
  const setHabitValue = useHabitStore((st) => st.setHabitValue);
  const [draft, setDraft] = useState(null);
  const src = sourceMeta(h.source);
  const target = Number(h.target) || 0;
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = h.direction === 'atMost' && value > target;
  const color = h.direction === 'atMost' ? (over ? 'var(--error)' : 'var(--success)') : value >= target ? 'var(--success)' : 'var(--accent-primary)';
  const step = target >= 1000 ? 500 : target >= 100 ? 10 : 1;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex-1 max-w-[12rem]"><ProgressBar value={h.direction === 'atMost' ? (over ? 100 : pct) : pct} height={5} color={color} /></div>
      {src ? (
        <span className="text-[11px] tabular-nums" style={{ color }}>{value}/{target} {h.unit}</span>
      ) : (
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 rounded border border-line text-mute hover:text-ink cursor-pointer flex items-center justify-center" onClick={() => setHabitValue(h.id, date, Math.max(0, value - step))}><Minus size={11} /></button>
          {draft != null ? (
            <form onSubmit={(e) => { e.preventDefault(); setHabitValue(h.id, date, Number(String(draft).replace(',', '.')) || 0); setDraft(null); }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { setHabitValue(h.id, date, Number(String(draft).replace(',', '.')) || 0); setDraft(null); }}
                className="w-14 bg-surface border border-accent rounded px-1 py-0.5 text-[11px] text-center tabular-nums text-ink" />
            </form>
          ) : (
            <button onClick={() => setDraft(String(value))} className="text-[11px] tabular-nums px-1 cursor-pointer hover:underline" style={{ color }} title="Saisir la valeur">{value}/{target} {h.unit}</button>
          )}
          <button className="w-6 h-6 rounded border border-line text-mute hover:text-ink cursor-pointer flex items-center justify-center" onClick={() => setHabitValue(h.id, date, value + step)}><Plus size={11} /></button>
        </div>
      )}
      {h.direction === 'atMost' && <span className="text-[10px] text-mute">{over ? 'limite dépassée' : `max ${target}`}</span>}
    </div>
  );
}

const QUIT_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];

function QuitCard({ h, today, onRelapse }) {
  const undoRelapse = useHabitStore((st) => st.undoRelapse);
  const days = quitStreak(h, today);
  const best = quitBest(h, today);
  const next = QUIT_MILESTONES.find((m) => m > days) || null;
  const prev = [...QUIT_MILESTONES].reverse().find((m) => m <= days) || 0;
  const lastRelapse = (h.relapses || []).slice(-1)[0];
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{h.name}</div>
          <div className="text-[11px] text-mute">{catLabel(h.category)} · record {best} j</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color: days >= 7 ? 'var(--success)' : 'var(--accent-primary)' }}>{days}</div>
          <div className="text-[10px] text-mute">jour{days > 1 ? 's' : ''} sans</div>
        </div>
      </div>
      {next && (
        <div className="mt-3">
          <ProgressBar value={((days - prev) / (next - prev)) * 100} height={4} color="var(--success)" />
          <div className="text-[10px] text-mute mt-1 flex items-center gap-1"><Trophy size={10} /> prochain palier : {next} jour{next > 1 ? 's' : ''}</div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={() => onRelapse(h)}>J’ai craqué</Button>
        {lastRelapse === today && <button className="text-[11px] text-mute hover:text-ink underline cursor-pointer" onClick={() => undoRelapse(h.id, today)}>annuler</button>}
      </div>
    </div>
  );
}

function PauseModal({ open, onClose }) {
  const startPause = useHabitStore((st) => st.startPause);
  const today = todayKey();
  const [f, setF] = useState({ from: today, to: today, reason: '' });
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setF({ from: today, to: todayKey(new Date(Date.now() + 6 * 86400000)), reason: '' }); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Mode pause (vacances, maladie…)">
      <div className="space-y-3">
        <p className="text-sm text-mute">Pendant la pause, vos habitudes ne cassent pas leurs séries : chaque jour couvert compte comme un joker, sans entamer vos jokers du mois.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Du"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="Au"><Input type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <Field label="Raison (optionnel)"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Voyage, examens, malade…" /></Field>
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => { const r = startPause(f); if (!r.ok) return setError(r.error); onClose(); }}><span className="flex items-center gap-1.5"><Palmtree size={14} /> Mettre en pause</span></Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
// ── Per-habit detail: yearly heatmap + records ──
const DAY_COLOR = {
  done: 'var(--success)', joker: 'var(--accent-secondary)', missed: 'color-mix(in srgb, var(--error) 45%, transparent)',
  off: 'color-mix(in srgb, var(--text-secondary) 16%, transparent)', future: 'transparent',
};
const DAY_LABEL = { done: 'réussi', joker: 'joker / pause', missed: 'manqué', off: 'non prévu', future: '' };
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function HabitDetailModal({ habit, onClose, onEdit }) {
  const allLogs = useHabitStore((s) => s.logs);
  const habits = useHabitStore((s) => s.habits);
  const today = todayKey();
  const scroller = useRef(null);
  // Most recent weeks first in view when the grid is wider than the modal.
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [habit?.id]);
  const data = useMemo(() => {
    if (!habit) return null;
    const logs = allLogs.filter((l) => l.habitId === habit.id);
    // 53 full weeks, Monday-first, ending with the current week.
    const end = new Date(today + 'T12:00:00');
    const start = new Date(end); start.setDate(start.getDate() - ((end.getDay() + 6) % 7) - 52 * 7);
    const weeks = []; const perWd = Array.from({ length: 7 }, () => ({ done: 0, due: 0 }));
    let totalDone = 0; let valueSum = 0; let valueN = 0;
    for (let w = 0; w < 53; w++) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + w * 7 + i);
        const key = dateKey(d);
        const st = habitDayStatus(habit, logs, key, today);
        const log = logs.find((l) => l.date === key);
        col.push({ key, st, value: log?.value, month: d.getMonth(), day: d.getDate() });
        if (st === 'done') { totalDone++; perWd[d.getDay()].done++; perWd[d.getDay()].due++; } else if (st === 'missed') perWd[d.getDay()].due++;
        if (habit.kind === 'quantity' && log?.value != null && key <= today) { valueSum += Number(log.value) || 0; valueN++; }
      }
      weeks.push(col);
    }
    // Weekly habits have no "missed" days: best weekday = the day it is done most often.
    const ranked = perWd.map((x, i) => ({ i, ...x, rate: habit.frequency === 'weekly' ? x.done : x.due >= 4 ? x.done / x.due : -1 }))
      .filter((x) => x.rate > 0).sort((a, b) => b.rate - a.rate);
    return {
      weeks, totalDone,
      streak: habitStreak(habit.id, allLogs, today, habit),
      best: habitBestStreak(habit, logs, today),
      r30: habitSuccessRate(habit, logs, today, 30), r90: habitSuccessRate(habit, logs, today, 90),
      avg: valueN ? valueSum / valueN : null,
      bestDay: ranked[0] ? WEEKDAY_FR[ranked[0].i] : null,
      anchor: habit.after ? habits.find((h) => h.id === habit.after) : null,
      chained: habits.filter((h) => !h.archived && h.after === habit.id),
    };
  }, [habit, allLogs, habits, today]);
  if (!habit || !data) return null;
  const unit = habit.kind === 'quit' ? 'j' : streakUnit(habit);
  const pctTxt = (r) => (r == null ? '—' : `${Math.round(r * 100)} %`);
  const stats = [
    { label: 'Série en cours', value: `${data.streak} ${unit}`, color: data.streak ? 'var(--warning)' : undefined },
    { label: 'Record', value: `${data.best} ${unit}`, color: data.best && data.best === data.streak ? 'var(--success)' : undefined },
    ...(habit.frequency === 'weekly' ? [] : [{ label: 'Réussite 30 j', value: pctTxt(data.r30) }, { label: 'Réussite 90 j', value: pctTxt(data.r90) }]),
    { label: habit.kind === 'quit' ? 'Jours sans (1 an)' : 'Fois réussie (1 an)', value: data.totalDone },
    habit.kind === 'quantity' ? { label: 'Moyenne / jour saisi', value: data.avg == null ? '—' : `${Math.round(data.avg * 10) / 10} ${habit.unit || ''}` }
      : { label: 'Meilleur jour', value: data.bestDay || '—' },
  ];
  const target = Number(habit.targetStreak) || 0;
  return (
    <Modal open onClose={onClose} title={habit.name} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-surface px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-mute">{s.label}</div>
              <div className="text-lg font-bold tabular-nums text-ink" style={s.color ? { color: s.color } : undefined}>{s.value}</div>
            </div>
          ))}
        </div>
        {target > 0 && habit.kind !== 'quit' && (
          <div>
            <div className="flex justify-between text-xs text-mute mb-1"><span>Objectif : série de {target} {unit}</span><span className="tabular-nums">{Math.min(data.streak, target)}/{target}</span></div>
            <ProgressBar value={Math.min(100, (data.streak / target) * 100)} color={data.streak >= target ? 'var(--success)' : 'var(--warning)'} />
          </div>
        )}
        <div>
          <div className="text-xs font-semibold text-ink mb-2">Les 12 derniers mois</div>
          <div ref={scroller} className="overflow-x-auto pb-1">
            <div className="inline-flex flex-col gap-1 min-w-max">
              <div className="flex gap-[2px] pl-5 text-[9px] text-mute h-3">
                {data.weeks.map((col, i) => (
                  <div key={i} className="w-[10px] overflow-visible whitespace-nowrap">{col[0].day <= 7 ? MONTHS_FR[col[0].month] : ''}</div>
                ))}
              </div>
              <div className="flex gap-[2px]">
                <div className="flex flex-col gap-[2px] text-[9px] text-mute w-4 pr-1">
                  {['L', '', 'M', '', 'V', '', 'D'].map((l, i) => <div key={i} className="h-[10px] leading-[10px]">{l}</div>)}
                </div>
                {data.weeks.map((col, i) => (
                  <div key={i} className="flex flex-col gap-[2px]">
                    {col.map((c) => (
                      <div key={c.key} title={c.st === 'future' ? '' : `${fmtDate(c.key)} · ${DAY_LABEL[c.st]}${c.value != null && habit.kind === 'quantity' ? ` · ${c.value} ${habit.unit || ''}` : ''}`}
                        className="w-[10px] h-[10px] rounded-[3px]" style={{ background: DAY_COLOR[c.st], outline: c.key === today ? '1.5px solid var(--accent-primary)' : undefined }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-mute">
            {['done', 'missed', 'joker', 'off'].map((k) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: DAY_COLOR[k] }} /> {DAY_LABEL[k]}</span>)}
          </div>
          {habit.frequency === 'weekly' && <p className="text-[11px] text-mute mt-1">Habitude hebdomadaire : les jours sans case verte ne sont pas des échecs, seule la semaine compte.</p>}
        </div>
        {(data.anchor || data.chained.length > 0 || habit.reminderTime) && (
          <div className="text-xs text-mute space-y-1">
            {habit.reminderTime && <div className="flex items-center gap-1.5"><Bell size={12} /> Rappel à {habit.reminderTime}</div>}
            {data.anchor && <div className="flex items-center gap-1.5"><Link2 size={12} /> Juste après « {data.anchor.name} »</div>}
            {data.chained.length > 0 && <div className="flex items-center gap-1.5"><Link2 size={12} /> Suivie de : {data.chained.map((h) => h.name).join(', ')}</div>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          <Button onClick={() => onEdit(habit)}><span className="flex items-center gap-1.5"><Pencil size={14} /> Modifier</span></Button>
        </div>
      </div>
    </Modal>
  );
}

// Habit stacking: chained habits come right after their anchor (depth-first).
function orderChains(items) {
  const ids = new Set(items.map((h) => h.id));
  const out = []; const seen = new Set();
  const visit = (h, depth) => {
    if (seen.has(h.id)) return;
    seen.add(h.id); out.push({ h, depth });
    items.filter((c) => c.after === h.id).forEach((c) => visit(c, Math.min(depth + 1, 2)));
  };
  items.filter((h) => !h.after || !ids.has(h.after)).forEach((h) => visit(h, 0));
  items.forEach((h) => visit(h, 0)); // cycles: never drop a habit
  return out;
}

async function enableReminders(setEnabled) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
  setEnabled(true);
  toast(typeof Notification !== 'undefined' && Notification.permission === 'granted'
    ? 'Rappels activés : notification à l’heure choisie (AUDAX ouvert).'
    : 'Rappels activés dans l’app (notifications du navigateur refusées).', 'success');
}

// ── Coach: slipping habits, mini versions, habit ↔ check-in links ──
const pctOf = (r) => `${Math.round((r || 0) * 100)} %`;
const nf1 = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
const METRIC_GENDER_F = { energy: true, sleep: true, stress: false }; // « votre énergie est plus élevée »

function CoachCard({ habits, logs, energyLogs, today, onEdit }) {
  const { applyMini, restoreFull, snoozeCoach, editHabit } = useHabitStore();
  const coachSnooze = useHabitStore((s) => s.coachSnooze);
  const advice = useMemo(() => coachAdvice(habits, logs, today, coachSnooze || {}), [habits, logs, today, coachSnooze]);
  const links = useMemo(() => habitCorrelations(habits, logs, energyLogs, today), [habits, logs, energyLogs, today]);
  return (
    <Card>
      <div className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><Sparkles size={15} className="text-accent" /> Coach</div>
      {advice.length === 0 && links.length === 0 && (
        <p className="text-sm text-mute">Rien à signaler : vos habitudes tiennent.{energyLogs.length < 14 ? ' Les liens avec votre énergie, votre sommeil et votre stress apparaîtront après environ deux semaines de check-ins.' : ''}</p>
      )}
      {advice.length > 0 && (
        <div className="space-y-2">
          {advice.map((a) => {
            const h = a.habit;
            const slipping = a.type === 'slipping';
            const color = slipping ? 'var(--warning)' : 'var(--success)';
            const Icon = slipping ? TrendingDown : TrendingUp;
            return (
              <div key={h.id} className="rounded-xl border px-3 py-2.5 flex items-start gap-2" style={{ borderColor: tint(color, 40), background: tint(color, 6) }}>
                <Icon size={16} className="shrink-0 mt-0.5" style={{ color }} />
                <div className="min-w-0 flex-1 text-sm">
                  {slipping ? (
                    <>
                      <div className="text-ink">« {h.name} » décroche</div>
                      <div className="text-[12px] text-mute">
                        {a.weeks ? (Math.round(a.recent * 3) ? `Quota atteint 1 semaine sur les 3 dernières.` : `Quota non atteint ces 3 dernières semaines.`)
                          : `${a.done}/${a.due} jours réussis ces 14 derniers jours${a.prior != null ? ` (contre ${pctOf(a.prior)} avant)` : ''}.`}
                        {a.mini ? ` Réduisez l’effort plutôt que d’abandonner : ${a.mini.text}.`
                          : a.fallback?.kind === 'reminder' ? ' Un rappel à heure fixe aide souvent à reprendre.'
                            : a.fallback?.kind === 'anchor' ? ` Accrochez-la à « ${a.fallback.anchor.name} », qui tient bien.`
                              : ' Un joker ou une pause protège la série si la période est chargée.'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-ink">« {h.name} » tient bon en version mini</div>
                      <div className="text-[12px] text-mute">{a.done != null ? `${a.done}/${a.due} jours réussis ces 14 derniers jours (${pctOf(a.recent)}).` : 'Quota atteint 3 semaines sur 3.'} Prêt à revenir à la version normale ?</div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {slipping && a.mini && <Button className="!py-1 !px-2.5 text-xs" onClick={() => applyMini(h.id, a.mini.changes)}>Passer en version mini</Button>}
                    {slipping && !a.mini && a.fallback?.kind === 'reminder' && <Button className="!py-1 !px-2.5 text-xs" onClick={() => onEdit(h)}>Ajouter un rappel</Button>}
                    {slipping && !a.mini && a.fallback?.kind === 'anchor' && <Button className="!py-1 !px-2.5 text-xs" onClick={() => { editHabit(h.id, { after: a.fallback.anchor.id }); toast(`« ${h.name} » s’enchaîne désormais après « ${a.fallback.anchor.name} »`, 'success'); }}>L’enchaîner</Button>}
                    {!slipping && <Button className="!py-1 !px-2.5 text-xs" onClick={() => restoreFull(h.id)}>Revenir à la normale</Button>}
                    <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={() => snoozeCoach(h.id, slipping ? 7 : 14)}>{slipping ? 'Plus tard' : 'Rester en mini'}</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {links.length > 0 && (
        <div className={advice.length ? 'mt-4 pt-3 border-t border-line' : ''}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-mute mb-2">Ce que disent vos check-ins</div>
          <div className="space-y-1.5">
            {links.map((l) => {
              const fem = METRIC_GENDER_F[l.metric.key];
              const word = l.diff > 0 ? (fem ? 'plus élevée' : 'plus élevé') : (fem ? 'plus basse' : 'plus bas');
              const c = l.good ? 'var(--success)' : 'var(--error)';
              return (
                <div key={`${l.habit.id}-${l.metric.key}`} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-mute">
                    Le lendemain de « <span className="text-ink">{l.habit.name}</span> », votre {l.metric.label} est <b style={{ color: c }}>{word} de {nf1(Math.abs(l.diff))} pt</b>
                    <span className="text-[11px]"> ({nf1(l.withMean)} contre {nf1(l.withoutMean)} sur 10 · {l.nWith} j avec, {l.nWithout} j sans)</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-mute mt-2">Sur 120 jours. Ce sont des corrélations, pas une preuve de cause à effet.</p>
        </div>
      )}
    </Card>
  );
}

export default function Habits() {
  const { habits, logs, energyLogs, toggleHabit, archiveHabit, unarchiveHabit, deleteHabit, editHabit, getBadges, useJoker, removeJoker, jokersLeft, logRelapse, endPause, pauses } = useHabitStore();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [relapsing, setRelapsing] = useState(null);
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
  const [detail, setDetail] = useState(null);
  const habitReminders = useHabitStore((s) => s.habitReminders);
  const setHabitRemindersEnabled = useHabitStore((s) => s.setHabitRemindersEnabled);
  const nameOf = (id) => habits.find((x) => x.id === id)?.name;

  const shift = (days) => {
    const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days);
    const next = dateKey(d);
    if (next <= today) setDate(next);
  };

  const active = habits.filter((h) => !h.archived);
  const quitHabits = active.filter((h) => h.kind === 'quit');
  const activePause = (pauses || []).find((p) => p.from <= today && p.to >= today);
  const archived = habits.filter((h) => h.archived);
  const isDone = (h, d) => logs.some((l) => l.habitId === h.id && l.date === d && l.completed);
  // A weekly habit stays on the list until its weekly quota is met (and on
  // the days it was done, so it can be unticked).
  const showOn = (h, d) => isHabitShownOn(h, logs, d);
  const dayList = active.filter((h) => showOn(h, date));
  // Joker / pause days are neither due nor missed: out of today's count.
  const isJokerDay = (h, d) => logs.some((l) => l.habitId === h.id && l.date === d && l.joker && !l.completed);
  const countable = dayList.filter((h) => !isJokerDay(h, date));
  const doneCount = countable.filter((h) => isDone(h, date)).length;
  const pct = countable.length ? Math.round((doneCount / countable.length) * 100) : 0;
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
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => (habitReminders?.enabled ? setHabitRemindersEnabled(false) : enableReminders(setHabitRemindersEnabled))}
            title={habitReminders?.enabled ? 'Désactiver les rappels' : 'Activer les rappels (heure choisie par habitude)'}>
            <span className="flex items-center gap-1.5">{habitReminders?.enabled ? <Bell size={15} className="text-accent" /> : <BellOff size={15} />} Rappels</span>
          </Button>
          <Button variant="secondary" onClick={() => setPauseOpen(true)}><span className="flex items-center gap-1.5"><Palmtree size={15} /> Pause</span></Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><span className="flex items-center gap-1.5"><Plus size={16} /> Nouvelle habitude</span></Button>
        </div>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-bold text-ink tabular-nums">{doneCount}/{countable.length}</span></div>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{isPast ? fmtDate(date) : 'Aujourd’hui'}</div>
              <div className="text-xs text-mute">{pct === 100 && countable.length ? 'Journée parfaite 🎉' : `${countable.length - doneCount} restante(s)`}</div>
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

      {activePause && (
        <div className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2" style={{ borderColor: tint('var(--accent-secondary)', 45), background: tint('var(--accent-secondary)', 8) }}>
          <Palmtree size={16} style={{ color: 'var(--accent-secondary)' }} className="shrink-0" />
          <span className="flex-1 text-mute">En pause jusqu’au <b className="text-ink">{fmtDate(activePause.to)}</b>{activePause.reason ? ` (${activePause.reason})` : ''} : vos séries sont protégées.</span>
          <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={() => endPause(activePause.id)}>Reprendre maintenant</Button>
        </div>
      )}

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
                    {orderChains(g.items).map(({ h, depth }) => {
                      const done = isDone(h, date);
                      const streak = habitStreak(h.id, logs, today, h);
                      const wk = h.frequency === 'weekly' ? weeklyProgress(h, logs, date) : null;
                      const target = Number(h.targetStreak) || 0;
                      const log = logs.find((l) => l.habitId === h.id && l.date === date);
                      const isJoker = !!log?.joker && !done;
                      const canJoker = !done && !isJoker && !(h.kind === 'quantity' && h.direction === 'atMost') && jokersLeft(h.id, date) > 0;
                      return (
                        <div key={h.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${done ? 'border-good/40' : 'border-line bg-surface'}`} style={{ ...(done ? { background: tint('var(--success)', 8) } : {}), marginLeft: depth ? depth * 18 : undefined }}>
                          {depth > 0 && <CornerDownRight size={14} className="text-mute -ml-1 shrink-0" />}
                          <button onClick={() => toggleHabit(h.id, date)} title={h.source ? 'Suivi automatique' : done ? 'Décocher' : 'Fait'}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${h.source ? 'cursor-default' : 'cursor-pointer'} ${done ? 'bg-good border-good text-black' : isJoker ? 'border-accent2 text-accent2' : 'border-line hover:border-accent'}`}>
                            {done ? <Check size={16} strokeWidth={3} /> : isJoker ? <Snowflake size={14} /> : h.source ? <Zap size={13} className="text-mute" /> : null}
                          </button>
                          <div className="min-w-0 flex-1">
                            <button type="button" onClick={() => setDetail(h)} className={`text-left text-sm font-medium cursor-pointer hover:underline ${done ? 'text-mute line-through' : 'text-ink'}`} title="Historique et records">{h.name}</button>
                            <div className="text-[11px] text-mute flex flex-wrap gap-x-2">
                              <span>{catLabel(h.category)}</span>
                              {h.duration ? <span>· {h.duration} min</span> : null}
                              {wk && <span className={wk.met ? 'text-good' : ''}>· {wk.done}/{wk.target} cette semaine</span>}
                              <span>· +{h.xpReward} XP{h.linkedSkill && SKILL_MAP[h.linkedSkill] ? ` → ${SKILL_MAP[h.linkedSkill].name}` : ''}</span>
                              {h.mandatory && <span className="text-warning">· obligatoire</span>}
                              {h.mini && <span className="text-accent">· version mini</span>}
                              {h.after && depth === 0 && nameOf(h.after) && <span>· après « {nameOf(h.after)} »</span>}
                              {h.reminderTime && !done && <span className={habitReminders?.enabled ? '' : 'line-through'}>· ⏰ {h.reminderTime}</span>}
                              {h.source && <span className="text-accent">· auto ({sourceMeta(h.source)?.section})</span>}
                              {isJoker && <span style={{ color: 'var(--accent-secondary)' }}>· {log.pause ? 'en pause' : 'joker'} — série protégée</span>}
                            </div>
                            {h.kind === 'quantity' && <QuantityControl h={h} value={Number(log?.value) || 0} date={date} />}
                          </div>
                          <div className="hidden sm:block w-24 shrink-0">
                            <div className="flex items-center justify-end gap-1 text-xs font-semibold" style={{ color: streak ? 'var(--warning)' : 'var(--text-secondary)' }}><Flame size={12} /> {streak} {streakUnit(h)}</div>
                            {target > 0 && <div className="mt-1"><ProgressBar value={Math.min(100, (streak / target) * 100)} height={3} color={streak >= target ? 'var(--success)' : 'var(--warning)'} /><div className="text-[9px] text-mute text-right mt-0.5">objectif {target} {streakUnit(h)}</div></div>}
                          </div>
                          <div className="flex items-center shrink-0">
                            {canJoker && <button className="p-1.5 text-mute hover:text-accent2 cursor-pointer" onClick={() => useJoker(h.id, date)} title={`Utiliser un joker (${jokersLeft(h.id, date)} restant(s) ce mois-ci)`}><Snowflake size={13} /></button>}
                            {isJoker && !log.pause && <button className="p-1.5 text-accent2 hover:text-ink cursor-pointer" onClick={() => removeJoker(h.id, date)} title="Retirer le joker"><Snowflake size={13} /></button>}
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

      {active.length > 0 && !isPast && <CoachCard habits={habits} logs={logs} energyLogs={energyLogs} today={today} onEdit={(h) => { setEditing(h); setFormOpen(true); }} />}

      {quitHabits.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><Ban size={15} className="text-accent" /> À éviter</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quitHabits.map((h) => <QuitCard key={h.id} h={h} today={today} onRelapse={setRelapsing} />)}
          </div>
        </div>
      )}

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
                    <button type="button" onClick={() => setDetail(h)} className="block max-w-full text-left text-sm text-ink truncate cursor-pointer hover:underline">{h.name}</button>
                    <div className="text-[11px] text-mute">
                      {h.kind === 'quit' ? `À arrêter · ${catLabel(h.category)}`
                        : `${catLabel(h.category)} · ${freqText(h)} · ${HABIT_MOMENTS.find((m) => m.value === (h.moment || 'any'))?.label}`}
                      {h.kind === 'quantity' && ` · ${h.direction === 'atMost' ? '≤' : '≥'} ${h.target} ${h.unit || ''}${h.source ? ` · auto (${sourceMeta(h.source)?.section})` : ''}`}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-mute w-28 shrink-0">
                    <div className="flex items-center justify-end gap-1" style={{ color: streak ? 'var(--warning)' : undefined }}><Flame size={11} /> {streak} {h.kind === 'quit' ? 'j sans' : streakUnit(h)}</div>
                    <div>{h.kind === 'quit' ? `record ${quitBest(h, today)} j` : r == null ? (h.frequency === 'weekly' ? 'suivi par semaine' : '—') : `${r} % sur 30 j`}</div>
                  </div>
                  <button className="p-1.5 text-mute hover:text-accent cursor-pointer" onClick={() => setDetail(h)} title="Historique et records"><CalendarDays size={13} /></button>
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

      {detail && <HabitDetailModal habit={habits.find((x) => x.id === detail.id) || detail} onClose={() => setDetail(null)} onEdit={(h) => { setDetail(null); setEditing(h); setFormOpen(true); }} />}
      <HabitFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} habit={editing} />
      <CheckinModal open={checkinOpen} onClose={() => setCheckinOpen(false)} date={date} />
      <PauseModal open={pauseOpen} onClose={() => setPauseOpen(false)} />
      <Modal open={!!relapsing} onClose={() => setRelapsing(null)} title="Noter une rechute ?">
        <p className="text-sm text-mute">Le compteur de « {relapsing?.name} » repartira de zéro demain. Votre record ({relapsing ? quitBest(relapsing, today) : 0} j) reste enregistré.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setRelapsing(null)}>Annuler</Button>
          <Button onClick={() => { logRelapse(relapsing.id, today); setRelapsing(null); }}>Noter</Button>
        </div>
      </Modal>
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
