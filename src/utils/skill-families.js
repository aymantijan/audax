// The skill tree as the person sees it. Storage still keeps the historical
// nodes ("DCF Analysis Lv1", "…Lv2") that 50+ call sites award XP to; here
// those chains are folded into ONE compétence ("family") with ONE level 0-5.
//
// Rules (inspired by progression systems where every real action is absorbed):
//  - every activity counts, even on a compétence not yet "discovered";
//  - a level needs points AND a number of separate activities;
//  - levels 4 and 5 are capped until a real proof is added (exam passed,
//    certificate, delivered project, validated result);
//  - a level reached is kept forever (mastery), even after a pause;
//  - everything earned before the new rules (CUTOVER) is honoured on points alone.
//
// Pure module — imported by the store, the pages and node tests (.js imports).

import { SKILL_TREE } from './skill-tree-data.js';
import { FAMILY_LABELS_FR, BRANCH_LABELS_FR } from './skill-labels-fr.js';

export const CUTOVER = Date.UTC(2026, 8, 28, 12); // 28 Sept 2026 — new rules start

export const LEVELS = [
  { level: 1, points: 1, activities: 1, proofs: 0 },
  { level: 2, points: 50, activities: 3, proofs: 0 },
  { level: 3, points: 150, activities: 8, proofs: 0 },
  { level: 4, points: 350, activities: 15, proofs: 1 },
  { level: 5, points: 650, activities: 25, proofs: 2 },
];
export const LEVEL_LABELS = ['Pas commencée', 'Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Maître'];
export const UNLOCK_LEVEL = 2; // a compétence opens its dependents at this level

export const PROOF_KINDS = [
  { id: 'exam', label: 'Examen réussi' },
  { id: 'certificate', label: 'Certificat ou diplôme' },
  { id: 'project', label: 'Projet livré' },
  { id: 'result', label: 'Résultat mesuré' },
  { id: 'other', label: 'Autre preuve' },
];

// Models = groups a person switches on. The 3D view draws one cluster per model.
export const MODELS = [
  { id: 'discipline', label: 'Discipline et méthode', hint: 'Régularité, apprentissage, décisions', defaultOn: true },
  { id: 'sante', label: 'Santé', hint: 'Sport, sommeil, alimentation', defaultOn: true },
  { id: 'lecture', label: 'Lecture', hint: 'Lire, finir ses livres, genres', defaultOn: true },
  { id: 'savoir-etre', label: 'Savoir-être', hint: 'Communication, leadership, résilience', defaultOn: true },
  { id: 'argent', label: 'Finances personnelles', hint: 'Budget, comptabilité, trésorerie', defaultOn: true },
  { id: 'finance', label: 'Finance d’entreprise', hint: 'Évaluation, modélisation, risques' },
  { id: 'marches', label: 'Marchés et économie', hint: 'Macroéconomie, analyse technique, crypto' },
  { id: 'investissement', label: 'Investissement', hint: 'Capital-investissement, capital-risque, croissance' },
  { id: 'trading', label: 'Trading', hint: 'Strategies, instruments, risk, psychology' },
  { id: 'ingenierie', label: 'Ingénierie des procédés', hint: 'Thermodynamique, réacteurs, sécurité' },
  { id: 'iscae', label: 'Cursus ISCAE', hint: 'Comptabilité, droit, gestion — modèle d’école' },
];
export const MODEL_MAP = Object.fromEntries(MODELS.map((m) => [m.id, m]));
export const DEFAULT_MODELS = MODELS.filter((m) => m.defaultOn).map((m) => m.id);

