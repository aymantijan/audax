import { useEffect, useState } from 'react';
import {
  BookOpen, Play, Archive, Trash2, AlertCircle, WifiOff, ChevronRight, Sun, LineChart,
  Salad, Link2, Target, BarChart3, Layers, Pencil, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import { Card, Button, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { toast } from '../../../store/uiStore';
import CreateProgramWizard from './creation/CreateProgramWizard';
import PhaseEditor from './creation/PhaseEditor';
import LocationManager from './creation/LocationManager';
import DailyView from './DailyView';
import NutritionTemplateEditor from './NutritionTemplateEditor';
import HabitLinker from './HabitLinker';
import DisciplineCard from './DisciplineCard';
import ReadinessCard from './ReadinessCard';
import KPIDashboard from './KPIDashboard';
import GoalsBoard from '../goals/GoalsBoard';
import { useHealthStore } from '../../../store/healthStore';
import TrophyBoard from './TrophyBoard';
import AlertsBanner from './AlertsBanner';
import AnalyticsView from './AnalyticsView';
import { ProgramHero, SegmentedTabs, SectionHeader } from './shared/design';

export default function ProgramTab() {
  const store = useProgramStore();
  const { available, initialized, loading, error, activeProgram, draftProgram, archivedPrograms, phases, canActivate, kpis = [] } = store;
  const allGoals = useHealthStore((st) => st.goals);

  useEffect(() => { store.initialize(); }, []);

  const [view, setView] = useState('main'); // 'main' | 'create' | 'edit' | 'archives'
  const [mainTab, setMainTab] = useState('today');
  const [editTab, setEditTab] = useState('structure');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentProgram = activeProgram || draftProgram;
  const isDraft = currentProgram?.status === 'draft';
  const isActive = currentProgram?.status === 'active';

  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast(okMsg, 'success'); }
    catch (err) { toast(err?.message || 'Action impossible', 'error'); }
  };
  const handleActivate = () => run(() => store.activateProgram(currentProgram.id), 'Programme activé');
  const handleArchive = () => run(async () => { await store.archiveProgram(currentProgram.id); setConfirmArchive(false); setView('main'); }, 'Programme archivé');
  const handleDelete = () => run(async () => { await store.deleteDraft(currentProgram.id); setConfirmDelete(false); setView('main'); }, 'Brouillon supprimé');
  const openEditor = () => { store.loadProgramDetails(currentProgram.id); setView('edit'); };

  if (!available) {
    return (
      <Card>
        <div className="py-8 text-center">
          <WifiOff size={32} className="mx-auto mb-3 text-mute" />
          <h3 className="mb-1 font-semibold">Programme non disponible</h3>
          <p className="text-sm text-mute">La fonctionnalité Programme nécessite une connexion Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>
        </div>
      </Card>
    );
  }

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

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
        <Button variant="secondary" onClick={() => { useProgramStore.setState({ initialized: false, error: null }); store.initialize(); }} className="mt-3">Réessayer</Button>
      </Card>
    );
  }

  if (view === 'create') return <CreateProgramWizard onCreated={() => setView('edit')} />;

  // ─────────────────────────── Editor ───────────────────────────
  if (view === 'edit' && currentProgram) {
    const editTabs = [
      { key: 'structure', label: 'Phases & séances', icon: Layers, count: phases.length },
      { key: 'nutrition', label: 'Nutrition', icon: Salad },
      { key: 'tracking', label: 'KPIs & objectifs', icon: Target, count: kpis.length + allGoals.filter((g) => g.programId === currentProgram.id && !g.achieved).length || null },
      { key: 'links', label: 'Habitudes & lieux', icon: Link2 },
    ];
    return (
      <div className="space-y-5">
        <ProgramHero
          program={currentProgram}
          phases={phases}
          actions={(
            <>
              {isDraft && (
                <>
                  <Button onClick={handleActivate} disabled={!canActivate()}>
                    <span className="flex items-center gap-1.5"><Play size={14} /> Activer</span>
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /></Button>
                </>
              )}
              {isActive && (
                <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                  <span className="flex items-center gap-1.5"><Archive size={14} /> Archiver</span>
                </Button>
              )}
              <Button variant="secondary" onClick={() => setView('main')}>
                <span className="flex items-center gap-1.5"><ArrowLeft size={14} /> Retour</span>
              </Button>
            </>
          )}
        />

        {isDraft && !canActivate() && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Pour activer : au moins <strong className="mx-1">1 phase</strong> avec au moins <strong className="ml-1">1 séance</strong>.
          </div>
        )}

        <SegmentedTabs tabs={editTabs} value={editTab} onChange={setEditTab} />

        {editTab === 'structure' && <PhaseEditor programId={currentProgram.id} />}

        {editTab === 'nutrition' && (
          phases.length ? (
            <div className="space-y-6">
              {phases.map((phase) => (
                <div key={phase.id}>
                  <SectionHeader icon={Salad} title={`Phase ${phase.phase_order} — ${phase.name}`} subtitle="Templates nutrition de la phase" />
                  <NutritionTemplateEditor phaseId={phase.id} />
                </div>
              ))}
            </div>
          ) : <Card><EmptyState>Créez d’abord une phase.</EmptyState></Card>
        )}

        {editTab === 'tracking' && (
          <div className="space-y-6">
            <div><SectionHeader icon={BarChart3} title="KPIs" subtitle="Indicateurs mesurés automatiquement depuis vos séances" /><KPIDashboard /></div>
            <GoalsBoard programId={currentProgram.id} phases={phases} />
          </div>
        )}

        {editTab === 'links' && (
          <div className="space-y-6">
            <div><SectionHeader icon={Link2} title="Liaisons habitudes" subtitle="Une séance loggée coche l’habitude liée (et inversement)" /><HabitLinker /></div>
            <LocationManager />
          </div>
        )}

        <Modal open={confirmArchive} onClose={() => setConfirmArchive(false)} title="Archiver le programme ?">
          <p className="mb-4 text-sm text-mute">Le programme ne pilotera plus vos séances. Il restera consultable. Action irréversible.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>Annuler</Button>
            <Button variant="danger" onClick={handleArchive}>Archiver</Button>
          </div>
        </Modal>
        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer le brouillon ?">
          <p className="mb-4 text-sm text-mute">Le brouillon et tout son contenu (phases, séances, exercices) seront supprimés définitivement.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
          </div>
        </Modal>
      </div>
    );
  }

  // ─────────────────────────── Archives ───────────────────────────
  if (view === 'archives') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Programmes archivés</h3>
          <Button variant="secondary" onClick={() => setView('main')}><span className="flex items-center gap-1.5"><ArrowLeft size={14} /> Retour</span></Button>
        </div>
        {archivedPrograms.length ? archivedPrograms.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><span className="font-semibold">{p.name}</span><Badge color="var(--text-secondary)">Archivé</Badge></div>
                <div className="mt-1 text-xs text-mute">{p.start_date} → {p.end_date} · archivé le {new Date(p.archived_at).toLocaleDateString('fr-FR')}</div>
              </div>
              <Button variant="secondary" onClick={async () => { await store.loadProgramDetails(p.id); setView('edit'); }}>Consulter</Button>
            </div>
          </Card>
        )) : <EmptyState>Aucun programme archivé.</EmptyState>}
      </div>
    );
  }

  // ─────────────────────────── Main ───────────────────────────
  const mainTabs = [
    { key: 'today', label: 'Aujourd’hui', icon: Sun },
    { key: 'tracking', label: 'Suivi', icon: Target },
    { key: 'analytics', label: 'Analyses', icon: LineChart },
  ];

  return (
    <div className="space-y-5">
      {isActive && (
        <>
          <ProgramHero
            program={currentProgram}
            phases={phases}
            actions={(
              <Button variant="secondary" onClick={openEditor}>
                <span className="flex items-center gap-1.5"><Pencil size={14} /> Modifier le programme</span>
              </Button>
            )}
          />
          <AlertsBanner />
          <SegmentedTabs tabs={mainTabs} value={mainTab} onChange={setMainTab} />

          {mainTab === 'today' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0"><DailyView /></div>
              <div className="space-y-4">
                <ReadinessCard />
                <DisciplineCard />
              </div>
            </div>
          )}
          {mainTab === 'tracking' && (
            <div className="space-y-6">
              <div><SectionHeader icon={BarChart3} title="KPIs" /><KPIDashboard /></div>
              <GoalsBoard programId={currentProgram.id} phases={phases} />
              <div><SectionHeader title="Trophées" /><TrophyBoard /></div>
            </div>
          )}
          {mainTab === 'analytics' && <AnalyticsView />}
        </>
      )}

      {isDraft && (
        <ProgramHero
          program={currentProgram}
          phases={phases}
          actions={(
            <Button onClick={openEditor}>
              <span className="flex items-center gap-1.5"><Pencil size={14} /> Continuer l’édition</span>
            </Button>
          )}
        />
      )}

      {!currentProgram && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent"><BookOpen size={26} /></div>
          <h3 className="mb-1 text-lg font-semibold text-ink">Aucun programme</h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-mute">Structurez vos séances, votre cardio, votre agilité, votre nutrition et vos objectifs en phases.</p>
          <Button onClick={() => setView('create')}>
            <span className="flex items-center gap-2"><BookOpen size={16} /> Créer un programme</span>
          </Button>
        </div>
      )}

      {archivedPrograms.length > 0 && (
        <button
          onClick={() => setView('archives')}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-left text-sm text-mute transition-colors hover:border-accent/40 hover:text-ink cursor-pointer"
        >
          <span className="flex items-center gap-2"><Archive size={14} /> {archivedPrograms.length} programme(s) archivé(s)</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
