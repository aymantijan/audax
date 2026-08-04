import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, WeekdayPicker } from './ui';
import { WEEKDAYS } from '../../utils/constants';
import {
  connectGoogleCalendar,
  createCalendarEvent,
  createRecurringCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarConfigured,
} from '../../services/google-calendar';
import { useGoogleCalendarStatus } from '../../hooks/useGoogleCalendarStatus';
import { toast } from '../../store/uiStore';

// Shared "Add to Google Calendar" modal — powers the Schedule action on deal
// tasks, Learning courses, habits, and workouts. `recurring` switches between
// a one-off event (task/workout) and an open-ended weekly series (course/habit),
// which the caller later stops via services/google-calendar.endRecurringEvent
// when the linked item is completed/archived.
//
// existingEventId (optional): editing an already-scheduled item instead of
// creating a new one. Submit tries to PATCH that event first; if it no longer
// exists — e.g. its calendar was deleted in Google Calendar directly, outside
// AUDAX — it transparently falls back to creating a fresh event instead of
// failing, and the caller still gets a valid {eventId, htmlLink} back either way.
export default function ScheduleEventModal({ open, onClose, title = 'Schedule', defaultSummary = '', description = '', recurring = false, existingEventId = null, existingEventLink = null, onScheduled, onUnschedule }) {
  const { connected } = useGoogleCalendarStatus();
  const configured = isGoogleCalendarConfigured();
  const isEdit = !!existingEventId;
  const [summary, setSummary] = useState(defaultSummary);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState(60);
  const [weekdays, setWeekdays] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) {
      setSummary(defaultSummary);
      setDate(new Date().toISOString().slice(0, 10));
      setTime('09:00');
      setDurationMin(60);
      setWeekdays([]);
      setErr(null);
    }
  }, [open, defaultSummary]);

  const submit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) return;
    if (recurring && !weekdays.length) {
      setErr('Pick at least one day.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (!connected) await connectGoogleCalendar();
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + durationMin * 60000);
      const eventData = { summary, description, start, end, ...(recurring ? { weekdays } : {}) };

      let result;
      if (isEdit) {
        try {
          result = await updateCalendarEvent(existingEventId, eventData);
        } catch (updateErr) {
          if (!updateErr.notFound) throw updateErr;
          // The original event (or its whole calendar) is gone — recreate rather than fail.
          result = recurring ? await createRecurringCalendarEvent(eventData) : await createCalendarEvent(eventData);
        }
      } else {
        result = recurring ? await createRecurringCalendarEvent(eventData) : await createCalendarEvent(eventData);
      }

      toast(isEdit ? 'Schedule updated' : 'Added to Google Calendar', 'success');
      onScheduled(result);
      onClose();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const unschedule = async () => {
    if (!confirm('Remove this from Google Calendar?')) return;
    setBusy(true);
    try {
      await deleteCalendarEvent(existingEventId);
      onUnschedule();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit: ${title}` : title}>
      <form onSubmit={submit} className="space-y-3">
        {!configured ? (
          <p className="text-sm text-mute">
            Google Calendar isn't configured yet — set <code className="text-ink">VITE_GOOGLE_CLIENT_ID</code> (see .env.example) to enable scheduling.
          </p>
        ) : (
          <>
            {isEdit && existingEventLink && (
              <a href={existingEventLink} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Open current event in Google Calendar ↗</a>
            )}
            <Field label="Event title">
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus />
            </Field>
            {recurring && (
              <Field label="Repeats on" hint="Weekly, until this is marked complete/archived in AUDAX — then future occurrences stop automatically.">
                <WeekdayPicker value={weekdays} onChange={setWeekdays} options={WEEKDAYS} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={recurring ? 'Starting' : 'Date'}>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Time">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <Field label="Duration (minutes)">
              <Input type="number" min="5" step="5" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
            </Field>
            {!connected && <p className="text-xs text-mute">You'll be asked to connect Google Calendar.</p>}
            {err && <p className="text-bad text-sm">{err}</p>}
          </>
        )}
        <div className="flex justify-between gap-3">
          <div>
            {isEdit && configured && (
              <Button type="button" variant="danger" onClick={unschedule} disabled={busy}>Remove</Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !configured}>
              {busy ? '…' : isEdit ? 'Save changes' : connected ? 'Schedule' : 'Connect & Schedule'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
