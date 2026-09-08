import { useState, useMemo } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, ChevronLeft, ChevronRight, AlertTriangle, Play, SkipForward } from 'lucide-react';
import { Card, Button, Badge, EmptyState } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import SessionLogger from './SessionLogger';
import OverrideModal from './OverrideModal';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TYPE_EMOJI = { strength: '🏋️', cardio: '🫀', sport: '⚽', mobility: '🧘', recovery: '💆' };

function formatDate(str) {
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isToday(str) {
  return str === new Date().toISOString().slice(0, 10);
}

export default function DailyView() {
  const store = useProgramStore();
  const { activeProgram, locations } = store;

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const goDay = (offset) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Logging modal state
  const [loggingEvent, setLoggingEvent] = useState(null);
  // Override modal state
  const [overrideEvent, setOverrideEvent] = useState(null);

  // Get schedule for selected date
  const schedule = useMemo(
    () => store.getScheduleForDate(selectedDate),
    [selectedDate, store.overridesByDate, store.sessionLogsByDate, store.weeklyByPhase, store.sessionsByPhase, store.phases]
  );

  if (!activeProgram) {
    return (
      <EmptyState>
        Activez un programme pour voir la vue quotidienne.
      </EmptyState>
    );
  }

  const locationName = (id) => locations.find((l) => l.id === id)?.name || '';

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => goDay(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <button
          onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          className={`text-center cursor-pointer ${isToday(selectedDate) ? 'text-accent font-bold' : 'text-ink'}`}
        >
          <div className="text-sm font-semibold capitalize">{formatDate(selectedDate)}</div>
          {isToday(selectedDate) && <div className="text-[10px] text-accent">Aujourd'hui</div>}
        </button>
        <Button variant="ghost" onClick={() => goDay(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Scheduled sessions */}
      {schedule.length === 0 ? (
        <Card>
          <div className="text-center py-6 text-mute">
            <Calendar size={24} className="mx-auto mb-2" />
            <div className="text-sm">Jour de repos ou hors programme</div>
          </div>
        </Card>
      ) : (
        schedule.map((evt, i) => {
          const { session, planned_time, location_id, override, logged, cancelled, moved, phase } = evt;
          const done = logged?.status === 'completed';
          const partial = logged?.status === 'partial';
          const skipped = logged?.status === 'skipped';

          return (
            <Card
              key={`${session.id}-${i}`}
              className={`transition-all ${
                cancelled ? 'opacity-50 border-bad/30' :
                done ? 'border-good/30 bg-good/5' :
                moved ? 'border-warning/30 bg-warning/5' :
                ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: session info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{TYPE_EMOJI[session.type] || '📋'}</span>
                    <span className="font-semibold">{session.label}</span>
                    <Badge color={session.type === 'strength' ? 'var(--accent-primary)' : session.type === 'cardio' ? 'var(--success)' : 'var(--warning)'}>
                      {session.type}
                    </Badge>
                    {cancelled && <Badge color="var(--danger)">Annulé</Badge>}
                    {moved && <Badge color="var(--warning)">Déplacé → {override?.new_date}</Badge>}
                    {done && <Badge color="var(--success)">✓ Fait</Badge>}
                    {partial && <Badge color="var(--warning)">Partiel</Badge>}
                    {skipped && <Badge color="var(--text-mute)">Passé</Badge>}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-mute flex-wrap">
                    {planned_time && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {planned_time}
                      </span>
                    )}
                    {session.estimated_duration_min && (
                      <span>{session.estimated_duration_min} min</span>
                    )}
                    {location_id && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {locationName(location_id)}
                      </span>
                    )}
                    {phase && <span>Phase: {phase.name}</span>}
                  </div>

                  {/* Override reason */}
                  {override && override.reason_note && (
                    <div className="text-xs text-warning mt-1 flex items-center gap-1">
                      <AlertTriangle size={11} /> {override.reason_note}
                    </div>
                  )}

                  {/* Log summary */}
                  {logged && (
                    <div className="text-xs text-mute mt-2 border-t border-line pt-2">
                      {logged.actual_start && (
                        <span>Début: {new Date(logged.actual_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {logged.duration_min && <span> · {logged.duration_min} min</span>}
                      {logged.session_rpe && <span> · RPE {logged.session_rpe}</span>}
                      {logged.exercises_performed?.length > 0 && (
                        <span> · {logged.exercises_performed.length} exercice(s)</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  {!cancelled && !done && !skipped && (
                    <>
                      <Button
                        onClick={() => setLoggingEvent(evt)}
                        className="!py-1.5 !px-3 text-xs"
                      >
                        <span className="flex items-center gap-1"><Play size={12} /> Logger</span>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setOverrideEvent(evt)}
                        className="!py-1 !px-2 text-[10px]"
                      >
                        Modifier
                      </Button>
                    </>
                  )}
                  {done && (
                    <Button
                      variant="ghost"
                      onClick={() => setLoggingEvent(evt)}
                      className="!py-1 !px-2 text-[10px]"
                    >
                      Voir / éditer
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}

      {/* Session Logger modal */}
      {loggingEvent && (
        <SessionLogger
          event={loggingEvent}
          date={selectedDate}
          onClose={() => setLoggingEvent(null)}
        />
      )}

      {/* Override modal */}
      {overrideEvent && (
        <OverrideModal
          event={overrideEvent}
          date={selectedDate}
          onClose={() => setOverrideEvent(null)}
        />
      )}
    </div>
  );
}
