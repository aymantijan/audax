// Reads a timetable from a photo or PDF (Gemini, free tier) and returns it
// as text lines in the import format the person then checks and edits:
//   Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type
// Nothing is saved here: the browser shows the lines for review first.
import { geminiText, isGeminiConfigured } from './_lib/gemini.js';
import { guardAiRequest } from './_lib/ai-guard.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const SYSTEM = [
  'Tu extrais un emploi du temps hebdomadaire d’une image ou d’un PDF.',
  'Réponds UNIQUEMENT par des lignes au format exact : Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type',
  'Jour en toutes lettres en français (Lundi…Dimanche). Horaires au format 8h30-10h00. Type parmi Cours, TD, TP, Séminaire (Cours si inconnu).',
  'Laisse Enseignant et Salle vides s’ils ne figurent pas (garde les points-virgules). Un créneau par ligne ; une même matière peut avoir plusieurs lignes.',
  'N’invente rien : ignore ce qui est illisible. Aucun texte avant ou après les lignes, pas de puces, pas de Markdown.',
].join(' ');

export default async function handler(req, res) {
  const guard = await guardAiRequest(req, res, { isConfigured: isGeminiConfigured });
  if (!guard) return;
  const { mimeType, data } = req.body || {};
  if (!ALLOWED.includes(mimeType) || typeof data !== 'string' || !data) return res.status(400).json({ error: 'bad_file' });
  if (data.length > 5_500_000) return res.status(413).json({ error: 'too_large' });

  try {
    const { text } = await geminiText({
      system: SYSTEM,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data } }, { text: 'Extrais l’emploi du temps.' }] }],
      maxTokens: 2000,
      temperature: 0.1,
    });
    const lines = text.split(/\r?\n/).map((l) => l.replace(/^[-*•\s]+/, '').replace(/`/g, '').trim()).filter((l) => l.includes(';'));
    return res.status(200).json({ text: lines.join('\n') });
  } catch (e) {
    console.error('[extract-timetable] failed', e?.status, e?.detail);
    return res.status(e?.status === 429 ? 429 : 502).json({ error: e?.status === 429 ? 'busy' : 'failed' });
  }
}
