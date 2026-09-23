import { useMemo, useState } from 'react';
import { Trash2, Pencil, HeartPulse, CalendarPlus, History } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { CARDIO_LIBRARY, CARDIO_BY_ID, CARDIO_CATEGORIES, HR_ZONES, CARDIO_METRIC_LABELS, cardioSessionType } from '../../utils/exercise-library';
import { Card, Button, Field, Input, Select, EmptyState, Badge } from '../../components/common/ui';
import ScheduleEventModal from '../../components/common/ScheduleEventModal';
import CyclePhaseHint from '../../components/health/CyclePhaseHint';
import CardioTrend from './program/visualizations/CardioTrend';

// Same cardio library as the Programme logger, so a manual session and a
// programme session on the Stairmaster are the same thing in every chart.

// Old manual entries only had a free "subtype" (sessionType) — map it back to a
// library modality / zone when editing them.
const LEGACY_SUBTYPE = {
  stairmaster: 'cardio-stairmaster', rowing: 'cardio-rower-concept2', elliptical: 'cardio-elliptical',
  cycling: 'cardio-stationary-bike', running: 'cardio-running-outdoor', swimming: 'cardio-swimming',
  jump_rope: 'cardio-jump-rope', hiit: 'cardio-hiit',
};

const blankMetrics = () => ({});

