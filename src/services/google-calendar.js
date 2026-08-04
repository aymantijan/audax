// Google Calendar integration, client-only (Google Identity Services token
// client — see .env.example for setup). No backend involved: this keeps
// VITE_GOOGLE_CLIENT_ID public-safe (a public identifier, not a secret) and
// needs no server, consistent with AUDAX's local-first architecture.
// Trade-off: the access token is short-lived (~1h) and lives only in
// sessionStorage — no silent refresh without a backend, so re-connecting
// occasionally is expected and normal.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TOKEN_KEY = 'audax-google-calendar-token';
const WEEKDAY_RRULE = { mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU' };

let tokenClient = null;
let gisLoadPromise = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

// Subscribe to connect/disconnect changes — powers useGoogleCalendarStatus().
export function subscribeGoogleCalendar(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loadGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function readToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t.accessToken || t.expiresAt <= Date.now()) return null;
    return t;
  } catch {
    return null;
  }
}

function writeToken(accessToken, expiresInSec) {
  // Shave 60s off the real expiry so we never hand out a token that dies mid-request.
  const t = { accessToken, expiresAt: Date.now() + expiresInSec * 1000 - 60000 };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  notify();
  return t;
}

export function isGoogleCalendarConfigured() {
  return !!CLIENT_ID;
}

export function isGoogleCalendarConnected() {
  return !!readToken();
}

export function getGoogleCalendarStatus() {
  const t = readToken();
  return { connected: !!t, expiresAt: t?.expiresAt || null };
}

// Opens the Google consent popup (skips the "choose account/consent" screen
// on repeat calls once the user has granted access once this session).
export async function connectGoogleCalendar() {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set — see .env.example.');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        resolve(writeToken(resp.access_token, resp.expires_in));
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function disconnectGoogleCalendar() {
  const t = readToken();
  sessionStorage.removeItem(TOKEN_KEY);
  if (t?.accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(t.accessToken, () => {});
  }
  notify();
}

// Requires an existing valid token — never triggers the OAuth popup itself.
// User-initiated flows (ScheduleEventModal) call connectGoogleCalendar()
// explicitly first; this guards the request-building code that follows.
async function apiFetch(path, options = {}) {
  const t = readToken();
  if (!t) throw new Error('Google Calendar is not connected.');
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${t.accessToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Google Calendar request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// One-off event. start/end: Date objects.
export async function createCalendarEvent({ summary, description, start, end }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const event = await apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
    }),
  });
  return { eventId: event.id, htmlLink: event.htmlLink };
}

// Open-ended weekly recurring event — stopped later via endRecurringEvent().
export async function createRecurringCalendarEvent({ summary, description, start, end, weekdays }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const byday = weekdays.map((w) => WEEKDAY_RRULE[w]).filter(Boolean).join(',');
  const event = await apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byday}`],
    }),
  });
  return { eventId: event.id, htmlLink: event.htmlLink };
}

// Stops future occurrences of a recurring event as of today (past occurrences
// stay on the calendar as history) — called when the linked course/habit is
// completed or archived. Best-effort: silently no-ops if not connected, and
// swallows API errors, since this always runs as a side effect of an in-app
// action the user already completed — it should never block or surface as a
// failure of that action.
export async function endRecurringEvent(eventId) {
  if (!eventId || !isGoogleCalendarConnected()) return;
  try {
    const until = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const event = await apiFetch(`/calendars/primary/events/${eventId}`);
    const rrule = (event.recurrence || []).find((r) => r.startsWith('RRULE'));
    if (!rrule) return;
    const nextRule = /UNTIL=/.test(rrule) ? rrule.replace(/UNTIL=[^;]+/, `UNTIL=${until}`) : `${rrule};UNTIL=${until}`;
    await apiFetch(`/calendars/primary/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ recurrence: [nextRule] }) });
  } catch (e) {
    console.warn('[google-calendar] failed to end recurring event:', e.message);
  }
}

// Best-effort delete — same silent-no-op/swallow rationale as endRecurringEvent.
export async function deleteCalendarEvent(eventId) {
  if (!eventId || !isGoogleCalendarConnected()) return;
  try {
    await apiFetch(`/calendars/primary/events/${eventId}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('[google-calendar] failed to delete event:', e.message);
  }
}
