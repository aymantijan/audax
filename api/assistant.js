// VAUDAX's single AI assistant (étape 4): one conversation that can read the
// sections the person allows (Études, Santé, Patrimoine, Carrière,
// Aujourd'hui) as a structured summary built in the browser
// (src/utils/assistant-context.js). Streams the answer as plain text.
import { isGeminiConfigured } from './_lib/gemini.js';
import { aiStream, keyError } from './_lib/llm.js';
import { guardAiRequest } from './_lib/ai-guard.js';
import { ACTIONS_PROMPT } from '../src/utils/assistant-actions.js';

const SYSTEM = [
  'Tu es l’assistant de VAUDAX, une application où une personne suit ses études, sa santé, son argent, sa carrière et ses habitudes.',
  'Réponds dans la langue de la question (français par défaut), en tutoyant, avec des phrases simples et sans jargon non expliqué.',
  'Appuie-toi uniquement sur les données JSON fournies : n’invente jamais un chiffre, une note, un montant ou un événement. S’il manque une donnée, dis-le et dis où la saisir dans l’application.',
  'Relie les domaines quand c’est utile (sommeil et concentration, assiduité et note de contrôle continu, dépenses et objectifs d’épargne).',
  'Santé : jamais de diagnostic ; pour tout signe inquiétant, conseille un professionnel.',
  'Argent et trading : pas de recommandation d’achat ou de vente ni de conseil d’investissement personnalisé ; tu parles de méthode, de budget et de discipline.',
  'Tu proposes, la personne décide : rien n’est fait à sa place ; tu peux préparer des actions qu’elle valide une par une.',
  'Réponse complète et utile, en général 3 à 8 phrases ou une courte liste ; termine toujours ta pensée.',
  ACTIONS_PROMPT,
].join(' ');

const MAX_QUESTION = 1200;
const MAX_CONTEXT = 16000;

export default async function handler(req, res) {
  const guard = await guardAiRequest(req, res, { isConfigured: isGeminiConfigured });
  if (!guard) return;

  const { question, context, history, facts } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Missing question' });

  const today = new Date().toISOString().slice(0, 10);
  const preamble = [
    `Date du jour : ${today}.`,
    Array.isArray(facts) && facts.length ? `À retenir sur moi (écrit par moi) : ${facts.slice(0, 20).map((f) => String(f).slice(0, 200)).join(' · ')}` : '',
    `Mes données (JSON) : ${JSON.stringify(context || {}).slice(0, MAX_CONTEXT)}`,
  ].filter(Boolean).join('\n');

  const turns = (Array.isArray(history) ? history : []).slice(-8).map((t) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(t.text || '').slice(0, 2000) }],
  }));
  const contents = [
    { role: 'user', parts: [{ text: preamble }] },
    { role: 'model', parts: [{ text: 'Compris, je m’appuie sur ces données.' }] },
    ...turns,
    { role: 'user', parts: [{ text: question.trim().slice(0, MAX_QUESTION) }] },
  ];

  let started = false;
  try {
    const { model } = await aiStream({ system: SYSTEM, contents, maxTokens: 2000 }, (delta) => {
      if (!started) {
        started = true;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Quota-Used', String(guard.quota.used ?? ''));
        res.setHeader('X-Quota-Limit', String(guard.quota.limit));
      }
      res.write(delta);
    }, { userKey: guard.userKey });
    if (!started) return res.status(502).json({ error: 'empty' });
    console.log('[assistant] ok', model);
    res.end();
  } catch (e) {
    if (started) return res.end();
    return res.status(e?.status === 429 ? 429 : 502).json({ error: keyError(e, guard.userKey) });
  }
}
