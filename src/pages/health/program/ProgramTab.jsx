import { useEffect, useState } from 'react';
import { BookOpen, Play, Archive, Trash2, AlertCircle, Wifi, WifiOff, ChevronDown, ChevronRight, CalendarDays, Salad, Link2, Target, BarChart3, Trophy as TrophyIcon } from 'lucide-react';
import { Card, Button, Badge, EmptyState, Stat, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import CreateProgramWizard from './creation/CreateProgramWizard';
import PhaseEditor from './creation/PhaseEditor';
import LocationManager from './creation/LocationManager';
import DailyView from './DailyView';
import NutritionTemplateEditor from './NutritionTemplateEditor';
import HabitLinker from './HabitLinker';
import DisciplineCard from './DisciplineCard';
import KPIDashboard from './KPIDashboard';
import GoalsEditor from './GoalsEditor';
import TrophyBoard from './TrophyBoard';
import AlertsBanner from './AlertsBanner';
import AnalyticsView from './AnalyticsView';

const STATUS_COLORS = { draft: 'var(--warning)', active: 'var(--success)', archived: 'var(--text-mute)' };
const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', archived: 'Archivé' };

export default function ProgramTab() {
  const store = useProgramStore();
  const { available, initialized, loading, error, activeProgram, draftProgram, archivedPrograms, phases, canActivate } = store;

  // Initialize on mount
  useEffect(() => { store.initialize(); }, []);

  // Views
  const [view, setView] = useState('main'); // 'main' | 'create' | 'edit' | 'archives'
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Current program to display/edit
  const currentProgram = activeProgram || draftProgram;
  const isDraft = currentProgram?.status === 'draft';
  const isActive = currentProgram?.status === 'active';

  // After program creation, switch to edit view
  const handleCreated = (program) => setView('edit');

  // Activate
  const handleActivate = async () => {
    try {
      await store.activateProgram(currentProgram.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Archive
  const handleArchive = async () => {
    try {
      await store.archiveProgram(currentProgram.id);
      setConfirmArchive(false);
      setView('main');
    } catch (err) {
      console.error(err);
    }
  };

  // Delete draft
  const handleDelete = async () => {
    try {
      await store.deleteDraft(currentProgram.id);
      setConfirmDelete(false);
      setView('main');
    } catch (err) {
      console.error(err);
    }
  };

  // Not available (Supabase not configured)
  if (!available) {
    return (
      <Card>
        <div className="text-center py-8">
          <WifiOff size={32} className="mx-auto text-mute mb-3" />
          <h3 className="font-semibold mb-1">Programme non disponible</h3>
          <p className="text-sm text-mute">
            La fonctionnalité Programme nécessite une connexion Supabase.<br />
            Configurez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans votre fichier .env.
          </p>
        </div>
      </Card>
    );
  }

  // Loading
  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-bad">
          <AlertCircle size={20} />
          <div>
            <div className="font-semibold">Erreur Programme</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
        <Button variant="secondary" onClick={() => store.initialize()} className="mt-3">Réessayer</Button>
      </Card>
    );
  }

  // === Create view ===
  if (view === 'create') {
    return <CreateProgramWizard onCreated={handleCreated} />;
  }

  // === Edit view (draft or active program detail) ===
  if (view === 'edit' && currentProgram) {
    const activePhase = phases.find((p) => p.status === 'active');
    return (
      <div className="space-y-6">
        {/* Program header */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{currentProgram.name}</h2>
                <Badge color={STATUS_COLORS[currentProgram.status]}>{STATUS_LABELS[currentProgram.status]}</Badge>
              </div>
              {currentProgram.start_date && (
                <div className="text-xs text-mute mt-1">
                  {currentProgram.start_date} → {currentProgram.end_date || '…'}
                  {' '} • {phases.length} phase(s)
                  {activePhase && ` • Phase active : ${activePhase.name}`}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {isDraft && (
                <>
                  <Button onClick={handleActivate} disabled={!canActivate()}>
                    <span className="flex items-center gap-1"><Play size={14} /> Activer</span>
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    <span className="flex items-center gap-1"><Trash2 size={14} /> Supprimer</span>
                  </Button>
                </>
              )}
              {isActive && (
                <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                  <span className="flex items-center gap-1"><Archive size={14} /> Archiver</span>
                </Button>
              )}
              <Button variant="ghost" onClick={() => setView('main')}>← Retour</Button>
            </div>
          </div>
        </Card>

        {/* Validation hints */}
        {isDraft && !canActivate() && (
          <div className="text-sm text-warning border border-warning/30 bg-warning/5 rounded-lg px-4 py-3">
            ⚠️ Pour activer : au moins <strong>1 phase</strong> avec au moins <strong>1 séance</strong>.
          </div>
        )}

        {/* Phases editor */}
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3">Phases du programme</h3>
          <PhaseEditor programId={currentProgram.id} />
        </div>

        {/* Nutrition templates per phase */}
        {phases.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
              <Salad size={14} /> Templates Nutrition
            </h3>
            {phases.map((phase) => (
              <div key={phase.id} className="mb-4">
                <div className="text-xs text-mute mb-1">Phase {phase.phase_order} — {phase.name}</div>
                <NutritionTemplateEditor phaseId={phase.id} />
              </div>
            ))}
          </div>
        )}

        {/* Habit links */}
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <Link2 size={14} /> Liaisons Habitudes
          </h3>
          <HabitLinker />
        </div>

        {/* KPIs (can configure in both draft and active) */}
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart3 size={14} /> KPIs
          </h3>
          <KPIDashboard />
        </div>

        {/* Goals (can configure in both draft and active) */}
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target size={14} /> Objectifs
          </h3>
          <GoalsEditor />
        </div>

        {/* Locations */}
        <LocationManager />

        {/* Confirm dialogs */}
        <Modal open={confirmArchive} onClose={() => setConfirmArchive(false)} title="Archiver le programme ?">
          <p className="text-sm text-mute mb-4">
            Le programme sera archivé et ne pilotera plus vos séances. Vous pourrez le consulter en lecture seule.<br />
            Cette action est irréversible.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>Annuler</Button>
            <Button variant="danger" onClick={handleArchive}>Archiver</Button>
          </div>
        </Modal>

        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer le brouillon ?">
          <p className="text-sm text-mute mb-4">
            Le brouillon et tout son contenu (phases, séances, exercices) seront supprimés définitivement.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
          </div>
        </Modal>
      </div>
    );
  }

  // === Archives view ===
  if (view === 'archives') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide">Programmes archivés</h3>
          <Button variant="ghost" onClick={() => setView('main')}>← Retour</Button>
        </div>
        {archivedPrograms.length > 0 ? (
          archivedPrograms.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <Badge color="var(--text-mute)">Archivé</Badge>
                  </div>
                  <div className="text-xs text-mute mt-1">
                    {p.start_date} → {p.end_date} • Archivé le {new Date(p.archived_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <Button variant="secondary" onClick={async () => { await store.loadProgramDetails(p.id); setView('edit'); store.archivedPrograms; /* TODO: proper archived view (read-only) */ }}>
                  Consulter
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <EmptyState>Aucun programme archivé.</EmptyState>
        )}
      </div>
    );
  }

  // === Main view ===
  return (
    <div className="space-y-6">
      {/* Active program summary */}
      {isActive && (
        <Card className="ring-1 ring-accent/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-good animate-pulse" />
                <h3 className="font-bold text-lg">{currentProgram.name}</h3>
                <Badge color="var(--success)">Actif</Badge>
              </div>
              <div className="text-xs text-mute mt-1">
                {currentProgram.start_date} → {currentProgram.end_date || '…'} • {phases.length} phase(s)
              </div>
            </div>
            <Button onClick={() => { store.loadProgramDetails(currentProgram.id); setView('edit'); }}>
              Ouvrir le programme
            </Button>
          </div>
        </Card>
      )}

      {/* Alerts banner */}
      {isActive && <AlertsBanner />}

      {/* Discipline score */}
      {isActive && (
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target size={14} /> Discipline
          </h3>
          <DisciplineCard />
        </div>
      )}

      {/* Daily view — shows today's scheduled sessions for active program */}
      {isActive && (
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <CalendarDays size={14} /> Vue quotidienne
          </h3>
          <DailyView />
        </div>
      )}

      {/* KPIs */}
      {isActive && (
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart3 size={14} /> KPIs
          </h3>
          <KPIDashboard />
        </div>
      )}

      {/* Goals */}
      {isActive && (
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target size={14} /> Objectifs
          </h3>
          <GoalsEditor />
        </div>
      )}

      {/* Trophies */}
      {isActive && (
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrophyIcon size={14} /> Trophées
          </h3>
          <TrophyBoard />
        </div>
      )}

      {/* Analytics & Visualizations */}
      {isActive && (
        <div>
          <h3 className="text-sm font-semibold text-mute uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart3 size={14} /> Analyses & Visualisations
          </h3>
          <AnalyticsView />
        </div>
      )}

      {/* Draft program */}
      {isDraft && (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-warning" />
                <h3 className="font-semibold">{currentProgram.name}</h3>
                <Badge color="var(--warning)">Brouillon</Badge>
              </div>
              <div className="text-xs text-mute mt-1">
                Créé le {new Date(currentProgram.created_at).toLocaleDateString('fr-FR')} • {phases.length} phase(s)
              </div>
            </div>
            <Button onClick={() => { store.loadProgramDetails(currentProgram.id); setView('edit'); }}>
              Continuer l'édition
            </Button>
          </div>
        </Card>
      )}

      {/* No program — show create */}
      {!currentProgram && (
        <Card>
          <div className="text-center py-8">
            <BookOpen size={40} className="mx-auto text-mute mb-3" />
            <h3 className="font-semibold text-lg mb-1">Pas de programme</h3>
            <p className="text-sm text-mute mb-4">
              Commencez un programme pour structurer vos séances, nutrition, sommeil et objectifs en phases.
            </p>
            <Button onClick={() => setView('create')}>
              <span className="flex items-center gap-2"><BookOpen size={16} /> Commencer un programme</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Archives link */}
      {archivedPrograms.length > 0 && (
        <button
          onClick={() => setView('archives')}
          className="w-full text-left flex items-center justify-between gap-3 border border-line rounded-lg px-4 py-3 text-sm text-mute hover:text-ink hover:border-accent/30 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Archive size={14} />
            {archivedPrograms.length} programme(s) archivé(s)
          </span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
