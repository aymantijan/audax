/**
 * Free learning tracks (parcours) — languages (CEFR), trading, any skill or
 * topic. A track is a `course` with kind 'free' plus trackType/level/goal
 * fields; its roadmap is the usual chapters/checklist.
 */
import { Languages, CandlestickChart, Wrench, Compass } from 'lucide-react';

export const TRACK_TYPES = [
  { value: 'language', label: 'Langue', icon: Languages, color: '#06b6d4', desc: 'Niveaux CECRL A1 → C2, vocabulaire en fiches' },
  { value: 'trading', label: 'Trading', icon: CandlestickChart, color: '#10b981', desc: 'Marchés, risque, psychologie, stratégie' },
  { value: 'skill', label: 'Compétence', icon: Wrench, color: '#f59e0b', desc: 'Excel, Python, prise de parole…' },
  { value: 'topic', label: 'Autre sujet', icon: Compass, color: '#8b5cf6', desc: 'Tout ce que vous voulez apprendre' },
];
export const trackMeta = (t) => TRACK_TYPES.find((x) => x.value === t) || TRACK_TYPES[3];

export const CEFR = [
  { value: 'A1', label: 'A1 — Découverte', short: 'Découverte', words: 500 },
  { value: 'A2', label: 'A2 — Survie', short: 'Survie', words: 1000 },
  { value: 'B1', label: 'B1 — Seuil', short: 'Seuil', words: 2000 },
  { value: 'B2', label: 'B2 — Avancé', short: 'Avancé', words: 4000 },
  { value: 'C1', label: 'C1 — Autonome', short: 'Autonome', words: 8000 },
  { value: 'C2', label: 'C2 — Maîtrise', short: 'Maîtrise', words: 16000 },
];
export const GENERIC_LEVELS = [
  { value: 'L0', label: 'Découverte', short: 'Découverte' },
  { value: 'L1', label: 'Débutant', short: 'Débutant' },
  { value: 'L2', label: 'Intermédiaire', short: 'Intermédiaire' },
  { value: 'L3', label: 'Avancé', short: 'Avancé' },
  { value: 'L4', label: 'Expert', short: 'Expert' },
];
export const levelsFor = (trackType) => (trackType === 'language' ? CEFR : GENERIC_LEVELS);
export const levelLabel = (trackType, v) => levelsFor(trackType).find((l) => l.value === v)?.label || v || '—';

export const LANGUAGES = ['Anglais', 'Français', 'Espagnol', 'Allemand', 'Arabe', 'Italien', 'Portugais', 'Chinois (mandarin)', 'Japonais', 'Coréen', 'Turc', 'Russe', 'Néerlandais', 'Autre'];

export const RESOURCE_TYPES = [
  { value: 'book', label: 'Livre' },
  { value: 'video', label: 'Vidéo / chaîne' },
  { value: 'course', label: 'Cours en ligne' },
  { value: 'article', label: 'Article' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'tool', label: 'Outil / appli' },
  { value: 'link', label: 'Lien' },
];
export const resourceLabel = (t) => RESOURCE_TYPES.find((r) => r.value === t)?.label || 'Ressource';

// CEFR "can do" milestones per level (Conseil de l'Europe descriptors, condensed).
const CEFR_ROADMAP = {
  A1: ['Se présenter et poser des questions simples', 'Comprendre des phrases très courantes', 'Remplir un formulaire (nom, adresse…)', 'Présent + vocabulaire de base (~500 mots)'],
  A2: ['Décrire sa formation, son environnement', 'Comprendre des annonces et messages simples', 'Écrire un message court et personnel', 'Passé + futur proche (~1 000 mots)'],
  B1: ['Raconter une expérience, donner son avis', 'Comprendre l’essentiel d’un podcast / d’une vidéo', 'Écrire un texte simple et cohérent', 'Tenir une conversation sur un sujet familier (~2 000 mots)'],
  B2: ['Argumenter dans un débat', 'Comprendre des conférences et articles longs', 'Rédiger un rapport ou un e-mail professionnel', 'Parler spontanément avec un natif (~4 000 mots)'],
  C1: ['S’exprimer couramment sans chercher ses mots', 'Comprendre des textes longs et implicites', 'Présenter un sujet complexe à l’oral', 'Usage professionnel et académique (~8 000 mots)'],
  C2: ['Tout comprendre sans effort', 'Nuancer finement sa pensée', 'Rédiger des textes complexes et élégants', 'Niveau proche d’un natif cultivé'],
};

