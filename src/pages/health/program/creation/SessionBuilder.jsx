import { useState } from 'react';
import { Plus, Save, Trash2, HeartPulse, AlertTriangle, X } from 'lucide-react';
import { Button, Input, Select, Field } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import { CARDIO_LIBRARY, CARDIO_CATEGORIES, HR_ZONES, getCardioConfig } from '../../../../utils/exercise-library';
import { TypePicker, typeMeta, tint, EXERCISE_TYPES, DRILL_TYPES } from '../shared/design';
import ExerciseRow from './ExerciseRow';

// Legacy notes encoding, only written when the DB predates migration 004.
function legacyCardioNotes(modalityId, zone, freeNote) {
  const mod = CARDIO_LIBRARY.find((m) => m.id === modalityId);
  if (!mod) return freeNote || null;
  const base = `${mod.name} · Zone ${zone}`;
  return freeNote?.trim() ? `${base} — ${freeNote.trim()}` : base;
}

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

export default function SessionBuilder({ phaseId, session = null, onClose }) {
  const { createSession, updateSession: updateSess, deleteSession: delSess, addExercise, updateExercise, removeExercise, getExercisesForSession } = useProgramStore();

  const isNew = !session;
  const [label, setLabel] = useState(session?.label || '');
  const [type, setType] = useState(session?.type || 'strength');
  const [duration, setDuration] = useState(session?.estimated_duration_min || 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cardio setup — structured config first, legacy notes fallback
  const initialCardio = session?.type === 'cardio' ? getCardioConfig(session) : null;
  const [cardioModality, setCardioModality] = useState(initialCardio?.modality?.id || '');
  const [cardioZone, setCardioZone] = useState(initialCardio?.zone || 2);
  const [cardioCategory, setCardioCategory] = useState(initialCardio?.modality?.category || 'machine');
  const hasStructuredCardio = !!session?.config?.cardio;
  const [notes, setNotes] = useState(
    session?.type === 'cardio' && !hasStructuredCardio ? (initialCardio?.note || '') : (session?.notes || '')
  );

  const mode = DRILL_TYPES.has(type) ? 'drill' : 'strength';
  const existingExercises = session ? getExercisesForSession(session.id) : [];
  const [exercises, setExercises] = useState(existingExercises.length ? existingExercises : [ExerciseRow.blank(0, mode)]);

  const changeType = (t) => {
    setType(t);
    // Fresh builder with only an empty row → give it the new mode's defaults
    const newMode = DRILL_TYPES.has(t) ? 'drill' : 'strength';
    if (newMode !== mode && exercises.length === 1 && !exercises[0].exercise_name && !exercises[0].id) {
      setExercises([ExerciseRow.blank(0, newMode)]);
    }
  };

  const addRow = () => setExercises([...exercises, ExerciseRow.blank(exercises.length, mode)]);
  const handleExerciseChange = (idx, updated) => setExercises(exercises.map((ex, i) => (i === idx ? { ...updated, exercise_order: i } : ex)));
  const handleExerciseRemove = (idx) => setExercises(exercises.filter((_, i) => i !== idx).map((ex, i) => ({ ...ex, exercise_order: i })));

  const autoKey = (label || 'session').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      const isCardio = type === 'cardio';
      const config = isCardio && cardioModality ? { cardio: { modality_id: cardioModality, zone: cardioZone } } : {};
      const payload = {
        label: label.trim(),
        type,
        estimated_duration_min: int(duration, null),
        notes: notes?.trim() || null,
        config,
        // Only used if the DB lacks the config column (pre-migration 004)
        notesFallback: isCardio ? legacyCardioNotes(cardioModality, cardioZone, notes) : (notes?.trim() || null),
      };

      const sess = isNew
        ? await createSession(phaseId, { session_key: session?.session_key || autoKey, ...payload })
        : await updateSess(session.id, payload);

      if (EXERCISE_TYPES.has(type) && sess) {
        const keptIds = new Set(exercises.filter((e) => e.id).map((e) => e.id));
        for (const ex of existingExercises) if (!keptIds.has(ex.id)) await removeExercise(sess.id, ex.id);
        let order = 0;
        for (const ex of exercises) {
          if (!ex.exercise_name?.trim()) continue;
          const clean = {
            ...ex,
            exercise_order: order++,
            sets_count: int(ex.sets_count, 3),
            reps_min: int(ex.reps_min, null),
            reps_max: int(ex.reps_max, null),
            reps_prefill: int(ex.reps_prefill, null),
            rest_seconds: int(ex.rest_seconds, null),
            target_rpe: mode === 'drill' ? null : num(ex.target_rpe, null),
          };
          if (ex.id) await updateExercise(sess.id, ex.id, clean);
          else await addExercise(sess.id, clean);
        }
      }
      onClose?.();
    } catch (err) {
      console.error('Save session failed:', err);
      setError(err?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    try { await delSess(session.id); onClose?.(); }
    catch (err) { setError(err?.message || 'Suppression impossible.'); }
  };

  const meta = typeMeta(type);
  const selectedMod = CARDIO_LIBRARY.find((m) => m.id === cardioModality);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {/* Header strip in the session-type colour */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ background: tint(meta.color, 12), borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <meta.icon size={18} style={{ color: meta.color }} className="shrink-0" />
          <h3 className="truncate font-semibold text-ink">{isNew ? 'Nouvelle séance' : session.label}</h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-mute hover:text-ink cursor-pointer" aria-label="Fermer"><X size={16} /></button>
      </div>

      <div className="space-y-5 p-5">
        {/* Identity */}
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Nom de la séance">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex : PUSH A — Pecs, épaules, triceps" />
          </Field>
          <Field label="Durée estimée (min)">
            <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-mute">Type de séance</span>
          <TypePicker value={type} onChange={changeType} />
        </div>

        {/* Exercises / drills */}
        {EXERCISE_TYPES.has(type) && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">
                {mode === 'drill' ? 'Exercices d’agilité / mobilité' : 'Exercices'}
                <span className="ml-2 text-xs font-normal text-mute">{exercises.filter((e) => e.exercise_name).length}</span>
              </h4>
            </div>
            {exercises.map((ex, i) => (
              <ExerciseRow key={ex.id || `new-${i}`} mode={mode} exercise={ex} index={i} onChange={handleExerciseChange} onRemove={handleExerciseRemove} />
            ))}
            <button
              type="button"
              onClick={addRow}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-3 text-sm text-mute transition-colors hover:border-accent hover:text-accent cursor-pointer"
            >
              <Plus size={15} /> Ajouter un exercice
            </button>
          </div>
        )}

        {/* Cardio */}
        {type === 'cardio' && (
          <div className="space-y-3 rounded-xl border border-line bg-surface/60 p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink"><HeartPulse size={15} className="text-good" /> Modalité cardio</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Catégorie">
                <Select options={CARDIO_CATEGORIES} value={cardioCategory} onChange={(e) => setCardioCategory(e.target.value)} />
              </Field>
              <Field label="Machine / activité">
                <Select
                  options={[{ value: '', label: '— Choisir —' }, ...CARDIO_LIBRARY.filter((m) => m.category === cardioCategory).map((m) => ({ value: m.id, label: m.name }))]}
                  value={cardioModality}
                  onChange={(e) => setCardioModality(e.target.value)}
                />
              </Field>
              <Field label="Zone cible (FC)">
                <Select options={HR_ZONES.map((z) => ({ value: String(z.value), label: z.label }))} value={String(cardioZone)} onChange={(e) => setCardioZone(parseInt(e.target.value, 10))} />
              </Field>
            </div>
            {selectedMod?.note && <p className="text-xs text-mute">💡 {selectedMod.note}</p>}
          </div>
        )}

        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes optionnelles (consignes, échauffement…)" />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2.5 text-sm text-bad">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-4">
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
    </div>
  );
}
