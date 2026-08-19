// Vercel Cron job (see vercel.json's `crons` entry) — Tier 2 of the
// notification scheduler, "app closed" best-effort backstop. Tier 1
// (src/hooks/useHealthReminders.js) is the reliable channel: it runs in the
// browser every minute while AUDAX is open and needs no server access at
// all. This endpoint exists for when the tab isn't open, which Tier 1
// structurally cannot cover.
//
// Unlike every other endpoint in api/ (health-coach.js, push-subscribe.js,
// push-send-test.js), this one has NO single calling user — it has to
// evaluate every user's reminder preferences in one pass, so it's the one
// place in this codebase that reads Supabase with a SERVICE-ROLE key
// (SUPABASE_SERVICE_ROLE_KEY) instead of a caller's own JWT. That key must
// only ever be set as a server-side Vercel env var, never a VITE_ one.
//
// ⚠️ Real limitation: Vercel Cron Jobs run at most once/day on the Hobby
// (free) plan — the */15-minute schedule below is only honored on a paid
// plan. On Hobby this degrades to one daily pass, which will only catch
// whichever reminder happens to be due at that single moment — Tier 1
// remains the realistic primary channel until/unless the Vercel plan changes.
//
// Protected by Vercel's own automatic Cron auth: Vercel calls this with
// `Authorization: Bearer $CRON_SECRET` when a CRON_SECRET env var is set —
// checked below so this can't be hit by a random request to burn push quota.
import webpush from 'web-push';

const WINDOW_MIN = 15; // matches the cron cadence — a reminder due within this window of "now" fires

function nowInTimezone(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    return h * 60 + m;
  } catch {
    return null; // unknown/invalid timezone — skip this user rather than guess
  }
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: 'Cloud sync is not configured on this deployment.' });
  if (!vapidPublicKey || !vapidPrivateKey) return res.status(503).json({ error: 'Push notifications are not configured on this deployment.' });

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const healthRowsRes = await fetch(`${supabaseUrl}/rest/v1/app_state?store_name=eq.health&select=user_id,data`, { headers });
  if (!healthRowsRes.ok) {
    console.error('[reminders-cron] failed to read app_state', healthRowsRes.status, await healthRowsRes.text());
    return res.status(502).json({ error: 'Failed to read health state.' });
  }
  const healthRows = await healthRowsRes.json();

  const dueUserIds = [];
  const dueMessages = {};
  for (const row of healthRows) {
    const prefs = row.data?.healthProfile?.reminderPrefs;
    if (!prefs?.timezone) continue;
    const nowMin = nowInTimezone(prefs.timezone);
    if (nowMin == null) continue;

    const due = [];
    for (const time of prefs.mealWindows || []) {
      const target = toMinutes(time);
      if (target != null && Math.abs(nowMin - target) <= WINDOW_MIN) due.push(`repas (${time})`);
    }
    if (prefs.bedtimeTarget) {
      const target = toMinutes(prefs.bedtimeTarget);
      if (target != null && Math.abs(nowMin - target) <= WINDOW_MIN) due.push(`coucher (${prefs.bedtimeTarget})`);
    }
    if (prefs.weighInTime) {
      const target = toMinutes(prefs.weighInTime);
      if (target != null && Math.abs(nowMin - target) <= WINDOW_MIN) due.push(`pesée (${prefs.weighInTime})`);
    }
    if (due.length) {
      dueUserIds.push(row.user_id);
      dueMessages[row.user_id] = due.join(' · ');
    }
  }

  if (!dueUserIds.length) return res.status(200).json({ ok: true, checked: healthRows.length, sent: 0 });

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=in.(${dueUserIds.join(',')})&select=user_id,endpoint,p256dh,auth`, { headers });
  if (!subsRes.ok) {
    console.error('[reminders-cron] failed to read push_subscriptions', subsRes.status, await subsRes.text());
    return res.status(502).json({ error: 'Failed to read push subscriptions.' });
  }
  const subs = await subsRes.json();

  webpush.setVapidDetails('mailto:audax-app@example.com', vapidPublicKey, vapidPrivateKey);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: 'AUDAX', body: dueMessages[s.user_id] })
      )
    )
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  if (failed) console.error('[reminders-cron] some sends failed', results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message));

  return res.status(200).json({ ok: true, checked: healthRows.length, dueUsers: dueUserIds.length, sent, failed });
}
