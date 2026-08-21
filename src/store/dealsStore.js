import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { TASK_LEGACY_DEAL_SKILL, SKILL_MAP, DEAL_STAGES } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { deleteCalendarEvent } from '../services/google-calendar';
import { evaluateBadges } from '../utils/badges';

const CLOSING_STAGE_INDEX = DEAL_STAGES.length - 1;

// Same shape/mechanism as healthStore's/engineeringStore's BADGE_DEFS —
// `check` receives this store's state, `awardedBadges` persists which ones
// already fired so re-checking on every deal/task mutation never re-toasts one.
const BADGE_DEFS = [
  { id: 'first-deal', name: 'First Deal', tier: 'bronze', check: (s) => s.deals.length >= 1 },
  { id: 'due-diligence-pro', name: 'Due Diligence Pro', tier: 'bronze', check: (s) => s.deals.some((d) => d.stageIndex >= 3) },
  { id: 'negotiator', name: 'Negotiator', tier: 'silver', check: (s) => s.deals.some((d) => d.stageIndex >= 6) },
  { id: 'pipeline-builder', name: 'Pipeline Builder', tier: 'silver', check: (s) => s.deals.length >= 10 },
  { id: 'type-explorer', name: 'Type Explorer', tier: 'silver', check: (s) => new Set(s.deals.map((d) => d.type).filter(Boolean)).size >= 3 },
  { id: 'task-machine', name: 'Task Machine', tier: 'silver', check: (s) => s.deals.reduce((a, d) => a + (d.tasks || []).filter((t) => t.status === 'done').length, 0) >= 25 },
  { id: 'flawless-execution', name: 'Flawless Execution', tier: 'silver', check: (s) => s.deals.some((d) => (d.tasks || []).length >= 3 && d.tasks.every((t) => t.status === 'done')) },
  { id: 'deal-closer', name: 'Deal Closer', tier: 'gold', check: (s) => s.deals.some((d) => d.stageIndex === CLOSING_STAGE_INDEX && d.stageStatus === 'done') },
  { id: 'serial-closer', name: 'Serial Closer', tier: 'gold', check: (s) => s.deals.filter((d) => d.stageIndex === CLOSING_STAGE_INDEX && d.stageStatus === 'done').length >= 5 },
];

// Fixed XP a deal awards the moment it's logged — cross-cutting PE competencies
// every deal touches regardless of type. Type-specific skill XP now comes from
// completing the deal's tasks (see setTaskStatus) rather than a lump sum here.
// awardXP no-ops on locked skills, so awards to still-locked masteries are safe.
export function dealLogAwards() {
  return [
    { skillId: 'pe-deal-sourcing', amount: 3 },
    { skillId: 'pe-acquisition-valuation', amount: 5 },
    { skillId: 'three-statement-modeling-lv1', amount: 5 },
  ];
}

