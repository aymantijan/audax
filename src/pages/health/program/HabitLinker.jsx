import { useState } from 'react';
import { Link2, Unlink, Plus } from 'lucide-react';
import { Card, Button, Field, Select, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { useHabitStore } from '../../../store/habitStore';

const LINK_TYPES = [
  { value: 'session_completes_habit', label: 'Séance → complète l\'habitude' },
  { value: 'habit_fulfils_session', label: 'Habitude → valide la séance' },
  { value: 'bidirectional', label: 'Bidirectionnel' },
  { value: 'partial', label: 'Partiel (% personnalisable)' },
];

/**
 * Link habits to programme sessions. Bidirectional: logging a session
 * can auto-complete a linked habit, and completing a habit can count
 * as fulfilling a session requirement.
 */
export default function HabitLinker() {
  const store = useProgramStore();
  const habitStore = useHabitStore();
  const program = store.activeProgram || store.draftProgram;
  const { habitLinks, phases, sessionsByPhase } = store;
  const habits = habitStore.habits || [];

  const [adding, setAdding] = useState(false);

  if (!program) return null;

  // All sessions across all phases
  const allSessions = phases.flatMap((p) => (sessionsByPhase[p.id] || []).map((s) => ({ ...s, phaseName: p.name })));

  const handleRemove = async (linkId) => {
    try {
      await store.removeHabitLink(linkId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card title="Liaison Habitudes ↔ Programme" action={
      <Button variant="secondary" onClick={() => setAdding(true)}>
        <span className="flex items-center gap-1"><Plus size={14} /> Lier une habitude</span>
      </Button>
    }>
      {habitLinks.length === 0 ? (
        <EmptyState>
          <Link2 size={20} className="mx-auto mb-2" />
          Aucune liaison. Liez une habitude pour automatiser le suivi.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {habitLinks.map((link) => {
            const session = allSessions.find((s) => s.id === link.session_id);
            return (
              <div key={link.id} className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link2 size={12} className="text-accent" />
                  <span className="text-sm font-medium">{link.habit_name}</span>
                  <span className="text-xs text-mute">↔</span>
                  <span className="text-sm">{session?.label || 'Séance supprimée'}</span>
                  <Badge>{LINK_TYPES.find((t) => t.value === link.link_type)?.label || link.link_type}</Badge>
                  {link.fulfilment_percent < 100 && (
                    <Badge color="var(--warning)">{link.fulfilment_percent}%</Badge>
                  )}
                </div>
                <Button variant="ghost" onClick={() => handleRemove(link.id)}>
                  <Unlink size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AddLinkModal
          programId={program.id}
          habits={habits}
          sessions={allSessions}
          phases={phases}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  );
}

function AddLinkModal({ programId, habits, sessions, phases, onClose }) {
  const store = useProgramStore();

  const [habitId, setHabitId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [linkType, setLinkType] = useState('bidirectional');
  const [fulfilmentPercent, setFulfilmentPercent] = useState(100);
  const [saving, setSaving] = useState(false);

  const selectedHabit = habits.find((h) => h.id === habitId);

  const handleSave = async () => {
    if (!habitId || !sessionId) return;
    setSaving(true);
    try {
      await store.createHabitLink(programId, {
        phase_id: phaseId || null,
        session_id: sessionId,
        habit_id: habitId,
        habit_name: selectedHabit?.name || habitId,
        link_type: linkType,
        fulfilment_percent: linkType === 'partial' ? fulfilmentPercent : 100,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Lier une habitude au programme">
      <div className="space-y-4">
        <Field label="Habitude">
          <Select value={habitId} onChange={(e) => setHabitId(e.target.value)}>
            <option value="">— Choisir une habitude —</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>{h.name} ({h.frequency || 'quotidien'})</option>
            ))}
          </Select>
        </Field>

        <Field label="Phase (optionnel)">
          <Select value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
            <option value="">— Toutes les phases —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>Phase {p.phase_order} — {p.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Séance liée">
          <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">— Choisir une séance —</option>
            {sessions
              .filter((s) => !phaseId || phases.find((p) => p.id === phaseId && store.sessionsByPhase[p.id]?.some((ss) => ss.id === s.id)))
              .map((s) => (
                <option key={s.id} value={s.id}>{s.label} ({s.type}) — {s.phaseName}</option>
              ))}
          </Select>
        </Field>

        <Field label="Type de liaison">
          <Select value={linkType} onChange={(e) => setLinkType(e.target.value)}>
            {LINK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>

        {linkType === 'partial' && (
          <Field label={`Pourcentage de fulfillment: ${fulfilmentPercent}%`}>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={fulfilmentPercent}
              onChange={(e) => setFulfilmentPercent(parseInt(e.target.value))}
              className="w-full accent-accent"
            />
          </Field>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-line">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving || !habitId || !sessionId}>
          {saving ? 'Liaison…' : 'Lier'}
        </Button>
      </div>
    </Modal>
  );
}
