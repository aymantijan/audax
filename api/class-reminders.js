// Class reminders by Web Push — works with AUDAX closed (the in-app hook
// src/hooks/useClassReminders.js only covers the app being open).
//
// Called every 5 minutes by Supabase pg_cron + pg_net (see
// supabase/migrations/005_class_reminders_cron.sql): Vercel's Hobby plan only
// allows daily crons, far too coarse for "your class starts in 20 min".
// Protected by CRON_SECRET like api/reminders-cron.js, and like it the one
// kind of endpoint that reads every user's row with the service-role key.
//
// Stateless and exactly-once without a log table: each reminder fires in the
// run whose 5-minute window (now − 5 min, now] contains its moment.
//   heads-up: class start − classReminderMin
//   nudge:    "on time" deadline − 5 min, only if not checked in yet
// Times are evaluated in the user's own timezone (academic.settings.timezone,
// written by the app), by comparing wall-clock values on both sides.
import webpush from 'web-push';
import { classesOn, arriveBy, withDefaults, fmtClock } from '../src/utils/attendance.js';

const WINDOW_MS = 5 * 60 * 1000;

// The user's wall clock as a Date in THIS process's zone, so it compares with
// attendance.js times (built from 'YYYY-MM-DDTHH:MM' in the local zone).
function wallClock(timezone, now = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now).map((x) => [x.type, x.value]));
    const hour = p.hour === '24' ? 0 : Number(p.hour);
    return { date: `${p.year}-${p.month}-${p.day}`, ms: new Date(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second)).getTime() };
  } catch {
    return null;
  }
}

/** Reminders due in the window ending at `nowMs` for one user's learning state. */
export function dueClassReminders(learning, timezone, now = new Date()) {
  const academic = learning?.academic;
  if (!academic || !Array.isArray(learning.courses)) return [];
  const settings = withDefaults(academic.settings);
  const lead = Number(settings.classReminderMin) || 0;
  if (!lead) return [];
  const wall = wallClock(timezone, now);
  if (!wall) return [];
  const inWindow = (t) => t > wall.ms - WINDOW_MS && t <= wall.ms;
  const out = [];
  for (const o of classesOn(learning.courses, { ...academic, settings }, wall.date)) {
    if (learning.attendance?.[o.key]) continue; // checked in, cancelled or excused
    const deadline = arriveBy(o, settings);
    const where = o.slot.room ? ` · ${o.slot.room}` : '';
    if (inWindow(o.startMs - lead * 60000)) out.push({ tag: `class-${o.key}`, body: `${o.course.name} à ${o.start}${where} — en salle avant ${fmtClock(deadline)}.` });
    else if (inWindow(deadline - 5 * 60000)) out.push({ tag: `class-${o.key}`, body: `Tu es en salle ? Pointe « En salle » pour ${o.course.name} avant ${fmtClock(deadline)}.` });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: 'Cloud sync is not configured on this deployment.' });
  if (!vapidPublicKey || !vapidPrivateKey) return res.status(503).json({ error: 'Push notifications are not configured on this deployment.' });
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  // Only users who can receive a push are worth evaluating.
  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth`, { headers });
  if (!subsRes.ok) return res.status(502).json({ error: 'Failed to read push subscriptions.' });
  const subs = await subsRes.json();
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  if (!userIds.length) return res.status(200).json({ ok: true, users: 0, sent: 0 });

  const rowsRes = await fetch(`${supabaseUrl}/rest/v1/app_state?store_name=eq.learning&user_id=in.(${userIds.join(',')})&select=user_id,data`, { headers });
  if (!rowsRes.ok) return res.status(502).json({ error: 'Failed to read learning state.' });
  const rows = await rowsRes.json();

  webpush.setVapidDetails('mailto:audax-app@example.com', vapidPublicKey, vapidPrivateKey);
  const jobs = [];
  for (const row of rows) {
    const tz = row.data?.academic?.settings?.timezone || 'Africa/Casablanca';
    const due = dueClassReminders(row.data, tz);
    for (const msg of due) {
      for (const s of subs.filter((x) => x.user_id === row.user_id)) {
        jobs.push(
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: 'AUDAX · Cours', url: '/today', ...msg }))
            .catch(async (err) => {
              // Subscription gone (app uninstalled / permission revoked): clean it up.
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers }).catch(() => {});
              }
              throw err;
            })
        );
      }
    }
  }
  const results = await Promise.allSettled(jobs);
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return res.status(200).json({ ok: true, users: rows.length, sent, failed: results.length - sent });
}
