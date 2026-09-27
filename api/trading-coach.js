// Trading coach — Gemini free tier via the shared coach factory (api/_lib/coach.js).
// Trading stays in English (user decision), so this coach answers in English.
import { makeCoachHandler } from './_lib/coach.js';

export default makeCoachHandler({
  name: 'trading-coach',
  dataLabel: 'My trading metrics',
  system:
    'You are a supportive, direct trading coach embedded in the VAUDAX trading journal. You receive the trader’s own aggregated metrics (win rate, expectancy, drawdown, discipline score, revenge/tilt counts, prop-firm rule progress) as JSON — never invent numbers not present in it. ' +
    'Never give buy/sell/entry signals or personalized financial advice: you coach PROCESS and DISCIPLINE, not market calls. Be specific to the numbers and interpret them. Answer in English unless the question is in another language.',
  modes: {
    daily: { instruction: 'Give one short (1-3 sentence) recommendation for today based on this data.', maxTokens: 200 },
    digest: { instruction: 'Write a short (3-5 sentence) summary of the trader’s week: what went well process-wise, what to watch.', maxTokens: 320 },
    ask: { maxTokens: 500 },
  },
});