// Hybrid task-XP suggestion: picks the deal-type skill whose name best matches
// the task title's words, falling back to the type's first skill. Amount is a
// flat default — both are pre-filled in the Add/Edit Task form and freely
// editable before saving, so a wrong guess costs nothing.
export function suggestTaskAward(deal, title) {
  const candidates = TASK_LEGACY_DEAL_SKILL[deal?.type] || [];
  const words = (title || '').toLowerCase().split(/\s+/).filter(Boolean);
  let best = candidates[0] || 'pe-deal-sourcing';
  let bestScore = -1;
  for (const id of candidates) {
    const nameWords = (SKILL_MAP[id]?.name || '').toLowerCase().split(/\s+/).filter(Boolean);
    const score = words.filter((w) => nameWords.some((nw) => nw.includes(w) || w.includes(nw))).length;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return { skillId: best, xpAmount: 8 };
}

export const useDealsStore = create(
  persist(
    (set, get) => ({
      deals: [],
      awardedBadges: [], // badge ids already toasted, so checkBadges never re-fires one

      // NOTE: 'three-statement-modeling-lv1' (not e.g. 'pe-deal-sourcing') —
      // dealLogAwards() above references several skill ids that don't exist
      // in skill-tree-data.js (pe-deal-sourcing, pe-acquisition-valuation),
      // a pre-existing bug where those awardXP calls silently no-op. This one
      // is confirmed real and unlocked from the start, so badge XP here
      // actually lands instead of quietly doing nothing.
      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'three-statement-modeling-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addDeal: (data) => {
        const deal = { ...data, id: uid(), size: Number(data.size) || 0, tasks: [], stageIndex: 0, stageStatus: 'not-started', createdAt: Date.now(), updatedAt: Date.now() };
        set({ deals: [...get().deals, deal] });
        const award = useSkillStore.getState().awardXP;
        const awards = dealLogAwards();
        for (const { skillId, amount } of awards) award(skillId, amount, `deal: ${deal.name}`);
        toast(`Deal logged: ${deal.name} · +${awards.reduce((a, x) => a + x.amount, 0)} XP · log tasks to earn more`, 'success');
        get().checkBadges();
        return deal.id;
      },

      editDeal: (id, updates) => set({ deals: get().deals.map((d) => (d.id === id ? { ...d, ...updates, size: Number(updates.size ?? d.size), updatedAt: Date.now() } : d)) }),

      // Jumping to a stage always resets its status to 'not-started' (a fresh
      // gate to clear) unless a status is passed explicitly — e.g. the stepper
      // click passes just {stageIndex}, while the status buttons pass just
      // {stageStatus} for the current stage.
      setDealStage: (id, { stageIndex, stageStatus }) => {
        set({
          deals: get().deals.map((d) => {
            if (d.id !== id) return d;
            const nextIndex = stageIndex ?? d.stageIndex;
            const nextStatus = stageStatus ?? (stageIndex !== undefined && stageIndex !== d.stageIndex ? 'not-started' : d.stageStatus);
            return { ...d, stageIndex: nextIndex, stageStatus: nextStatus, updatedAt: Date.now() };
          }),
        });
        get().checkBadges();
      },

      deleteDeal: (id) => {
        const deal = get().deals.find((d) => d.id === id);
        set({ deals: get().deals.filter((d) => d.id !== id) });
        if (deal) {
          const remove = useSkillStore.getState().removeXP;
          for (const { skillId, amount } of dealLogAwards()) remove(skillId, amount, 'deal deleted');
          for (const t of deal.tasks || []) {
            if (t.status === 'done') remove(t.skillId, t.xpAmount, 'deal deleted');
          }
        }
        toast('Deal deleted', 'info');
      },

      addTask: (dealId, data) => {
        const task = {
          id: uid(),
          title: data.title,
          skillId: data.skillId,
          xpAmount: Number(data.xpAmount) || 0,
          stage: data.stage || null,
          status: 'todo',
          createdAt: Date.now(),
          completedAt: null,
          googleEventId: null,
          googleEventLink: null,
        };
        set({ deals: get().deals.map((d) => (d.id === dealId ? { ...d, tasks: [...(d.tasks || []), task], updatedAt: Date.now() } : d)) });
        toast(`Task added: ${task.title}`, 'info');
        return task.id;
      },

      // Edits title/skill/xp only — status transitions always go through
      // setTaskStatus below, which is the sole place XP is awarded/reversed.
      // If the task is currently 'done' and its skill or amount changes, the old
      // award is reversed and the new one applied so XP always matches the screen.
      updateTask: (dealId, taskId, { title, skillId, xpAmount, stage }) => {
        const deal = get().deals.find((d) => d.id === dealId);
        const task = deal?.tasks.find((t) => t.id === taskId);
        if (!deal || !task) return;

        const next = {
          ...task,
          title: title ?? task.title,
          skillId: skillId ?? task.skillId,
          xpAmount: xpAmount !== undefined ? Number(xpAmount) : task.xpAmount,
          stage: stage !== undefined ? (stage || null) : task.stage,
        };
        const skillOrAmountChanged = next.skillId !== task.skillId || next.xpAmount !== task.xpAmount;
        if (task.status === 'done' && skillOrAmountChanged) {
          const { removeXP, awardXP } = useSkillStore.getState();
          removeXP(task.skillId, task.xpAmount, 'task edited');
          awardXP(next.skillId, next.xpAmount, `task: ${next.title} (${deal.name})`);
        }
        set({
          deals: get().deals.map((d) =>
            d.id === dealId ? { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? next : t)), updatedAt: Date.now() } : d
          ),
        });
      },

      // The only path that awards/reverses XP for a task. done → XP awarded,
      // completedAt stamped; done → anything else reverses that same XP.
      setTaskStatus: (dealId, taskId, status) => {
        const deal = get().deals.find((d) => d.id === dealId);
        const task = deal?.tasks.find((t) => t.id === taskId);
        if (!deal || !task || task.status === status) return;

        const { awardXP, removeXP } = useSkillStore.getState();
        if (status === 'done') {
          awardXP(task.skillId, task.xpAmount, `task: ${task.title} (${deal.name})`);
          toast(`Task complete: ${task.title} · +${task.xpAmount} ${SKILL_MAP[task.skillId]?.name || ''} XP`, 'success');
        } else if (task.status === 'done') {
          removeXP(task.skillId, task.xpAmount, 'task reopened');
        }

        set({
          deals: get().deals.map((d) =>
            d.id === dealId
              ? { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, status, completedAt: status === 'done' ? Date.now() : null } : t)), updatedAt: Date.now() }
              : d
          ),
        });
        get().checkBadges();
      },

      deleteTask: (dealId, taskId) => {
        const deal = get().deals.find((d) => d.id === dealId);
        const task = deal?.tasks.find((t) => t.id === taskId);
        if (!deal || !task) return;
        if (task.status === 'done') useSkillStore.getState().removeXP(task.skillId, task.xpAmount, 'task deleted');
        if (task.googleEventId) deleteCalendarEvent(task.googleEventId);
        set({ deals: get().deals.map((d) => (d.id === dealId ? { ...d, tasks: d.tasks.filter((t) => t.id !== taskId), updatedAt: Date.now() } : d)) });
        toast('Task deleted', 'info');
      },

      // Records the Google Calendar event a task's "Schedule" action created.
      setTaskCalendarEvent: (dealId, taskId, { eventId, htmlLink }) =>
        set({
          deals: get().deals.map((d) =>
            d.id === dealId
              ? { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, googleEventId: eventId, googleEventLink: htmlLink } : t)), updatedAt: Date.now() }
              : d
          ),
        }),

      resetAll: () => set({ deals: [], awardedBadges: [] }),
    }),
    {
      name: 'audax-deals',
      version: 3,
      // v1 deals predate tasks[]; v2 deals predate the stage pipeline (stageIndex/
      // stageStatus) and per-task stage tagging. Backfill both so every consumer
      // can assume the fields are always present, no scattered `?? default`.
      migrate: (persisted, version) => {
        let state = persisted;
        if (version < 2) state = { ...state, deals: (state.deals || []).map((d) => ({ ...d, tasks: d.tasks || [] })) };
        if (version < 3) {
          state = {
            ...state,
            deals: (state.deals || []).map((d) => ({
              ...d,
              stageIndex: d.stageIndex ?? 0,
              stageStatus: d.stageStatus ?? 'not-started',
              tasks: (d.tasks || []).map((t) => ({ ...t, stage: t.stage ?? null })),
            })),
          };
        }
        return state;
      },
    }
  )
);
