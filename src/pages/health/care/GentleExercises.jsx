import { useEffect, useRef, useState } from 'react';
import { Footprints, Scale, Sun, Armchair, Moon, Wind, Play, Pause, SkipForward, ChevronLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';
import { GENTLE_ROUTINES, GENTLE_SAFETY, routineMinutes } from '../../../utils/gentle-routines';
import { todayKey, fmtDate } from '../../../utils/formatters';
import { Card, Button, Badge } from '../../../components/common/ui';

const ICONS = { footprints: Footprints, scale: Scale, sun: Sun, armchair: Armchair, moon: Moon, wind: Wind };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// The guided session: one step at a time, big text, a timer that moves on by itself.
function Player({ routine, onExit }) {
  const logWorkout = useHealthStore((s) => s.logWorkout);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(routine.steps[0].seconds);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());
  const step = routine.steps[i];

  const go = (k) => {
    if (k >= routine.steps.length) { setDone(true); setRunning(false); return; }
    setI(k); setLeft(routine.steps[k].seconds);
  };

  useEffect(() => {
    if (!running || done) return undefined;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running, done]);
  useEffect(() => {
    if (left > 0 || done) return;
    try { navigator.vibrate?.(200); } catch { /* not supported */ }
    go(i + 1);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    logWorkout({ date: todayKey(), type: 'sport', category: 'sport', sessionType: 'gentle', exercise: routine.name, durationMin: Math.min(minutes, routineMinutes(routine) + 5), quality: 7, notes: '' });
    onExit();
  };

  if (done) {
    return (
      <Card>
        <div className="text-center py-6 space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-good" />
          <h2 className="text-2xl font-bold">Séance terminée, bravo !</h2>
          <p className="text-mute">{routine.name} · environ {routineMinutes(routine)} min</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={onExit}>Ne pas enregistrer</Button>
            <Button onClick={finish}>Enregistrer la séance</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={routine.name} action={<Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={onExit}><span className="flex items-center gap-1"><ChevronLeft size={14} /> Quitter</span></Button>}>
      <div className="text-center space-y-4 py-2" aria-live="polite">
        <div className="text-xs text-mute">Étape {i + 1} sur {routine.steps.length}</div>
        <h2 className="text-2xl font-bold">{step.name}</h2>
        <p className="text-[1.15rem] leading-relaxed max-w-xl mx-auto">{step.how}</p>
        <div className="font-data text-5xl font-bold tabular-nums" aria-label={`${left} secondes restantes`}>{mmss(Math.max(0, left))}</div>
        <div className="h-2 rounded-full bg-line overflow-hidden max-w-md mx-auto"><div className="h-full bg-accent transition-all" style={{ width: `${100 - (left / step.seconds) * 100}%` }} /></div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {i > 0 && <Button variant="secondary" onClick={() => go(i - 1)}><span className="flex items-center gap-1"><ChevronLeft size={16} /> Précédent</span></Button>}
          <Button variant="secondary" onClick={() => setRunning((r) => !r)}><span className="flex items-center gap-1">{running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Reprendre</>}</span></Button>
          <Button onClick={() => go(i + 1)}><span className="flex items-center gap-1"><SkipForward size={16} /> Suivant</span></Button>
        </div>
      </div>
    </Card>
  );
}

export default function GentleExercises() {
  const workouts = useHealthStore((s) => s.workouts);
  const [playing, setPlaying] = useState(null);
  const recent = workouts.filter((w) => w.sessionType === 'gentle').sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  if (playing) return <Player routine={playing} onExit={() => setPlaying(null)} />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex gap-2"><ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" /> {GENTLE_SAFETY}</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {GENTLE_ROUTINES.map((r) => {
          const Icon = ICONS[r.icon] || Footprints;
          return (
            <div key={r.id} className="rounded-xl border border-line bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2"><Icon size={18} className="text-accent" /><span className="font-semibold">{r.name}</span><span className="ml-auto"><Badge color="var(--text-secondary)">{routineMinutes(r)} min</Badge></span></div>
              <p className="text-sm text-mute flex-1">{r.desc}</p>
              <div className="text-xs text-mute">{r.steps.length} étapes · {r.level}</div>
              <Button onClick={() => setPlaying(r)}><span className="flex items-center justify-center gap-1.5"><Play size={15} /> Commencer</span></Button>
            </div>
          );
        })}
      </div>
      {recent.length > 0 && (
        <Card title="Dernières séances douces">
          <ul className="text-sm space-y-1">{recent.map((w) => <li key={w.id} className="flex justify-between"><span>{w.exercise}</span><span className="text-mute">{fmtDate(w.date)} · {w.durationMin} min</span></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
