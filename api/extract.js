// Reads a photo or PDF with Gemini (free tier) and returns data to REVIEW —
// nothing is saved here. One endpoint for every reader (Vercel Hobby allows
// 12 functions): body { kind, mimeType, data (base64) }.
//   kind 'timetable' → { text }: lines "Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type"
//   kind 'receipt'   → { amount, currency, date, merchant, category }
import { geminiText, isGeminiConfigured } from './_lib/gemini.js';
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
  if (!['timetable', 'receipt'].includes(kind)) return res.status(400).json({ error: 'bad_kind' });
  if (!ALLOWED.includes(mimeType) || typeof data !== 'string' || !data) return res.status(400).json({ error: 'bad_file' });
  if (data.length > 5_500_000) return res.status(413).json({ error: 'too_large' });

  const file = { inlineData: { mimeType, data } };
  try {
    if (kind === 'timetable') {
      const { text } = await geminiText({ system: TIMETABLE, contents: [{ role: 'user', parts: [file, { text: 'Extrais l’emploi du temps.' }] }], maxTokens: 2000, temperature: 0.1 });
      const lines = text.split(/\r?\n/).map((l) => l.replace(/^[-*•\s]+/, '').replace(/`/g, '').trim()).filter((l) => l.includes(';'));
      return res.status(200).json({ text: lines.join('\n') });
    }
    const { text } = await geminiText({ system: RECEIPT, contents: [{ role: 'user', parts: [file, { text: 'Lis ce reçu.' }] }], maxTokens: 300, temperature: 0.1, json: true });
    const receipt = parseReceipt(text);
    if (!receipt) return res.status(502).json({ error: 'failed' });
    return res.status(200).json(receipt);
  } catch (e) {
    console.error('[extract] failed', kind, e?.status, e?.detail);
    return res.status(e?.status === 429 ? 429 : 502).json({ error: e?.status === 429 ? 'busy' : 'failed' });
  }
}
