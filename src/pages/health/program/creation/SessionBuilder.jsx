import { useState } from 'react';
import { Plus, Save, Trash2, Search } from 'lucide-react';
import { Card, Button, Input, Select, Field, EmptyState } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import { searchExercises } from '../../../../utils/exercise-library';
import ExerciseRow from './ExerciseRow';

const SESSION_TYPES = [
  { value: 'strength', label: 'Musculation' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'sport', label: 'Sport' },
  { value: 'mobility', label: 'Mobilité' },
  { value: 'recovery', label: 'Récupération' },
];

export default function SessionBuilder({ phaseId, session = null, onClose }) {
  const { createSession, updateSession: updateSess, deleteSession: delSess, addExercise, updateExercise, removeExercise, getExercisesForSession } = useProgramStore();

  const isNew = !session;
  const [label, setLabel] = useState(session?.label || '');
  const [sessionKey, setSessionKey] = useState(session?.session_key || '');
  const [type, setType] = useState(session?.type || 'strength');
  const [duration, setDuration] = useState(session?.estimated_duration_min || 60);
  const [notes, setNotes] = useState(session?.notes || '');
  const [saving, setSaving] = useState(false);

  // Exercises — local state while editing, persisted on save
  const existingExercises = session ? getExercisesForSession(session.id) : [];
  const [exercises, setExercises] = useState(
    existingExercises.length ? existingExercises : [ExerciseRow.blank(0)]
  );

  // Exercise search
  const [searchTerm, setSearchTerm] = useState('');
  const searchResults = searchTerm.length >= 2 ? searchExercises(searchTerm).slice(0, 8) : [];

  const addBlankExercise = () => {
    setExercises([...exercises, ExerciseRow.blank(exercises.length)]);
  };

  const addFromLibrary = (ex) => {
    setExercises([
      ...exercises,
      { ...ExerciseRow.blank(exercises.length), exercise_name: ex.name, exercise_key: ex.key },
    ]);
    setSearchTerm('');
  };

  const handleExerciseChange = (idx, updated) => {
    setExercises(exercises.map((ex, i) => i === idx ? { ...updated, exercise_order: i } : ex));
  };

  const handleExerciseRemove = (idx) => {
    setExercises(exercises.filter((_, i) => i !== idx).map((ex, i) => ({ ...ex, exercise_order: i })));
  };

  // Auto-generate session_key from label
  const autoKey = (label || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      let sess;
      const key = sessionKey || autoKey;
      if (isNew) {
        sess = await createSession(phaseId, { session_key: key, label, type, estimated_duration_min: duration || null, notes: notes || null });
      } else {
        sess = await updateSess(session.id, { label, type, estimated_duration_min: duration || null, notes: notes || null });
      }

      // Save exercises
      if (type === 'strength' && sess) {
        // Remove exercises that were deleted
        const savedIds = new Set(exercises.filter((e) => e.id).map((e) => e.id));
        for (const ex of existingExercises) {
          if (!savedIds.has(ex.id)) await removeExercise(sess.id, ex.id);
        }
        // Upsert all exercises
        for (const ex of exercises) {
          if (!ex.exercise_name.trim()) continue;
          if (ex.id) {
            await updateExercise(sess.id, ex.id, ex);
          } else {
            await addExercise(sess.id, ex);
          }
        }
      }
      onClose?.();
    } catch (err) {
      console.error('Save session failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    try {
      await delSess(session.id);
      onClose?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card title={isNew ? 'Nouvelle séance' : `Séance : ${session.label}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom de la séance">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Push — Pecs, Épaules, Triceps" />
          </Field>
          <Field label="Clé unique" hint={isNew ? `Auto: ${autoKey}` : 'Non modifiable après création'}>
            <Input
              value={sessionKey}
              onChange={(e) => setSessionKey(e.target.value)}
              placeholder={autoKey}
              disabled={!isNew}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Type">
            <Select options={SESSION_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
          </Field>
          <Field label="Durée estimée (min)">
            <Input type="number" min={0} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes optionnelles" />
          </Field>
        </div>

        {/* Exercises section — only for strength sessions */}
        {type === 'strength' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-mute uppercase tracking-wide">Exercices</h4>
              <div className="flex gap-2">
                <div className="relative">
                  <div className="flex items-center gap-1 border border-line rounded-lg px-2 py-1 bg-surface">
                    <Search size={13} className="text-mute" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Chercher un exercice…"
                      className="bg-transparent text-sm text-ink placeholder:text-mute outline-none w-40"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-line rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                      {searchResults.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => addFromLibrary(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface cursor-pointer border-b border-line last:border-0"
                        >
                          {r.name}
                          {r.muscles?.length > 0 && (
                            <span className="text-[10px] text-mute ml-2">{r.muscles.join(', ')}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="secondary" onClick={addBlankExercise}>
                  <span className="flex items-center gap-1"><Plus size={14} /> Vide</span>
                </Button>
              </div>
            </div>

            {/* Header row */}
            {exercises.length > 0 && (
              <div className="text-[10px] text-mute grid grid-cols-12 gap-2 px-8">
                <div className="col-span-4">Exercice</div>
                <div className="col-span-1 text-center">Séries</div>
                <div className="col-span-1 text-center">Min</div>
                <div className="col-span-1 text-center">Max</div>
                <div className="col-span-1 text-center">Repos</div>
                <div className="col-span-1 text-center">RPE</div>
                <div className="col-span-1 text-center">Tempo</div>
                <div className="col-span-2">Notes</div>
              </div>
            )}

            <div className="space-y-2">
              {exercises.map((ex, i) => (
                <ExerciseRow
                  key={ex.id || `new-${i}`}
                  exercise={ex}
                  index={i}
                  onChange={handleExerciseChange}
                  onRemove={handleExerciseRemove}
                />
              ))}
            </div>

            {!exercises.length && (
              <EmptyState>Aucun exercice. Recherchez ou ajoutez un exercice vide.</EmptyState>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <div>
            {!isNew && (
              <Button variant="danger" onClick={handleDelete}>
                <span className="flex items-center gap-1"><Trash2 size={14} /> Supprimer</span>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !label.trim()}>
              <span className="flex items-center gap-1"><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
