import { aiRequestHeaders } from './ai-headers';

// Calls the /api/trading-coach Vercel serverless function (see api/trading-coach.js) —
// the real OpenRouter key never reaches this file or the browser. Throws on any
// failure (missing deployment, no key configured, rate limit, offline dev server
// without `vercel dev`) so callers can fall back to the local rule-based coach.
async function callTradingCoach(mode, context, question) {
  const headers = await aiRequestHeaders();
  const res = await fetch('/api/trading-coach', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode, context, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[trading-coach-ai] request failed', res.status, body.error, body.detail || '');
    throw new Error(`trading-coach ${res.status}: ${body.error || ''}`);
  }
  const data = await res.json();
  if (!data.text) throw new Error('trading-coach empty response');
  return data.text;
}

export const getAITradingRecommendation = (context) => callTradingCoach('daily', context);
export const getAITradingWeeklyNarrative = (context) => callTradingCoach('digest', context);
export const askAITradingQuestion = (context, question) => callTradingCoach('ask', context, question);
