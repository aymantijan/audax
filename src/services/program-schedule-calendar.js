// ─────────────────────────────────────────────────────────────────────────────
// Orchestrates pushing a generated program schedule (program-schedule-
// generator.js output) to Google Calendar as recurring weekly events — one
// event per (day, blockType) since content differs per weekday (Monday's
// training is "PUSH 1", Tuesday's is "PULL 1", so they can't share one
// multi-weekday recurring event the way a generic "Cardio" block sometimes
// could). Deliberately store-agnostic (only calls google-calendar.js) — the
// caller (ProgramOnboarding.jsx) is responsible for persisting results via
// healthStore.saveProgramSchedule, incrementally via onProgress, so an
// expired token mid-push never loses already-created events from app state.
// ─────────────────────────────────────────────────────────────────────────────
import { connectGoogleCalendar, isGoogleCalendarConnected, createRecurringCalendarEvent } from './google-calendar';

const FR_TO_EN_DAY = { lundi: 'mon', mardi: 'tue', mercredi: 'wed', jeudi: 'thu', vendredi: 'fri', samedi: 'sat', dimanche: 'sun' };
const FR_DAY_INDEX = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };

// Next real calendar Date for `dayKey` at `HH:MM` — used as the RRULE's
// anchor occurrence (Google Calendar recurs weekly from there onward).
function nextOccurrence(dayKey, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const targetDow = FR_DAY_INDEX[dayKey];
  const now = new Date();
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  let diff = (targetDow - now.getDay() + 7) % 7;
  if (diff === 0 && d <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Pushes every placed/shrunk cardio+training block to Google Calendar.
// `onProgress(result)` fires after each individual event (success or
// failure) — the caller should save state incrementally from this callback,
// not just once at the end.
export async function pushScheduleToCalendar(program, schedule, { onProgress } = {}) {
  if (!isGoogleCalendarConnected()) await connectGoogleCalendar();

  const results = [];
  for (const [dayKey, day] of Object.entries(schedule.days)) {
    for (const blockType of ['cardio', 'training']) {
      const block = day[blockType];
      if (!block || block.status === 'skipped') continue;

      const summary = blockType === 'training' ? (program.sessions[block.sessionKey]?.label || 'Séance') : `Cardio — ${program.name}`;
      const description = blockType === 'training' ? `Programme : ${program.name}` : `Cardio Zone 2 — ${program.name}`;

      let result;
      try {
        const start = nextOccurrence(dayKey, block.start);
        const end = nextOccurrence(dayKey, block.end);
        const { eventId, htmlLink } = await createRecurringCalendarEvent({ summary, description, start, end, weekdays: [FR_TO_EN_DAY[dayKey]] });
        result = { day: dayKey, blockType, eventId, htmlLink, status: 'ok' };
      } catch (err) {
        result = { day: dayKey, blockType, status: 'error', error: err.message };
      }
      results.push(result);
      onProgress?.(result);
    }
  }
  return results;
}
