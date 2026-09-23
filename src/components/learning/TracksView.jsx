import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Plus, Play, Target, CalendarClock, Brain, ArrowUpRight, Trophy, Clock } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useFocusStore } from '../../store/focusStore';
import { useFlashcardStore, buildQueue } from '../../store/flashcardStore';
import { isAcademic, daysUntil } from '../../utils/academic';
import { calculateCourseProgress } from '../../utils/course-progress';
import { minutesByCourse, weekStart, fmtMinutes, nextTaskOf } from '../../utils/study';
import { trackMeta, levelsFor, levelLabel } from '../../utils/tracks';
import { todayKey } from '../../utils/formatters';
import { Button, Card, ProgressBar } from '../common/ui';
import { SectionHeader, tint, countdownLabel } from './design';
import { TrackFormModal } from './TrackModals';

/** Level ladder (A1 → C2 or Découverte → Expert) with current / target. */
export function LevelLadder({ course, compact = false }) {
  const levels = levelsFor(course.trackType);
  const cur = levels.findIndex((l) => l.value === course.level);
  const tgt = levels.findIndex((l) => l.value === course.targetLevel);
  const color = trackMeta(course.trackType).color;
  return (
    <div className="flex items-center gap-1">
      {levels.map((l, i) => {
        const reached = i <= cur;
        const isTarget = i === tgt;
        return (
          <div key={l.value} className="flex-1 min-w-0" title={l.label}>
            <div className="h-1.5 rounded-full" style={{ background: reached ? color : isTarget ? tint(color, 35) : 'var(--border)' }} />
            {!compact && (
              <div className={`text-[10px] mt-1 text-center truncate ${i === cur ? 'font-bold' : ''}`} style={{ color: i === cur ? color : isTarget ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {course.trackType === 'language' ? l.value : l.short}{isTarget ? ' 🎯' : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Course-page card for a track: level, next level, goal, deadline, weekly time. */
export function TrackLevelCard({ course }) {
  const setTrackLevel = useLearningStore((s) => s.setTrackLevel);
  const sessions = useFocusStore((s) => s.sessions);
  const levels = levelsFor(course.trackType);
  const cur = levels.findIndex((l) => l.value === course.level);
  const next = levels[cur + 1];
  const meta = trackMeta(course.trackType);
  const today = todayKey();
  const weekMin = minutesByCourse(sessions, weekStart(today), today)[course.id] || 0;
  const targetMin = (Number(course.weeklyHours) || 0) * 60;
  const days = course.targetDate ? daysUntil(course.targetDate, today) : null;
  const reachedTarget = course.targetLevel && cur >= levels.findIndex((l) => l.value === course.targetLevel);
  return (
    <Card>
      <SectionHeader icon={meta.icon} title={`Niveau · ${course.language || meta.label}`}
        subtitle={course.level === 'A0' ? 'Débutant complet' : `${levelLabel(course.trackType, course.level)} → objectif ${levelLabel(course.trackType, course.targetLevel)}`} />
      <LevelLadder course={course} />
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {reachedTarget ? (
          <span className="text-sm text-good flex items-center gap-1.5"><Trophy size={15} /> Niveau visé atteint !</span>
        ) : next ? (
          <Button variant="secondary" className="!py-1.5" onClick={() => setTrackLevel(course.id, next.value)}>
            <span className="flex items-center gap-1.5"><ArrowUpRight size={14} /> J'ai atteint {course.trackType === 'language' ? next.value : next.short}</span>
          </Button>
        ) : null}
        {course.levelHistory?.length > 1 && (
          <span className="text-[11px] text-mute">
            {course.levelHistory.slice(-3).map((h) => `${h.level} (${new Date(h.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })})`).join(' → ')}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-line text-sm">
        <div>
          <div className="text-[11px] text-mute flex items-center gap-1"><Clock size={11} /> Cette semaine</div>
          <div className="font-semibold text-ink tabular-nums">{fmtMinutes(weekMin)}{targetMin ? <span className="text-mute font-normal"> / {course.weeklyHours} h</span> : ''}</div>
          {targetMin > 0 && <div className="mt-1"><ProgressBar value={Math.min(100, (weekMin / targetMin) * 100)} height={4} color={meta.color} /></div>}
        </div>
        <div>
          <div className="text-[11px] text-mute flex items-center gap-1"><CalendarClock size={11} /> Échéance</div>
          <div className="font-semibold tabular-nums" style={{ color: days != null && days < 14 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {days == null ? '—' : days < 0 ? 'dépassée' : countdownLabel(days)}
          </div>
        </div>
      </div>
      {course.goal && <p className="text-xs text-mute mt-3 flex items-start gap-1.5"><Target size={12} className="mt-0.5 shrink-0" style={{ color: meta.color }} /> {course.goal}</p>}
    </Card>
  );
}

function TrackCard({ c, weekMin, due, onStart, running }) {
  const meta = trackMeta(c.trackType);
  const Icon = meta.icon;
  const progress = calculateCourseProgress(c);
  const next = nextTaskOf(c);
  const today = todayKey();
  const days = c.targetDate ? daysUntil(c.targetDate, today) : null;
  const targetMin = (Number(c.weeklyHours) || 0) * 60;
  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden flex flex-col">
      <div className="p-4 flex items-start gap-3" style={{ background: `linear-gradient(135deg, ${tint(meta.color, 14)}, transparent 70%)` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint(meta.color, 20) }}><Icon size={19} style={{ color: meta.color }} /></div>
        <div className="min-w-0 flex-1">
          <Link to={`/learning/course/${c.id}`} className="font-semibold text-ink hover:text-accent leading-snug block truncate">{c.name}</Link>
          <div className="text-[11px] text-mute mt-0.5 truncate">
            {meta.label}{c.language ? ` · ${c.language}` : ''}{c.level ? ` · ${c.level === 'A0' ? 'débutant' : levelLabel(c.trackType, c.level)}` : ''}
          </div>
        </div>
        {days != null && days >= 0 && <span className="text-[10px] rounded-md px-1.5 py-0.5 font-semibold whitespace-nowrap" style={{ background: tint(days < 14 ? 'var(--warning)' : meta.color, 15), color: days < 14 ? 'var(--warning)' : meta.color }}>{countdownLabel(days)}</span>}
      </div>
      <div className="px-4 pb-4 space-y-3 flex-1 flex flex-col">
        {c.level && c.trackType && <LevelLadder course={c} compact />}
        {c.goal && <p className="text-xs text-mute line-clamp-2">🎯 {c.goal}</p>}
        <div>
          <div className="flex justify-between text-[11px] text-mute mb-1"><span>Feuille de route</span><span className="text-ink tabular-nums">{progress}%</span></div>
          <ProgressBar value={progress} height={5} color={meta.color} />
          {next && <div className="text-[11px] text-mute mt-1 truncate">Ensuite : <span className="text-ink">{next.item.title}</span></div>}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-mute">
          <span className="flex items-center gap-1"><Clock size={11} /> {fmtMinutes(weekMin)}{targetMin ? ` / ${c.weeklyHours} h` : ''} cette sem.</span>
          {due > 0 && <span className="flex items-center gap-1" style={{ color: 'var(--accent-secondary)' }}><Brain size={11} /> {due} fiche(s)</span>}
        </div>
        <div className="flex gap-2 mt-auto pt-1">
          <Link to={`/learning/course/${c.id}`} className="flex-1"><Button variant="secondary" className="w-full !py-1.5 text-xs">Ouvrir</Button></Link>
          <Button className="flex-1 !py-1.5 text-xs" disabled={running} onClick={() => onStart(c.id)}><span className="flex items-center justify-center gap-1"><Play size={12} /> Étudier</span></Button>
        </div>
      </div>
    </div>
  );
}

export default function TracksView() {
  const courses = useLearningStore((s) => s.courses);
  const sessions = useFocusStore((s) => s.sessions);
  const activeTimer = useFocusStore((s) => s.activeTimer);
  const startTimer = useFocusStore((s) => s.startTimer);
  const fc = useFlashcardStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const today = todayKey();

  const tracks = courses.filter((c) => !isAcademic(c) && c.status === 'active');
  const finished = courses.filter((c) => !isAcademic(c) && c.status === 'completed');
  const weekMins = useMemo(() => minutesByCourse(sessions, weekStart(today), today), [sessions, today]);
  const dueFor = (courseId) => {
    const deckIds = fc.decks.filter((d) => d.courseId === courseId).map((d) => d.id);
    return deckIds.length ? buildQueue({ cards: fc.cards, decks: fc.decks, deckIds, reviewLog: fc.reviewLog, settings: fc.settings }).length : 0;
  };
  const totalWeek = tracks.reduce((s, c) => s + (weekMins[c.id] || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <SectionHeader icon={Compass} title="Parcours libres"
          subtitle={`Langues, trading, compétences, tout sujet · ${tracks.length} en cours · ${fmtMinutes(totalWeek)} cette semaine`} />
        <Button onClick={() => setOpen(true)}><span className="flex items-center gap-1.5"><Plus size={15} /> Nouveau parcours</span></Button>
      </div>

      {tracks.length ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tracks.map((c) => (
            <TrackCard key={c.id} c={c} weekMin={weekMins[c.id] || 0} due={dueFor(c.id)} running={!!activeTimer}
              onStart={(id) => startTimer({ domain: 'Learning', courseId: id, targetMin: 50 })} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8 max-w-lg mx-auto">
            <Compass size={28} className="mx-auto text-mute mb-2" />
            <p className="text-sm font-medium text-ink">Apprenez tout ce qui vous tient à cœur, avec méthode</p>
            <p className="text-xs text-mute mt-1">Une langue du niveau A1 au C2, le trading, Excel, la prise de parole… Chaque parcours a une feuille de route, des ressources, des fiches et un temps hebdomadaire visé.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>Créer mon premier parcours</Button>
          </div>
        </Card>
      )}

      {finished.length > 0 && (
        <p className="text-xs text-mute">{finished.length} parcours terminé(s) · visibles dans <Link className="underline hover:text-ink" to="/learning?tab=courses">Tous les cours › Archives</Link></p>
      )}

      <TrackFormModal open={open} onClose={() => setOpen(false)} onCreated={(id) => navigate(`/learning/course/${id}`)} />
    </div>
  );
}
