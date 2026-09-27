import { useState } from 'react';
import { FlaskConical, FolderKanban, Send, BookMarked } from 'lucide-react';
import { useEngineeringStore } from '../store/engineeringStore';
import { Card, Button, Input } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';
import { askAIEngineeringQuestion } from '../services/engineering-coach-ai';
import { PortfolioExportModal } from '../components/engineering/PortfolioExportModal';
import { LabJournal } from '../components/engineering/LabJournal';
import { Projects } from '../components/engineering/EngineeringProjects';
const TABS = [
  { key: 'journal', label: 'Journal de labo', icon: FlaskConical, Component: LabJournal },
  { key: 'projects', label: 'Projets', icon: FolderKanban, Component: Projects },
];

// Same UX as Health's "Ask the Health AI" (Dashboard.jsx) — degrades to a
// plain error message rather than crashing when the backend isn't
// configured on this deployment (api/engineering-coach.js returns 503 if
// OPENROUTER_API_KEY is unset).
function AskEngineeringAI() {
  const buildCoachContext = useEngineeringStore((s) => s.buildCoachContext);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError('');
    setAnswer(null);
    try {
      const text = await askAIEngineeringQuestion(buildCoachContext(), question.trim());
      setAnswer(text);
    } catch {
      setAskError("Le coach IA n'est pas disponible pour l'instant (non configuré ou hors ligne) — réessaie plus tard.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <Card title="Demander au coach Ingénierie">
      <form onSubmit={submitQuestion} className="flex gap-2 mb-3">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ex. Pourquoi mon rendement baisse-t-il ces derniers essais ?" className="flex-1" />
        <Button type="submit" disabled={asking}>{asking ? 'Réflexion…' : <span className="flex items-center gap-1.5"><Send size={13} /> Demander</span>}</Button>
      </form>
      {answer && <div className="text-sm bg-surface border border-line rounded-lg p-3">{answer}</div>}
      {askError && <div className="text-sm text-bad">{askError}</div>}
      {!answer && !askError && !asking && <div className="text-xs text-mute">Pose une question sur tes propres données loggées (labo, projets) — nécessite que le coach IA soit configuré sur ce déploiement.</div>}
    </Card>
  );
}

export default function Engineering() {
  const [tab, setTab] = useState('journal');
  const [portfolioModal, setPortfolioModal] = useState(false);
  // Destructure from the whole store (not a scoped selector) so this
  // re-renders on ANY engineeringStore change — a selector keyed to just
  // `getBadges` would never re-fire since the function reference itself
  // never changes, even though the awardedBadges array it reads does.
  const { getBadges, projects, labEntries } = useEngineeringStore();
  const badges = getBadges();
  const Active = TABS.find((t) => t.key === tab)?.Component || LabJournal;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ingénierie</h1>
          <p className="text-mute text-sm mt-1">Journal de laboratoire et suivi de projets — pour le génie chimique et disciplines proches.</p>
        </div>
        {(projects.length > 0 || labEntries.length > 0) && (
          <Button variant="secondary" onClick={() => setPortfolioModal(true)}>
            <span className="flex items-center gap-2"><BookMarked size={14} /> Exporter le portfolio</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                active ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <Active />

      <AskEngineeringAI />

      <BadgeList badges={badges} />

      <PortfolioExportModal open={portfolioModal} onClose={() => setPortfolioModal(false)} projects={projects} labEntries={labEntries} />
    </div>
  );
}
