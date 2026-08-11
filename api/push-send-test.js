import webpush from 'web-push';

// Sends a single test push notification to every device the CALLING user has
// subscribed (not any other user — see push-subscribe.js's comment on why no
// service-role key is used: the Supabase read below carries the user's own
// JWT, so RLS only ever returns their own rows). Proves the whole pipeline
// (subscribe -> store -> server push -> OS notification) end to end, but is
// NOT the automatic "you haven't logged today" reminder system — that needs
// a scheduled job with broader (service-role) Supabase access to evaluate
// every user's conditions, which is a deliberate follow-up decision, not
// built here. See Settings.jsx's "Send me a test push" button.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[push-send-test] VAPID keys not set');
    return res.status(503).json({ error: 'Push notifications are not configured on this deployment.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ error: 'Cloud sync is not configured on this deployment.' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
  });
  if (!verifyRes.ok) return res.status(401).json({ error: 'Unauthorized' });

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
  });
  if (!subsRes.ok) {
    console.error('[push-send-test] fetch subscriptions failed', subsRes.status, await subsRes.text());
    return res.status(502).json({ error: 'Could not load your subscriptions.' });
  }
  const subs = await subsRes.json();
  if (!subs.length) return res.status(404).json({ error: 'No push subscription found — enable notifications first.' });

  webpush.setVapidDetails('mailto:audax-app@example.com', vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({ title: 'AUDAX', body: 'Push notifications are working — this is a test.' });
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload))
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  if (failed) console.error('[push-send-test] some sends failed', results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message));

  return res.status(200).json({ ok: true, sent, failed });
}
