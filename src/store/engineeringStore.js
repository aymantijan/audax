import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { ENGINEERING_STAGE_SKILL, ENGINEERING_PROJECT_STAGES } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { deleteCalendarEvent } from '../services/google-calendar';
import { evaluateBadges } from '../utils/badges';

const HAZOP_STAGE_INDEX = ENGINEERING_PROJECT_STAGES.indexOf('Analyse de sécurité (HAZOP)');
const LAST_STAGE_INDEX = ENGINEERING_PROJECT_STAGES.length - 1;

// Same shape/mechanism as healthStore's BADGE_DEFS/checkBadges — `check`
// receives the store state, `awardedBadges` persists which ones already
// toasted so re-checking on every mutation never re-fires one.
const BADGE_DEFS = [
  { id: 'first-entry', name: 'First Entry', tier: 'bronze', check: (s) => s.labEntries.length >= 1 },
  { id: 'project-starter', name: 'Project Starter', tier: 'bronze', check: (s) => s.projects.length >= 1 },
  { id: 'lab-regular', name: 'Lab Regular', tier: 'silver', check: (s) => s.labEntries.length >= 10 },
  { id: 'lab-veteran', name: 'Lab Veteran', tier: 'gold', check: (s) => s.labEntries.length >= 50 },
  { id: 'high-yield', name: 'High Yield', tier: 'silver', check: (s) => s.labEntries.some((e) => Number(e.yieldPercent) >= 90) },
  { id: 'perfect-yield', name: 'Perfect Yield', tier: 'gold', check: (s) => s.labEntries.some((e) => Number(e.yieldPercent) >= 98) },
  { id: 'multi-course', name: 'Cross-Course', tier: 'bronze', check: (s) => new Set(s.labEntries.map((e) => e.course).filter(Boolean)).size >= 3 },
  { id: 'multi-project', name: 'Multi-Project', tier: 'silver', check: (s) => s.projects.length >= 5 },
  { id: 'safety-first', name: 'Safety First', tier: 'silver', check: (s) => s.projects.some((p) => p.stageIndex > HAZOP_STAGE_INDEX || (p.stageIndex === HAZOP_STAGE_INDEX && p.stageStatus === 'done')) },
  { id: 'process-master', name: 'Process Master', tier: 'gold', check: (s) => s.projects.some((p) => p.stageIndex === LAST_STAGE_INDEX && p.stageStatus === 'done') },
];

// Fixed XP a lab entry awards — cross-cutting "did the work" credit, same
// role as health's per-log discipline XP (healthStore's health-discipline-lv1
// awards). awardXP no-ops on locked/unknown skills, so this is safe even
// before the user has unlocked the Engineering branch.
const LAB_ENTRY_XP = 3;
// Flat per-task XP on completion — deliberately not tunable per-task like
// dealsStore's tasks (no real basis to vary it without inventing numbers).
const TASK_XP = 8;

