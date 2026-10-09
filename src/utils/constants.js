export { SKILL_TREE, SKILL_MAP, LEGACY_SKILL_MAP } from './skill-tree-data';
export { CAREER_TRACKS, CAREER_GOALS } from './professional-skills';

export const isRealApplication = (a) => a?.stage !== 'Target';
export const stageLabel = (s) => CAREER_STAGE_LABEL[s] || s;
const LEGACY_DOMAIN_LABEL = { General: 'Général', Engineering: 'Ingénierie', PE: 'Private equity' };
export const domainLabel = (d) => LEGACY_DOMAIN_LABEL[d] || d;

// Deep-work sessions — a cross-cutting focus timer, not its own life domain
// (see focusStore.js). Broader than LIFE_DOMAINS since a focus session can
// target Learning or Health too, not just the four "career" domains above.
// Every id here is a real, unlocked-from-start skill (verified against
// skill-tree-data.js / life-skills.js / professional-skills.js) — same
// mistake-avoidance as ENGINEERING_STAGE_SKILL/CAREER_STAGE_SKILL above.
// Trading, PE, Engineering, Business, Networking, Career and Content left with
// their modules (2026-10-09); past sessions keep their domain (FocusSessions.jsx).
export const FOCUS_DOMAINS = ['Learning', 'Health', 'Projects', 'Creative', 'General'];
export const FOCUS_DOMAIN_SKILL = {
  Trading: 'trading-discipline-lv1',
  PE: 'three-statement-modeling-lv1',
  Engineering: 'engineering-discipline-lv1',
  Business: 'ge-thesis',
  Learning: 'deep-focus-lv1',
  Health: 'stress-management-lv1',
  Networking: 'networking-lv1',
  Career: 'written-communication-lv1',
  Content: 'written-communication-lv1',
  Projects: 'ge-thesis',
  Creative: 'deep-focus-lv1',
  General: 'deep-focus-lv1',
};

// ── Creative practice (artists, musicians, writers) — 2026-08-27 ────────────
export const CREATIVE_MEDIUMS = ['Peinture', 'Musique', 'Écriture', 'Photographie', 'Sculpture', 'Design', 'Autre'];
export const CREATIVE_WORK_STATUSES = ['Idée', 'En cours', 'Terminé'];
export const SHOWCASE_TYPES = ['Exposition', 'Concert', 'Publication', 'Festival', 'Autre'];

export const INITIAL_ACCOUNT_VALUE = 52000;

// Per-account trading currency (Demo/Broker/Prop Firm each pick their own —
// see tradingStore.js `accounts[].currency`, default 'USD' for pre-existing
// accounts). Purely a DISPLAY symbol swap — no FX conversion between accounts
// of different currencies; cross-account aggregates (Score-3, TradingAccounts
// by-type totals) still sum raw numbers, so mixing currencies there is a
// known simplification, not a bug.
export const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'MAD', label: 'Moroccan Dirham (DH)', symbol: 'DH' },
  { value: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
];
export const CURRENCY_SYMBOL = Object.fromEntries(CURRENCIES.map((c) => [c.value, c.symbol]));
export const DIRECTIONS = ['long', 'short'];
export const EMOTIONS = ['calm', 'greedy', 'scared', 'bored', 'FOMO', 'neutral'];

// ---- Finance: grouped transaction categories ----
export const INCOME_SOURCES = [
  'Salary', 'Bonus', 'Internship Stipend', 'Demo Trading P&L', 'Real Money Trading P&L',
  'Freelance / Consulting', 'Investment Returns', 'Gifts / Inheritance', 'Other Income',
];

