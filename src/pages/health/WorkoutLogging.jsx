import { useState, useMemo } from 'react';
import { Plus, Trash2, Dumbbell, HeartPulse, Trophy } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, EmptyState, Badge } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const blankSet = () => ({ reps: '', weight: '', rpe: 7, form: 'Good' });

export default function WorkoutLogging({ pendingPrompt }) {
  const { workouts, logWorkout, deleteWorkout, getPRs, getWorkoutVolumeSeries } = useHealthStore();
  const [type, setType] = useState(pendingPrompt?.type === 'cardio' ? 'cardio' : 'strength');
  const [exercise, setExercise] = useState(pendingPrompt?.habitName || '');
  const [durationMin, setDurationMin] = useState(pendingPrompt?.duration || 30);
  const [sets, setSets] = useState([blankSet()]);
  const [quality, setQuality] = useState(7);
  const [notes, setNotes] = useState('');
  const [progressExercise, setProgressExercise] = useState('');

  const addSet = () => setSets((s) => [...s, blankSet()]);
  const updateSet = (i, patch) => setSets((s) => s.map((set, idx) => (idx === i ? { ...set, ...patch } : set)));
  const removeSet = (i) => setSets((s) => s.filter((_, idx) => idx !== i));

  const submit = (e) => {
    e.preventDefault();
    logWorkout(
      {
        type,
        exercise,
        durationMin: type === 'cardio' ? durationMin : undefined,
        sets: type === 'strength' ? sets.filter((s) => s.reps || s.weight) : [],
        quality,
        notes,
      },
      pendingPrompt?.id
    );
    setExercise('');
    setSets([blankSet()]);
    setQuality(7);
    setNotes('');
  };

  const today = todayKey();
  const todayWorkouts = workouts.filter((w) => w.date === today);
  const history = [...workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  const prs = getPRs();
  const volumeSeries = getWorkoutVolumeSeries();

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
        maxWeight: Math.max(0, ...(w.sets || []).map((s) => Number(s.weight) || 0)),
        volume: (w.sets || []).reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0),
      }));
  }, [workouts, progressExercise]);

  return (
    <div className="space-y-6">
      <Card title="Log a Workout">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'cardio', label: 'Cardio' }, { value: 'strength', label: 'Strength' }]} />
            </Field>
            <Field label="Exercise">
              <Input value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder={type === 'cardio' ? 'e.g. Zone-2 run' : 'e.g. Deadlift'} required />
            </Field>
          </div>

          {type === 'cardio' ? (
            <Field label="Duration (min)">
              <Input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
            </Field>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-mute uppercase tracking-wide">Sets</div>
              {sets.map((s, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-center">
                  <Input type="number" placeholder="Reps" value={s.reps} onChange={(e) => updateSet(i, { reps: e.target.value })} />
                  <Input type="number" placeholder="Weight (kg)" value={s.weight} onChange={(e) => updateSet(i, { weight: e.target.value })} />
                  <div>
                    <input type="range" min="1" max="10" value={s.rpe} onChange={(e) => updateSet(i, { rpe: Number(e.target.value) })} className="w-full" />
                    <div className="text-[10px] text-mute text-center">RPE {s.rpe}</div>
                  </div>
                  <Select value={s.form} onChange={(e) => updateSet(i, { form: e.target.value })} options={['Good', 'Fair', 'Poor']} />
                  <button type="button" onClick={() => removeSet(i)} className="text-mute hover:text-bad cursor-pointer justify-self-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addSet}>
                <span className="flex items-center gap-2"><Plus size={14} /> Add set</span>
              </Button>
            </div>
          )}

          <Field label={`Session quality: ${quality}/10`}>
            <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">Log workout</Button>
        </form>
      </Card>

      <Card title="Today" action={<Badge>{todayWorkouts.length} logged</Badge>}>
        {todayWorkouts.length ? (
          <ul className="space-y-2">
            {todayWorkouts.map((w) => (
              <WorkoutRow key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} />
            ))}
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
                <span className="font-semibold">{pr.weight}kg × {pr.reps}</span>
                <span className="text-mute text-xs">{pr.date}</span>
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
              <LineChart data={progressData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="maxWeight" name="Max weight (kg)" stroke="#00d9ff" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-mute text-sm py-6">{progressExercise ? 'Log a few more sessions to see a trend.' : 'Pick an exercise to see its progression.'}</div>
          )}
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
        {history.length ? (
          <ul className="space-y-2">
            {history.map((w) => (
              <WorkoutRow key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} showDate />
            ))}
          </ul>
        ) : (
          <EmptyState>No workouts logged yet.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function WorkoutRow({ w, onDelete, showDate }) {
  const totalVolume = w.sets?.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0) || 0;
  return (
    <li className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-2.5">
      {w.type === 'cardio' ? <HeartPulse size={16} className="text-accent shrink-0" /> : <Dumbbell size={16} className="text-accent shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm">{w.exercise || w.type}</div>
        <div className="text-[11px] text-mute">
          {showDate ? `${w.date} · ` : ''}
          {w.type === 'cardio' ? `${w.durationMin}min` : `${w.sets?.length || 0} sets · ${totalVolume}kg vol`}
          {w.avgRpe ? ` · RPE ${w.avgRpe}` : ''}
          {w.quality ? ` · quality ${w.quality}/10` : ''}
        </div>
      </div>
      <button onClick={onDelete} className="text-mute hover:text-bad cursor-pointer shrink-0">
        <Trash2 size={14} />
      </button>
    </li>
  );
}
