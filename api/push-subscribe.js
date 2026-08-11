// Vercel serverless function — stores/removes a Web Push subscription for the
// calling user. Auth-gated the same way as api/health-coach.js: verifies the
// Supabase session token via /auth/v1/user first.
//
// Deliberately does NOT use a Supabase service-role key. Every Supabase REST
// call here carries the CALLER's OWN JWT as the Authorization header (with
// the anon key only as the `apikey` header, which Supabase requires
// regardless) — so Postgres RLS (see supabase/schema.sql's push_subscriptions
// policies) naturally scopes every read/write to that user's own rows. This
// endpoint can only ever touch the subscription of whoever is calling it.

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

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
  if (!verifyRes.ok) {
    console.error('[push-subscribe] token verify failed', verifyRes.status);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = await verifyRes.json();

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    const del = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${user.id}&endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` } }
    );
    if (!del.ok) {
      console.error('[push-subscribe] delete failed', del.status, await del.text());
      return res.status(502).json({ error: 'Failed to remove subscription.' });
    }
    return res.status(200).json({ ok: true });
  }

  const { subscription } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Invalid subscription payload' });

  const upsert = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=user_id,endpoint`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ user_id: user.id, endpoint, p256dh, auth }),
  });
  if (!upsert.ok) {
    console.error('[push-subscribe] upsert failed', upsert.status, await upsert.text());
    return res.status(502).json({ error: 'Failed to save subscription.' });
  }
  return res.status(200).json({ ok: true });
}
