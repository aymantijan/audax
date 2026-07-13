// Association livre → compétences, à deux niveaux :
//   1. Par GENRE  — tout livre d'un genre nourrit les skills thématiques de ce genre
//   2. Par LIVRE  — les ouvrages notables pointent vers des skills précises
// `skillsForBook()` fusionne les deux, dédoublonne, et FILTRE contre SKILL_MAP :
// tout id inexistant est silencieusement écarté (robustesse). Ces skills alimentent
// l'XP de lecture (par 10 pages + à la complétion) via readingsStore.

import { SKILL_MAP } from './constants';
import { GENRE_TO_READER_SKILL } from './life-skills';

// ── Niveau 1 : skills thématiques par genre (en plus du "reader skill" du genre) ──
export const GENRE_SKILLS = {
  'Business & Economics': ['financial-statements-lv1', 'macro-theory-lv1', 'financial-discipline-lv1'],
  'Philosophy': ['self-awareness-lv1', 'decision-discipline-lv1'],
  'Science & Nature': ['statistical-modeling-lv1', 'note-taking-lv1'],
  'Health & Fitness': ['health-discipline-lv1', 'stress-management-lv1'],
  'History': ['macro-theory-lv1'],
  'Politics & Current Events': ['geopolitical-risk-lv1', 'macro-theory-lv1'],
  'Religion & Spirituality': ['self-awareness-lv1', 'stress-management-lv1'],
  'Self-Help & Personal Development': ['learning-discipline-lv1', 'emotional-regulation-lv1'],
  'Memoir': ['self-awareness-lv1'],
  'Autobiography': ['self-awareness-lv1'],
  'Essays': ['note-taking-lv1'],
};

