// Single source of truth for VAUDAX's structure: four sections ("pôles")
// around Aujourd'hui. The desktop bar, the phone tabs, the section home pages,
// the section sub-menu and the global search all read from here.
import {
  Sun, Target, Flame, Timer, Swords, History, GraduationCap, Library, GitBranch, Palette, HeartPulse,
  Wallet, TrendingUp, Building2, Handshake, Rocket, Briefcase, Laptop, FolderKanban, FlaskConical,
} from 'lucide-react';

// Modules: one page each. `flag` = key(s) in user.enabledModules; modules
// without a flag are always on. `def` = value for accounts that predate the flag.
export const MODULES = {
  today: { label: 'Aujourd’hui', to: '/today', icon: Sun, end: true },
  goals: { label: 'Objectifs', to: '/goals', icon: Target },
  habits: { label: 'Habitudes', to: '/habits', icon: Flame },
  challenges: { label: 'Défis', to: '/defis', icon: Swords },
  timeline: { label: 'Chronologie', to: '/chronologie', icon: History },
  focus: { label: 'Minuteur', to: '/focus', icon: Timer, flag: 'focus', def: false, desc: 'Sessions de concentration (Deep Work, étude) et leur historique.' },

  learning: { label: 'Études', to: '/learning', icon: GraduationCap, prefixes: ['/learning/course'] },
  readings: { label: 'Lectures', to: '/learning/readings', icon: Library },
  skills: { label: 'Compétences', to: '/skills', icon: GitBranch },
  creative: { label: 'Création', to: '/creative', icon: Palette, flag: 'creative', def: false, desc: 'Œuvres, pratique et expositions, pour les artistes, musiciens et auteurs.' },

  health: { label: 'Santé', to: '/health', icon: HeartPulse },

  finance: { label: 'Finances', to: '/finance', icon: Wallet },
  trading: { label: 'Trading', to: '/trading', icon: TrendingUp, flag: 'trading', def: true, desc: 'Journal multi-comptes, gestion du risque, suivi de la psychologie.' },
  realEstate: { label: 'Immobilier', to: '/real-estate', icon: Building2, flag: 'realEstate', def: false, desc: 'Biens locatifs : cash-flow et rentabilité par bien.' },
  pe: { label: 'Private equity', to: '/deals', icon: Handshake, flag: 'pe', def: true, desc: 'Suivi de deals (LBO, capital-risque) et des tâches de chaque deal.' },
  fundraising: { label: 'Levée de fonds', to: '/fundraising', icon: Rocket, flag: 'fundraising', def: false, desc: 'Suivi des investisseurs quand tu lèves des fonds.' },

  career: { label: 'Carrière', to: '/career', icon: Briefcase, flag: ['career', 'networking', 'content'], def: false, desc: 'CV, candidatures, entretiens, réseau et visibilité.' },
  freelance: { label: 'Freelance', to: '/freelance', icon: Laptop, flag: 'freelance', def: false, desc: 'Clients, heures et factures, pour les indépendants et consultants.' },
  business: { label: 'Projets', to: '/businesses', icon: FolderKanban, flag: 'business', def: true, desc: 'Du petit projet perso (étapes, tâches) à la vraie entreprise (phases, planning, comptabilité).' },
  engineering: { label: 'Ingénierie', to: '/engineering', icon: FlaskConical, flag: 'engineering', def: false, desc: 'Journal de laboratoire et projets de conception.' },
};

export const POLES = [
  { key: 'etudes', label: 'Études & savoir', short: 'Études', home: '/etudes', icon: GraduationCap, blurb: 'Apprendre et créer', modules: ['learning', 'readings', 'skills', 'creative'] },
  { key: 'sante', label: 'Santé', short: 'Santé', home: '/health', icon: HeartPulse, blurb: 'Corps et énergie', modules: ['health'] },
  { key: 'today', label: 'Aujourd’hui', short: 'Aujourd’hui', home: '/today', icon: Sun, blurb: 'Le centre de pilotage', modules: ['today', 'goals', 'habits', 'focus', 'timeline', 'challenges'] },
  { key: 'patrimoine', label: 'Patrimoine', short: 'Patrimoine', home: '/patrimoine', icon: Wallet, blurb: 'Argent et investissements', modules: ['finance', 'trading', 'realEstate', 'pe', 'fundraising'] },
  { key: 'carriere', label: 'Carrière & entreprise', short: 'Carrière', home: '/carriere', icon: Briefcase, blurb: 'Travail et projets', modules: ['career', 'freelance', 'business', 'engineering'] },
];

// Desktop order reads left to right; the phone bar puts Aujourd'hui in the middle.
export const DESKTOP_POLES = ['today', 'etudes', 'sante', 'patrimoine', 'carriere'];
export const MOBILE_POLES = ['etudes', 'sante', 'today', 'patrimoine', 'carriere'];

export const poleByKey = (key) => POLES.find((p) => p.key === key);

export function isModuleEnabled(user, key) {
  const m = MODULES[key];
  if (!m?.flag) return true;
  const flags = Array.isArray(m.flag) ? m.flag : [m.flag];
  return flags.some((f) => user?.enabledModules?.[f] ?? m.def);
}

// Turn a module on/off: returns the new enabledModules object.
export function withModule(user, key, on) {
  const m = MODULES[key];
  const flags = Array.isArray(m.flag) ? m.flag : [m.flag];
  return { ...(user?.enabledModules || {}), ...Object.fromEntries(flags.map((f) => [f, on])) };
}

export const enabledModules = (user, pole) => pole.modules.filter((k) => isModuleEnabled(user, k));

// Which section a URL belongs to (null for profile pages: settings, ranking…).
export function poleOfPath(pathname) {
  for (const pole of POLES) {
    if (pathname === pole.home || pathname.startsWith(`${pole.home}/`)) return pole;
  }
  let best = null;
  let bestLen = 0;
  for (const pole of POLES) {
    for (const key of pole.modules) {
      const m = MODULES[key];
      for (const p of [m.to, ...(m.prefixes || [])]) {
        if ((pathname === p || pathname.startsWith(`${p}/`)) && p.length > bestLen) { best = pole; bestLen = p.length; }
      }
    }
  }
  return best;
}

// Module whose page is open (longest matching route wins: /learning/readings
// is Lectures, not Études).
export function moduleOfPath(pathname) {
  let best = null;
  let bestLen = 0;
  for (const [key, m] of Object.entries(MODULES)) {
    for (const p of [m.to, ...(m.prefixes || [])]) {
      if ((pathname === p || pathname.startsWith(`${p}/`)) && p.length > bestLen) { best = key; bestLen = p.length; }
    }
  }
  return best;
}
