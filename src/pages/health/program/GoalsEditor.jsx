import { useState } from 'react';
import { Target, Plus, Trash2, Trophy, CheckCircle, Circle } from 'lucide-react';
import { Card, Button, Field, Input, Select, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { getKpiDefinition } from '../../../utils/kpi-library';

const PRIORITY_COLORS = {
  low: 'var(--text-mute)',
  medium: 'var(--accent)',
  high: 'var(--warning)',
  critical: 'var(--danger, #ef4444)',
};

const PRIORITY_LABELS = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

/**
 * Goals editor — create and track goals linked to KPIs and phases.
 */
export default function GoalsEditor() {
  const store = useProgramStore();
  const program = store.activeProgram || store.draftProgram;
  const { goals, kpis, phases } = store;
  const [creating, setCreating] = useState(false);

  if (!program) return null;

  const activeGoals = goals.filter((g) => !g.achieved);
  const achievedGoals = goals.filter((g) => g.achieved);

  const handleAchieve = async (goalId) => {
    try {
      await store.achieveGoal(goalId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (goalId) => {
    try {
      await store.removeGoal(goalId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card title="Objectifs" action={
      <Button variant="secondary" onClick={() => setCreating(true)}>
        <span className="flex items-center gap-1"><Plus size={14} /> Nouvel objectif</span>
      </Button>
    }>
      {goals.length === 0 ? (
        <EmptyState>
          <Target size={20} className="mx-auto mb-2" />
          Aucun objectif. Créez un objectif lié à un KPI pour suivre votre progression.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {/* Active goals */}
          {activeGoals.length > 0 && (
            <div className="space-y-2">
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  kpis={kpis}
                  phases={phases}
                  onAchieve={handleAchieve}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Achieved goals */}
          {achievedGoals.length > 0 && (
            <div>
              <div className="text-[10px] text-mute uppercase tracking-wider mt-4 mb-2 flex items-center gap-1">
                <Trophy size={10} /> Atteints ({achievedGoals.length})
              </div>
              <div className="space-y-1">
                {achievedGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-3 px-3 py-2 border border-line rounded-lg opacity-60">
                    <CheckCircle size={14} className="text-good" />
                    <span className="text-sm line-through flex-1">{goal.title}</span>
                    <span className="text-[10px] text-mute">
                      {goal.achieved_at ? new Date(goal.achieved_at).toLocaleDateString('fr-FR') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {creating && (
        <CreateGoalModal
          programId={program.id}
          kpis={kpis}
          phases={phases}
          onClose={() => setCreating(false)}
        />
      )}
    </Card>
  );
}

function GoalCard({ goal, kpis, phases, onAchieve, onDelete }) {
  const kpi = kpis.find((k) => k.id === goal.kpi_id);
  const def = kpi?.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
  const kpiName = def?.name || kpi?.custom_name || null;
  const phase = phases.find((p) => p.id === goal.phase_id);

  const progress = goal.progress_pct ?? 0;
  const isNearTarget = progress >= 90;

  return (
    <div className="border border-line rounded-lg p-3 group">
      <div className="flex items-start gap-3">
        <button onClick={() => onAchieve(goal.id)} className="mt-0.5 cursor-pointer text-mute hover:text-good">
          {isNearTarget ? <CheckCircle size={16} className="text-good" /> : <Circle size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{goal.title}</span>
            <Badge color={PRIORITY_COLORS[goal.priority]}>
              {PRIORITY_LABELS[goal.priority]}
            </Badge>
            {phase && <span className="text-[10px] text-mute">Phase: {phase.name}</span>}
          </div>

          {goal.description && (
            <p className="text-xs text-mute mt-1">{goal.description}</p>
          )}

          {/* Progress bar */}
          {goal.target_value != null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-mute mb-1">
                <span>{kpiName || 'Progression'}: {goal.current_value ?? 0}</span>
                <span>Cible: {goal.target_value}</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, progress)}%`,
                    background: progress >= 90 ? 'var(--success)' : progress >= 50 ? 'var(--accent)' : 'var(--warning)',
                  }}
                />
              </div>
              <div className="text-[10px] text-mute text-right mt-0.5">{progress.toFixed(0)}%</div>
            </div>
          )}
        </div>

        <button onClick={() => onDelete(goal.id)} className="text-mute hover:text-bad opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function CreateGoalModal({ programId, kpis, phases, onClose }) {
  const store = useProgramStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kpiId, setKpiId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetDirection, setTargetDirection] = useState('higher');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await store.addGoal(programId, {
        title: title.trim(),
        description: description || null,
        kpi_id: kpiId || null,
        phase_id: phaseId || null,
        target_value: targetValue ? parseFloat(targetValue) : null,
        target_direction: targetDirection,
        priority,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Nouvel objectif">
      <div className="space-y-4">
        <Field label="Titre">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Atteindre 100 kg au squat" />
        </Field>

        <Field label="Description (optionnel)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Détails…" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="KPI lié (optionnel)">
            <Select value={kpiId} onChange={(e) => setKpiId(e.target.value)}>
              <option value="">— Aucun —</option>
              {kpis.map((k) => {
                const def = k.kpi_key ? getKpiDefinition(k.kpi_key) : null;
                return (
                  <option key={k.id} value={k.id}>
                    {def?.name || k.custom_name || k.kpi_key}
                  </option>
                );
              })}
            </Select>
          </Field>

          <Field label="Phase (optionnel)">
            <Select value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
              <option value="">— Toutes —</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>Phase {p.phase_order} — {p.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Cible">
            <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Direction">
            <Select value={targetDirection} onChange={(e) => setTargetDirection(e.target.value)}>
              <option value="higher">↑ Plus haut</option>
              <option value="lower">↓ Plus bas</option>
              <option value="range">↔ Plage</option>
              <option value="exact">= Exact</option>
            </Select>
          </Field>
          <Field label="Priorité">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="critical">Critique</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-line">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Création…' : 'Créer'}
        </Button>
      </div>
    </Modal>
  );
}