// ── Niveau 2 : skills précises pour des ouvrages notables (clé = titre en minuscules) ──
const T = {
  // Trading & marchés
  'trading in the zone': ['trading-discipline-lv1', 'emotional-regulation-lv1', 'decision-discipline-lv1'],
  'the disciplined trader': ['trading-discipline-lv1', 'emotional-regulation-lv1'],
  'reminiscences of a stock operator': ['trend-following-lv1', 'trading-discipline-lv1'],
  'how to trade in stocks': ['trend-following-lv1', 'position-sizing-lv1'],
  'market wizards': ['trading-discipline-lv1', 'position-sizing-lv1'],
  'the new market wizards': ['trading-discipline-lv1', 'position-sizing-lv1'],
  'unknown market wizards': ['trading-discipline-lv1', 'position-sizing-lv1'],
  'the new trading for a living': ['trading-discipline-lv1', 'position-sizing-lv1', 'technical-analysis-lv1'],
  'technical analysis of the financial markets': ['technical-analysis-lv1', 'support-resistance-lv1'],
  'japanese candlestick charting techniques': ['technical-analysis-lv1'],
  'trend following': ['trend-following-lv1'],

  // Investissement & analyse
  'the intelligent investor': ['equity-research-lv1', 'financial-statements-lv1', 'value-vs-growth-lv1'],
  'security analysis': ['equity-research-lv1', 'three-statement-modeling-lv1', 'financial-statements-lv1'],
  'common stocks and uncommon profits': ['equity-research-lv1', 'value-vs-growth-lv1'],
  'one up on wall street': ['equity-research-lv1', 'value-vs-growth-lv1'],
  'beating the street': ['equity-research-lv1'],
  'the most important thing': ['risk-adjusted-returns-lv1', 'macro-theory-lv1'],
  'mastering the market cycle': ['macro-theory-lv1', 'risk-adjusted-returns-lv1'],
  'a random walk down wall street': ['risk-adjusted-returns-lv1'],
  'the little book of common sense investing': ['risk-adjusted-returns-lv1'],
  'the dhandho investor': ['value-vs-growth-lv1'],
  'the little book that still beats the market': ['equity-research-lv1', 'relative-valuation-lv1'],
  "poor charlie's almanack": ['cognitive-biases-lv1', 'decision-discipline-lv1'],
  'the psychology of money': ['financial-discipline-lv1', 'cognitive-biases-lv1'],
  'the black swan': ['risk-adjusted-returns-lv1', 'cognitive-biases-lv1', 'statistical-modeling-lv1'],
  'fooled by randomness': ['risk-adjusted-returns-lv1', 'cognitive-biases-lv1'],
  'antifragile': ['risk-adjusted-returns-lv1', 'decision-discipline-lv1'],
  'skin in the game': ['decision-discipline-lv1', 'risk-adjusted-returns-lv1'],
  'principles': ['decision-discipline-lv1', 'self-awareness-lv1'],
  'big debt crises': ['macro-theory-lv1', 'financial-crises-lv1'],
  'rich dad poor dad': ['financial-discipline-lv1', 'financial-statements-lv1'],
  'cashflow quadrant': ['financial-discipline-lv1'],
  'the richest man in babylon': ['financial-discipline-lv1'],
  'think and grow rich': ['financial-discipline-lv1', 'self-awareness-lv1'],
  'the simple path to wealth': ['financial-discipline-lv1', 'risk-adjusted-returns-lv1'],
  'i will teach you to be rich': ['financial-discipline-lv1', 'budget-control-lv1'],

  // Décision & comportement
  'thinking, fast and slow': ['cognitive-biases-lv1', 'decision-discipline-lv1'],
  'nudge': ['cognitive-biases-lv1'],
  'misbehaving': ['cognitive-biases-lv1'],
  'predictably irrational': ['cognitive-biases-lv1'],
  'freakonomics': ['statistical-modeling-lv1'],

  // PE / VC / entrepreneuriat & management
  'zero to one': ['vc-thesis', 'ge-thesis'],
  'the hard thing about hard things': ['team-leadership-lv1', 'ge-thesis'],
  "the innovator's dilemma": ['ge-thesis', 'ma-strategy-lv1'],
  'high output management': ['team-leadership-lv1'],
  'only the paranoid survive': ['team-leadership-lv1', 'decision-discipline-lv1'],
  'measure what matters': ['team-leadership-lv1'],
  'the lean startup': ['ge-thesis'],
  'good to great': ['team-leadership-lv1'],
  'start with why': ['team-leadership-lv1'],
  'leaders eat last': ['team-leadership-lv1'],
  'no rules rules': ['team-leadership-lv1'],
  'never split the difference': ['negotiation-lv1'],
  'getting to yes': ['negotiation-lv1'],
  'influence: the psychology of persuasion': ['negotiation-lv1', 'cognitive-biases-lv1'],
  'shoe dog': ['ge-thesis', 'self-awareness-lv1'],

  // Discipline & développement personnel
  'atomic habits': ['learning-discipline-lv1', 'deep-focus-lv1'],
  'deep work': ['deep-focus-lv1', 'learning-discipline-lv1'],
  'digital minimalism': ['deep-focus-lv1'],
  "so good they can't ignore you": ['learning-discipline-lv1'],
  'the 7 habits of highly effective people': ['self-awareness-lv1', 'decision-discipline-lv1'],
  'the power of habit': ['learning-discipline-lv1'],
  'tiny habits': ['learning-discipline-lv1'],
  'getting things done': ['deep-focus-lv1'],
  'mindset': ['learning-discipline-lv1', 'self-awareness-lv1'],
  'grit': ['learning-discipline-lv1', 'self-awareness-lv1'],
  "can't hurt me": ['health-discipline-lv1', 'emotional-regulation-lv1'],
  'never finished': ['health-discipline-lv1', 'emotional-regulation-lv1'],
  'extreme ownership': ['decision-discipline-lv1', 'self-awareness-lv1'],
  'discipline equals freedom': ['health-discipline-lv1', 'decision-discipline-lv1'],
  'the obstacle is the way': ['self-awareness-lv1', 'emotional-regulation-lv1'],
  'ego is the enemy': ['self-awareness-lv1'],
  'stillness is the key': ['self-awareness-lv1', 'stress-management-lv1'],
  'the daily stoic': ['self-awareness-lv1', 'emotional-regulation-lv1'],
  'discipline is destiny': ['health-discipline-lv1', 'self-awareness-lv1'],
  'courage is calling': ['self-awareness-lv1', 'decision-discipline-lv1'],
  '12 rules for life': ['self-awareness-lv1'],
  'the 48 laws of power': ['cognitive-biases-lv1', 'negotiation-lv1'],
  'the laws of human nature': ['cognitive-biases-lv1', 'self-awareness-lv1'],
  'mastery': ['learning-discipline-lv1'],
  'the 33 strategies of war': ['decision-discipline-lv1', 'negotiation-lv1'],
  'think again': ['cognitive-biases-lv1'],
  'originals': ['cognitive-biases-lv1'],
  'outliers': ['cognitive-biases-lv1', 'learning-discipline-lv1'],
  'blink': ['cognitive-biases-lv1'],
  'talking to strangers': ['cognitive-biases-lv1'],

  // Stoïcisme & sens
  'meditations': ['self-awareness-lv1', 'emotional-regulation-lv1'],
  'letters from a stoic': ['self-awareness-lv1', 'emotional-regulation-lv1'],
  'on the shortness of life': ['self-awareness-lv1'],
  "man's search for meaning": ['self-awareness-lv1', 'stress-management-lv1'],
  'the art of war': ['decision-discipline-lv1', 'negotiation-lv1'],

  // Santé & performance
  'the body keeps the score': ['stress-management-lv1', 'emotional-regulation-lv1'],
  'why we sleep': ['health-discipline-lv1'],
  'breath': ['health-discipline-lv1'],
  'outlive': ['health-discipline-lv1'],
  "why zebras don't get ulcers": ['stress-management-lv1'],
  'spark': ['health-discipline-lv1'],

  // Macro & économie
  'the wealth of nations': ['macro-theory-lv1'],
  'capital in the twenty-first century': ['macro-theory-lv1'],
  'basic economics': ['macro-theory-lv1'],
};

// Normalisation clé de titre : minuscules + espaces compactés.
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const TITLE_SKILLS = T;

// Skills d'un livre = reader du genre + skills du genre + skills du titre.
// Filtré contre SKILL_MAP (seuls les ids réellement présents dans l'arbre passent).
export function skillsForBook(book) {
  if (!book) return [];
  const ids = new Set();
  const reader = GENRE_TO_READER_SKILL[book.genre];
  if (reader) ids.add(reader);
  for (const id of GENRE_SKILLS[book.genre] || []) ids.add(id);
  for (const id of TITLE_SKILLS[norm(book.title)] || []) ids.add(id);
  return [...ids].filter((id) => SKILL_MAP[id]);
}
