import { useMemo, useState, useEffect, useRef } from 'react';
import { Pencil, Check, HeartPulse, Ban, Gauge, Palmtree, Bell, Link2 } from 'lucide-react';
import { HABIT_SOURCES, sourceMeta } from '../../utils/habit-sources';
import { baseCurrencyShort } from '../../utils/formatters';
import { useHabitStore } from '../../store/habitStore';
import { useSkillStore } from '../../store/skillStore';
import { habitStreak, streakUnit, habitDayStatus, habitBestStreak, habitSuccessRate } from '../../utils/calculations';
import { calculateSleepScore, SLEEP_BAND_COLOR, SLEEP_BAND_LABEL } from '../../utils/sleep-quality';
import { calculateStressLevel, stressLabel } from '../../utils/stress-calculator';
import { HABIT_CATEGORIES, HABIT_FREQUENCIES, HABIT_MOMENTS, WEEKDAYS, MOODS, MOOD_LABELS, RECOVERY_ACTIVITIES, RECOVERY_LABELS, STRESS_ITEMS, HEALTH_LINK_TYPES } from '../../utils/constants';
import { HABIT_TEMPLATES } from '../../utils/habit-templates';
import { habitSchema, validate } from '../../utils/validators';
import { todayKey, dateKey, fmtDate } from '../../utils/formatters';
import { Button, Field, Input, Select, Modal, ProgressBar, WeekdayPicker } from '../common/ui';
import SkillPicker from '../common/SkillPicker';
import { tint, MOMENT_ICON, catLabel, checkInFromLog } from './habit-ui';
import { enableReminders } from './HabitCards';

export function CheckinModal({ open, onClose, date }) {
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
        <p className="text-[11px] text-mute flex items-center gap-1.5"><HeartPulse size={12} className="text-accent" /> Le même check-in que dans Santé : ce que tu remplis ici complète la version rapide, sans rien effacer.</p>
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
export const blankHabit = () => ({ kind: 'check', name: '', category: 'health', moment: 'any', xpReward: 5, linkedSkill: '', healthLink: '', mandatory: false, frequency: 'daily', weekdays: [], timesPerWeek: 3, duration: 15, targetStreak: 30, target: 8, unit: '', direction: 'atLeast', source: '', reminderTime: '', after: '' });
export const KINDS = [
  { value: 'check', label: 'À cocher', Icon: Check, desc: 'Fait / pas fait' },
  { value: 'quantity', label: 'Mesurable', Icon: Gauge, desc: 'Verres, pages, minutes… (peut être automatique)' },
  { value: 'quit', label: 'À arrêter', Icon: Ban, desc: 'Compteur de jours sans (cigarette, réseaux…)' },
];
export const unitOf = (src) => (src?.value === 'spent_amount' ? baseCurrencyShort() : src?.unit || '');

export function HabitFormModal({ open, onClose, habit }) {
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
    setF({ ...blankHabit(), ...tpl, linkedSkill, timesPerWeek: tpl.frequency === 'weekly' ? tpl.timesPerWeek || 1 : 3, source: tpl.source || '', unit: tpl.unit || unitOf(sourceMeta(tpl.source)) });
  };
  const submit = (e) => {
    e.preventDefault();
    const res = validate(habitSchema, { ...f, linkedSkill: f.linkedSkill || undefined, healthLink: f.healthLink || undefined });
    if (!res.ok) return setError(res.error);
    if (f.kind !== 'quit' && f.frequency === 'custom' && !f.weekdays?.length) return setError('Choisis au moins un jour.');
    if (f.kind === 'quantity' && !(Number(f.target) > 0) && f.direction === 'atLeast') return setError('Indique une cible supérieure à 0.');
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
          <Field label="Partir d’un modèle (optionnel)" hint="94 modèles : à cocher, mesurables (souvent automatiques) et à arrêter">
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
            <Field label="Suivi" hint={f.source ? 'La valeur du jour est lue automatiquement : rien à cocher.' : 'Tu saisis la valeur du jour (+ / −).'}>
              <Select value={f.source} onChange={(e) => { const src = sourceMeta(e.target.value); setF({ ...f, source: e.target.value, unit: src ? unitOf(src) : f.unit }); }}>
                <option value="">Saisie manuelle</option>
                <optgroup label="Automatique, depuis tes autres sections">
                  {HABIT_SOURCES.map((src) => <option key={src.value} value={src.value}>{src.label}</option>)}
                </optgroup>
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Objectif"><Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} options={[{ value: 'atLeast', label: 'Au moins' }, { value: 'atMost', label: 'Au plus' }]} /></Field>
              <Field label="Valeur"><Input type="number" min="0" step="any" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
              <Field label="Unité"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="verres, pages, min…" /></Field>
            </div>
            {f.direction === 'atMost' && <p className="text-[11px] text-mute">« Au plus » : la journée est réussie si tu restes sous la limite ; elle est validée une fois la journée terminée.</p>}
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
export function PauseModal({ open, onClose }) {
  const startPause = useHabitStore((st) => st.startPause);
  const today = todayKey();
  const [f, setF] = useState({ from: today, to: today, reason: '' });
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setF({ from: today, to: todayKey(new Date(Date.now() + 6 * 86400000)), reason: '' }); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onClose={onClose} title="Mode pause (vacances, maladie…)">
      <div className="space-y-3">
        <p className="text-sm text-mute">Pendant la pause, tes habitudes ne cassent pas leurs séries : chaque jour couvert compte comme un joker, sans entamer tes jokers du mois.</p>
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
export const DAY_COLOR = {
  done: 'var(--success)', joker: 'var(--accent-secondary)', missed: 'color-mix(in srgb, var(--error) 45%, transparent)',
  off: 'color-mix(in srgb, var(--text-secondary) 16%, transparent)', future: 'transparent',
};
export const DAY_LABEL = { done: 'réussi', joker: 'joker / pause', missed: 'manqué', off: 'non prévu', future: '' };
export const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const WEEKDAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function HabitDetailModal({ habit, onClose, onEdit }) {
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
