import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SKILL_TREE, SKILL_MAP, LEGACY_SKILL_MAP, XP_TO_NEXT } from '../utils/constants';
import { advance, preview, freshMomentumState, CONSISTENCY_CONFIG } from '../utils/momentum';
import { domainXpBreakdown } from '../utils/xp-domains';
import { todayKey } from '../utils/formatters';
import { toast } from './uiStore';
import { computeFamilyStates, familyIdOf, newlyAvailable, FAMILY_MAP, DEFAULT_MODELS } from '../utils/skill-families';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const freshSkills = () =>
  Object.fromEntries(
    SKILL_TREE.map((def) => [
      def.id,
      {
        id: def.id,
        level: 1,
        xp: 0,
        xpLog: [],
        levelUpDates: [],
        lastPracticed: null,
        decayStatus: 'active',
        locked: def.prereqs.length > 0,
      },
    ])
  );

// Unlock any skill whose prereqs are all Lv2+. Silent mode for migrations.
function recomputeUnlocks(skills, { silent = false } = {}) {
  const next = { ...skills };
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of SKILL_TREE) {
      if (next[def.id]?.locked && def.prereqs.every((p) => (next[p]?.level ?? 0) >= 2)) {
        next[def.id] = { ...next[def.id], locked: false };
        if (!silent) toast(`Compétence débloquée : ${def.name}`, 'success');
        changed = true;
      }
    }
  }
  return next;
}

// v2 migration: map legacy MVP skill ids onto the expanded 211-skill tree,
// preserving XP, levels, and history. Unknown ids are dropped.
function migrateSkills(persisted) {
  const fresh = freshSkills();
  if (!persisted?.skills) return { skills: fresh };
  for (const [oldId, old] of Object.entries(persisted.skills)) {
    const target = fresh[oldId] ? oldId : LEGACY_SKILL_MAP[oldId];
    if (!target || !fresh[target]) continue;
    const cur = fresh[target];
    fresh[target] = {
      ...cur,
      level: Math.min(5, Math.max(cur.level, old.level || 1)),
      xp: (cur.xp || 0) + (old.xp || 0),
      xpLog: [...cur.xpLog, ...(old.xpLog || [])],
      levelUpDates: [...cur.levelUpDates, ...(old.levelUpDates || [])],
      lastPracticed: Math.max(cur.lastPracticed || 0, old.lastPracticed || 0) || null,
      decayStatus: old.decayStatus || 'active',
    };
  }
  return { skills: recomputeUnlocks(fresh, { silent: true }) };
}

