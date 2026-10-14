import { useState, useMemo, useEffect } from 'react';
import { Clock, MapPin, ChevronLeft, ChevronRight, AlertTriangle, Play, Timer, CheckCircle2, Pencil, Moon, RotateCcw } from 'lucide-react';
import { Button, Badge, Modal } from '../../../components/common/ui';
import { useHealthStore } from '../../../store/healthStore';
import { toast } from '../../../store/uiStore';
import { useProgramStore } from '../../../store/programStore';
import { getCardioConfig } from '../../../utils/exercise-library';
import { typeMeta, tint, TypeBadge } from './shared/design';
import SessionLogger from './SessionLogger';
import OverrideModal from './OverrideModal';

import Term from '../../../components/common/Term';
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDate = (str) => new Date(str + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function DailyView() {
  const store = useProgramStore();
  const { activeProgram, locations } = store;
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [loggingEvent, setLoggingEvent] = useState(null);
  const [overrideEvent, setOverrideEvent] = useState(null);
  const [resetting, setResetting] = useState(null); // event whose status is being cleared
  const [busy, setBusy] = useState(false);

  // Going back weeks: load that week's statuses so a past session shows the truth.
  useEffect(() => {
    if (activeProgram) store.ensureWeekLoaded(activeProgram.id, selectedDate);
  }, [activeProgram?.id, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // « Rien n'est définitif »: a cancelled or moved session can be put back,
  // and a logged one (done, partial, skipped) can go back to « à faire ».
  const restore = async (evt) => {
    setBusy(true);
    try {
      await store.undoOverride(activeProgram.id, evt.override);
      toast(`${evt.session.label} : remise comme prévu.`, 'success');
    } catch (err) {
      toast(`Impossible pour l’instant : ${err.message}`, 'error');
    } finally { setBusy(false); }
  };
  const clearStatus = async () => {
    const evt = resetting;
    setBusy(true);
    try {
      await store.removeSessionLog(evt.logged.id, selectedDate);
      useHealthStore.getState().deleteSession(evt.logged.id); // its copy in the workout history
      toast(`${evt.session.label} : de nouveau « à faire ».`, 'success');
      setResetting(null);
    } catch (err) {
      toast(`Impossible pour l’instant : ${err.message}`, 'error');
    } finally { setBusy(false); }
  };

  const goDay = (offset) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const schedule = useMemo(
    () => store.getScheduleForDate(selectedDate),
    [selectedDate, store.overridesByDate, store.sessionLogsByDate, store.weeklyByPhase, store.sessionsByPhase, store.phases]
  );

  if (!activeProgram) return null;
  const isToday = selectedDate === localToday();
  const locationName = (id) => locations.find((l) => l.id === id)?.name || '';
  const doneCount = schedule.filter((e) => e.logged?.status === 'completed').length;

  return (
    <div className="rounded-2xl border border-line bg-card">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <button onClick={() => goDay(-1)} className="rounded-lg p-2 text-mute hover:bg-surface hover:text-ink cursor-pointer" aria-label="Jour précédent"><ChevronLeft size={18} /></button>
        <button onClick={() => setSelectedDate(localToday())} className="text-center cursor-pointer">
          <div className={`text-sm font-semibold capitalize ${isToday ? 'text-accent' : 'text-ink'}`}>{formatDate(selectedDate)}</div>
          <div className="text-xs text-mute">
            {isToday ? 'Aujourd’hui' : 'Revenir à aujourd’hui'}
            {schedule.length > 0 && ` · ${doneCount}/${schedule.length} fait(es)`}
          </div>
        </button>
        <button onClick={() => goDay(1)} className="rounded-lg p-2 text-mute hover:bg-surface hover:text-ink cursor-pointer" aria-label="Jour suivant"><ChevronRight size={18} /></button>
      </div>

      <div className="p-4">
        {schedule.length === 0 ? (
          <div className="py-10 text-center text-mute">
            <Moon size={26} className="mx-auto mb-2" />
            <div className="text-sm">Jour de repos ou hors programme</div>
          </div>
        ) : (
          <ol className="relative space-y-3">
            {schedule.map((evt, i) => {
              const { session, planned_time, duration_min, location_id, override, logged, cancelled, moved } = evt;
              const m = typeMeta(session.type);
              const done = logged?.status === 'completed';
              const partial = logged?.status === 'partial';
              const skipped = logged?.status === 'skipped';
              const cardio = session.type === 'cardio' ? getCardioConfig(session) : null;
              const exCount = store.getExercisesForSession(session.id).length;

              return (
                <li key={`${session.id}-${i}`} className="flex gap-3">
                  {/* Time rail */}
                  <div className="w-12 shrink-0 pt-3 text-right">
                    <div className="text-sm font-semibold tabular-nums text-ink">{planned_time ? planned_time.slice(0, 5) : '—'}</div>
                  </div>

                  <div
                    className={`min-w-0 flex-1 rounded-xl border p-3.5 transition-colors ${cancelled ? 'opacity-50' : ''}`}
                    style={{
                      borderColor: done ? 'color-mix(in srgb, var(--success) 45%, transparent)' : 'var(--border)',
                      background: done ? tint('var(--success)', 7) : 'var(--bg-secondary)',
                      borderLeft: `3px solid ${m.color}`,
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{session.label}</span>
                          <TypeBadge type={session.type} />
                          {cancelled && <Badge color="var(--error)">Annulée</Badge>}
                          {moved && <Badge color="var(--warning)">Déplacée → {override?.new_date}</Badge>}
                          {done && <Badge color="var(--success)">✓ Faite</Badge>}
                          {partial && <Badge color="var(--warning)">Partielle</Badge>}
                          {skipped && <Badge color="var(--text-secondary)">Passée</Badge>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
                          {duration_min && <span className="flex items-center gap-1"><Timer size={12} /> {duration_min} min</span>}
                          {location_id && <span className="flex items-center gap-1"><MapPin size={12} /> {locationName(location_id)}</span>}
                          {cardio?.modality && <span style={{ color: m.color }}>{cardio.modality.name} · Zone {cardio.zone}</span>}
                          {!cardio && exCount > 0 && <span>{exCount} exercice(s)</span>}
                        </div>
                        {override?.reason_note && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-warning"><AlertTriangle size={12} /> {override.reason_note}</div>
                        )}
                        {logged && (
                          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-mute">
                            {logged.actual_start && <span className="flex items-center gap-1"><Clock size={12} /> {new Date(logged.actual_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                            {logged.duration_min && <span>{logged.duration_min} min réalisées</span>}
                            {logged.session_rpe && <span><Term id="rpe" short /> {logged.session_rpe}</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {!cancelled && !done && !skipped && (
                          <>
                            <Button variant="ghost" onClick={() => setOverrideEvent(evt)} className="!px-2.5 !py-1.5 text-xs">Modifier</Button>
                            <Button onClick={() => setLoggingEvent(evt)} className="!px-3 !py-1.5 text-xs">
                              <span className="flex items-center gap-1"><Play size={12} /> Logger</span>
                            </Button>
                          </>
                        )}
                        {(done || partial || skipped) && !cancelled && (
                          <>
                            <Button variant="secondary" onClick={() => setLoggingEvent(evt)} className="!px-2.5 !py-1.5 text-xs">
                              <span className="flex items-center gap-1">{done ? <CheckCircle2 size={12} className="text-good" /> : <Pencil size={12} />} {done ? 'Voir / modifier' : 'Modifier'}</span>
                            </Button>
                            <Button variant="ghost" onClick={() => setResetting(evt)} className="!px-2.5 !py-1.5 text-xs">Annuler le statut</Button>
                          </>
                        )}
                        {(cancelled || moved) && override && (
                          <Button variant="secondary" disabled={busy} onClick={() => restore(evt)} className="!px-2.5 !py-1.5 text-xs">
                            <span className="flex items-center gap-1"><RotateCcw size={12} /> Rétablir</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {loggingEvent && <SessionLogger event={loggingEvent} date={selectedDate} onClose={() => setLoggingEvent(null)} />}
      {overrideEvent && <OverrideModal event={overrideEvent} date={selectedDate} onClose={() => setOverrideEvent(null)} />}
      <Modal open={!!resetting} onClose={() => setResetting(null)} title="Remettre « à faire » ?">
        <p className="text-sm text-mute">« {resetting?.session.label} » redevient une séance à faire. Ce que tu avais noté pour cette séance (séries, durée, ressenti) sera effacé.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setResetting(null)}>Garder</Button>
          <Button variant="danger" disabled={busy} onClick={clearStatus}>Remettre à faire</Button>
        </div>
      </Modal>
    </div>
  );
}