export const EXPENSE_CATEGORY_GROUPS = [
  { group: 'Trading & Professional', items: ['Trading Fees', 'Trading Commission', 'Spread Cost', 'Data Subscriptions', 'Trading Software', 'Education & Courses', 'Books & Reading', 'Tuition', 'Mentorship Fees', 'Professional Development'] },
  { group: 'Food & Dining', items: ['Groceries', 'Food Delivery', 'Coffee & Beverages', 'Restaurants & Dining Out'] },
  { group: 'Transportation', items: ['Gas / Fuel', 'Public Transit', 'Taxi / Rideshare', 'Parking', 'Car Maintenance'] },
  { group: 'Housing', items: ['Rent / Mortgage', 'Utilities', 'Home Maintenance', 'Home Insurance', 'Property Tax'] },
  { group: 'Entertainment', items: ['Streaming & Subscriptions', 'Gaming', 'Hobbies', 'Sports & Fitness', 'Concerts & Events'] },
  { group: 'Travel', items: ['Flights', 'Hotels', 'Car Rentals', 'Activities & Tours', 'Travel Insurance'] },
  { group: 'Health & Personal', items: ['Doctor Visits', 'Prescriptions', 'Gym Membership', 'Personal Care', 'Dental', 'Vision'] },
  { group: 'Shopping', items: ['Clothing', 'Shoes', 'Accessories', 'Furniture', 'Office Supplies', 'Household Goods'] },
  { group: 'Insurance & Taxes', items: ['Health Insurance', 'Auto Insurance', 'Life Insurance', 'Income Tax', 'Capital Gains Tax'] },
  { group: 'Savings & Investing', items: ['Brokerage Deposits', 'Crypto Purchases', 'Emergency Fund'] },
  { group: 'Other', items: ['Gifts', 'Donations', 'Pets', 'Miscellaneous'] },
];
export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.items);

// ---- Finance: net worth composition ----
export const ASSET_TYPES = [
  { key: 'cash', label: 'Cash (checking + savings)' },
  { key: 'demoAccount', label: 'Demo trading account' },
  { key: 'realMoneyAccount', label: 'Real money trading account' },
  { key: 'brokerage', label: 'Brokerage accounts' },
  { key: 'crypto', label: 'Cryptocurrency' },
  { key: 'bonds', label: 'Bonds' },
  { key: 'realEstate', label: 'Real estate' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'collectibles', label: 'Collectibles' },
  { key: 'otherAssets', label: 'Other assets' },
];
export const LIABILITY_TYPES = [
  { key: 'studentLoans', label: 'Student loans' },
  { key: 'creditCards', label: 'Credit card debt' },
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'personalLoans', label: 'Personal loans' },
  { key: 'marginDebt', label: 'Margin debt' },
  { key: 'otherLiabilities', label: 'Other liabilities' },
];

// Trading / engineering / career left the list with their modules (2026-10-09);
// habits already filed under them keep that category (see Habits.jsx).
export const HABIT_CATEGORIES = ['learning', 'finance', 'health', 'reflection', 'recovery'];
// 'custom' = repeats only on the specific weekdays chosen in `habit.weekdays`
// (e.g. Heavy Weight Lifting on Mon/Wed/Fri) — see utils/calculations.js#isHabitDueOn.
// Labeled explicitly (not plain strings) so the day-picker option is discoverable
// in the dropdown itself, rather than reading as the bare word "custom".
export const HABIT_FREQUENCIES = [
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekly', label: 'X fois par semaine' },
  { value: 'custom', label: 'Certains jours (ex. lun/mer/ven)' },
];
export const WEEKDAYS = [
  { value: 'mon', label: 'Lun' },
  { value: 'tue', label: 'Mar' },
  { value: 'wed', label: 'Mer' },
  { value: 'thu', label: 'Jeu' },
  { value: 'fri', label: 'Ven' },
  { value: 'sat', label: 'Sam' },
  { value: 'sun', label: 'Dim' },
];
export const MOODS = ['great', 'good', 'okay', 'bad', 'terrible'];
export const MOOD_LABELS = { great: 'Excellente', good: 'Bonne', okay: 'Correcte', bad: 'Mauvaise', terrible: 'Très mauvaise' };
export const RECOVERY_ACTIVITIES = ['exercise', 'meditation', 'walk', 'social', 'hobby', 'rest'];
export const RECOVERY_LABELS = { exercise: 'Sport', meditation: 'Méditation', walk: 'Marche', social: 'Moment social', hobby: 'Loisir', rest: 'Repos' };
export const HABIT_CATEGORY_LABELS = { trading: 'Trading', learning: 'Apprentissage', finance: 'Finances', health: 'Santé', reflection: 'Réflexion', recovery: 'Récupération', engineering: 'Ingénierie', career: 'Carrière' };
// When in the day a habit happens — groups the daily checklist.
export const HABIT_MOMENTS = [
  { value: 'morning', label: 'Matin' },
  { value: 'day', label: 'Journée' },
  { value: 'evening', label: 'Soir' },
  { value: 'any', label: 'N’importe quand' },
];

