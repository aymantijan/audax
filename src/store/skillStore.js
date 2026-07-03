import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SKILL_TREE, SKILL_MAP, LEGACY_SKILL_MAP, XP_TO_NEXT } from '../utils/constants';
import { toast } from './uiStore';

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
        if (!silent) toast(`Skill unlocked: ${def.name}`, 'success');
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

      awardXP: (skillId, amount, source = 'manual') => {
        const skill = get().skills[skillId];
        if (!skill || skill.locked || amount <= 0) return;
        let { level, xp } = skill;
        xp += amount;
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
            xpLog: [...skill.xpLog, { date: Date.now(), amount, source }],
          },
        };
        skills = recomputeUnlocks(skills);
        set({ skills });
        if (leveled) toast(`${SKILL_MAP[skillId].name} leveled up to Lv${level}!`, 'success');
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

      // Manual declaration: "I already know this." Unlocks the node (level >= 2 so
      // dependents can open) with 0 XP, flagged as manually acquired.
      acquireManually: (skillId) => {
        const skill = get().skills[skillId];
        if (!skill) return;
        let skills = {
          ...get().skills,
          [skillId]: {
            ...skill,
            locked: false,
            level: Math.max(skill.level, 2),
            manualAcquired: true,
            decayStatus: 'active',
            lastPracticed: Date.now(),
            xpLog: [...skill.xpLog, { date: Date.now(), amount: 0, source: 'manual acquisition' }],
          },
        };
        skills = recomputeUnlocks(skills);
        set({ skills });
        toast(`${SKILL_MAP[skillId].name} marked as acquired`, 'success');
      },

      // Daily decay pass: >60d warning, >90d drop a level (Lv2+ only)
      checkDecay: () => {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        let changed = false;
        const skills = { ...get().skills };
        for (const id of Object.keys(skills)) {
          const s = skills[id];
          if (!s.lastPracticed || s.locked) continue;
          const daysSince = (now - s.lastPracticed) / day;
          if (daysSince > 90 && s.level > 1 && s.decayStatus !== 'decayed') {
            skills[id] = { ...s, level: s.level - 1, decayStatus: 'decayed', lastPracticed: now };
            toast(`${SKILL_MAP[id].name} decayed to Lv${s.level - 1} — practice it soon`, 'warning');
            changed = true;
          } else if (daysSince > 60 && s.level > 1 && s.decayStatus === 'active') {
            skills[id] = { ...s, decayStatus: 'warning' };
            changed = true;
          }
        }
        if (changed) set({ skills });
      },

      resetAll: () => set({ skills: freshSkills() }),
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
