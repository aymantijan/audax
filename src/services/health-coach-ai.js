import { supabase, isSupabaseConfigured } from './supabase';

// Calls the /api/health-coach Vercel serverless function (see api/health-coach.js) —
// the real OpenRouter key never reaches this file or the browser. Throws on any
// failure (missing deployment, no key configured, rate limit, offline dev server
// without `vercel dev`) so callers can fall back to the local rule-based coach.
async function callHealthCoach(mode, context, question) {
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/health-coach', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode, context, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[health-coach-ai] request failed', res.status, body.error, body.detail || '');
    throw new Error(`health-coach ${res.status}: ${body.error || ''}`);
  }
  const data = await res.json();
  if (!data.text) throw new Error('health-coach empty response');
  return data.text;
}

export const getAIDailyRecommendation = (context) => callHealthCoach('daily', context);
export const getAIWeeklyNarrative = (context) => callHealthCoach('digest', context);
export const askAIHealthQuestion = (context, question) => callHealthCoach('ask', context, question);