export const useSkillStore = create(
  persist(
    (set, get) => ({
      skills: freshSkills(),
      consistency: freshMomentumState(), // global XP consistency multiplier — see utils/momentum.js
      proofs: {}, // familyId → [{ id, kind, title, date, note }] — lifts the level-4/5 cap
      mastery: {}, // familyId → best level ever reached (kept forever)
      activeModels: DEFAULT_MODELS, // skill-tree models shown (see utils/skill-families.js)

      // THE single choke point every domain funnels XP through (trades, courses,
      // readings, habits, journal entries...). That makes it the one place to
      // apply a cross-app "consistency multiplier": sustained daily engagement
      // compounds toward a 1.25x bonus, while a burst after a long gap is
      // dampened toward 0.7x. This is what actually rewards working like the
      // disciplined, decades-consistent personalities on the Leaderboard,
      // instead of just letting raw grinding close the gap.
      awardXP: (skillId, amount, source = 'manual') => {
        const skill = get().skills[skillId];
        // Every real activity counts, even on a compétence not yet discovered.
        if (!skill || amount <= 0) return;
        const before = computeFamilyStates(get());
        const today = todayKey();
        const multiplier = preview(get().consistency, today, CONSISTENCY_CONFIG).momentum;
        const effective = Math.max(1, Math.round(amount * multiplier));

        let { level, xp } = skill;
        xp += effective;
        const levelUpDates = [...skill.levelUpDates];
        let leveled = false;
        while (level < 5 && xp >= XP_TO_NEXT[level]) {
          xp -= XP_TO_NEXT[level];
          level++;
          levelUpDates.push(Date.now());
          leveled = true;
        }
        let skills = {
          ...get().skills,
          [skillId]: {
            ...skill,
            level,
            xp,
            levelUpDates,
            lastPracticed: Date.now(),
            decayStatus: 'active',
            xpLog: [...skill.xpLog, { date: Date.now(), amount: effective, source, rawAmount: amount, multiplier }],
          },
        };
        skills = recomputeUnlocks(skills, { silent: true });
        const famId = familyIdOf(skillId);
        const after = computeFamilyStates({ ...get(), skills });
        const from = before[famId]?.level || 0;
        const to = after[famId]?.level || 0;
        const mastery = to > (get().mastery?.[famId] || 0) ? { ...get().mastery, [famId]: to } : get().mastery;
        set({ skills, mastery, consistency: advance(get().consistency, today, CONSISTENCY_CONFIG) });
        const unlocked = newlyAvailable(before, after);
        const name = FAMILY_MAP[famId]?.name || skillId;
        if (to > from) toast(`${name} passe au niveau ${to} !`, 'success');
        else if (after[famId]?.capped && !before[famId]?.capped) toast(`${name} : ajoute une preuve pour passer au niveau ${to + 1}`, 'info');
        for (const id of unlocked.slice(0, 3)) toast(`Nouvelle compétence débloquée : ${FAMILY_MAP[id].name}`, 'success');
      },

      // Reverse XP (e.g. trade deleted). Simple subtraction, no de-leveling below current floor.
      removeXP: (skillId, amount, source = 'reversal') => {
        const skill = get().skills[skillId];
        if (!skill) return;
        const xp = Math.max(0, skill.xp - amount);
        set({
          skills: {
            ...get().skills,
            [skillId]: { ...skill, xp, xpLog: [...skill.xpLog, { date: Date.now(), amount: -amount, source }] },
          },
        });
      },

      // A proof lifts the level cap (levels 4 and 5): exam passed, certificate,
      // delivered project, measured result.
      addProof: (familyId, { kind = 'other', title = '', date = '', note = '' }) => {
        if (!FAMILY_MAP[familyId] || !title.trim()) return;
        const before = computeFamilyStates(get());
        const proof = { id: uid(), kind, title: title.trim(), date: date || todayKey(), note: note.trim(), createdAt: Date.now() };
        const proofs = { ...get().proofs, [familyId]: [...(get().proofs?.[familyId] || []), proof] };
        const after = computeFamilyStates({ ...get(), proofs });
        const from = before[familyId]?.level || 0;
        const to = after[familyId]?.level || 0;
        const mastery = to > (get().mastery?.[familyId] || 0) ? { ...get().mastery, [familyId]: to } : get().mastery;
        set({ proofs, mastery });
        toast(to > from ? `${FAMILY_MAP[familyId].name} passe au niveau ${to} !` : 'Preuve ajoutée', 'success');
      },

      // A level already reached stays (mastery); removing a proof only affects what comes next.
      removeProof: (familyId, proofId) => {
        const list = (get().proofs?.[familyId] || []).filter((p) => p.id !== proofId);
        set({ proofs: { ...get().proofs, [familyId]: list } });
      },

      toggleModel: (modelId) => {
        const cur = get().activeModels || DEFAULT_MODELS;
        set({ activeModels: cur.includes(modelId) ? cur.filter((m) => m !== modelId) : [...cur, modelId] });
      },

      // Total positive XP ever earned across all skills — the literal, raw
      // total shown on the Leaderboard ("Lifetime XP" stat) AND what grade
      // progression itself is gated on (gradeFor(getLifetimeXP(), score)).
      // A domain-balanced/diminishing-returns variant was tried and
      // explicitly rejected by the user as too opaque — removed.
      getLifetimeXP: () =>
        Object.values(get().skills)
          .flatMap((s) => s.xpLog || [])
          .filter((e) => e.amount > 0)
          .reduce((a, e) => a + e.amount, 0),

      // Raw positive XP split across the 5 synergy domains (trading/finance/
      // health/learning/growth) — powers the informational "Domain balance"
      // breakdown UI, no longer tied to grade gating.
      getDomainXP: () => domainXpBreakdown(get().skills),

      // Live consistency multiplier (0.7–1.25) + current cross-app streak.
      getConsistencyState: () => preview(get().consistency, todayKey(), CONSISTENCY_CONFIG),

      resetAll: () => set({ skills: freshSkills(), consistency: freshMomentumState(), proofs: {}, mastery: {}, activeModels: DEFAULT_MODELS }),
    }),
    {
      name: 'audax-skills',
      version: 2,
      migrate: (persisted, version) => (version < 2 ? migrateSkills(persisted) : persisted),
      // Backfill any tree nodes added after the user's data was persisted
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        skills: { ...freshSkills(), ...(persisted?.skills || {}) },
      }),
    }
  )
);
