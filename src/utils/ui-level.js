// Mode Simple / Expert for the whole app (chantier 4, G5). Simple keeps the
// essentials in everyday words; Expert shows every tool and the technical
// terms (each one explained on tap, see components/common/Term.jsx).
// New accounts start in Simple; accounts created before keep Expert, the view
// they know. Paramètres → Affichage switches it.
import { useAuthStore } from '../store/authStore';

export const uiLevelOf = (user) => user?.uiLevel || 'expert';
export const useUiLevel = () => useAuthStore((s) => uiLevelOf(s.user));
export const useIsSimple = () => useUiLevel() === 'simple';

// Technical words → everyday words (S11, F3). `short` fits a table header.
export const GLOSSARY = {
  rpe: { expert: 'RPE', simple: 'Effort ressenti', short: 'Effort', def: 'Effort ressenti, de 1 (très facile) à 10 (impossible d’en faire plus).' },
  '1rm': { expert: '1RM', simple: 'Charge maximale', short: 'Max', def: 'Le poids le plus lourd que tu pourrais soulever une seule fois, estimé à partir de tes séries.' },
  vo2max: { expert: 'VO2max', simple: 'Forme cardio', short: 'Cardio', def: 'La quantité d’oxygène que ton corps utilise à l’effort : plus elle est haute, meilleure est ton endurance.' },
  readiness: { expert: 'Readiness', simple: 'Forme du jour', short: 'Forme', def: 'Ta forme du jour, calculée à partir de ton sommeil, de ton énergie, de ton stress et de ta récupération.' },
  tdee: { expert: 'TDEE', simple: 'Dépense du jour', short: 'Dépense', def: 'Les calories que tu dépenses en une journée, activité comprise.' },
  bmr: { expert: 'BMR', simple: 'Dépense au repos', short: 'Repos', def: 'Les calories que ton corps brûle sans bouger, juste pour fonctionner.' },
  ancc: { expert: 'ANCC', simple: 'Patrimoine net', short: 'Patrimoine', def: 'Ce que tu possèdes moins ce que tu dois.' },
  statements: { expert: 'Bilan · CPC · ESG', simple: 'Bilan et résultat', short: 'Bilan', def: 'Le bilan (ce que tu possèdes et dois), le compte de résultat (revenus et dépenses) et l’analyse de la trésorerie.' },
};

export function termText(id, level, { short = false } = {}) {
  const g = GLOSSARY[id];
  if (!g) return id;
  if (level === 'simple') return short ? g.short : g.simple;
  return g.expert;
}

// For props that need a plain string (labels, titles, chart names).
export function useTerm() {
  const level = useUiLevel();
  return (id, opts) => termText(id, level, opts);
}