export default function CardioLogging({ pendingPrompt }) {
  const { workouts, logWorkout, editWorkout, deleteWorkout } = useHealthStore();

  const [editing, setEditing] = useState(null);
  const [category, setCategory] = useState('machine');
  const [modalityId, setModalityId] = useState('cardio-stairmaster');
  const [zone, setZone] = useState(2);
  const [durationMin, setDurationMin] = useState(pendingPrompt?.duration || 30);
  const [metrics, setMetrics] = useState(blankMetrics());
  const [quality, setQuality] = useState(7);
  const [notes, setNotes] = useState('');
  const [logDate, setLogDate] = useState(todayKey());
  const [scheduleModal, setScheduleModal] = useState(false);

  const modality = CARDIO_BY_ID[modalityId];
  const metricKeys = (modality?.metrics || ['distance', 'avgHr']).filter((k) => k !== 'duration' && k !== 'zone');

  const cardioWorkouts = useMemo(() => workouts.filter((w) => w.type === 'cardio'), [workouts]);

  // Last session on the same machine — a reference to beat
  const last = useMemo(() => cardioWorkouts
    .filter((w) => (w.cardio?.modalityId === modalityId) && w.id !== editing?.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)))[0] || null,
  [cardioWorkouts, modalityId, editing]);

  const pickModality = (id) => {
    setModalityId(id);
    setMetrics(blankMetrics());
    const m = CARDIO_BY_ID[id];
    if (m?.defaultZone) setZone(m.defaultZone);
  };

  const resetForm = () => {
    setDurationMin(30); setMetrics(blankMetrics()); setQuality(7); setNotes(''); setLogDate(todayKey()); setEditing(null);
  };

  const startEdit = (w) => {
    const id = w.cardio?.modalityId || LEGACY_SUBTYPE[w.sessionType] || CARDIO_LIBRARY.find((m) => m.name === w.exercise)?.id || 'cardio-stairmaster';
    const z = Number(w.cardio?.zone) || Number(String(w.sessionType || '').replace('zone', '')) || 2;
    setCategory(CARDIO_BY_ID[id]?.category || 'machine');
    setModalityId(id);
    setZone(z);
    const { modalityId: _a, modalityName: _b, zone: _c, ...rest } = w.cardio || {};
    setMetrics(rest);
    setDurationMin(w.durationMin || 0);
    setQuality(w.quality || 7);
    setNotes(w.notes || '');
    setLogDate(w.date);
    setEditing({ id: w.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (e) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(metrics).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)]));
    const payload = {
      date: logDate,
      type: 'cardio',
      category: 'cardio',
      sessionType: cardioSessionType(modalityId, zone),
      exercise: modality?.name || 'Cardio',
      durationMin,
      quality,
      notes,
      cardio: { modalityId, modalityName: modality?.name, zone, ...clean },
    };
    if (editing) editWorkout(editing.id, payload);
    else logWorkout(payload, pendingPrompt?.id);
    resetForm();
  };

  const today = todayKey();
  const todayItems = cardioWorkouts.filter((w) => w.date === today).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const historyItems = [...cardioWorkouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);

  return (
    <div className="space-y-6">
      <CyclePhaseHint context="cardio" />

      <Card
        title={editing ? 'Modifier la séance cardio' : 'Enregistrer du cardio'}
        action={<Button variant="secondary" onClick={() => setScheduleModal(true)}><span className="flex items-center gap-2"><CalendarPlus size={14} /> Programmer</span></Button>}
      >
        <form onSubmit={submit} className="space-y-4">
          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            {CARDIO_CATEGORIES.map((c) => (
              <button key={c.value} type="button"
                onClick={() => { setCategory(c.value); const first = CARDIO_LIBRARY.find((m) => m.category === c.value); if (first) pickModality(first.id); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${category === c.value ? 'border-good bg-good/10 text-good' : 'border-line text-mute hover:text-ink'}`}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Modality tiles */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CARDIO_LIBRARY.filter((m) => m.category === category).map((m) => (
              <button key={m.id} type="button" onClick={() => pickModality(m.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${modalityId === m.id ? 'border-good bg-good/10 text-ink' : 'border-line bg-surface text-mute hover:border-good/50 hover:text-ink'}`}>
                <HeartPulse size={14} className={modalityId === m.id ? 'mb-1 text-good' : 'mb-1'} />
                <span className="block font-medium leading-tight">{m.name}</span>
              </button>
            ))}
          </div>

          {modality?.note && <p className="text-xs text-mute">💡 {modality.note}</p>}

          {last && (
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-mute">
              <History size={13} className="shrink-0" />
              <span>
                Dernière fois ({new Date(last.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}) :{' '}
                <span className="text-ink">
                  {[
                    `${last.durationMin} min`,
                    last.cardio?.zone && `Zone ${last.cardio.zone}`,
                    last.cardio?.distance && `${last.cardio.distance} dist.`,
                    last.cardio?.avgHr && `${last.cardio.avgHr} bpm`,
                    last.cardio?.level && `niveau ${last.cardio.level}`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Durée (min)">
              <Input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
            </Field>
            <Field label="Zone de fréquence cardiaque">
              <Select value={String(zone)} onChange={(e) => setZone(Number(e.target.value))} options={HR_ZONES.map((z) => ({ value: String(z.value), label: z.label }))} />
            </Field>
            <Field label="Date" hint="Rattraper une séance manquée">
              <Input type="date" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} />
            </Field>
          </div>

          {metricKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metricKeys.map((k) => (
                <Field key={k} label={CARDIO_METRIC_LABELS[k] || k}>
                  <Input type="number" step="any" min="0" value={metrics[k] ?? ''} placeholder="—" onChange={(e) => setMetrics({ ...metrics, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
          )}

          <Field label={`Ressenti de la séance : ${quality}/10`}>
            <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Notes (facultatif)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            {editing && <Button type="button" variant="secondary" className="flex-1" onClick={resetForm}>Annuler la modification</Button>}
            <Button type="submit" className="flex-1">{editing ? 'Enregistrer' : 'Enregistrer la séance'}</Button>
          </div>
        </form>
      </Card>

      <Card title="Aujourd’hui" action={<Badge>{todayItems.length} séance{todayItems.length !== 1 ? 's' : ''}</Badge>}>
        {todayItems.length ? (
          <ul className="space-y-2">{todayItems.map((w) => <Row key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} onEdit={() => startEdit(w)} />)}</ul>
        ) : <EmptyState>Rien d’enregistré aujourd’hui.</EmptyState>}
      </Card>

      <CardioTrend />

      <Card title="Historique">
        {historyItems.length ? (
          <ul className="space-y-2">{historyItems.map((w) => <Row key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} onEdit={() => startEdit(w)} showDate />)}</ul>
        ) : <EmptyState>Aucun cardio enregistré pour l’instant.</EmptyState>}
      </Card>

      <ScheduleEventModal open={scheduleModal} onClose={() => setScheduleModal(false)} title="Programmer une séance cardio" defaultSummary="Cardio" onScheduled={() => {}} />
    </div>
  );
}

function Row({ w, onDelete, onEdit, showDate }) {
  const c = w.cardio || {};
  const zone = c.zone || (String(w.sessionType || '').startsWith('zone') ? w.sessionType.slice(4) : null);
  const details = [
    showDate && new Date(w.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    `${w.durationMin} min`,
    zone && `Zone ${zone}`,
    c.distance && `${c.distance} dist.`,
    c.avgHr && `${c.avgHr} bpm`,
    w.quality && `ressenti ${w.quality}/10`,
  ].filter(Boolean).join(' · ');
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5">
      <HeartPulse size={16} className="shrink-0 text-good" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink">{w.exercise || 'Cardio'}</div>
        <div className="text-[11px] text-mute">{details}</div>
      </div>
      <button onClick={onEdit} className="shrink-0 text-mute hover:text-accent cursor-pointer" title="Modifier"><Pencil size={14} /></button>
      <button onClick={onDelete} className="shrink-0 text-mute hover:text-bad cursor-pointer" title="Supprimer"><Trash2 size={14} /></button>
    </li>
  );
}
