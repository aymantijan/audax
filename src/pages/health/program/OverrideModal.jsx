import { useState } from 'react';
import { XCircle, ArrowRight, Shuffle, Wrench } from 'lucide-react';
import { Modal, Button, Field, Input, Select } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';

// Justification barème — 18 reason codes with labels and default % reduction
const REASON_CODES = [
  { code: 'transport_public', label: 'Transport en commun (retard/grève)', category: 'predictable' },
  { code: 'embouteillage', label: 'Embouteillage', category: 'predictable' },
  { code: 'reunion_professionnelle', label: 'Réunion professionnelle imprévue', category: 'unpredictable' },
  { code: 'maladie_legere', label: 'Maladie légère (rhume, migraine)', category: 'health' },
  { code: 'maladie_grave', label: 'Maladie grave / hospitalisation', category: 'health' },
  { code: 'blessure', label: 'Blessure', category: 'health' },
  { code: 'fatigue_extreme', label: 'Fatigue extrême / surentraînement', category: 'health' },
  { code: 'obligation_familiale', label: 'Obligation familiale', category: 'personal' },
  { code: 'urgence_personnelle', label: 'Urgence personnelle', category: 'personal' },
  { code: 'meteo_previsible', label: 'Météo prévisible (pluie annoncée)', category: 'weather_predictable' },
  { code: 'meteo_imprevisible', label: 'Météo imprévisible (orage soudain)', category: 'weather_unpredictable' },
  { code: 'salle_fermee', label: 'Salle fermée / indisponible', category: 'facility' },
  { code: 'equipement_casse', label: 'Équipement cassé / indisponible', category: 'facility' },
  { code: 'sommeil_insuffisant', label: 'Sommeil insuffisant (<5h)', category: 'health' },
  { code: 'douleur_musculaire', label: 'Douleur musculaire / DOMS sévère', category: 'health' },
  { code: 'examen_etudes', label: 'Examen / échéance études', category: 'academic' },
  { code: 'voyage', label: 'Voyage / déplacement', category: 'travel' },
  { code: 'autre', label: 'Autre (préciser)', category: 'other' },
];

export default function OverrideModal({ event, date, onClose }) {
  const store = useProgramStore();
  const { session, planned_time } = event;
  const programId = store.activeProgram?.id;

  const [action, setAction] = useState('cancel'); // cancel | reschedule | swap
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState(planned_time || '');
  const [newLocationId, setNewLocationId] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [cascade, setCascade] = useState(true);
  const [saving, setSaving] = useState(false);

  // Available sessions for swap (same phase)
  const phaseSessions = event.phase ? store.getSessionsForPhase(event.phase.id) : [];
  const [swapSessionId, setSwapSessionId] = useState('');

  const handleSave = async () => {
    if (!reasonCode) return;
    setSaving(true);
    try {
      if (action === 'cancel' && cascade) {
        await store.cancelSessionWithCascade(programId, date, session.id, reasonCode, reasonNote);
      } else {
        await store.createOverride(programId, {
          target_date: date,
          original_session_id: session.id,
          action,
          new_date: action === 'reschedule' ? newDate : null,
          new_time: action === 'reschedule' ? newTime : null,
          new_session_id: action === 'swap' ? swapSessionId : null,
          new_location_id: newLocationId || null,
          reason_code: reasonCode,
          reason_note: reasonNote,
          cascade_applied: false,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Modifier — ${session.label} (${date})`}>
      <div className="space-y-4">
        {/* Action type */}
        <div className="flex gap-2">
          {[
            { key: 'cancel', icon: XCircle, label: 'Annuler', color: 'text-bad' },
            { key: 'reschedule', icon: ArrowRight, label: 'Reporter', color: 'text-warning' },
            { key: 'swap', icon: Shuffle, label: 'Remplacer', color: 'text-accent' },
          ].map(({ key, icon: Icon, label, color }) => (
            <button
              key={key}
              onClick={() => setAction(key)}
              className={`flex-1 flex items-center justify-center gap-2 border rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                action === key
                  ? `border-accent bg-accent/10 ${color} font-semibold`
                  : 'border-line text-mute hover:text-ink'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Reschedule fields */}
        {action === 'reschedule' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nouvelle date">
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </Field>
            <Field label="Nouvelle heure">
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </Field>
          </div>
        )}

        {/* Swap fields */}
        {action === 'swap' && (
          <Field label="Remplacer par">
            <Select value={swapSessionId} onChange={(e) => setSwapSessionId(e.target.value)}>
              <option value="">— Choisir une séance —</option>
              {phaseSessions.filter((s) => s.id !== session.id).map((s) => (
                <option key={s.id} value={s.id}>{s.label} ({s.type})</option>
              ))}
            </Select>
          </Field>
        )}

        {/* Cancel cascade option */}
        {action === 'cancel' && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={cascade}
              onChange={(e) => setCascade(e.target.checked)}
              className="accent-accent"
            />
            Décaler les séances restantes de la semaine (+1 jour)
          </label>
        )}

        {/* Location override */}
        {action !== 'cancel' && store.locations.length > 0 && (
          <Field label="Lieu (optionnel)">
            <Select value={newLocationId} onChange={(e) => setNewLocationId(e.target.value)}>
              <option value="">— Même lieu —</option>
              {store.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </Field>
        )}

        {/* Justification */}
        <Field label="Raison *">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            <option value="">— Choisir une raison —</option>
            {REASON_CODES.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Détails (optionnel)">
          <Input
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Précisions sur la raison…"
          />
        </Field>
      </div>

      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-line">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button
          variant={action === 'cancel' ? 'danger' : 'primary'}
          onClick={handleSave}
          disabled={saving || !reasonCode || (action === 'reschedule' && !newDate) || (action === 'swap' && !swapSessionId)}
        >
          {saving ? 'En cours…' : action === 'cancel' ? 'Confirmer l\'annulation' : 'Enregistrer'}
        </Button>
      </div>
    </Modal>
  );
}

export { REASON_CODES };
