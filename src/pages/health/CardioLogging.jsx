import { useState } from 'react';
import { Trash2, Pencil, HeartPulse, CalendarPlus } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { CARDIO_TYPES, labelFor } from '../../utils/workout-types';
import { Card, Button, Field, Input, Select, EmptyState, Badge } from '../../components/common/ui';
import ScheduleEventModal from '../../components/common/ScheduleEventModal';
import CyclePhaseHint from '../../components/health/CyclePhaseHint';
import { CuratedCardioLogger } from './CuratedSessionLogger';

export default function CardioLogging({ pendingPrompt }) {
  const { workouts, logWorkout, editWorkout, deleteWorkout, getActiveCuratedProgram, getTodayCuratedSession } = useHealthStore();
  const curatedProgram = getActiveCuratedProgram();
  const curatedToday = curatedProgram ? getTodayCuratedSession() : null;
  const hasCuratedToday = !!(curatedProgram && curatedToday?.dayEntry?.blocks?.some((b) => b.type === 'cardio'));
  const [freeMode, setFreeMode] = useState(false);

  const [editing, setEditing] = useState(null); // { id } | null
  const showManualForm = !hasCuratedToday || freeMode || !!editing;

  const [cardioSubtype, setCardioSubtype] = useState(CARDIO_TYPES[1].value);
  const [durationMin, setDurationMin] = useState(pendingPrompt?.duration || 30);
  const [quality, setQuality] = useState(7);
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(todayKey());
  const [scheduleModal, setScheduleModal] = useState(false);

  const resetForm = () => {
    setDurationMin(30);
    setQuality(7);
    setNotes('');
    setLogDate(todayKey());
    setEditing(null);
  };

  const startEdit = (w) => {
    setCardioSubtype(w.sessionType || CARDIO_TYPES[1].value);
    setDurationMin(w.durationMin || 0);
    setQuality(w.quality || 7);
    setNotes(w.notes || '');
    setLogDate(w.date);
    setEditing({ id: w.id });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      date: logDate,
      type: 'cardio',
      category: 'cardio',
      sessionType: cardioSubtype,
      exercise: labelFor(CARDIO_TYPES, cardioSubtype),
      durationMin,
      quality,
      notes,
    };
    if (editing) editWorkout(editing.id, payload);
    else logWorkout(payload, pendingPrompt?.id);
    resetForm();
  };

  const today = todayKey();
  const cardioWorkouts = workouts.filter((w) => w.type === 'cardio').sort((a, b) => b.createdAt - a.createdAt);
  const todayItems = cardioWorkouts.filter((w) => w.date === today);
  const historyItems = [...cardioWorkouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);

  return (
    <div className="space-y-6">
      <CyclePhaseHint />
      {curatedProgram && <CuratedCardioLogger />}

      {hasCuratedToday && !editing && (
        <button type="button" onClick={() => setFreeMode((v) => !v)} className="text-xs text-mute hover:text-ink underline cursor-pointer">
          {freeMode ? 'Masquer le formulaire libre' : "Autre chose à logger en plus du programme ? Mode libre"}
        </button>
      )}

      {showManualForm && (
        <Card
          title={editing ? 'Modifier la séance cardio' : 'Logger du cardio'}
          action={<Button variant="secondary" onClick={() => setScheduleModal(true)}><span className="flex items-center gap-2"><CalendarPlus size={14} /> Programmer une séance</span></Button>}
        >
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type de cardio">
                <Select value={cardioSubtype} onChange={(e) => setCardioSubtype(e.target.value)} options={CARDIO_TYPES} />
              </Field>
              <Field label="Date" hint="Rattraper une séance manquée">
                <Input type="date" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Durée (min)">
              <Input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
            </Field>
            <Field label={`Qualité de la séance : ${quality}/10`}>
              <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
            </Field>
            <Field label="Notes (optionnel)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              {editing && (
                <Button type="button" variant="secondary" className="flex-1" onClick={resetForm}>Annuler la modification</Button>
              )}
              <Button type="submit" className="flex-1">{editing ? 'Enregistrer' : 'Logger'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Aujourd'hui" action={<Badge>{todayItems.length} loggée{todayItems.length !== 1 ? 's' : ''}</Badge>}>
        {todayItems.length ? (
          <ul className="space-y-2">
            {todayItems.map((w) => <Row key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} onEdit={() => startEdit(w)} />)}
          </ul>
        ) : (
          <EmptyState>Rien loggé aujourd'hui.</EmptyState>
        )}
      </Card>

      <Card title="Historique">
        {historyItems.length ? (
          <ul className="space-y-2">
            {historyItems.map((w) => <Row key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} onEdit={() => startEdit(w)} showDate />)}
          </ul>
        ) : (
          <EmptyState>Aucun cardio loggé pour l'instant.</EmptyState>
        )}
      </Card>

      <ScheduleEventModal open={scheduleModal} onClose={() => setScheduleModal(false)} title="Programmer une séance cardio" defaultSummary="Cardio" onScheduled={() => {}} />
    </div>
  );
}

function Row({ w, onDelete, onEdit, showDate }) {
  return (
    <li className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-2.5">
      <HeartPulse size={16} className="text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{w.exercise || 'Cardio'}</div>
        <div className="text-[11px] text-mute">
          {showDate ? `${w.date} · ` : ''}{w.durationMin}min
          {w.quality ? ` · qualité ${w.quality}/10` : ''}
        </div>
      </div>
      <button onClick={onEdit} className="text-mute hover:text-accent cursor-pointer shrink-0"><Pencil size={14} /></button>
      <button onClick={onDelete} className="text-mute hover:text-bad cursor-pointer shrink-0"><Trash2 size={14} /></button>
    </li>
  );
}