const BRANCH_MODEL = {
  'Learning Discipline': 'discipline', 'Financial Discipline': 'discipline', 'Decision-Making Discipline': 'discipline',
  'Learning Rituals': 'discipline', 'Reading & Literature': 'lecture', 'Personal Accounting': 'argent',
  'Health Discipline': 'sante', 'Trading Discipline': 'trading', 'Engineering Discipline': 'ingenierie',
};
const CATEGORY_MODEL = {
  Trading: 'trading', 'Advanced Trading': 'trading', Finance: 'finance', Knowledge: 'marches',
  'Soft Skills': 'savoir-etre', Health: 'sante', Discipline: 'discipline', Engineering: 'ingenierie',
  'Private Equity': 'investissement', 'Growth Equity': 'investissement', 'Venture Capital': 'investissement',
  'Revenue-Based Financing': 'investissement', 'Academics (ISCAE)': 'iscae',
};

export const familyIdOf = (nodeId) => String(nodeId || '').replace(/-lv\d+$/, '');
const tierOf = (nodeId) => Number((/-lv(\d+)$/.exec(nodeId) || [])[1] || 1);

function buildFamilies() {
  const fams = {};
  for (const def of SKILL_TREE) {
    const id = familyIdOf(def.id);
    if (!fams[id]) {
      const model = BRANCH_MODEL[def.subcategory] || CATEGORY_MODEL[def.category] || 'marches';
      const fr = FAMILY_LABELS_FR[id];
      fams[id] = {
        id,
        name: fr ? fr[0] : def.name.replace(/ Lv\d+$/, ''),
        desc: fr ? fr[1] : def.description,
        model,
        branch: BRANCH_LABELS_FR[def.subcategory] || def.subcategory,
        nodes: [],
        stages: [], // per-node descriptions: the path from Lv1 to the last tier
        prereqs: new Set(),
      };
    }
    fams[id].nodes.push(def.id);
    fams[id].stages.push(def.description);
    for (const p of def.prereqs) if (familyIdOf(p) !== id) fams[id].prereqs.add(familyIdOf(p));
  }
  const list = Object.values(fams).map((f) => {
    const order = f.nodes.map((n, i) => [tierOf(n), n, f.stages[i]]).sort((a, b) => a[0] - b[0]);
    return { ...f, nodes: order.map((o) => o[1]), stages: order.map((o) => o[2]), prereqs: [...f.prereqs].filter((p) => fams[p]), dependents: [] };
  });
  const byId = Object.fromEntries(list.map((f) => [f.id, f]));
  for (const f of list) for (const p of f.prereqs) byId[p].dependents.push(f.id);
  return { list, byId };
}

const BUILT = buildFamilies();
export const FAMILIES = BUILT.list;
export const FAMILY_MAP = BUILT.byId;
/** The node XP should be sent to when a family is picked (its first tier). */
export const entryNodeOf = (familyId) => FAMILY_MAP[familyId]?.nodes[0] || familyId;
/** Display name for any stored node id (or family id). */
export const skillLabel = (id) => FAMILY_MAP[familyIdOf(id)]?.name || id;

function levelFrom(points, activities, proofs, { ignoreProofs = false, ignoreActivities = false } = {}) {
  let level = 0;
  for (const r of LEVELS) {
    if (points < r.points) break;
    if (!ignoreActivities && activities < r.activities) break;
    if (!ignoreProofs && proofs < r.proofs) break;
    level = r.level;
  }
  return level;
}

/**
 * Raw progress of one family from the stored nodes.
 * skills: store `skills` map (node id → { xpLog, manualAcquired, … })
 */
export function familyTotals(fam, skills) {
  let points = 0, activities = 0, legacyPoints = 0, last = 0, manual = false;
  const sources = new Set();
  const recent = [];
  for (const nodeId of fam.nodes) {
    const s = skills?.[nodeId];
    if (!s) continue;
    if (s.manualAcquired) manual = true;
    for (const e of s.xpLog || []) {
      const amt = Number(e.amount) || 0;
      points += amt;
      if (amt > 0) {
        activities++;
        if (e.date < CUTOVER) legacyPoints += amt;
        if (e.date > last) last = e.date;
        sources.add(String(e.source || 'manual').split(':')[0].trim().toLowerCase());
        recent.push(e);
      } else if (amt < 0 && e.date < CUTOVER) legacyPoints += amt;
    }
  }
  recent.sort((a, b) => b.date - a.date);
  return { points: Math.max(0, points), activities, legacyPoints: Math.max(0, legacyPoints), last: last || null, manual, sources: sources.size, recent: recent.slice(0, 30) };
}

