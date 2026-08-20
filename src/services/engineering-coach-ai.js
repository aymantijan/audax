import { supabase, isSupabaseConfigured } from './supabase';

// Calls the /api/engineering-coach Vercel serverless function (see
// api/engineering-coach.js) — mirrors health-coach-ai.js exactly, just a
// different endpoint. Throws on any failure so the caller can show a
// graceful "not configured" message instead of crashing.
async function callEngineeringCoach(mode, context, question) {
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/engineering-coach', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode, context, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[engineering-coach-ai] request failed', res.status, body.error, body.detail || '');
    throw new Error(`engineering-coach ${res.status}: ${body.error || ''}`);
  }
  const data = await res.json();
  if (!data.text) throw new Error('engineering-coach empty response');
  return data.text;
}

export const askAIEngineeringQuestion = (context, question) => callEngineeringCoach('ask', context, question);
