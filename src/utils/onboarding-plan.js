// New-user onboarding: from "what do you want to improve?" + situation +
// country, build a starting setup (modules switched on, starter habits,
// 1 to 3 starting goals). Pure functions — tested in tests/onboarding.test.mjs.

export const AIMS = [
  { key: 'studies', label: 'Réussir mes études', habits: ['Réviser un concept par jour'], modules: ['focus'] },
  { key: 'money', label: 'Mieux gérer mon argent', habits: ['Noter ses dépenses du jour', 'Vérifier son budget chaque semaine'], goals: ['savings'] },
  { key: 'sport', label: 'Reprendre le sport', habits: ['Sport le matin'], goals: ['workouts'] },
  { key: 'sleep', label: 'Mieux dormir', habits: ['8 h de sommeil ou plus'], goals: ['sleep'] },
  { key: 'calm', label: 'Moins de stress, plus d’énergie', habits: ['Méditation (10 min)', 'Journal de gratitude'] },
  { key: 'read', label: 'Lire plus', habits: ['Lecture quotidienne (30 min)'] },
  { key: 'job', label: 'Trouver un emploi', modules: ['career'], goals: ['job'] },
  { key: 'business', label: 'Lancer mon activité', modules: ['business', 'freelance'], goals: ['launch'] },
  { key: 'trading', label: 'Trader avec discipline', habits: ['Journal de trading quotidien', 'Revoir le P&L du jour'], modules: ['trading'] },
  { key: 'invest', label: 'Investir et suivre mon patrimoine', modules: ['realEstate'] },
  { key: 'create', label: 'Créer (art, musique, écriture…)', modules: ['creative'] },
];

export const SITUATIONS = [
  { key: 'student', label: 'Étudiant·e', modules: ['focus'] },
  { key: 'employee', label: 'Salarié·e', modules: [] },
  { key: 'freelancer', label: 'Indépendant·e', modules: ['freelance'] },
  { key: 'founder', label: 'Entrepreneur·e', modules: ['business'] },
  { key: 'jobseeker', label: 'En recherche d’emploi', modules: ['career'] },
  { key: 'parent', label: 'Parent au foyer', modules: [] },
  { key: 'none', label: 'Sans activité pour l’instant', modules: [] },
];

// Currency follows the country; the dirham is only proposed in Morocco.
export const COUNTRIES = [
  { key: 'MA', label: 'Maroc', currency: 'MAD', tz: ['Africa/Casablanca'] },
  { key: 'FR', label: 'France', currency: 'EUR', tz: ['Europe/Paris'] },
  { key: 'BE', label: 'Belgique', currency: 'EUR', tz: ['Europe/Brussels'] },
  { key: 'CH', label: 'Suisse', currency: 'CHF', tz: ['Europe/Zurich'] },
  { key: 'CA', label: 'Canada', currency: 'CAD', tz: ['America/Toronto', 'America/Montreal', 'America/Vancouver'] },
  { key: 'SN', label: 'Sénégal', currency: 'XOF', tz: ['Africa/Dakar'] },
  { key: 'CI', label: 'Côte d’Ivoire', currency: 'XOF', tz: ['Africa/Abidjan'] },
  { key: 'TN', label: 'Tunisie', currency: 'TND', tz: ['Africa/Tunis'] },
  { key: 'DZ', label: 'Algérie', currency: 'DZD', tz: ['Africa/Algiers'] },
  { key: 'EG', label: 'Égypte', currency: 'EGP', tz: ['Africa/Cairo'] },
  { key: 'AE', label: 'Émirats arabes unis', currency: 'AED', tz: ['Asia/Dubai'] },
  { key: 'SA', label: 'Arabie saoudite', currency: 'SAR', tz: ['Asia/Riyadh'] },
  { key: 'GB', label: 'Royaume-Uni', currency: 'GBP', tz: ['Europe/London'] },
  { key: 'US', label: 'États-Unis', currency: 'USD', tz: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] },
  { key: 'OTHER', label: 'Autre pays', currency: 'EUR', tz: [] },
];

export function guessCountry(timeZone) {
  return COUNTRIES.find((c) => c.tz.includes(timeZone))?.key || 'OTHER';
}

// Starting goals the app can create without asking anything else, except
// savings, which needs an amount (created only when one is given).
export const GOAL_TEMPLATES = {
  savings: { label: 'Mettre de l’argent de côté', needsAmount: true },
  workouts: { label: 'Faire 3 séances de sport par semaine' },
  sleep: { label: 'Dormir 7 h 30 en moyenne' },
  job: { label: 'Trouver un emploi' },
  launch: { label: 'Lancer mon activité' },
};

// Every optional module flag (see utils/navigation.js MODULES[*].flag).
const ALL_FLAGS = ['trading', 'pe', 'business', 'engineering', 'networking', 'career', 'content', 'focus', 'fundraising', 'freelance', 'creative', 'realEstate'];
const MODULE_FLAGS = { career: ['career', 'networking', 'content'] };

export function buildOnboardingPlan({ aims = [], situation = null }) {
  const chosen = AIMS.filter((a) => aims.includes(a.key));
  const sit = SITUATIONS.find((s) => s.key === situation);
  const on = new Set();
  for (const m of [...chosen.flatMap((a) => a.modules || []), ...(sit?.modules || [])]) {
    for (const f of MODULE_FLAGS[m] || [m]) on.add(f);
  }
  const modules = Object.fromEntries(ALL_FLAGS.map((f) => [f, on.has(f)]));

  const habits = [...new Set(chosen.flatMap((a) => a.habits || []))];
  // Nobody starts with an empty "Aujourd'hui": two light defaults.
  for (const h of ['Lecture quotidienne (30 min)', 'Boire 8 verres d’eau']) {
    if (habits.length >= 2) break;
    if (!habits.includes(h)) habits.push(h);
  }

  const goals = [...new Set(chosen.flatMap((a) => a.goals || []))].slice(0, 3);
  return { modules, habits: habits.slice(0, 6), goals };
}
