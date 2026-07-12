// ─────────────────────────────────────────────────────────────────────────────
// GRADES — a 500-level game-style rank ladder.
// A grade is reached by meeting BOTH an XP threshold AND a synergy-score gate,
// so raw grinding alone never carries you to the top: balance matters.
//   currentGrade = highest level where lifetimeXP ≥ xpRequired AND score ≥ scoreGate
// The XP curve tops out above the strongest leaderboard personality, so there is
// always headroom to climb. Names ascend across 10 thematic eras of 50 grades.
// ─────────────────────────────────────────────────────────────────────────────

// Each era: a theme (for grouping) + 10 ascending adjectives × 5 roles = 50 names.
// Adjectives are kept distinct across eras so every one of the 500 names is unique.
const ERAS = [
  {
    theme: 'The Street',
    adjectives: ['Novice', 'Raw', 'Green', 'Humble', 'Aspiring', 'Eager', 'Fledgling', 'Budding', 'Rookie', 'Nascent'],
    roles: ['Runner', 'Clerk', 'Scout', 'Trainee', 'Hustler'],
  },
  {
    theme: 'The Desk',
    adjectives: ['Bronze', 'Tempered', 'Steady', 'Diligent', 'Sharp', 'Keen', 'Rising', 'Able', 'Proven', 'Seasoned'],
    roles: ['Analyst', 'Broker', 'Dealer', 'Associate', 'Operator'],
  },
  {
    theme: 'The Floor',
    adjectives: ['Iron', 'Silver', 'Bold', 'Astute', 'Cunning', 'Resolute', 'Vigilant', 'Precise', 'Focused', 'Relentless'],
    roles: ['Trader', 'Strategist', 'Allocator', 'Underwriter', 'Arbitrageur'],
  },
  {
    theme: 'The Vault',
    adjectives: ['Gold', 'Platinum', 'Elite', 'Refined', 'Formidable', 'Distinguished', 'Peerless', 'Vaunted', 'Storied', 'Masterful'],
    roles: ['Portfolio Manager', 'Principal', 'Quant', 'Banker', 'Financier'],
  },
  {
    theme: 'The Exchange',
    adjectives: ['Diamond', 'Obsidian', 'Regal', 'Exalted', 'Vanguard', 'Paramount', 'Supreme', 'Apex', 'Crowned', 'Majestic'],
    roles: ['Partner', 'Fund Manager', 'Dealmaker', 'Architect', 'Magnate'],
  },
  {
    theme: 'The Syndicate',
    adjectives: ['Crimson', 'Azure', 'Radiant', 'Luminous', 'Ascendant', 'Cardinal', 'Zenith', 'Prime', 'Ultra', 'Sovereign'],
    roles: ['Managing Partner', 'Chief', 'Baron', 'Tycoon', 'Kingmaker'],
  },
  {
    theme: 'The Citadel',
    adjectives: ['Celestial', 'Astral', 'Empyreal', 'Ethereal', 'Stellar', 'Solar', 'Lunar', 'Nova', 'Quasar', 'Pulsar'],
    roles: ['Regent', 'Overlord', 'Warden', 'Emperor', 'Highlord'],
  },
  {
    theme: 'The Dominion',
    adjectives: ['Mythic', 'Fabled', 'Legendary', 'Timeless', 'Undying', 'Everlasting', 'Boundless', 'Immortal', 'Vast', 'Titanic'],
    roles: ['Titan', 'Colossus', 'Leviathan', 'Behemoth', 'Juggernaut'],
  },
  {
    theme: 'The Pantheon',
    adjectives: ['Divine', 'Sacred', 'Hallowed', 'Seraphic', 'Empyrean', 'Godly', 'Olympian', 'Primordial', 'Cosmic', 'Galactic'],
    roles: ['Demigod', 'Oracle', 'Archon', 'Sovereign Lord', 'Deity'],
  },
  {
    theme: 'The Cosmos',
    adjectives: ['Absolute', 'Ultimate', 'Omniscient', 'Omnipotent', 'Infinite', 'Eternal', 'Transcendent', 'Singular', 'Ineffable', 'Final'],
    roles: ['Ascendant', 'Paragon', 'Demiurge', 'Star-Forger', 'World-Shaper'],
  },
];

// Build the 500 grades once at module load.
function buildGrades() {
  const grades = [];
  const seen = new Set();
  const A = 2_000_000; // XP at grade 500 — above the top personality, always headroom
  ERAS.forEach((era, ei) => {
    for (let i = 0; i < 50; i++) {
      const level = ei * 50 + i + 1; // 1..500
      const name = `${era.adjectives[Math.floor(i / 5)]} ${era.roles[i % 5]}`;
      if (seen.has(name)) throw new Error(`Duplicate grade name: ${name}`);
      seen.add(name);
      const t = (level - 1) / 499; // 0..1
      const xpRequired = Math.round(A * Math.pow(t, 2.3));
      const scoreGate = Math.round(95 * Math.pow(t, 0.75)); // 0 → 95
      grades.push({ level, name, era: era.theme, eraIndex: ei, xpRequired, scoreGate });
    }
  });
  return grades;
}

export const GRADES_LADDER = buildGrades();
export const GRADE_ERAS = ERAS.map((e) => e.theme);

// Highest grade the user qualifies for given lifetime XP and synergy score.
// Both gates must be satisfied — grade N needs xp ≥ xpRequired(N) AND score ≥ scoreGate(N).
export function gradeFor(lifetimeXp = 0, score = 0) {
  let current = GRADES_LADDER[0];
  for (const g of GRADES_LADDER) {
    if (lifetimeXp >= g.xpRequired && score >= g.scoreGate) current = g;
    else break;
  }
  const next = GRADES_LADDER[current.level] || null; // level is 1-indexed → next is at index=level
  // Progress toward next grade: the binding gate (whichever is further away).
  let progress = 100;
  let xpProgress = 100;
  let scoreProgress = 100;
  if (next) {
    const xpSpan = next.xpRequired - current.xpRequired;
    xpProgress = xpSpan > 0 ? Math.max(0, Math.min(100, ((lifetimeXp - current.xpRequired) / xpSpan) * 100)) : 100;
    const scoreSpan = next.scoreGate - current.scoreGate;
    scoreProgress = scoreSpan > 0 ? Math.max(0, Math.min(100, ((score - current.scoreGate) / scoreSpan) * 100)) : 100;
    progress = Math.min(xpProgress, scoreProgress);
  }
  return { current, next, progress, xpProgress, scoreProgress };
}

// A pseudo lifetime-XP figure for a personality so grades line up with the
// leaderboard: the greatest legends sit near the top of the ladder.
export function gradeForXpOnly(lifetimeXp = 0) {
  let current = GRADES_LADDER[0];
  for (const g of GRADES_LADDER) {
    if (lifetimeXp >= g.xpRequired) current = g;
    else break;
  }
  return current;
}
