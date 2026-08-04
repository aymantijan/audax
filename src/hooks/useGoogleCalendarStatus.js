import { useEffect, useState } from 'react';
import { getGoogleCalendarStatus, subscribeGoogleCalendar } from '../services/google-calendar';

// Reactive wrapper around the module-level token in services/google-calendar —
// that token lives in sessionStorage/memory (not a zustand store), so this
// hook is what makes Settings/ScheduleEventModal re-render on connect/disconnect.
export function useGoogleCalendarStatus() {
  const [status, setStatus] = useState(getGoogleCalendarStatus());
  useEffect(() => subscribeGoogleCalendar(() => setStatus(getGoogleCalendarStatus())), []);
  return status;
}