const legacyLevel = (t) => Math.max(levelFrom(t.legacyPoints, 0, 0, { ignoreProofs: true, ignoreActivities: true }), t.manual ? 2 : 0);

/** Level 0-5 of one compétence, from a stored node id or a family id. */
export function familyLevelOf(store, id) {
  const fam = FAMILY_MAP[familyIdOf(id)];
  if (!fam) return 0;
  const t = familyTotals(fam, store?.skills);
  const earned = levelFrom(t.points, t.activities, (store?.proofs?.[fam.id] || []).length);
  return Math.max(earned, legacyLevel(t), Number(store?.mastery?.[fam.id]) || 0);
}

/**
 * Every family's state in one pass.
 * store: { skills, proofs, mastery } — proofs: { famId: [...] }, mastery: { famId: bestLevel }
 * Returns { [famId]: { level, earned, capped, points, activities, proofCount, next, status, available, last, … } }
 */
export function computeFamilyStates(store) {
  const { skills = {}, proofs = {}, mastery = {} } = store || {};
  const out = {};
  for (const fam of FAMILIES) {
    const t = familyTotals(fam, skills);
    const proofCount = (proofs[fam.id] || []).length;
    const earned = levelFrom(t.points, t.activities, proofCount);
    const withoutProof = levelFrom(t.points, t.activities, Infinity);
    const level = Math.max(earned, legacyLevel(t), Number(mastery[fam.id]) || 0);
    const nextRule = LEVELS.find((r) => r.level === level + 1) || null;
    const next = nextRule && {
      level: nextRule.level,
      points: Math.max(0, nextRule.points - t.points),
      activities: Math.max(0, nextRule.activities - t.activities),
      proofs: Math.max(0, nextRule.proofs - proofCount),
      pointsPct: Math.min(1, t.points / nextRule.points),
    };
    out[fam.id] = {
      ...t, id: fam.id, level, earned, proofCount, next,
      // Points and activities are there but a proof is missing: the "ceiling".
      capped: !!next && next.points === 0 && next.activities === 0 && next.proofs > 0 && withoutProof > level,
    };
  }
  for (const fam of FAMILIES) {
    const s = out[fam.id];
    s.available = fam.prereqs.every((p) => (out[p]?.level || 0) >= UNLOCK_LEVEL);
    s.status = s.level >= 5 ? 'mastered' : s.level >= 1 ? 'active' : s.available ? 'available' : 'locked';
  }
  return out;
}

/**
 * Families to draw: every family of an active model, anything already
 * practised, and anything the person linked from a course, habit or plan.
 */
export function visibleFamilyIds(states, activeModels = DEFAULT_MODELS, linked = new Set()) {
  const on = new Set(activeModels);
  return FAMILIES.filter((f) => on.has(f.model) || (states[f.id]?.level || 0) > 0 || linked.has(f.id)).map((f) => f.id);
}

/** Plain-French list of what the next level still needs. */
export function nextRequirementText(state) {
  const n = state?.next;
  if (!n) return 'Niveau maximal atteint — maîtrise permanente.';
  const parts = [];
  if (n.points > 0) parts.push(`${n.points} point${n.points > 1 ? 's' : ''}`);
  if (n.activities > 0) parts.push(`${n.activities} activité${n.activities > 1 ? 's' : ''} de plus`);
  if (n.proofs > 0) parts.push(`${n.proofs} preuve${n.proofs > 1 ? 's' : ''} (examen, certificat, projet…)`);
  return `Pour le niveau ${n.level} : ${parts.join(' · ')}`;
}

/** Families that became available between two state maps (for unlock effects). */
export function newlyAvailable(before, after) {
  return FAMILIES.filter((f) => !before[f.id]?.available && after[f.id]?.available && (f.prereqs.length > 0)).map((f) => f.id);
}
