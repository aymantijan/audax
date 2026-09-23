import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, Pause, Square, Timer, Plus } from 'lucide-react';
import { useFocusStore } from '../../store/focusStore';
import { useLearningStore } from '../../store/learningStore';
import { isAcademic } from '../../utils/academic';
import { todayKey } from '../../utils/formatters';
import { FOCUS_DOMAINS } from '../../utils/constants';
import { Button, Field, Input, Modal, Select } from '../common/ui';
import { tint, useAcademicSettings } from './design';
import { courseColor } from './TimetableView';

export const TIMER_MODES = [
  { key: 'free', label: 'Libre', targetMin: null },
  { key: 'p25', label: 'Pomodoro 25 min', targetMin: 25 },
  { key: 'p50', label: 'Session 50 min', targetMin: 50 },
  { key: 'p90', label: 'Deep work 90 min', targetMin: 90 },
];

export function timerElapsedMs(t, now = Date.now()) {
  if (!t) return 0;
  return t.accumulatedMs + (t.pausedAt ? 0 : now - t.startedAt);
}

// Re-renders every second while a timer is running.
export function useTimerElapsed() {
  const t = useFocusStore((s) => s.activeTimer);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!t || t.pausedAt) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t]);
  return { timer: t, ms: timerElapsedMs(t) };
}

export function fmtClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Soft chime when a Pomodoro target is reached (no asset, WebAudio).
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach((delay, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = i ? 880 : 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.6);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.65);
    });
  } catch { /* audio unavailable */ }
}

function useTargetChime(timer, ms) {
  const fired = useRef(null);
  useEffect(() => {
    if (!timer?.targetMin) return;
    const key = `${timer.startedAt}-${timer.targetMin}`;
    if (ms >= timer.targetMin * 60000 && ms < timer.targetMin * 60000 + 15000 && fired.current !== key) {
      fired.current = key;
      chime();
    }
  }, [timer, ms]);
}

// French labels for the focus domains (keys stay as stored).
export const DOMAIN_LABELS = {
  Trading: 'Trading', PE: 'Private equity', Engineering: 'Ingénierie', Business: 'Business', Learning: 'Apprentissage',
  Health: 'Santé', Networking: 'Réseau', Career: 'Carrière', Content: 'Contenu', Projects: 'Projets', Creative: 'Création', General: 'Général',
};
export const domainLabel = (d) => DOMAIN_LABELS[d] || d;

export function useCourseLabel(courseId, domain = 'Learning') {
  const course = useLearningStore((s) => s.courses.find((c) => c.id === courseId));
  if (course) return course.name;
  if (courseId) return 'Cours supprimé';
  return domain === 'Learning' ? 'Étude libre' : domainLabel(domain);
}

