// Reads a photo or PDF with Gemini (free tier) and returns data to REVIEW —
// nothing is saved here. One endpoint for every reader (Vercel Hobby allows
// 12 functions): body { kind, mimeType, data (base64) }.
//   kind 'timetable' → { text }: lines "Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type"
//   kind 'receipt'   → { amount, currency, date, merchant, category }
//   kind 'text'      → { draft } — body { kind, text, context }: one free sentence
//                      from the + button, as a draft checked again on the device
//                      (utils/quick-capture.js normalizeDraft). Nothing is saved.
import { isGeminiConfigured } from './_lib/gemini.js';
import { aiText, keyError } from './_lib/llm.js';
import { guardAiRequest } from './_lib/ai-guard.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const TIMETABLE = [
  'Tu extrais un emploi du temps hebdomadaire d’une image ou d’un PDF.',
  'Réponds UNIQUEMENT par des lignes au format exact : Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type',
  'Jour en toutes lettres en français (Lundi…Dimanche). Horaires au format 8h30-10h00. Type parmi Cours, TD, TP, Séminaire (Cours si inconnu).',
  'Laisse Enseignant et Salle vides s’ils ne figurent pas (garde les points-virgules). Un créneau par ligne ; une même matière peut avoir plusieurs lignes.',
  'N’invente rien : ignore ce qui est illisible. Aucun texte avant ou après les lignes, pas de puces, pas de Markdown.',
].join(' ');

const RECEIPT = [
  'Tu lis un ticket de caisse, un reçu ou une facture.',
  'Réponds par un objet JSON : {"amount": nombre total payé TTC, "currency": code ISO à 3 lettres ou null, "date": "AAAA-MM-JJ" ou null, "merchant": nom du commerce ou null, "category": une catégorie courte en français (alimentation, restaurant, transport, santé, logement, loisirs, vêtements, études, abonnements, autre)}.',
  'N’invente rien : null si une information est illisible. Le montant est le TOTAL final, pas un sous-total.',
].join(' ');

const CAPTURE = [
  'Tu ranges UNE phrase qu’une personne note dans son application de vie personnelle.',
  'Réponds par un objet JSON avec un champ "kind" parmi :',
  'expense {amount, currency, label, date} (dépense) ; income {amount, currency, label, date} (revenu) ;',
  'freelance {client, amount, label, date} (un de SES clients lui a payé une somme ; client = nom exact de la liste) ;',
  'workout {type: "cardio"|"strength"|"sport", exercise, durationMin, distanceKm, date} ; weight {weightKg, date} ;',
  'sleep {hours, date} ; water {ml, date} ; study {minutes, course, label, date} (course = nom exact de la liste ou null) ;',
  'habit {habit, value, date} (habit = nom exact de la liste ; value seulement pour une quantité) ;',
  'ou {"kind": null} si la phrase ne correspond à rien de cela.',
  'Dates au format AAAA-MM-JJ, calculées depuis la date du jour fournie (hier, lundi dernier…) ; jamais dans le futur.',
  'currency = code ISO à 3 lettres seulement si la phrase le précise, sinon null. label = quelques mots en français, sans le montant.',
  'N’invente rien : aucun montant, aucune durée ni aucun nom absent de la phrase.',
].join(' ');

const names = (list) => (Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, 60).map((x) => x.slice(0, 60)) : []);

export function parseDraftJson(text) {
  try {
    const o = JSON.parse(String(text).replace(/^```(json)?|```$/g, '').trim());
    return o && typeof o === 'object' && typeof o.kind === 'string' ? o : null;
  } catch { return null; }
}

export function parseReceipt(text) {
  let o;
  try { o = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()); } catch { return null; }
  const amount = Number(String(o?.amount ?? '').replace(',', '.'));
  return {
    amount: amount > 0 ? Math.round(amount * 100) / 100 : null,
    currency: /^[A-Z]{3}$/.test(o?.currency || '') ? o.currency : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(o?.date || '') ? o.date : null,
    merchant: typeof o?.merchant === 'string' ? o.merchant.slice(0, 80) : null,
    category: typeof o?.category === 'string' ? o.category.slice(0, 40) : null,
  };
}

export default async function handler(req, res) {
  const guard = await guardAiRequest(req, res, { isConfigured: isGeminiConfigured });
  if (!guard) return;
  const { kind, mimeType, data } = req.body || {};
  if (!['timetable', 'receipt', 'text'].includes(kind)) return res.status(400).json({ error: 'bad_kind' });
  if (kind === 'text') {
    const text = typeof req.body.text === 'string' ? req.body.text.trim().slice(0, 500) : '';
    if (!text) return res.status(400).json({ error: 'bad_text' });
    const c = req.body.context || {};
    const context = [
      `Date du jour : ${/^\d{4}-\d{2}-\d{2}$/.test(c.today || '') ? c.today : new Date().toISOString().slice(0, 10)}.`,
      `Devise habituelle : ${/^[A-Z]{3}$/.test(c.currency || '') ? c.currency : 'inconnue'}.`,
      `Habitudes : ${names(c.habits).join(' | ') || 'aucune'}.`,
      `Matières / cours : ${names(c.courses).join(' | ') || 'aucun'}.`,
      `Clients : ${names(c.clients).join(' | ') || 'aucun'}.`,
    ].join('\n');
    try {
      const out = await aiText({ system: CAPTURE, contents: [{ role: 'user', parts: [{ text: `${context}\n\nPhrase : ${text}` }] }], maxTokens: 300, temperature: 0.1, json: true }, { userKey: guard.userKey });
      return res.status(200).json({ draft: parseDraftJson(out.text) });
    } catch (e) {
      console.error('[extract] text failed', e?.status, e?.detail);
      return res.status(e?.status === 429 ? 429 : 502).json({ error: keyError(e, guard.userKey) });
    }
  }
  if (!ALLOWED.includes(mimeType) || typeof data !== 'string' || !data) return res.status(400).json({ error: 'bad_file' });
  if (data.length > 5_500_000) return res.status(413).json({ error: 'too_large' });

  const file = { inlineData: { mimeType, data } };
  try {
    if (kind === 'timetable') {
      const { text } = await aiText({ system: TIMETABLE, contents: [{ role: 'user', parts: [file, { text: 'Extrais l’emploi du temps.' }] }], maxTokens: 2000, temperature: 0.1 }, { userKey: guard.userKey });
      const lines = text.split(/\r?\n/).map((l) => l.replace(/^[-*•\s]+/, '').replace(/`/g, '').trim()).filter((l) => l.includes(';'));
      return res.status(200).json({ text: lines.join('\n') });
    }
    const { text } = await aiText({ system: RECEIPT, contents: [{ role: 'user', parts: [file, { text: 'Lis ce reçu.' }] }], maxTokens: 300, temperature: 0.1, json: true }, { userKey: guard.userKey });
    const receipt = parseReceipt(text);
    if (!receipt) return res.status(502).json({ error: 'failed' });
    return res.status(200).json(receipt);
  } catch (e) {
    console.error('[extract] failed', kind, e?.status, e?.detail);
    return res.status(e?.status === 429 ? 429 : 502).json({ error: keyError(e, guard.userKey) });
  }
}
