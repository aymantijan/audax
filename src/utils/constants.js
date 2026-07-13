export { SKILL_TREE, SKILL_MAP, LEGACY_SKILL_MAP } from './skill-tree-data';
export { CAREER_TRACKS, CAREER_GOALS } from './professional-skills';

// Derived skill ids for a trade's auto-award (only unlocked skills actually receive XP).
export const STRATEGY_SKILL = { Trend: 'trend-following-lv1', Range: 'range-trading-lv1', Breakout: 'breakout-trading-lv1' };
export const INSTRUMENT_SKILL = { EURUSD: 'eurusd-mastery-lv1', GBPUSD: 'gbpusd-mastery-lv1', USDJPY: 'usdjpy-mastery-lv1', XAUUSD: 'gold-mastery-lv1', BTC: 'bitcoin-mastery-lv1' };
export const MACRO_SKILL = { fedPolicy: 'central-bank-policy-lv1', inflation: 'inflation-cpi-lv1', growth: 'gdp-growth-data-lv1', riskSentiment: 'at-risk-onoff', volatility: 'volatility-analysis-lv1', usdStrength: 'capital-flows-lv1' };

// Deal types → the PE/VC/GE/RBF skills they build (deal logging auto-award).
export const DEAL_TYPES = ['LBO', 'Growth', 'VC', 'RBF', 'M&A', 'Distressed'];
export const DEAL_ROLES = ['Sourcing', 'Due Diligence', 'Modeling', 'Execution', 'Portfolio Ops'];
export const DEAL_STATUS = ['ongoing', 'completed', 'passed'];
export const DEAL_SKILL = {
  LBO: ['pe-lbo-value-creation-lv1', 'pe-debt-structuring', 'pe-acquisition-valuation'],
  Growth: ['ge-thesis', 'ge-scaling-strategy', 'ge-saas-metrics'],
  VC: ['vc-thesis', 'vc-startup-eval', 'vc-term-sheets'],
  RBF: ['rbf-mechanics', 'rbf-structure', 'rbf-vs-equity'],
  'M&A': ['ma-strategy-lv1', 'deal-structure-lv1', 'synergy-analysis-lv1'],
  Distressed: ['bankruptcy-distress-lv1', 'credit-analysis-lv1'],
};

export const INITIAL_ACCOUNT_VALUE = 52000;

export const INSTRUMENTS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTC'];
export const STRATEGIES = ['Trend', 'Range', 'Breakout'];
export const DIRECTIONS = ['long', 'short'];
export const EMOTIONS = ['calm', 'greedy', 'scared', 'bored', 'FOMO', 'neutral'];

// ---- Macro context tags (optional per trade) ----
export const MACRO_FIELDS = [
  { key: 'fedPolicy', label: 'Fed policy', options: ['hiking', 'pausing', 'cutting'] },
  { key: 'inflation', label: 'Inflation', options: ['rising', 'stable', 'falling'] },
  { key: 'growth', label: 'Growth outlook', options: ['strong', 'moderate', 'weak'] },
  { key: 'riskSentiment', label: 'Risk sentiment', options: ['risk-on', 'neutral', 'risk-off'] },
  { key: 'volatility', label: 'Volatility', options: ['low', 'normal', 'high'] },
  { key: 'usdStrength', label: 'USD', options: ['strong', 'neutral', 'weak'] },
];

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

export const HABIT_CATEGORIES = ['trading', 'learning', 'finance', 'health', 'reflection', 'recovery'];
// 'custom' = repeats only on the specific weekdays chosen in `habit.weekdays`
// (e.g. Heavy Weight Lifting on Mon/Wed/Fri) — see utils/calculations.js#isHabitDueOn.
// Labeled explicitly (not plain strings) so the day-picker option is discoverable
// in the dropdown itself, rather than reading as the bare word "custom".
export const HABIT_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Specific days (e.g. Mon/Wed/Fri)' },
];
export const WEEKDAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];
export const MOODS = ['great', 'good', 'okay', 'bad', 'terrible'];
export const RECOVERY_ACTIVITIES = ['exercise', 'meditation', 'walk', 'social', 'hobby', 'rest'];

export const STRESS_ITEMS = [
  { key: 'heartPalpitations', label: 'Heart palpitations' },
  { key: 'muscleTension', label: 'Muscle tension' },
  { key: 'difficultyFocusing', label: 'Difficulty focusing' },
  { key: 'sleepDisruption', label: 'Sleep disruption' },
  { key: 'emotionalReactivity', label: 'Emotional reactivity' },
  { key: 'stomachTension', label: 'Stomach tension' },
  { key: 'overwhelm', label: 'Feeling overwhelmed' },
  { key: 'socialWithdrawal', label: 'Social withdrawal' },
  { key: 'appetiteChange', label: 'Appetite change' },
  { key: 'procrastination', label: 'Procrastination' },
];

export const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
export const GRADE_XP = { A: 15, 'B+': 12, B: 10, 'C+': 7, C: 5, D: 0, F: 0 };
export const GRADE_POINTS = { A: 4.0, 'B+': 3.5, B: 3.0, 'C+': 2.5, C: 2.0, D: 1.0, F: 0.0 };

export const TRADE_XP = 5; // XP per linked skill when a trade is logged

// XP needed to advance FROM a given level to the next one
export const XP_TO_NEXT = { 1: 50, 2: 100, 3: 200, 4: 300, 5: Infinity };
export const LEVEL_NAMES = { 1: 'Novice', 2: 'Intermediate', 3: 'Advanced', 4: 'Expert', 5: 'Master' };

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
