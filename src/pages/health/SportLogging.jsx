import { useState } from 'react';
import { Trash2, Pencil, Activity, CalendarPlus } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { SPORT_TYPES, labelFor } from '../../utils/workout-types';
import { Card, Button, Field, Input, Select, EmptyState, Badge } from '../../components/common/ui';
import ScheduleEventModal from '../../components/common/ScheduleEventModal';

// Always free-form — no curated program prescribes generic sport activity
// (only training/cardio blocks exist in the program data model), so there's
// no "prescribed vs autonomous" split here like Cardio/Gym.
export default function SportLogging() {
  const { workouts, logWorkout, editWorkout, deleteWorkout } = useHealthStore();

  const [editing, setEditing] = useState(null); // { id } | null
  const [sportSubtype, setSportSubtype] = useState(SPORT_TYPES[0].value);
  const [durationMin, setDurationMin] = useState(30);
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
    setSportSubtype(w.sessionType || SPORT_TYPES[0].value);
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
      type: 'sport',
      category: 'sport',
      sessionType: sportSubtype,
      exercise: labelFor(SPORT_TYPES, sportSubtype),
      durationMin,
      quality,
      notes,
    };
    if (editing) editWorkout(editing.id, payload);
    else logWorkout(payload);
    resetForm();
  };

  const today = todayKey();
  const sportWorkouts = workouts.filter((w) => w.type === 'sport').sort((a, b) => b.createdAt - a.createdAt);
  const todayItems = sportWorkouts.filter((w) => w.date === today);
  const historyItems = [...sportWorkouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);

  return (
    <div className="space-y-6">
      <Card
        title={editing ? "Modifier l'activité" : 'Logger un sport'}
        action={<Button variant="secondary" onClick={() => setScheduleModal(true)}><span className="flex items-center gap-2"><CalendarPlus size={14} /> Programmer une séance</span></Button>}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sport">
              <Select value={sportSubtype} onChange={(e) => setSportSubtype(e.target.value)} options={SPORT_TYPES} />
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
          <EmptyState>Aucun sport loggé pour l'instant.</EmptyState>
        )}
      </Card>

      <ScheduleEventModal open={scheduleModal} onClose={() => setScheduleModal(false)} title="Programmer une activité sportive" defaultSummary="Sport" onScheduled={() => {}} />
    </div>
  );
}

function Row({ w, onDelete, onEdit, showDate }) {
  return (
    <li className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-2.5">
      <Activity size={16} className="text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{w.exercise || 'Sport'}</div>
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