// Two structures, mirroring the two patterns already established elsewhere:
// - labEntries: a flat dated log, same shape philosophy as tradingStore's
//   trades[] (addTrade) — one row per lab session/experiment, no workflow.
// - projects: a stage pipeline, same shape as dealsStore's deals[]
//   (stageIndex/stageStatus into ENGINEERING_PROJECT_STAGES) — for design
//   projects, PFE, internships, research work that actually moves through
//   real process-engineering gates (spec → lit review → design → simulation
//   → HAZOP → optimization → report → defense).
export const useEngineeringStore = create(
  persist(
    (set, get) => ({
      labEntries: [], // [{id, date, title, course, objective, protocol, reagents, yieldPercent, observations, conclusion, tags, createdAt, updatedAt}]
      projects: [], // [{id, name, type, description, deadline, notes, tasks:[], stageIndex, stageStatus, createdAt, updatedAt}]
      awardedBadges: [], // badge ids already toasted, so checkBadges never re-fires one

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'engineering-discipline-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addLabEntry: (data) => {
        const entry = { ...data, id: uid(), createdAt: Date.now(), updatedAt: Date.now() };
        set({ labEntries: [...get().labEntries, entry].sort((a, b) => (a.date < b.date ? 1 : -1)) });
        useSkillStore.getState().awardXP('engineering-discipline-lv1', LAB_ENTRY_XP, `lab: ${entry.title}`);
        toast(`Entrée loggée : ${entry.title} · +${LAB_ENTRY_XP} XP`, 'success');
        get().checkBadges();
        return entry.id;
      },
      editLabEntry: (id, updates) =>
        set({ labEntries: get().labEntries.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e)).sort((a, b) => (a.date < b.date ? 1 : -1)) }),
      deleteLabEntry: (id) => {
        const entry = get().labEntries.find((e) => e.id === id);
        set({ labEntries: get().labEntries.filter((e) => e.id !== id) });
        if (entry) useSkillStore.getState().removeXP('engineering-discipline-lv1', LAB_ENTRY_XP, 'lab entry deleted');
        toast('Entrée supprimée', 'info');
      },

      addProject: (data) => {
        const project = { ...data, id: uid(), tasks: [], stageIndex: 0, stageStatus: 'not-started', createdAt: Date.now(), updatedAt: Date.now() };
        set({ projects: [...get().projects, project] });
        toast(`Projet créé : ${project.name}`, 'success');
        return project.id;
      },
      editProject: (id, updates) => set({ projects: get().projects.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p)) }),

      // Same convention as dealsStore.setDealStage: jumping to a new stage
      // resets its status to 'not-started' unless a status is passed
      // explicitly (the stepper click passes just {stageIndex}, the status
      // pill buttons pass just {stageStatus} for the current stage).
      setProjectStage: (id, { stageIndex, stageStatus }) => {
        set({
          projects: get().projects.map((p) => {
            if (p.id !== id) return p;
            const nextIndex = stageIndex ?? p.stageIndex;
            const nextStatus = stageStatus ?? (stageIndex !== undefined && stageIndex !== p.stageIndex ? 'not-started' : p.stageStatus);
            return { ...p, stageIndex: nextIndex, stageStatus: nextStatus, updatedAt: Date.now() };
          }),
        });
        get().checkBadges();
      },

      deleteProject: (id) => {
        set({ projects: get().projects.filter((p) => p.id !== id) });
        toast('Projet supprimé', 'info');
      },

      addTask: (projectId, data) => {
        const task = { id: uid(), title: data.title, stage: data.stage || null, status: 'todo', createdAt: Date.now(), completedAt: null, googleEventId: null, googleEventLink: null };
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: [...(p.tasks || []), task], updatedAt: Date.now() } : p)) });
        return task.id;
      },
      updateTask: (projectId, taskId, { title, stage }) =>
        set({
          projects: get().projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, title: title ?? t.title, stage: stage !== undefined ? (stage || null) : t.stage } : t)), updatedAt: Date.now() }
              : p
          ),
        }),
      // The only path that awards/reverses task XP — mirrors dealsStore's
      // setTaskStatus. Skill is resolved from the task's stage via
      // ENGINEERING_STAGE_SKILL (falling back to the general discipline node
      // for an unassigned stage), not user-editable per task like Deals'
      // tasks — there's no real basis to vary XP amount per task here.
      setTaskStatus: (projectId, taskId, status) => {
        const project = get().projects.find((p) => p.id === projectId);
        const task = project?.tasks.find((t) => t.id === taskId);
        if (!project || !task || task.status === status) return;

        const skillId = ENGINEERING_STAGE_SKILL[task.stage] || 'engineering-discipline-lv1';
        const { awardXP, removeXP } = useSkillStore.getState();
        if (status === 'done') {
          awardXP(skillId, TASK_XP, `task: ${task.title} (${project.name})`);
          toast(`Tâche terminée : ${task.title} · +${TASK_XP} XP`, 'success');
        } else if (task.status === 'done') {
          removeXP(skillId, TASK_XP, 'task reopened');
        }

        set({
          projects: get().projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status, completedAt: status === 'done' ? Date.now() : null } : t)), updatedAt: Date.now() }
              : p
          ),
        });
      },
      deleteTask: (projectId, taskId) => {
        const project = get().projects.find((p) => p.id === projectId);
        const task = project?.tasks.find((t) => t.id === taskId);
        if (task?.status === 'done') {
          const skillId = ENGINEERING_STAGE_SKILL[task.stage] || 'engineering-discipline-lv1';
          useSkillStore.getState().removeXP(skillId, TASK_XP, 'task deleted');
        }
        if (task?.googleEventId) deleteCalendarEvent(task.googleEventId);
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId), updatedAt: Date.now() } : p)) });
      },

      // Records the Google Calendar event a task's "Schedule" action created —
      // same role as dealsStore.setTaskCalendarEvent.
      setTaskCalendarEvent: (projectId, taskId, { eventId, htmlLink }) =>
        set({
          projects: get().projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, googleEventId: eventId, googleEventLink: htmlLink } : t)), updatedAt: Date.now() }
              : p
          ),
        }),

      // Snapshot sent as context to the AI coach (see
      // services/engineering-coach-ai.js) — same idea as healthStore's
      // buildCoachContext: recent real data, nothing fabricated, capped so
      // it doesn't grow unbounded for a heavy user.
      buildCoachContext: () => {
        const state = get();
        return {
          recentLabEntries: [...state.labEntries].slice(0, 20).map((e) => ({ date: e.date, title: e.title, course: e.course, yieldPercent: e.yieldPercent })),
          projects: state.projects.map((p) => ({
            name: p.name,
            type: p.type,
            stage: ENGINEERING_PROJECT_STAGES[p.stageIndex],
            stageStatus: p.stageStatus,
            deadline: p.deadline,
            tasksDone: (p.tasks || []).filter((t) => t.status === 'done').length,
            tasksTotal: (p.tasks || []).length,
          })),
          badgesEarned: state.awardedBadges,
        };
      },

      resetAll: () => set({ labEntries: [], projects: [], awardedBadges: [] }),
    }),
    { name: 'audax-engineering', version: 1 }
  )
);
