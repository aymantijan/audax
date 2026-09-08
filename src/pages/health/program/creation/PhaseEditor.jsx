import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { Card, Button, Input, Field, Badge, EmptyState } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import SessionBuilder from './SessionBuilder';
import WeeklyStructureEditor from './WeeklyStructureEditor';

export default function PhaseEditor({ programId }) {
  const { phases, addPhase, updatePhase, deletePhase, getSessionsForPhase } = useProgramStore();
  const [expandedPhaseId, setExpandedPhaseId] = useState(null);
  const [editingSessionFor, setEditingSessionFor] = useState(null); // phaseId
  const [editingSession, setEditingSession] = useState(null);       // session object or null (new)
  const [adding, setAdding] = useState(false);

  // New phase form
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newObjective, setNewObjective] = useState('');

  const resetNew = () => { setNewName(''); setNewStart(''); setNewEnd(''); setNewObjective(''); setAdding(false); };

  // Compute next phase defaults
  const lastPhase = phases[phases.length - 1];
  const nextOrder = phases.length + 1;
  const nextStart = lastPhase
    ? new Date(new Date(lastPhase.end_date).getTime() + 86400000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const handleAddPhase = async () => {
    if (!newName.trim() || !newStart || !newEnd) return;
    if (newEnd < newStart) return;
    try {
      const phase = await addPhase(programId, {
        name: newName,
        phase_order: nextOrder,
        start_date: newStart,
        end_date: newEnd,
        objective: newObjective || null,
      });
      resetNew();
      setExpandedPhaseId(phase.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePhase = async (phaseId) => {
    try {
      await deletePhase(phaseId);
      if (expandedPhaseId === phaseId) setExpandedPhaseId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePhaseField = async (phaseId, field, value) => {
    try {
      await updatePhase(phaseId, { [field]: value });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (id) => setExpandedPhaseId(expandedPhaseId === id ? null : id);

  return (
    <div className="space-y-4">
      {/* Phase list */}
      {phases.map((phase) => {
        const expanded = expandedPhaseId === phase.id;
        const sessions = getSessionsForPhase(phase.id);
        const startDate = new Date(phase.start_date);
        const endDate = new Date(phase.end_date);
        const durationDays = Math.ceil((endDate - startDate) / 86400000) + 1;
        const durationWeeks = Math.round(durationDays / 7 * 10) / 10;

        return (
          <Card key={phase.id} className={expanded ? 'ring-1 ring-accent/30' : ''}>
            {/* Phase header */}
            <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => toggleExpand(phase.id)}>
              <div className="flex items-center gap-3">
                {expanded ? <ChevronDown size={16} className="text-accent" /> : <ChevronRight size={16} className="text-mute" />}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Phase {phase.phase_order}</span>
                    <span className="text-sm text-ink">— {phase.name}</span>
                    <Badge>{durationWeeks} sem.</Badge>
                    <Badge color="var(--success)">{sessions.length} séance(s)</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-mute mt-0.5">
                    <Calendar size={11} />
                    {phase.start_date} → {phase.end_date}
                    {phase.objective && <span className="ml-2">• {phase.objective}</span>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase.id); }}>
                <Trash2 size={14} />
              </Button>
            </div>

            {/* Expanded: editable details */}
            {expanded && (
              <div className="mt-4 space-y-4 border-t border-line pt-4">
                {/* Phase meta */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Nom">
                    <Input value={phase.name} onBlur={(e) => handleUpdatePhaseField(phase.id, 'name', e.target.value)} onChange={() => {}} defaultValue={phase.name} />
                  </Field>
                  <Field label="Date de début">
                    <Input type="date" value={phase.start_date} onChange={(e) => handleUpdatePhaseField(phase.id, 'start_date', e.target.value)} />
                  </Field>
                  <Field label="Date de fin">
                    <Input type="date" value={phase.end_date} onChange={(e) => handleUpdatePhaseField(phase.id, 'end_date', e.target.value)} />
                  </Field>
                  <Field label="Objectif">
                    <Input value={phase.objective || ''} onChange={(e) => handleUpdatePhaseField(phase.id, 'objective', e.target.value)} placeholder="Objectif de la phase" />
                  </Field>
                </div>

                {/* Sessions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-mute uppercase tracking-wide">Séances de cette phase</h4>
                    <Button variant="secondary" onClick={() => { setEditingSessionFor(phase.id); setEditingSession(null); }}>
                      <span className="flex items-center gap-1"><Plus size={14} /> Nouvelle séance</span>
                    </Button>
                  </div>

                  {sessions.length > 0 ? (
                    <div className="space-y-1">
                      {sessions.map((sess) => (
                        <div
                          key={sess.id}
                          onClick={() => { setEditingSessionFor(phase.id); setEditingSession(sess); }}
                          className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2 hover:border-accent/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Badge color={sess.type === 'strength' ? 'var(--accent-primary)' : sess.type === 'cardio' ? 'var(--success)' : 'var(--warning)'}>
                              {sess.type}
                            </Badge>
                            <span className="text-sm font-medium">{sess.label}</span>
                            <span className="text-xs text-mute">({sess.session_key})</span>
                          </div>
                          {sess.estimated_duration_min && <span className="text-xs text-mute">{sess.estimated_duration_min} min</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>Aucune séance. Créez-en une pour cette phase.</EmptyState>
                  )}

                  {/* Session builder modal (inline) */}
                  {editingSessionFor === phase.id && (
                    <div className="mt-3">
                      <SessionBuilder
                        phaseId={phase.id}
                        session={editingSession}
                        onClose={() => { setEditingSessionFor(null); setEditingSession(null); }}
                      />
                    </div>
                  )}
                </div>

                {/* Weekly structure */}
                {sessions.length > 0 && (
                  <WeeklyStructureEditor phaseId={phase.id} />
                )}
              </div>
            )}
          </Card>
        );
      })}

      {/* Add phase form */}
      {adding ? (
        <Card title="Nouvelle phase">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom de la phase">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`ex: Phase ${nextOrder} — Base`} />
              </Field>
              <Field label="Objectif (optionnel)">
                <Input value={newObjective} onChange={(e) => setNewObjective(e.target.value)} placeholder="Construire une base de force" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de début">
                <Input type="date" value={newStart || nextStart} onChange={(e) => setNewStart(e.target.value)} />
              </Field>
              <Field label="Date de fin">
                <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddPhase} disabled={!newName.trim() || !(newStart || nextStart) || !newEnd}>Ajouter la phase</Button>
              <Button variant="ghost" onClick={resetNew}>Annuler</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => { setNewStart(nextStart); setAdding(true); }} className="w-full">
          <span className="flex items-center gap-1 justify-center"><Plus size={14} /> Ajouter une phase</span>
        </Button>
      )}
    </div>
  );
}
