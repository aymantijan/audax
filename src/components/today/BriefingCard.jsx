import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sunrise, ChevronRight, Sparkles, AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { useAccountingStore } from '../../store/accountingStore';
import { useNetworkingStore } from '../../store/networkingStore';
import { buildBriefing } from '../../utils/briefing';
import { isDue } from '../../utils/fsrs';
import { todayKey } from '../../utils/formatters';
import { openAssistant } from '../../services/assistant';
import { Card, Button } from '../common/ui';

const LEVEL = {
  urgent: { icon: AlertTriangle, color: 'var(--error)' },
  today: { icon: Clock, color: 'var(--accent-primary)' },
  info: { icon: Info, color: 'var(--text-secondary)' },
  done: { icon: CheckCircle2, color: 'var(--success)' },
};

// Top of Aujourd'hui: what matters today, most urgent first, one tap to act.
export default function BriefingCard({ habitsDue, habitsDone, checkinDone }) {
  const today = todayKey();
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const cards = useFlashcardStore((s) => s.cards);
  const journal = useAccountingStore((s) => s.journal);
  const echeances = useAccountingStore((s) => s.echeances);
  const contacts = useNetworkingStore((s) => s.contacts);

  const items = useMemo(() => {
    const acc = useAccountingStore.getState();
    let overdue = [];
    let todayDue = [];
    try {
      overdue = acc.getOverdueEcheances();
      todayDue = acc.getUpcomingEcheances(0).filter((e) => (e.occurrenceDate || e.date) === today);
    } catch { /* no schedules */ }
    let followUps = 0;
    try { followUps = useNetworkingStore.getState().getFollowUpAlerts(0, today).length; } catch { /* module unused */ }
    return buildBriefing({
      today, courses, academic, habitsDue, habitsDone, checkinDone,
      overdueEcheances: overdue, todayEcheances: todayDue,
      flashcardsDue: (cards || []).filter((c) => isDue(c)).length,
      followUps,
    });
  }, [today, courses, academic, cards, journal, echeances, contacts, habitsDue, habitsDone, checkinDone]);

  return (
    <Card
      title={<span className="flex items-center gap-2"><Sunrise size={15} /> Ton briefing</span>}
      action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAssistant('Fais-moi le briefing du jour.')}><span className="flex items-center gap-1.5"><Sparkles size={13} /> Version commentée</span></Button>}
    >
      {items.length ? (
        <ul className="space-y-1">
          {items.map((it) => {
            const L = LEVEL[it.level];
            return (
              <li key={it.key}>
                <Link to={it.to} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-2 hover:bg-surface transition-colors">
                  <L.icon size={15} style={{ color: L.color }} className="shrink-0" />
                  <span className="text-sm flex-1">{it.text}</span>
                  <ChevronRight size={14} className="text-mute group-hover:text-accent shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-mute">Rien d’urgent aujourd’hui. Bonne journée !</p>
      )}
    </Card>
  );
}
