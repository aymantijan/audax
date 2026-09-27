// Section coaches (Trading, Santé, Ingénierie): same contract as before
// ({ mode, context, question } → { text, model }), now on Gemini's free tier
// with the shared auth + daily quota. The browser falls back to its local
// rule-based coach whenever this answers an error (e.g. no key configured).
import { geminiText, isGeminiConfigured } from './gemini.js';
import { guardAiRequest } from './ai-guard.js';

export function makeCoachHandler({ name, system, dataLabel, modes }) {
  return async function handler(req, res) {
    const guard = await guardAiRequest(req, res, { isConfigured: isGeminiConfigured });
    if (!guard) return;
    const { mode, context, question } = req.body || {};
    const m = modes[mode];
    if (!m) return res.status(400).json({ error: 'Invalid mode' });
    if (mode === 'ask' && !question?.trim()) return res.status(400).json({ error: 'Missing question' });
    const instruction = mode === 'ask'
      ? `${question.trim().slice(0, 600)}\n(Réponds dans la langue de la question, en 3 à 5 phrases complètes.)`
      : m.instruction;
    const contents = [
      { role: 'user', parts: [{ text: `${dataLabel} (JSON) : ${JSON.stringify(context || {}).slice(0, 6000)}` }] },
      { role: 'model', parts: [{ text: 'Compris.' }] },
      { role: 'user', parts: [{ text: instruction }] },
    ];
    try {
      const { text, model } = await geminiText({ system, contents, maxTokens: m.maxTokens });
      if (!text) return res.status(502).json({ error: 'Empty AI response' });
      return res.status(200).json({ text, model });
    } catch (e) {
      console.error(`[${name}] failed`, e?.status, e?.detail);
      return res.status(e?.status === 429 ? 429 : 502).json({ error: 'AI request failed' });
    }
  };
}
