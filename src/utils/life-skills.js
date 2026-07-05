// Compétences "vie" reliées aux modules concrets de l'app :
//  - Lecture (Library/Readings) : XP par pages lues et livres terminés, par genre
//  - Comptabilité personnelle (Finance) : XP par écriture au journal, budgets, états
//  - Apprentissage : renforcement des chaînes d'étude existantes
// Chaque skill est câblée à un événement réel — readingsStore / accountingStore.

const mk = (category) => (id, name, subcategory, prereqs, description) => ({ id, name, category, subcategory, prereqs, description });
const k = mk('Knowledge');
const f = mk('Finance');
const d = mk('Discipline');

export const LIFE_SKILLS = [
  // ════════ KNOWLEDGE · Reading & Literature ════════
  k('reading-habit-lv1', 'Reading Habit Lv1', 'Reading & Literature', [], 'Read consistently — XP for every 10 pages logged in Readings'),
  k('reading-habit-lv2', 'Reading Habit Lv2', 'Reading & Literature', ['reading-habit-lv1'], 'Sustained daily reading streaks and longer sessions'),
  k('reading-habit-lv3', 'Reading Habit Lv3', 'Reading & Literature', ['reading-habit-lv2'], 'A reading life: dozens of books across many genres'),
  k('book-finisher-lv1', 'Book Finisher Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Finish what you start — XP for every completed book'),
  k('book-finisher-lv2', 'Book Finisher Lv2', 'Reading & Literature', ['book-finisher-lv1'], 'Complete long and demanding works (500+ pages)'),
  k('fiction-reader-lv1', 'Fiction Connoisseur Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Novels, sagas, and stories — awarded when finishing fiction'),
  k('philosophy-reader-lv1', 'Philosophy Reader Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Stoics to moderns — awarded when finishing philosophy books'),
  k('business-reader-lv1', 'Business & Markets Reader Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Investing, trading, and business books — feeds your edge'),
  k('science-reader-lv1', 'Science Reader Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Science, nature, and health books completed'),
  k('history-reader-lv1', 'History Reader Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'History, politics, and civilizations — awarded per completed book'),
  k('spirituality-reader-lv1', 'Spirituality Reader Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Religion & spirituality reading — awarded per completed book'),
  k('growth-reader-lv1', 'Growth Reader Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Self-development, memoirs, and biographies completed'),
  k('curiosity-reader-lv1', 'Curious Mind Lv1', 'Reading & Literature', ['reading-habit-lv1'], 'Travel, essays, art, humor, true crime — eclectic reading'),

  // ════════ FINANCE · Personal Accounting ════════
  f('double-entry-lv1', 'Double-Entry Accounting Lv1', 'Personal Accounting', [], 'Débit = Crédit — XP for every balanced journal entry'),
  f('double-entry-lv2', 'Double-Entry Accounting Lv2', 'Personal Accounting', ['double-entry-lv1'], 'Multi-line entries, opening balances, and complex operations'),
  f('journal-keeper-lv1', 'Journal Keeper Lv1', 'Personal Accounting', ['double-entry-lv1'], 'A living journal: regular, complete bookkeeping of your life'),
  f('financial-statements-lv1', 'Financial Statements Lv1', 'Personal Accounting', ['double-entry-lv1'], 'Read your own Bilan, CPC, and ESG fluently'),
  f('ratio-analysis-lv1', 'Ratio Analysis Lv1', 'Personal Accounting', ['financial-statements-lv1'], 'FR, BFR, TN, liquidity, solvency — diagnose your own finances'),
  f('budget-control-lv1', 'Budget Control Lv1', 'Personal Accounting', [], 'Set budgets per account and hold the line — XP when budgets are set'),
  f('budget-control-lv2', 'Budget Control Lv2', 'Personal Accounting', ['budget-control-lv1'], 'Variance analysis: favorable écarts month after month'),
  f('treasury-planning-lv1', 'Treasury Planning Lv1', 'Personal Accounting', ['budget-control-lv1'], 'Cash-flow forecasting and runway management'),

  // ════════ DISCIPLINE · Study & Learning rituals ════════
  d('note-taking-lv1', 'Note-Taking Lv1', 'Learning Rituals', [], 'Capture and structure what you learn from courses and books'),
  d('spaced-repetition-lv1', 'Spaced Repetition Lv1', 'Learning Rituals', ['note-taking-lv1'], 'Review on a schedule — retain instead of re-learn'),
  d('deep-focus-lv1', 'Deep Focus Lv1', 'Learning Rituals', [], 'Long uninterrupted study blocks without context switching'),
  d('teach-to-learn-lv1', 'Teach to Learn Lv1', 'Learning Rituals', ['note-taking-lv1'], 'Explain concepts simply — the Feynman technique'),
];

// Genre du livre → skill « lecteur » créditée à la fin d'un livre.
export const GENRE_TO_READER_SKILL = {
  'Action & Adventure': 'fiction-reader-lv1', Crime: 'fiction-reader-lv1', Dystopian: 'fiction-reader-lv1',
  Fantasy: 'fiction-reader-lv1', 'Historical Fiction': 'fiction-reader-lv1', Horror: 'fiction-reader-lv1',
  'Humor & Satire': 'fiction-reader-lv1', 'Literary Fiction': 'fiction-reader-lv1', 'Magical Realism': 'fiction-reader-lv1',
  Mystery: 'fiction-reader-lv1', Romance: 'fiction-reader-lv1', 'Science Fiction': 'fiction-reader-lv1',
  'Speculative Fiction': 'fiction-reader-lv1', 'Thriller & Suspense': 'fiction-reader-lv1', "Women's Fiction": 'fiction-reader-lv1',
  Philosophy: 'philosophy-reader-lv1',
  'Business & Economics': 'business-reader-lv1',
  'Science & Nature': 'science-reader-lv1', 'Health & Fitness': 'science-reader-lv1',
  History: 'history-reader-lv1', 'Politics & Current Events': 'history-reader-lv1',
  'Religion & Spirituality': 'spirituality-reader-lv1',
  'Self-Help & Personal Development': 'growth-reader-lv1', Memoir: 'growth-reader-lv1',
  Autobiography: 'growth-reader-lv1', Biography: 'growth-reader-lv1',
  Travel: 'curiosity-reader-lv1', Essays: 'curiosity-reader-lv1', 'True Crime': 'curiosity-reader-lv1',
  'Cookbooks & Culinary': 'curiosity-reader-lv1', 'Humor & Entertainment': 'curiosity-reader-lv1',
  'Art & Architecture': 'curiosity-reader-lv1',
};
