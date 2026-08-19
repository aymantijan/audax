import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Pencil, Dumbbell, HeartPulse, Trophy, Library, CalendarPlus, Activity, X, Search, AlertTriangle, ClipboardList } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { kgToLb, lbToKg } from '../../utils/health-science';
import { CARDIO_TYPES, GYM_SESSION_TYPES, SPORT_TYPES, SMALL_MUSCLE_OPTIONS, labelFor } from '../../utils/workout-types';
import { searchExercises, suggestExercises } from '../../utils/exercise-library';
import { INJURY_EXCLUSION_MAP } from '../../utils/training-program-generator';
import { Card, Button, Field, Input, Select, EmptyState, Badge } from '../../components/common/ui';
import ScheduleEventModal from '../../components/common/ScheduleEventModal';
import CuratedSessionLogger from './CuratedSessionLogger';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const blankSet = () => ({ reps: '', weight: '', rpe: 7, form: 'Good' });
const CATEGORY_ICON = { cardio: HeartPulse, gym: Dumbbell, sport: Activity };

export default function WorkoutLogging({ pendingPrompt }) {
  const { workouts, logWorkout, logGymSession, editWorkout, editGymSession, deleteWorkout, deleteSession, getPRs, getWorkoutVolumeSeries, getEstimated1RMs, getExerciseLibrary, weightUnit, setWeightUnit, getNextPlannedDay, healthProfile, getStrengthPredictions, getActiveCuratedProgram, getTodayCuratedSession } = useHealthStore();
  const curatedProgram = getActiveCuratedProgram();
  const curatedToday = curatedProgram ? getTodayCuratedSession() : null;
  // Whether the checkbox logger above already covers today (training and/or
  // cardio scheduled) — mirrors CuratedSessionLogger's own render condition.
  // When true, the manual exercise-by-exercise form is redundant with what
  // Programme already gave the user, so it's hidden by default behind
  // "Mode libre" instead of always showing underneath it.
  const hasCuratedToday = !!(curatedProgram && curatedToday?.dayEntry?.blocks?.some((b) => b.type === 'training' || b.type === 'cardio'));
  const [freeMode, setFreeMode] = useState(false);
  // A curated program (given, read-only) takes priority over the generated
  // one's rotation-based "next up" guess when both could apply — a curated
  // program's sessions are tied to real weekdays, so "today's session" is
  // known exactly rather than inferred from a logging-count rotation.
  const plannedDay = curatedProgram
    ? (curatedToday?.session ? { label: curatedToday.session.label, exercises: curatedToday.session.exercises } : null)
    : getNextPlannedDay();
  const injuredAreas = (healthProfile.injuries || []).map((i) => i.area).filter((a) => INJURY_EXCLUSION_MAP[a]);
  const isCautionExercise = (name) => injuredAreas.some((area) => INJURY_EXCLUSION_MAP[area].excludeNameMatch.some((re) => re.test(name)));

  // null | { kind: 'single', id } | { kind: 'session', sessionId } — 'single'
  // only ever applies to cardio/sport (duration-based, one entry); every
  // strength/gym entry is always part of a session (created via
  // logGymSession — see its comment), so its edit path is always 'session'.
  const [editing, setEditing] = useState(null);
  // Editing an existing entry always needs the form, regardless of freeMode.
  const showManualForm = !hasCuratedToday || freeMode || !!editing;
  // The edit buttons live on Today/History rows, which can be well below the
  // fold (PRs/1RM/Progression/Library/Volume-chart cards sit between "Today"
  // and "History") — without scrolling, populating the form off-screen looks
  // exactly like the click did nothing. This ref + scrollIntoView is the fix.
  const formCardRef = useRef(null);
  const scrollToForm = () => formCardRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });

  const promptCategory = pendingPrompt?.type === 'cardio' ? 'cardio' : pendingPrompt?.type === 'strength' ? 'gym' : 'cardio';
  const [category, setCategory] = useState(promptCategory);

  // Cardio / Sport — duration-based, single entry
  const [cardioSubtype, setCardioSubtype] = useState(CARDIO_TYPES[1].value);
  const [sportSubtype, setSportSubtype] = useState(SPORT_TYPES[0].value);
  const [durationMin, setDurationMin] = useState(pendingPrompt?.duration || 30);

  // Gym — a session built from N exercises picked off the library
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
        : suggestExercises(sessionMuscleGroups, 24), // round-robin so a small accessory pick isn't crowded out by a big group like "back"
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

  // Populates the form from an existing cardio/sport entry and switches to
  // edit mode — submit() below then calls editWorkout instead of logWorkout.
  const startEditWorkout = (w) => {
    setCategory(w.type);
    if (w.type === 'cardio') setCardioSubtype(w.sessionType || CARDIO_TYPES[1].value);
    else setSportSubtype(w.sessionType || SPORT_TYPES[0].value);
    setDurationMin(w.durationMin || 0);
    setQuality(w.quality || 7);
    setNotes(w.notes || '');
    setLogDate(w.date);
    setEditing({ kind: 'single', id: w.id });
    scrollToForm();
  };

  // Populates the form from an existing gym session's exercises — weights are
  // converted to the CURRENT display unit (dispW) since the Weight input shows
  // whatever unit is active, and submit() converts back to kg via toKg.
  const startEditSession = (item) => {
    setCategory('gym');
    setSessionType(item.sessionType || GYM_SESSION_TYPES[0].value);
    setExtraMuscles(new Set());
    setSessionExercises(item.exercises.map((ex) => ({ exercise: ex.exercise, sets: (ex.sets || []).map((s) => ({ ...s, weight: dispW(Number(s.weight) || 0) })) })));
    setQuality(item.exercises[0]?.quality || 7);
    setNotes(item.exercises[0]?.notes || '');
    setLogDate(item.date);
    setEditing({ kind: 'session', sessionId: item.sessionId });
    scrollToForm();
  };

  const cancelEdit = () => resetForm();

  const submit = (e) => {
    e.preventDefault();
    if (category === 'gym') {
      const exercises = sessionExercises.map((ex) => ({ exercise: ex.exercise, sets: ex.sets.map((s) => ({ ...s, weight: toKg(s.weight) })) }));
      if (editing?.kind === 'session') {
        editGymSession(editing.sessionId, { date: logDate, sessionType, exercises, quality, notes });
      } else {
        logGymSession({ date: logDate, sessionType, exercises, quality, notes }, pendingPrompt?.id);
      }
    } else {
      const subtype = category === 'cardio' ? cardioSubtype : sportSubtype;
      const list = category === 'cardio' ? CARDIO_TYPES : SPORT_TYPES;
      const payload = {
        date: logDate,
        type: category, // 'cardio' | 'sport'
        category,
        sessionType: subtype,
        exercise: labelFor(list, subtype),
        durationMin,
        quality,
        notes,
      };
      if (editing?.kind === 'single') editWorkout(editing.id, payload);
      else logWorkout(payload, pendingPrompt?.id);
    }
    resetForm();
  };

  const today = todayKey();
  const prs = getPRs();
  const volumeSeries = getWorkoutVolumeSeries();
  const oneRMs = getEstimated1RMs();
  const library = getExerciseLibrary();

  // Group entries sharing a sessionId into one display card; standalone
  // entries (cardio/sport, or legacy pre-session-builder strength logs)
  // render individually exactly as before.
  const groupItems = (list) => {
    const seen = new Set();
    const items = [];
    for (const w of list) {
      if (w.sessionId) {
        if (seen.has(w.sessionId)) continue;
        seen.add(w.sessionId);
        const group = list.filter((x) => x.sessionId === w.sessionId);
        items.push({ kind: 'session', sessionId: w.sessionId, date: w.date, sessionType: w.sessionType, exercises: group, createdAt: w.createdAt });
      } else {
        items.push({ kind: 'single', w, createdAt: w.createdAt });
      }
    }
    return items.sort((a, b) => b.createdAt - a.createdAt);
  };

  const todayItems = groupItems(workouts.filter((w) => w.date === today));
  const historyItems = groupItems([...workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60)).slice(0, 20);

  const strengthExercises = useMemo(
    () => [...new Set(workouts.filter((w) => w.type === 'strength' && w.exercise).map((w) => w.exercise))],
    [workouts]
  );
  const progressData = useMemo(() => {
    if (!progressExercise) return [];
    return workouts
      .filter((w) => w.type === 'strength' && w.exercise === progressExercise)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((w) => ({
        date: w.date.slice(5),
        maxWeight: dispW(Math.max(0, ...(w.sets || []).map((s) => Number(s.weight) || 0))),
        volume: (w.sets || []).reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0),
      }));
  }, [workouts, progressExercise, weightUnit]);

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
      {curatedProgram && <CuratedSessionLogger />}

      {hasCuratedToday && !editing && (
        <button
          type="button"
          onClick={() => setFreeMode((v) => !v)}
          className="text-xs text-mute hover:text-ink underline cursor-pointer"
        >
          {freeMode ? 'Masquer le formulaire libre' : "Autre chose à logger en plus du programme ? Mode libre"}
        </button>
      )}

      {plannedDay && category === 'gym' && !editing && showManualForm && (
        <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <ClipboardList size={16} className="text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium">Séance planifiée : {plannedDay.label}.</span>{' '}
            <span className="text-mute">{plannedDay.exercises.map((e) => e.name).join(', ')}</span>
          </div>
        </div>
      )}

      {showManualForm && (
      <div ref={formCardRef} style={{ scrollMarginTop: '5rem' }}>
      <Card
        title={editing ? 'Edit Workout' : 'Log a Workout'}
        action={<Button variant="secondary" onClick={() => setScheduleModal(true)}><span className="flex items-center gap-2"><CalendarPlus size={14} /> Schedule a session</span></Button>}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[{ value: 'cardio', label: 'Cardio' }, { value: 'gym', label: 'Gym' }, { value: 'sport', label: 'Sport' }].map((c) => {
              const Icon = CATEGORY_ICON[c.value];
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-sm cursor-pointer transition-colors ${
                    category === c.value ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
                  }`}
                >
                  <Icon size={14} /> {c.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {category === 'cardio' && (
              <Field label="Cardio type">
                <Select value={cardioSubtype} onChange={(e) => setCardioSubtype(e.target.value)} options={CARDIO_TYPES} />
              </Field>
            )}
            {category === 'sport' && (
              <Field label="Sport">
                <Select value={sportSubtype} onChange={(e) => setSportSubtype(e.target.value)} options={SPORT_TYPES} />
              </Field>
            )}
            {category === 'gym' && (
              <Field label="Session type">
                <Select value={sessionType} onChange={(e) => setSessionType(e.target.value)} options={GYM_SESSION_TYPES} />
              </Field>
            )}
            <Field label="Date" hint="Backdate a missed session">
              <Input type="date" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} />
            </Field>
          </div>

          {(category === 'cardio' || category === 'sport') && (
            <Field label="Duration (min)">
              <Input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
            </Field>
          )}

          {category === 'gym' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs text-mute uppercase tracking-wide">Also train a small muscle today? (optional)</div>
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
                <div className="text-xs text-mute uppercase tracking-wide">Add an exercise</div>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
                  <Input
                    className="!pl-8"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder={sessionMuscleGroups.length ? `Search exercises (suggesting ${sessionMuscleGroups.join(', ')})…` : 'Search exercises…'}
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
                  <Input value={customExercise} onChange={(e) => setCustomExercise(e.target.value)} placeholder="Not in the list? Type a custom exercise" />
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
                          <Input type="number" placeholder={`Weight (${weightUnit})`} value={s.weight} onChange={(e) => updateSetInExercise(exIdx, setIdx, { weight: e.target.value })} />
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
                        <span className="flex items-center gap-1.5"><Plus size={12} /> Add set</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-mute text-sm py-4 border border-dashed border-line rounded-lg">
                  Search or type an exercise above to start building this session.
                </div>
              )}
            </div>
          )}

          <Field label={`Session quality: ${quality}/10`}>
            <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            {editing && (
              <Button type="button" variant="secondary" className="flex-1" onClick={cancelEdit}>
                Cancel edit
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={category === 'gym' && !sessionExercises.length}>
              {editing ? 'Save changes' : category === 'gym' ? 'Finish session' : 'Log workout'}
            </Button>
          </div>
        </form>
      </Card>
      </div>
      )}

      <Card title="Today" action={<Badge>{todayItems.length} logged</Badge>}>
        {todayItems.length ? (
          <ul className="space-y-2">
            {todayItems.map((item) =>
              item.kind === 'session' ? (
                <SessionRow key={item.sessionId} item={item} onDelete={() => deleteSession(item.sessionId)} onEdit={() => startEditSession(item)} />
              ) : (
                <WorkoutRow key={item.w.id} w={item.w} onDelete={() => deleteWorkout(item.w.id)} onEdit={item.w.type !== 'strength' ? () => startEditWorkout(item.w) : undefined} />
              )
            )}
          </ul>
        ) : (
          <EmptyState>Nothing logged today yet.</EmptyState>
        )}
      </Card>

      {prs.length > 0 && (
        <Card title="Personal Records">
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
        <Card title="Estimated 1RM" action={<span className="text-[10px] text-mute">Epley formula</span>}>
          <ul className="space-y-1.5">
            {oneRMs.map((rm) => (
              <li key={rm.exercise} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                <span className="flex-1">{rm.exercise}</span>
                <span className="font-semibold">{dispW(rm.oneRM)}{weightUnit}</span>
                <span className="text-mute text-xs">from {dispW(rm.weight)}{weightUnit} × {rm.reps} on {rm.date}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {strengthExercises.length > 0 && (
        <Card title="Strength Progression">
          <Field label="Exercise">
            <Select value={progressExercise} onChange={(e) => setProgressExercise(e.target.value)} options={['', ...strengthExercises]} />
          </Field>
          {progressData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220} className="mt-3">
              <LineChart data={[...progressData, ...projectionData]}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="maxWeight" name={`Max weight (${weightUnit})`} stroke="#00d9ff" strokeWidth={2} dot connectNulls />
                {projectionData.length > 0 && (
                  <Line type="monotone" dataKey="projected" name="Projection (1RM estimé)" stroke="#7c5cff" strokeWidth={2} strokeDasharray="5 4" dot connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-mute text-sm py-6">{progressExercise ? 'Log a few more sessions to see a trend.' : 'Pick an exercise to see its progression.'}</div>
          )}
        </Card>
      )}

      {library.length > 0 && (
        <Card title="Exercise Library" action={<Library size={16} className="text-mute" />}>
          <ul className="space-y-1.5">
            {library.map((ex) => (
              <li
                key={ex.exercise}
                onClick={() => ex.type === 'strength' && setProgressExercise(ex.exercise)}
                className={`flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2 text-sm ${ex.type === 'strength' ? 'cursor-pointer hover:border-accent' : ''}`}
              >
                {ex.type === 'strength' ? <Dumbbell size={14} className="text-accent shrink-0" /> : ex.type === 'sport' ? <Activity size={14} className="text-accent shrink-0" /> : <HeartPulse size={14} className="text-accent shrink-0" />}
                <span className="flex-1">{ex.exercise}</span>
                <span className="text-mute text-xs">{ex.sessions} session{ex.sessions !== 1 ? 's' : ''}</span>
                {ex.type === 'strength' ? (
                  <span className="text-xs">best {dispW(ex.bestWeightKg)}{weightUnit}</span>
                ) : (
                  <span className="text-xs">{ex.totalMinutes}min total</span>
                )}
                <span className="text-mute text-xs">last {ex.lastDate}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {volumeSeries.some((w) => w.volume > 0) && (
        <Card title="Weekly Training Volume (Periodization)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeSeries}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="volume" name="kg lifted" fill="#7c5cff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="History">
        {historyItems.length ? (
          <ul className="space-y-2">
            {historyItems.map((item) =>
              item.kind === 'session' ? (
                <SessionRow key={item.sessionId} item={item} onDelete={() => deleteSession(item.sessionId)} onEdit={() => startEditSession(item)} showDate />
              ) : (
                <WorkoutRow key={item.w.id} w={item.w} onDelete={() => deleteWorkout(item.w.id)} onEdit={item.w.type !== 'strength' ? () => startEditWorkout(item.w) : undefined} showDate />
              )
            )}
          </ul>
        ) : (
          <EmptyState>No workouts logged yet.</EmptyState>
        )}
      </Card>

      <ScheduleEventModal
        open={scheduleModal}
        onClose={() => setScheduleModal(false)}
        title="Schedule a workout"
        defaultSummary="Workout"
        onScheduled={() => {}}
      />
    </div>
  );
}

function WorkoutRow({ w, onDelete, onEdit, showDate }) {
  const totalVolume = w.sets?.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0) || 0;
  const Icon = w.type === 'cardio' ? HeartPulse : w.type === 'sport' ? Activity : Dumbbell;
  return (
    <li className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-2.5">
      <Icon size={16} className="text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{w.exercise || w.type}</div>
        <div className="text-[11px] text-mute">
          {showDate ? `${w.date} · ` : ''}
          {w.type === 'strength' ? `${w.sets?.length || 0} sets · ${totalVolume}kg vol` : `${w.durationMin}min`}
          {w.avgRpe ? ` · RPE ${w.avgRpe}` : ''}
          {w.quality ? ` · quality ${w.quality}/10` : ''}
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
    </li>
  );
}

function SessionRow({ item, onDelete, onEdit, showDate }) {
  const totalVolume = item.exercises.reduce((a, w) => a + (w.sets || []).reduce((s, set) => s + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0), 0);
  const totalSets = item.exercises.reduce((a, w) => a + (w.sets?.length || 0), 0);
  const label = labelFor(GYM_SESSION_TYPES, item.sessionType) || 'Gym session';
  return (
    <li className="bg-surface border border-line rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Dumbbell size={16} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm">{label}</div>
          <div className="text-[11px] text-mute">
            {showDate ? `${item.date} · ` : ''}
            {item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''} · {totalSets} sets · {totalVolume}kg vol
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
          <div key={ex.id}>{ex.exercise} — {ex.sets?.length || 0} sets</div>
        ))}
      </div>
    </li>
  );
}