const TRADING_ROADMAP = [
  ['Bases des marchés', ['Types d’actifs et sessions de marché', 'Types d’ordres (market, limit, stop)', 'Lire un graphique en chandeliers', 'Spread, commissions, levier et marge']],
  ['Analyse technique', ['Structure de marché (tendances, ranges)', 'Supports / résistances et zones de liquidité', 'Indicateurs clés (moyennes, RSI, volume)', 'Multi-timeframe']],
  ['Gestion du risque', ['Risque fixe par trade (ex. 0,5–1 %)', 'Ratio risque / rendement et espérance', 'Taille de position', 'Règles de drawdown journalier / hebdo']],
  ['Psychologie', ['Plan de trading écrit', 'Routine pré-marché et post-marché', 'Gérer FOMO, revenge trading, surconfiance', 'Revue hebdomadaire du journal']],
  ['Stratégie & backtest', ['Définir un setup précis (entrée, stop, sortie)', 'Backtester 100 trades', 'Forward test en démo', 'Statistiques : winrate, R moyen, expectancy']],
  ['Exécution', ['Passer en réel avec un risque réduit', 'Journaliser chaque trade', 'Monter progressivement la taille', 'Challenge / prop firm si pertinent']],
];

const GENERIC_ROADMAP = [
  ['Fondamentaux', ['Identifier les notions clés', 'Choisir 1 ou 2 ressources de référence', 'Faire des fiches sur l’essentiel']],
  ['Pratique guidée', ['Exercices / tutoriels pas à pas', 'Refaire sans aide', 'Demander un retour']],
  ['Projet', ['Choisir un projet concret', 'Le réaliser de bout en bout', 'Le présenter / publier']],
  ['Approfondissement', ['Sujets avancés', 'Enseigner à quelqu’un d’autre', 'Définir la prochaine étape']],
];

/** Chapters (roadmap) prefilled for a new track. */
export function roadmapFor({ trackType, level, targetLevel }) {
  if (trackType === 'language') {
    const order = CEFR.map((l) => l.value);
    const idx = order.indexOf(level); // -1 = complete beginner (A0)
    // Work on the levels above the current one, up to the target.
    const start = idx < 0 ? 0 : Math.min(order.length - 1, idx + 1);
    const to = Math.max(start, order.indexOf(targetLevel || 'C1'));
    return order.slice(start, to + 1).map((lv) => ({
      title: `Niveau ${lv}`,
      coefficient: 1,
      checklistItems: CEFR_ROADMAP[lv].map((t) => ({ title: t, coefficient: 1 })),
    }));
  }
  const src = trackType === 'trading' ? TRADING_ROADMAP : GENERIC_ROADMAP;
  return src.map(([title, items]) => ({ title, coefficient: 1, checklistItems: items.map((t) => ({ title: t, coefficient: 1 })) }));
}

// Legacy course.readings → unified resources.
export function resourcesOf(course) {
  if (Array.isArray(course.resources)) return course.resources;
  return (course.readings || []).map((r, i) => ({ id: `legacy-${i}`, title: r.title, type: r.type === 'book' ? 'book' : r.type === 'video' ? 'video' : r.type === 'podcast' ? 'podcast' : 'article', status: r.completed ? 'done' : 'todo', url: '' }));
}
