import { supabase, isSupabaseConfigured } from './supabase';

// Web Push subscription flow. The service worker is registered by
// vite-plugin-pwa (see PwaUpdatePrompt.jsx / main.jsx) — this module only
// handles the Push-specific part: requesting permission, subscribing via
// PushManager, and telling the server (api/push-subscribe.js) about it.
// NOT wired to any automatic "you haven't logged today" sender yet — see
// api/push-send-test.js's comment for why that's a deliberate follow-up.

async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Requests OS notification permission (if not already granted/denied), then
// subscribes this browser to Push and registers the subscription server-side.
// Throws with a readable message on any failure step so the caller can toast it.
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('Ce navigateur ne gère pas les notifications.');
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Les notifications ne sont pas disponibles sur cette version.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation refusée : active les notifications pour VAUDAX dans les réglages du téléphone ou du navigateur.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
  }

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Impossible d’enregistrer cet appareil (${res.status}).`);
  }
  return sub;
}

export async function unsubscribeFromPush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch('/api/push-subscribe', { method: 'DELETE', headers: await authHeaders(), body: JSON.stringify({ endpoint }) }).catch(() => {});
}

export async function sendTestPush() {
  const res = await fetch('/api/push-send-test', { method: 'POST', headers: await authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Échec du test (${res.status}).`);
  return body;
}
