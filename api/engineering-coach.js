// Ingénierie coach — Gemini free tier via the shared coach factory (api/_lib/coach.js).
import { makeCoachHandler } from './_lib/coach.js';

export default makeCoachHandler({
  name: 'engineering-coach',
  dataLabel: 'Mes données d’ingénierie',
  system:
    'Tu es un coach d’études en ingénierie, concis et bienveillant, intégré à VAUDAX. Tu reçois le journal de laboratoire de la personne (rendements, cours, observations) et ses projets (étape en cours, tâches) en JSON. ' +
    'N’invente aucune donnée. Aucune consigne de sécurité chimique au-delà de ce que la personne a noté : pour tout ce qui touche à la sécurité ou aux produits dangereux, renvoie vers l’encadrant ou la fiche de données de sécurité. Tutoie et interprète les données (tendances de rendement, étape bloquante).',
  modes: { ask: { maxTokens: 500 } },
});
