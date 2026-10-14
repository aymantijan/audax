import { useMemo, useState } from 'react';
import { History, Check, X } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { isHabitShownOn } from '../../utils/calculations';
import { todayKey } from '../../utils/formatters';

const DISMISS_KEY = 'audax-yesterday-dismissed';
const readDismissed = () => { try { return localStorage.getItem(DISMISS_KEY); } catch { return null; } };

// « Hier : 2 habitudes non cochées » (J1). Forgotten ticks from yesterday can
// be caught up from the morning screen, one tap each; nothing when all is done
// or once the card is closed for that day.
export default function YesterdayCard() {
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const toggleHabit = useHabitStore((s) => s.toggleHabit);
  const yesterday = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return todayKey(d); }, []);
  const [dismissed, setDismissed] = useState(() => readDismissed() === yesterday);

  const missed = useMemo(() => habits.filter((h) => {
    if (h.archived || h.source) return false;
    const created = h.createdAt ? todayKey(new Date(h.createdAt)) : null;
    if (created && created > yesterday) return false; // did not exist yet
    if (!isHabitShownOn(h, logs, yesterday)) return false;
    return !logs.some((l) => l.habitId === h.id && l.date === yesterday && l.completed);
  }), [habits, logs, yesterday]);

  if (dismissed || !missed.length) return null;
  const close = () => { try { localStorage.setItem(DISMISS_KEY, yesterday); } catch { /* ignore */ } setDismissed(true); };

  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <History size={16} className="text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Hier : {missed.length} habitude{missed.length > 1 ? 's' : ''} non cochée{missed.length > 1 ? 's' : ''}. {missed.length > 1 ? 'Tu les as faites ? Coche-les.' : 'Tu l’as faite ? Coche-la.'}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missed.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => toggleHabit(h.id, yesterday)}
                  className="ui-btn flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs hover:border-accent cursor-pointer"
                >
                  <Check size={12} className="text-accent" /> {h.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={close} aria-label="Ne plus afficher pour hier" className="ui-icon-btn p-1.5 rounded-lg text-mute hover:text-ink cursor-pointer"><X size={16} /></button>
      </div>
    </div>
  );
}
