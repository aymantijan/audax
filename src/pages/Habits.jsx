import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Flame, AlertTriangle, Pencil, ChevronLeft, ChevronRight, History, CalendarPlus, CalendarCheck, Check, Archive, ArchiveRestore, ShieldAlert, Target, ListChecks, ChevronDown, Snowflake, Ban, Zap, Palmtree, Bell, BellOff, CalendarDays, CornerDownRight } from 'lucide-react';
import { sourceMeta } from '../utils/habit-sources';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHabitStore } from '../store/habitStore';
import { useTradingStore } from '../store/tradingStore';
import { habitStreak, habitCompliance, isHabitShownOn, weeklyProgress, streakUnit, quitBest } from '../utils/calculations';
import { checkBurnoutTriggers } from '../utils/burnout';
import { HABIT_CATEGORIES, HABIT_MOMENTS, WEEKDAYS, SKILL_MAP } from '../utils/constants';
import { todayKey, dateKey, fmtDate } from '../utils/formatters';
import { Card, Button, Modal, EmptyState, ProgressBar, playSeal } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';
import ScheduleEventModal from '../components/common/ScheduleEventModal';
import { tooltipStyle } from '../components/common/chart-theme';
import { tint, MOMENT_ICON, catLabel } from '../components/habits/habit-ui';
import { CheckinModal, HabitFormModal, PauseModal, HabitDetailModal } from '../components/habits/HabitModals';
import { QuantityControl, QuitCard, orderChains, enableReminders, CoachCard } from '../components/habits/HabitCards';

export default function Habits() {
  const { habits, logs, energyLogs, toggleHabit, archiveHabit, unarchiveHabit, deleteHabit, editHabit, getBadges, useJoker, removeJoker, jokersLeft, logRelapse, endPause, pauses } = useHabitStore();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [relapsing, setRelapsing] = useState(null);
  const trades = useTradingStore((s) => s.trades);
  const today = todayKey();
  const [date, setDate] = useState(today);
  const isPast = date !== today;
  // Deep links from the global search: /habits?new=1 and /habits?checkin=1.
  const [formOpen, setFormOpen] = useState(() => new URLSearchParams(window.location.search).get('new') === '1');
  const [editing, setEditing] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(() => new URLSearchParams(window.location.search).get('checkin') === '1');
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
          <p className="text-mute text-sm mt-1">Tes routines quotidiennes, tes séries et ton énergie, avec une alerte précoce d’épuisement.</p>
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
            <div className="text-[11px] text-mute truncate">{bestStreak?.s ? bestStreak.h.name : 'coche une habitude'}</div>
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
          <span className="flex-1 text-mute">En pause jusqu’au <b className="text-ink">{fmtDate(activePause.to)}</b>{activePause.reason ? ` (${activePause.reason})` : ''} : tes séries sont protégées.</span>
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
                          <button type="button" onClick={(e) => { if (!done && !h.source) playSeal(e.currentTarget); toggleHabit(h.id, date); }} title={h.source ? 'Suivi automatique' : done ? 'Décocher' : 'Fait'} aria-label={`${done ? 'Décocher' : 'Cocher'} ${h.name}`}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${h.source ? 'cursor-default' : 'cursor-pointer'} ${done ? 'bg-good border-good text-on-accent' : isJoker ? 'border-accent2 text-accent2' : 'border-line hover:border-accent'}`}>
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
          <EmptyState>{isPast ? 'Aucune habitude prévue ce jour-là.' : active.length ? 'Rien de prévu aujourd’hui.' : 'Aucune habitude. Commence par une seule habitude clé, puis ajoutes-en progressivement.'}</EmptyState>
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
                <Line type="monotone" dataKey="Énergie" stroke="var(--accent-primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Sommeil" stroke="var(--success)" strokeWidth={2} dot={false} />
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
        <p className="text-sm text-mute">Le compteur de « {relapsing?.name} » repartira de zéro demain. Ton record ({relapsing ? quitBest(relapsing, today) : 0} j) reste enregistré.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setRelapsing(null)}>Annuler</Button>
          <Button onClick={() => { logRelapse(relapsing.id, today); setRelapsing(null); }}>Noter</Button>
        </div>
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Supprimer définitivement ?">
        <p className="text-sm text-mute">« {deleting?.name} » et tout son historique seront supprimés. Pour garder l’historique, laisse-la archivée.</p>
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