function Ring({ pct, color, size = 132, children }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} style={{ transition: 'stroke-dashoffset .8s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// Grouped <option>s: current-semester subjects, then free courses.
export function CourseOptions({ courses, settings }) {
  const active = courses.filter((c) => c.status === 'active');
  const acad = active.filter((c) => isAcademic(c) && (!settings.activeTermId || !c.termId || c.termId === settings.activeTermId));
  const free = active.filter((c) => !isAcademic(c));
  return (
    <>
      <option value="">Étude libre (sans matière)</option>
      {acad.length > 0 && <optgroup label="Cursus">{acad.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
      {free.length > 0 && <optgroup label="Cours libres">{free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
    </>
  );
}

/** Big timer card for the Aujourd'hui view. */
export function StudyTimerCard({ preselect, allDomains = false }) {
  const courses = useLearningStore((s) => s.courses);
  const settings = useAcademicSettings();
  const { startTimer, pauseTimer, resumeTimer, stopTimer, cancelTimer } = useFocusStore();
  const { timer, ms } = useTimerElapsed();
  const [courseId, setCourseId] = useState('');
  const [mode, setMode] = useState('p50');
  const [domain, setDomain] = useState('Learning');
  const label = useCourseLabel(timer?.courseId, timer?.domain);
  useTargetChime(timer, ms);
  useEffect(() => { if (preselect) setCourseId(preselect); }, [preselect]);

  const color = timer?.courseId ? courseColor(timer.courseId) : 'var(--accent-primary)';
  const target = timer?.targetMin ? timer.targetMin * 60000 : null;
  const pct = target ? ms / target : (ms % 3600000) / 3600000;
  const reached = target && ms >= target;

  if (!timer) {
    return (
      <div className="rounded-2xl border border-line p-5 h-full" style={{ background: `linear-gradient(135deg, ${tint('var(--accent-primary)', 10)}, var(--bg-tertiary) 60%)` }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Timer size={16} className="text-accent" /> {allDomains ? 'Session de concentration' : "Session d'étude"}</div>
        <div className="flex flex-col sm:flex-row gap-5 mt-4 items-center">
          <Ring pct={0} color="var(--accent-primary)">
            <div className="text-2xl font-bold tabular-nums text-ink">00:00</div>
            <div className="text-[10px] text-mute">prêt</div>
          </Ring>
          <div className="flex-1 w-full space-y-3">
            {allDomains && (
              <Field label="Domaine">
                <Select value={domain} onChange={(e) => setDomain(e.target.value)} options={FOCUS_DOMAINS.map((d) => ({ value: d, label: domainLabel(d) }))} />
              </Field>
            )}
            {(!allDomains || domain === 'Learning') && (
              <Field label="Matière / cours">
                <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <CourseOptions courses={courses} settings={settings} />
                </Select>
              </Field>
            )}
            <div className="flex flex-wrap gap-1.5">
              {TIMER_MODES.map((m) => (
                <button key={m.key} type="button" onClick={() => setMode(m.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs border cursor-pointer transition-colors ${mode === m.key ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => {
              const d = allDomains ? domain : 'Learning';
              startTimer({ domain: d, courseId: d === 'Learning' ? courseId || null : null, targetMin: TIMER_MODES.find((m) => m.key === mode)?.targetMin });
            }}>
              <span className="flex items-center justify-center gap-2"><Play size={15} /> Démarrer</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 h-full" style={{ borderColor: tint(color, 45), background: `linear-gradient(135deg, ${tint(color, 16)}, var(--bg-tertiary) 65%)` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${timer.pausedAt ? '' : 'animate-pulse'}`} style={{ background: color }} />
          <span className="truncate">{label}</span>
        </div>
        <span className="text-[11px] text-mute shrink-0">{timer.pausedAt ? 'En pause' : 'En cours'}</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-5 mt-4 items-center">
        <Ring pct={pct} color={reached ? 'var(--success)' : color}>
          <div className="text-2xl font-bold tabular-nums text-ink">{fmtClock(ms)}</div>
          <div className="text-[10px] text-mute">{target ? (reached ? 'objectif atteint ✓' : `sur ${timer.targetMin} min`) : 'chrono libre'}</div>
        </Ring>
        <div className="flex-1 w-full space-y-2">
          {reached && <div className="text-xs rounded-lg px-3 py-2" style={{ background: tint('var(--success)', 12), color: 'var(--success)' }}>Bravo ! Faites une pause de 5–10 min, ou continuez sur votre lancée.</div>}
          <div className="grid grid-cols-2 gap-2">
            {timer.pausedAt
              ? <Button variant="secondary" onClick={resumeTimer}><span className="flex items-center justify-center gap-1.5"><Play size={14} /> Reprendre</span></Button>
              : <Button variant="secondary" onClick={pauseTimer}><span className="flex items-center justify-center gap-1.5"><Pause size={14} /> Pause</span></Button>}
            <Button onClick={() => stopTimer({ courseLabel: label })}><span className="flex items-center justify-center gap-1.5"><Square size={14} /> Terminer</span></Button>
          </div>
          <button onClick={cancelTimer} className="w-full text-[11px] text-mute hover:text-bad cursor-pointer py-1">Annuler sans enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/** Floating pill shown on every page while a study timer runs. */
export function StudyTimerDock() {
  const { timer, ms } = useTimerElapsed();
  const { pauseTimer, resumeTimer, stopTimer } = useFocusStore();
  const label = useCourseLabel(timer?.courseId, timer?.domain);
  const location = useLocation();
  useTargetChime(timer, ms);
  if (!timer) return null;
  // The Aujourd'hui view and the Deep Work page already show the full timer.
  if (location.pathname === '/focus') return null;
  if (location.pathname === '/learning' && !location.search.includes('tab=')) return null;
  const color = timer.courseId ? courseColor(timer.courseId) : 'var(--accent-primary)';
  const reached = timer.targetMin && ms >= timer.targetMin * 60000;
  return (
    <div className="fixed z-40 bottom-20 md:bottom-6 left-4 md:left-6 flex items-center gap-2 rounded-full border bg-card shadow-xl pl-3 pr-1.5 py-1.5 max-w-[calc(100vw-7rem)]"
      style={{ borderColor: tint(color, 50) }}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${timer.pausedAt ? '' : 'animate-pulse'}`} style={{ background: reached ? 'var(--success)' : color }} />
      <Link to={timer.domain === 'Learning' ? '/learning' : '/focus'} className="min-w-0 flex items-baseline gap-2">
        <span className="font-mono font-semibold tabular-nums text-sm text-ink">{fmtClock(ms)}</span>
        <span className="text-xs text-mute truncate max-w-[9rem]">{label}</span>
      </Link>
      <button onClick={timer.pausedAt ? resumeTimer : pauseTimer} className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface cursor-pointer" title={timer.pausedAt ? 'Reprendre' : 'Pause'}>
        {timer.pausedAt ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button onClick={() => stopTimer({ courseLabel: label })} className="p-1.5 rounded-full text-mute hover:text-ink hover:bg-surface cursor-pointer" title="Terminer et enregistrer"><Square size={14} /></button>
    </div>
  );
}

/** Log a session after the fact (forgot the timer, studied in the library…). */
export function ManualSessionModal({ open, onClose, defaultCourseId = '' }) {
  const courses = useLearningStore((s) => s.courses);
  const settings = useAcademicSettings();
  const logSession = useFocusStore((s) => s.logSession);
  const [f, setF] = useState({ courseId: '', minutes: 60, date: todayKey(), notes: '' });
  useEffect(() => { if (open) setF({ courseId: defaultCourseId, minutes: 60, date: todayKey(), notes: '' }); }, [open, defaultCourseId]);
  const label = useMemo(() => courses.find((c) => c.id === f.courseId)?.name, [courses, f.courseId]);
  const submit = (e) => {
    e.preventDefault();
    const res = logSession({ domain: 'Learning', courseId: f.courseId || null, durationMinutes: Number(f.minutes), date: f.date, notes: f.notes, courseLabel: label });
    if (res?.ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Ajouter une session d'étude">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Matière / cours">
          <Select value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><CourseOptions courses={courses} settings={settings} /></Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durée (minutes)"><Input type="number" min="1" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[25, 45, 60, 90, 120].map((m) => (
            <button key={m} type="button" onClick={() => setF({ ...f, minutes: m })} className={`rounded-lg px-2.5 py-1 text-xs border cursor-pointer ${Number(f.minutes) === m ? 'border-accent text-accent' : 'border-line text-mute hover:text-ink'}`}>{m} min</button>
          ))}
        </div>
        <Field label="Note (optionnel)"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Chapitre 2, exercices 1 à 10…" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit"><span className="flex items-center gap-1.5"><Plus size={14} /> Ajouter</span></Button>
        </div>
      </form>
    </Modal>
  );
}