// Optional link from a habit to a Health-page activity type: completing the habit
// queues a one-tap "log it in Health?" prompt (see healthStore#queueHabitPrompt).
export const HEALTH_LINK_TYPES = [
  { value: '', label: 'Aucun' },
  { value: 'cardio', label: 'Séance de cardio' },
  { value: 'strength', label: 'Séance de musculation' },
  { value: 'recovery', label: 'Activité de récupération' },
  { value: 'mindfulness', label: 'Pleine conscience / stress' },
  { value: 'nutrition', label: 'Nutrition / protéines' },
  { value: 'sleep', label: 'Suivi du sommeil' },
  { value: 'reflection', label: 'Réflexion santé' },
];

export const STRESS_ITEMS = [
  { key: 'heartPalpitations', label: 'Palpitations' },
  { key: 'muscleTension', label: 'Tensions musculaires' },
  { key: 'difficultyFocusing', label: 'Difficulté à se concentrer' },
  { key: 'sleepDisruption', label: 'Sommeil perturbé' },
  { key: 'emotionalReactivity', label: 'Réactivité émotionnelle' },
  { key: 'stomachTension', label: 'Ventre noué' },
  { key: 'overwhelm', label: 'Sentiment d’être débordé' },
  { key: 'socialWithdrawal', label: 'Repli sur soi' },
  { key: 'appetiteChange', label: 'Appétit changé' },
  { key: 'procrastination', label: 'Procrastination' },
];

export const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
export const GRADE_XP = { A: 15, 'B+': 12, B: 10, 'C+': 7, C: 5, D: 0, F: 0 };
export const GRADE_POINTS = { A: 4.0, 'B+': 3.5, B: 3.0, 'C+': 2.5, C: 2.0, D: 1.0, F: 0.0 };

// XP needed to advance FROM a given level to the next one
export const XP_TO_NEXT = { 1: 50, 2: 100, 3: 200, 4: 300, 5: Infinity };
export const LEVEL_NAMES = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Avancé', 4: 'Expert', 5: 'Maître' };

export const SYNERGY_DOMAINS = ['trading', 'learning', 'finance', 'health', 'growth'];

export const GOAL_TYPES = [
  { value: 'netWorth', label: 'Net worth target' },
  { value: 'account', label: 'Trading account target' },
  { value: 'custom', label: 'Custom amount' },
];

// ---- Finance: cost accounting (comptabilité des coûts) ----
// Every expense is classified by cost behavior — mirrors fixed/variable/exceptional
// splits used in cost accounting to separate "committed" spend from discretionary spend.
export const COST_TYPES = [
  { value: 'fixed', label: 'Fixe (loyer, abonnements, dettes)' },
  { value: 'variable', label: 'Variable (courant, discrétionnaire)' },
  { value: 'exceptional', label: 'Exceptionnel (ponctuel, non récurrent)' },
];

// Category → default cost behavior. Anything not listed defaults to 'variable'.
export const DEFAULT_COST_TYPE_BY_CATEGORY = {
  'Rent / Mortgage': 'fixed', Utilities: 'fixed', 'Home Insurance': 'fixed', 'Property Tax': 'fixed',
  'Streaming & Subscriptions': 'fixed', 'Data Subscriptions': 'fixed', 'Trading Software': 'fixed',
  'Gym Membership': 'fixed', 'Health Insurance': 'fixed', 'Auto Insurance': 'fixed', 'Life Insurance': 'fixed',
  Tuition: 'fixed', 'Income Tax': 'fixed',
  Flights: 'exceptional', Hotels: 'exceptional', 'Car Rentals': 'exceptional', 'Travel Insurance': 'exceptional',
  Furniture: 'exceptional', 'Capital Gains Tax': 'exceptional', 'Car Maintenance': 'exceptional', 'Home Maintenance': 'exceptional',
};

export const RECURRING_FREQUENCIES = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'annual', label: 'Annuel' },
];

// Liquidity classification for treasury ratios (comptes rapidement mobilisables vs. non liquides).
export const LIQUID_ASSET_KEYS = ['cash', 'brokerage', 'crypto', 'demoAccount', 'realMoneyAccount'];
export const SHORT_TERM_LIABILITY_KEYS = ['creditCards', 'marginDebt'];
