import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Pencil, Dumbbell, Trophy, Library, CalendarPlus, X, Search, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { kgToLb, lbToKg } from '../../utils/health-science';
import { GYM_SESSION_TYPES, SMALL_MUSCLE_OPTIONS, labelFor } from '../../utils/workout-types';
import { searchExercises, suggestExercises } from '../../utils/exercise-library';
import { INJURY_EXCLUSION_MAP } from '../../utils/training-program-generator';
import { Card, Button, Field, Input, Select, EmptyState, Badge } from '../../components/common/ui';
import ScheduleEventModal from '../../components/common/ScheduleEventModal';
import CyclePhaseHint from '../../components/health/CyclePhaseHint';
import { CuratedGymLogger } from './CuratedSessionLogger';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const blankSet = () => ({ reps: '', weight: '', rpe: 7, form: 'Good' });

export default function GymLogging({ pendingPrompt }) {
  const { workouts, logGymSession, editGymSession, deleteSession, getPRs, getWorkoutVolumeSeries, getEstimated1RMs, getExerciseLibrary, weightUnit, setWeightUnit, healthProfile, getStrengthPredictions, getActiveCuratedProgram, getNextGymSession } = useHealthStore();
  const curatedProgram = getActiveCuratedProgram();
  // Whether the checkbox logger above already covers the next session (the
  // program's rotation, not a specific calendar day — see getNextGymSession)
  // — when true, the manual exercise-by-exercise builder is redundant with
  // what Programme already gave the user, so it's hidden by default behind
  // "Mode libre" instead of always showing underneath it.
  const hasCuratedToday = !!(curatedProgram && getNextGymSession()?.session?.exercises?.length);
  const [freeMode, setFreeMode] = useState(false);

  const injuredAreas = (healthProfile.injuries || []).map((i) => i.area).filter((a) => INJURY_EXCLUSION_MAP[a]);
  const isCautionExercise = (name) => injuredAreas.some((area) => INJURY_EXCLUSION_MAP[area].excludeNameMatch.some((re) => re.test(name)));

  // null | { sessionId } — every gym entry is always session-based (created
  // via logGymSession), so edit always targets a sessionId.
  const [editing, setEditing] = useState(null);
  // Editing an existing session always needs the form, regardless of freeMode.
  const showManualForm = !hasCuratedToday || freeMode || !!editing;
  // The edit button lives on Today/History rows, which can be well below the
  // fold (PRs/1RM/Progression/Library/Volume-chart cards sit in between) —
  // without scrolling, populating the form off-screen looks like nothing
  // happened. This ref + scrollIntoView is the fix.
  const formCardRef = useRef(null);
  const scrollToForm = () => formCardRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });

  const [sessionType, setSessionType] = useState(GYM_SESSION_TYPES[0].value);
  const [sessionExercises, setSessionExercises] = useState(
    pendingPrompt?.habitName ? [{ exercise: pendingPrompt.habitName, sets: [blankSet()] }] : []
  );
  // Optional accessory muscles tacked onto today's session (e.g. Biceps after
  // a Back day) — widens the picker's suggestions, doesn't change sessionType.
  const [extraMuscles, setExtraMuscles] = useState(new Set());
  const toggleExtraMuscle = (m) =>
    setExtraMuscles((s) => {
      const next = new Set(s);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  const [pickerQuery, setPickerQuery] = useState('');
  const [customExercise, setCustomExercise] = useState('');

  const [quality, setQuality] = useState(7);
  const [notes, setNotes] = useState('');
  const [progressExercise, setProgressExercise] = useState('');
  const [logDate, setLogDate] = useState(todayKey());
  const [scheduleModal, setScheduleModal] = useState(false);

  const isLb = weightUnit === 'lb';
  const dispW = (kg) => (kg ? Math.round((isLb ? kgToLb(kg) : kg) * 10) / 10 : 0);
  const toKg = (v) => (isLb ? lbToKg(Number(v) || 0) : Number(v) || 0);

  const sessionMuscleGroups = [
    ...(GYM_SESSION_TYPES.find((s) => s.value === sessionType)?.muscleGroups || []),
    ...extraMuscles,
  ];
  const pickerResults = useMemo(
    () =>
      pickerQuery.trim()
        ? searchExercises(pickerQuery, null).slice(0, 20)
        : suggestExercises(sessionMuscleGroups, 24),
    [pickerQuery, sessionType, extraMuscles]
  );

  const addExerciseToSession = (name) => {
    if (!name?.trim()) return;
    setSessionExercises((s) => [...s, { exercise: name.trim(), sets: [blankSet()] }]);
    setPickerQuery('');
    setCustomExercise('');
  };
  const removeExerciseFromSession = (i) => setSessionExercises((s) => s.filter((_, idx) => idx !== i));
  const addSetToExercise = (exIdx) =>
    setSessionExercises((s) => s.map((ex, idx) => (idx === exIdx ? { ...ex, sets: [...ex.sets, blankSet()] } : ex)));
  const updateSetInExercise = (exIdx, setIdx, patch) =>
    setSessionExercises((s) =>
      s.map((ex, idx) => (idx === exIdx ? { ...ex, sets: ex.sets.map((set, si) => (si === setIdx ? { ...set, ...patch } : set)) } : ex))
    );
  const removeSetFromExercise = (exIdx, setIdx) =>
    setSessionExercises((s) => s.map((ex, idx) => (idx === exIdx ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) } : ex)));

  const resetForm = () => {
    setSessionExercises([]);
    setExtraMuscles(new Set());
    setQuality(7);
    setLogDate(todayKey());
    setNotes('');
    setEditing(null);
  };

  const startEditSession = (item) => {
    setSessionType(item.sessionType || GYM_SESSION_TYPES[0].value);
    setExtraMuscles(new Set());
    setSessionExercises(item.exercises.map((ex) => ({ exercise: ex.exercise, sets: (ex.sets || []).map((s) => ({ ...s, weight: dispW(Number(s.weight) || 0) })) })));
    setQuality(item.exercises[0]?.quality || 7);
    setNotes(item.exercises[0]?.notes || '');
    setLogDate(item.date);
    setEditing({ sessionId: item.sessionId });
    scrollToForm();
  };

  const cancelEdit = () => resetForm();

  const submit = (e) => {
    e.preventDefault();
    const exercises = sessionExercises.map((ex) => ({ exercise: ex.exercise, sets: ex.sets.map((s) => ({ ...s, weight: toKg(s.weight) })) }));
    if (editing) {
      editGymSession(editing.sessionId, { date: logDate, sessionType, exercises, quality, notes });
    } else {
      logGymSession({ date: logDate, sessionType, exercises, quality, notes }, pendingPrompt?.id);
    }
    resetForm();
  };

  const today = todayKey();
  const prs = getPRs();
  const volumeSeries = getWorkoutVolumeSeries();
  const oneRMs = getEstimated1RMs();
  const library = getExerciseLibrary().filter((ex) => ex.type === 'strength');

  const gymWorkouts = workouts.filter((w) => w.type === 'strength');
  const groupItems = (list) => {
    const seen = new Set();
    const items = [];
    for (const w of list) {
      if (!w.sessionId || seen.has(w.sessionId)) continue;
      seen.add(w.sessionId);
      const group = list.filter((x) => x.sessionId === w.sessionId);
      items.push({ sessionId: w.sessionId, date: w.date, sessionType: w.sessionType, exercises: group, createdAt: w.createdAt });
    }
    return items.sort((a, b) => b.createdAt - a.createdAt);
  };

  const todayItems = groupItems(gymWorkouts.filter((w) => w.date === today));
  const historyItems = groupItems([...gymWorkouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60)).slice(0, 20);

  const strengthExercises = useMemo(
    () => [...new Set(gymWorkouts.filter((w) => w.exercise).map((w) => w.exercise))],
    [gymWorkouts]
  );
  const progressData = useMemo(() => {
    if (!progressExercise) return [];
    return gymWorkouts
      .filter((w) => w.exercise === progressExercise)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((w) => ({
        date: w.date.slice(5),
        maxWeight: dispW(Math.max(0, ...(w.sets || []).map((s) => Number(s.weight) || 0))),
        volume: (w.sets || []).reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0),
      }));
  }, [gymWorkouts, progressExercise, weightUnit]);

  // Dashed projection points appended after the real history — a linear-
  // regression trend extrapolation (health-predictions.js), not a guarantee.
  const projectionData = useMemo(() => {
    if (!progressExercise || progressData.length < 3) return [];
    const pred = getStrengthPredictions().find((p) => p.exercise === progressExercise);
    if (!pred) return [];
    return Object.entries(pred.projections).map(([label, oneRm]) => ({ date: `+${label}`, projected: dispW(oneRm) }));
  }, [progressExercise, progressData, weightUnit]);

  return (
    <div className="space-y-6">
      <CyclePhaseHint />
      {curatedProgram && <CuratedGymLogger />}

      {hasCuratedToday && !editing && (
        <button
          type="button"
          onClick={() => setFreeMode((v) => !v)}
          className="text-xs text-mute hover:text-ink underline cursor-pointer"
        >
          {freeMode ? 'Masquer le formulaire libre' : "Autre chose à logger en plus du programme ? Mode libre"}
        </button>
      )}

      {showManualForm && (
      <div ref={formCardRef} style={{ scrollMarginTop: '5rem' }}>
      <Card
        title={editing ? 'Modifier la séance' : 'Logger une séance'}
        action={<Button variant="secondary" onClick={() => setScheduleModal(true)}><span className="flex items-center gap-2"><CalendarPlus size={14} /> Programmer une séance</span></Button>}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type de séance">
              <Select value={sessionType} onChange={(e) => setSessionType(e.target.value)} options={GYM_SESSION_TYPES} />
            </Field>
            <Field label="Date" hint="Rattraper une séance manquée">
              <Input type="date" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs text-mute uppercase tracking-wide">Aussi entraîner un petit muscle aujourd'hui ? (optionnel)</div>
              <div className="flex flex-wrap gap-1.5">
                {SMALL_MUSCLE_OPTIONS.map((m) => {
                  const on = extraMuscles.has(m.value);
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => toggleExtraMuscle(m.value)}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                        on ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-mute uppercase tracking-wide">Ajouter un exercice</div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
                <Input
                  className="!pl-8"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={sessionMuscleGroups.length ? `Rechercher un exercice (suggestions : ${sessionMuscleGroups.join(', ')})…` : 'Rechercher un exercice…'}
                />
              </div>
              {pickerResults.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {pickerResults.map((ex) => {
                    const caution = isCautionExercise(ex.name);
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => addExerciseToSession(ex.name)}
                        title={caution ? 'Marqué comme précaution dans ton profil (blessure déclarée) — pas un avis médical' : undefined}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border cursor-pointer ${caution ? 'border-warning/50 text-warning' : 'border-line hover:border-accent hover:text-accent'}`}
                      >
                        {caution && <AlertTriangle size={10} />}
                        {ex.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={customExercise} onChange={(e) => setCustomExercise(e.target.value)} placeholder="Pas dans la liste ? Tape un exercice personnalisé" />
                <Button type="button" variant="secondary" onClick={() => addExerciseToSession(customExercise)}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>

            {sessionExercises.length ? (
              <div className="space-y-3">
                {sessionExercises.map((ex, exIdx) => (
                  <div key={exIdx} className="border border-line rounded-lg p-3 space-y-2 bg-surface">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{ex.exercise}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {['kg', 'lb'].map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setWeightUnit(u)}
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase cursor-pointer border ${weightUnit === u ? 'border-accent text-accent' : 'border-line text-mute'}`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => removeExerciseFromSession(exIdx)} className="text-mute hover:text-bad cursor-pointer">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {ex.sets.map((s, setIdx) => (
                      <div key={setIdx} className="grid grid-cols-5 gap-2 items-center">
                        <Input type="number" placeholder="Reps" value={s.reps} onChange={(e) => updateSetInExercise(exIdx, setIdx, { reps: e.target.value })} />
                        <Input type="number" placeholder={`Poids (${weightUnit})`} value={s.weight} onChange={(e) => updateSetInExercise(exIdx, setIdx, { weight: e.target.value })} />
                        <div>
                          <input type="range" min="1" max="10" value={s.rpe} onChange={(e) => updateSetInExercise(exIdx, setIdx, { rpe: Number(e.target.value) })} className="w-full" />
                          <div className="text-[10px] text-mute text-center">RPE {s.rpe}</div>
                        </div>
                        <Select value={s.form} onChange={(e) => updateSetInExercise(exIdx, setIdx, { form: e.target.value })} options={['Good', 'Fair', 'Poor']} />
                        <button type="button" onClick={() => removeSetFromExercise(exIdx, setIdx)} className="text-mute hover:text-bad cursor-pointer justify-self-center">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => addSetToExercise(exIdx)}>
                      <span className="flex items-center gap-1.5"><Plus size={12} /> Ajouter une série</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-mute text-sm py-4 border border-dashed border-line rounded-lg">
                Cherche ou tape un exercice ci-dessus pour construire cette séance.
              </div>
            )}
          </div>

          <Field label={`Qualité de la séance : ${quality}/10`}>
            <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Notes (optionnel)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            {editing && (
              <Button type="button" variant="secondary" className="flex-1" onClick={cancelEdit}>
                Annuler la modification
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={!sessionExercises.length}>
              {editing ? 'Enregistrer' : 'Terminer la séance'}
            </Button>
          </div>
        </form>
      </Card>
      </div>
      )}

      <Card title="Aujourd'hui" action={<Badge>{todayItems.length} loggée{todayItems.length !== 1 ? 's' : ''}</Badge>}>
        {todayItems.length ? (
          <ul className="space-y-2">
            {todayItems.map((item) => (
              <SessionRow key={item.sessionId} item={item} onDelete={() => deleteSession(item.sessionId)} onEdit={() => startEditSession(item)} />
            ))}
          </ul>
        ) : (
          <EmptyState>Rien loggé aujourd'hui.</EmptyState>
        )}
      </Card>

      {prs.length > 0 && (
        <Card title="Records personnels">
          <ul className="space-y-1.5">
            {prs.map((pr) => (
              <li key={pr.exercise} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                <Trophy size={14} className="text-warn shrink-0" />
                <span className="flex-1">{pr.exercise}</span>
                <span className="font-semibold">{dispW(pr.weight)}{weightUnit} × {pr.reps}</span>
                <span className="text-mute text-xs">{pr.date}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {oneRMs.length > 0 && (
        <Card title="1RM estimé" action={<span className="text-[10px] text-mute">Formule d'Epley</span>}>
          <ul className="space-y-1.5">
            {oneRMs.map((rm) => (
              <li key={rm.exercise} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                <span className="flex-1">{rm.exercise}</span>
                <span className="font-semibold">{dispW(rm.oneRM)}{weightUnit}</span>
                <span className="text-mute text-xs">à partir de {dispW(rm.weight)}{weightUnit} × {rm.reps} le {rm.date}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {strengthExercises.length > 0 && (
        <Card title="Progression en force">
          <Field label="Exercice">
            <Select value={progressExercise} onChange={(e) => setProgressExercise(e.target.value)} options={['', ...strengthExercises]} />
          </Field>
          {progressData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220} className="mt-3">
              <LineChart data={[...progressData, ...projectionData]}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="maxWeight" name={`Poids max (${weightUnit})`} stroke="#00d9ff" strokeWidth={2} dot connectNulls />
                {projectionData.length > 0 && (
                  <Line type="monotone" dataKey="projected" name="Projection (1RM estimé)" stroke="#7c5cff" strokeWidth={2} strokeDasharray="5 4" dot connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-mute text-sm py-6">{progressExercise ? 'Log a few more sessions to see a trend.' : 'Choisis un exercice pour voir sa progression.'}</div>
          )}
        </Card>
      )}

      {library.length > 0 && (
        <Card title="Bibliothèque d'exercices" action={<Library size={16} className="text-mute" />}>
          <ul className="space-y-1.5">
            {library.map((ex) => (
              <li
                key={ex.exercise}
                onClick={() => setProgressExercise(ex.exercise)}
                className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-accent"
              >
                <Dumbbell size={14} className="text-accent shrink-0" />
                <span className="flex-1">{ex.exercise}</span>
                <span className="text-mute text-xs">{ex.sessions} séance{ex.sessions !== 1 ? 's' : ''}</span>
                <span className="text-xs">best {dispW(ex.bestWeightKg)}{weightUnit}</span>
                <span className="text-mute text-xs">dernière {ex.lastDate}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {volumeSeries.some((w) => w.volume > 0) && (
        <Card title="Volume d'entraînement hebdomadaire (périodisation)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeSeries}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="volume" name="kg soulevés" fill="#7c5cff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="Historique">
        {historyItems.length ? (
          <ul className="space-y-2">
            {historyItems.map((item) => (
              <SessionRow key={item.sessionId} item={item} onDelete={() => deleteSession(item.sessionId)} onEdit={() => startEditSession(item)} showDate />
            ))}
          </ul>
        ) : (
          <EmptyState>Aucune séance loggée pour l'instant.</EmptyState>
        )}
      </Card>

      <ScheduleEventModal
        open={scheduleModal}
        onClose={() => setScheduleModal(false)}
        title="Programmer une séance"
        defaultSummary="Séance Gym"
        onScheduled={() => {}}
      />
    </div>
  );
}

function SessionRow({ item, onDelete, onEdit, showDate }) {
  const totalVolume = item.exercises.reduce((a, w) => a + (w.sets || []).reduce((s, set) => s + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0), 0);
  const totalSets = item.exercises.reduce((a, w) => a + (w.sets?.length || 0), 0);
  const label = labelFor(GYM_SESSION_TYPES, item.sessionType) || 'Séance Gym';
  return (
    <li className="bg-surface border border-line rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Dumbbell size={16} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm">{label}</div>
          <div className="text-[11px] text-mute">
            {showDate ? `${item.date} · ` : ''}
            {item.exercises.length} exercice{item.exercises.length !== 1 ? 's' : ''} · {totalSets} séries · {totalVolume}kg vol
          </div>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="text-mute hover:text-accent cursor-pointer shrink-0">
            <Pencil size={14} />
          </button>
        )}
        <button onClick={onDelete} className="text-mute hover:text-bad cursor-pointer shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-1.5 pl-7 text-[11px] text-mute space-y-0.5">
        {item.exercises.map((ex) => (
          <div key={ex.id}>{ex.exercise} — {ex.sets?.length || 0} séries</div>
        ))}
      </div>
    </li>
  );
}
