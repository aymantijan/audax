// ─────────────────────────────────────────────────────────────────────────────
// WEALTH RANKS — a 100-level ladder from poorest to richest, gated PURELY on
// net worth (ANCC, defined in DH and converted to each person's currency — see ladderIn) — unlike the Leaderboard's grade ladder (grades.js),
// this one has nothing to do with XP. A rank is reached the moment your ANCC
// crosses its threshold; it can also be LOST if your ANCC drops back below it
// (this is a live reading of your current wealth, not a one-way achievement
// ladder like grades — a net-worth rank you no longer qualify for isn't
// something you "keep" once life gets more expensive).
// Same generator shape as grades.js (era × adjective × role), scaled down to
// 100 names across 10 wealth eras instead of 500.
// ─────────────────────────────────────────────────────────────────────────────

const ERAS = [
  { theme: 'Le Départ', adjectives: ['Fauché', 'Précaire', 'Modeste', 'Naissant', 'Timide'], roles: ['Épargnant', 'Débutant'] },
  { theme: 'La Stabilité', adjectives: ['Stable', 'Constant', 'Régulier', 'Posé', 'Ancré'], roles: ['Épargnant', 'Gestionnaire'] },
  { theme: 'Le Confort', adjectives: ['Confortable', 'Serein', 'Tranquille', 'Équilibré', 'Rassuré'], roles: ['Investisseur', 'Propriétaire'] },
  { theme: "L'Aisance", adjectives: ['Prospère', 'Avisé', 'Astucieux', 'Habile', 'Perspicace'], roles: ['Investisseur', 'Entrepreneur'] },
  { theme: 'La Réussite', adjectives: ['Accompli', 'Brillant', 'Talentueux', 'Distingué', 'Estimé'], roles: ['Entrepreneur', 'Actionnaire'] },
  { theme: 'La Prospérité', adjectives: ['Opulent', 'Abondant', 'Fastueux', 'Éclatant', 'Triomphant'], roles: ['Magnat', 'Financier'] },
  { theme: 'La Richesse', adjectives: ['Riche', 'Fortuné', 'Doré', 'Luxueux', 'Éminent'], roles: ['Magnat', 'Baron'] },
  { theme: 'La Fortune', adjectives: ['Immense', 'Colossal', 'Majestueux', 'Grandiose', 'Monumental'], roles: ['Baron', 'Industriel'] },
  { theme: "L'Empire", adjectives: ['Impérial', 'Suprême', 'Absolu', 'Céleste', 'Divin'], roles: ['Empereur', 'Titan'] },
  { theme: 'La Légende', adjectives: ['Légendaire', 'Mythique', 'Ultime', 'Cosmique', 'Éternel'], roles: ['Légende', 'Titan'] },
];

const CEILING_DH = 20_000_000; // level 100 — always headroom above it, same philosophy as grades.js
const EXPONENT = 2.5; // convex: early levels are close together, the last stretch takes real money

function buildWealthLadder() {
  const ranks = [];
  const seen = new Set();
  ERAS.forEach((era, ei) => {
    for (let i = 0; i < 10; i++) {
      const level = ei * 10 + i + 1; // 1..100
      const name = `${era.adjectives[Math.floor(i / 2)]} ${era.roles[i % 2]}`;
      if (seen.has(name)) throw new Error(`Duplicate wealth rank name: ${name}`);
      seen.add(name);
      const t = (level - 1) / 99; // 0..1
      const threshold = Math.round(CEILING_DH * Math.pow(t, EXPONENT));
      ranks.push({ level, name, era: era.theme, eraIndex: ei, threshold });
    }
  });
  return ranks;
}

export const WEALTH_LADDER = buildWealthLadder();
export const WEALTH_ERAS = ERAS.map((e) => e.theme);

// The ladder is defined in dirhams; `factor` = value of 1 dirham in the
// person's own currency (rateFor('MAD', base, rates)), so a euro account
// climbs the same real-money ladder instead of one ten times easier.
export function ladderIn(factor = 1) {
  if (factor === 1) return WEALTH_LADDER;
  return WEALTH_LADDER.map((r) => ({ ...r, threshold: Math.round(r.threshold * factor) }));
}

// Highest rank whose threshold your CURRENT ancc meets. A live reading, not a
// one-way ratchet — pass the current getNetWorth().ancc value.
export function wealthRankFor(ancc = 0, ladder = WEALTH_LADDER) {
  let current = ladder[0];
  for (const r of ladder) {
    if (ancc >= r.threshold) current = r;
    else break;
  }
  const next = ladder[current.level] || null; // level is 1-indexed → next is at index=level
  let progress = 100;
  if (next) {
    const span = next.threshold - current.threshold;
    progress = span > 0 ? Math.max(0, Math.min(100, ((ancc - current.threshold) / span) * 100)) : 100;
  }
  return { current, next, progress };
}
