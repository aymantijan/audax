import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Eye, PartyPopper, RotateCcw } from 'lucide-react';
import { useFlashcardStore, buildQueue } from '../../store/flashcardStore';
import { useLearningStore } from '../../store/learningStore';
import { useFocusStore } from '../../store/focusStore';
import { previewIntervals } from '../../utils/fsrs';
import { Button } from '../common/ui';
import { tint } from './design';

const LEARN_AHEAD = 20 * 60 * 1000; // re-show short learning steps within the session

/**
 * Full-screen review session. `deckIds` null = every deck.
 * Keyboard: Espace/Entrée = afficher la réponse · 1-4 = noter · Échap = quitter.
 */
export default function ReviewSession({ deckIds = null, title = 'Révision', onClose }) {
  const { cards, decks, reviewLog, settings, rateCard } = useFlashcardStore();
  const courses = useLearningStore((s) => s.courses);
  const recordActivity = useLearningStore((s) => s.recordActivity);
  const [queue, setQueue] = useState(() =>
    buildQueue({ cards, decks, deckIds, reviewLog, settings }).map((c) => c.id));
  const [shown, setShown] = useState(false);
  const [stats, setStats] = useState({ done: 0, again: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 } });
  const startedAt = useRef(Date.now());
  const initialCount = useRef(queue.length);
  const activityRecorded = useRef(false);

  const card = useMemo(() => cards.find((c) => c.id === queue[0]) || null, [cards, queue]);
  const deck = card ? decks.find((d) => d.id === card.deckId) : null;
  const course = deck?.courseId ? courses.find((c) => c.id === deck.courseId) : null;
  const chapter = course && card?.chapterId ? course.chapters?.find((ch) => ch.id === card.chapterId) : null;
  const intervals = useMemo(() => (card ? previewIntervals(card, Date.now(), settings.retention) : []), [card, settings.retention, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = useCallback((r) => {
    if (!card || !shown) return;
    const next = rateCard(card.id, r);
    if (!activityRecorded.current) { recordActivity(); activityRecorded.current = true; }
    setStats((s) => ({ done: s.done + 1, again: s.again + (r === 1 ? 1 : 0), counts: { ...s.counts, [r]: s.counts[r] + 1 } }));
    setQueue((q) => {
      const rest = q.slice(1);
      return next && next.due - Date.now() <= LEARN_AHEAD ? [...rest, card.id] : rest;
    });
    setShown(false);
  }, [card, shown, rateCard, recordActivity]);

  const finish = useCallback(() => {
    // Review time counts as study time (unless a study timer is already running).
    const minutes = Math.round((Date.now() - startedAt.current) / 60000);
    const focus = useFocusStore.getState();
    if (stats.done > 0 && minutes >= 1 && !focus.activeTimer) {
      const scopeDecks = deckIds ? decks.filter((d) => deckIds.includes(d.id)) : decks;
      const courseIds = [...new Set(scopeDecks.map((d) => d.courseId).filter(Boolean))];
      focus.logSession({
        domain: 'Learning', courseId: courseIds.length === 1 ? courseIds[0] : null, durationMinutes: minutes,
        notes: `Révision : ${stats.done} fiche(s)`, courseLabel: 'révision',
      });
    }
    onClose();
  }, [stats.done, deckIds, decks, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { finish(); return; }
      if (!card) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setShown(true); return; }
      if (shown && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rate(Number(e.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, shown, rate, finish]);

  const done = !card;
  const progress = initialCount.current ? Math.min(100, Math.round((stats.done / Math.max(initialCount.current, stats.done + queue.length)) * 100)) : 100;
  const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
  const success = stats.done ? Math.round(((stats.done - stats.again) / stats.done) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[80] bg-base/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-3 px-4 sm:px-8 py-3 border-b border-line">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink truncate">{title}</div>
          <div className="text-[11px] text-mute">{done ? 'Terminé' : `${queue.length} fiche(s) restante(s) · ${stats.done} révisée(s)`}</div>
        </div>
        <button onClick={finish} className="p-2 rounded-lg text-mute hover:text-ink hover:bg-surface cursor-pointer" title="Quitter (Échap)"><X size={18} /></button>
      </div>
      <div className="h-1 bg-surface"><div className="h-full transition-all" style={{ width: `${done ? 100 : progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} /></div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-10 flex items-start sm:items-center justify-center">
        {done ? (
          <div className="max-w-md w-full text-center rounded-2xl border border-line bg-card p-8">
            <PartyPopper size={34} className="mx-auto text-accent" />
            <h2 className="text-xl font-bold text-ink mt-3">{stats.done ? 'Session terminée !' : 'Rien à réviser pour le moment'}</h2>
            {stats.done > 0 ? (
              <>
                <p className="text-sm text-mute mt-1">{stats.done} révision(s) en {elapsedMin} min · {success}% de réussite</p>
                <div className="grid grid-cols-4 gap-2 mt-5">
                  {[1, 2, 3, 4].map((r) => {
                    const meta = intervalsMeta[r];
                    return (
                      <div key={r} className="rounded-lg py-2" style={{ background: tint(meta.color, 12) }}>
                        <div className="text-lg font-bold tabular-nums" style={{ color: meta.color }}>{stats.counts[r]}</div>
                        <div className="text-[10px] text-mute">{meta.label}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-mute mt-4">Les fiches reviendront automatiquement au bon moment : juste avant que vous ne les oubliiez.</p>
              </>
            ) : (
              <p className="text-sm text-mute mt-1">Toutes vos fiches sont à jour. Ajoutez-en de nouvelles ou revenez plus tard.</p>
            )}
            <Button className="mt-6 w-full" onClick={finish}>Fermer</Button>
          </div>
        ) : (
          <div className="max-w-2xl w-full">
            <div className="flex items-center gap-2 text-[11px] text-mute mb-2">
              <span className="rounded-full px-2 py-0.5 border border-line">{deck?.name}</span>
              {chapter && <span className="truncate">{chapter.title}</span>}
              <span className="ml-auto">{card.state === 'new' ? 'Nouvelle' : card.state === 'review' ? 'Révision' : 'Apprentissage'}</span>
            </div>
            <div className="rounded-2xl border border-line bg-card shadow-xl overflow-hidden">
              <div className="px-6 sm:px-10 py-10 sm:py-14 text-center text-lg sm:text-2xl font-medium text-ink whitespace-pre-wrap break-words">{card.front}</div>
              {shown && (
                <div className="border-t border-dashed border-line px-6 sm:px-10 py-8 sm:py-10 text-center text-base sm:text-xl text-ink whitespace-pre-wrap break-words" style={{ background: tint('var(--accent-primary)', 5) }}>
                  {card.back}
                </div>
              )}
            </div>

            <div className="mt-6">
              {!shown ? (
                <Button className="w-full !py-3" onClick={() => setShown(true)}>
                  <span className="flex items-center justify-center gap-2"><Eye size={16} /> Afficher la réponse <span className="text-[10px] opacity-60 hidden sm:inline">(Espace)</span></span>
                </Button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {intervals.map((r) => (
                    <button key={r.value} onClick={() => rate(r.value)}
                      className="rounded-xl border px-2 py-2.5 cursor-pointer transition-transform hover:-translate-y-0.5"
                      style={{ borderColor: tint(r.color, 45), background: tint(r.color, 12) }}>
                      <div className="text-sm font-semibold" style={{ color: r.color }}>{r.label}</div>
                      <div className="text-[11px] text-mute">{r.interval} <span className="hidden sm:inline opacity-60">· {r.key}</span></div>
                    </button>
                  ))}
                </div>
              )}
              {shown && <p className="text-[11px] text-mute text-center mt-3 flex items-center justify-center gap-1"><RotateCcw size={10} /> Soyez honnête : « À revoir » fait revenir la fiche dans quelques minutes.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const intervalsMeta = {
  1: { label: 'À revoir', color: 'var(--error)' },
  2: { label: 'Difficile', color: 'var(--warning)' },
  3: { label: 'Bien', color: 'var(--success)' },
  4: { label: 'Facile', color: 'var(--accent-primary)' },
};
