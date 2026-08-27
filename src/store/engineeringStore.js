import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { ENGINEERING_STAGE_SKILL, ENGINEERING_PROJECT_STAGES } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useLearningStore } from './learningStore';
import { toast } from './uiStore';
import { deleteCalendarEvent } from '../services/google-calendar';
import { evaluateBadges } from '../utils/badges';
import { cascadeSchedule, pruneDependencies, addDaysKey } from '../utils/gantt';

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
  { id: 'hazop-thorough', name: 'HAZOP Thorough', tier: 'silver', check: (s) => s.projects.some((p) => (p.hazop || []).length >= 5) },
];

// Fixed XP a lab entry awards — cross-cutting "did the work" credit, same
// role as health's per-log discipline XP (healthStore's health-discipline-lv1
// awards). awardXP no-ops on locked/unknown skills, so this is safe even
// before the user has unlocked the Engineering branch.
const LAB_ENTRY_XP = 3;
// Flat per-task XP on completion — deliberately not tunable per-task like
// dealsStore's tasks (no real basis to vary it without inventing numbers).
const TASK_XP = 8;
// Per HAZOP deviation row logged — same "did the real work" role as
// LAB_ENTRY_XP, always to process-safety-lv1 (that's the whole point of a
// HAZOP worksheet, unlike a generic task whose skill depends on its stage).
const HAZOP_ROW_XP = 5;

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

        // Real cross-domain link (2026-08-27) — the "course" field used to be
        // cosmetic autocomplete only (Engineering.jsx suggests Learning's
        // tracked course names but never fed anything back). When it matches
        // a real tracked course exactly, this lab session now counts as a
        // genuine learning-momentum activity event — the same mechanism a
        // checklist tick uses (learningStore.recordActivity, mirrors
        // toggleChecklistItem's `advance()` call) — so a course actually
        // worked on via the lab isn't silently treated as untouched.
        const matchedCourse = entry.course?.trim()
          ? useLearningStore.getState().courses.find((c) => c.name.trim().toLowerCase() === entry.course.trim().toLowerCase())
          : null;
        if (matchedCourse) {
          useLearningStore.getState().recordActivity();
          toast(`Entrée loggée : ${entry.title} · +${LAB_ENTRY_XP} XP · momentum "${matchedCourse.name}" relancé`, 'success');
        } else {
          toast(`Entrée loggée : ${entry.title} · +${LAB_ENTRY_XP} XP`, 'success');
        }
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
        const project = { ...data, id: uid(), tasks: [], hazop: [], stageIndex: 0, stageStatus: 'not-started', createdAt: Date.now(), updatedAt: Date.now() };
        set({ projects: [...get().projects, project] });
        toast(`Projet créé : ${project.name}`, 'success');
        return project.id;
      },
      editProject: (id, updates) => set({ projects: get().projects.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p)) }),

      // ─────────── HAZOP worksheet (IEC 61882 guide words) ───────────
      // Structured deviation rows per project — what actually makes the
      // "Analyse de sécurité (HAZOP)" stage a real safety review instead of
      // just another checkbox. Each row earns process-safety-lv1 XP once
      // (on creation, not on every edit) — same "reward the real work"
      // pattern as lab entries.
      addHazopRow: (projectId, data) => {
        const project = get().projects.find((p) => p.id === projectId);
        if (!project) return;
        const row = {
          id: uid(),
          guideWord: data.guideWord || '',
          parameter: data.parameter || '',
          deviation: data.deviation || '',
          causes: data.causes || '',
          consequences: data.consequences || '',
          safeguards: data.safeguards || '',
          actions: data.actions || '',
          severity: data.severity || '',
          likelihood: data.likelihood || '',
          createdAt: Date.now(),
        };
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, hazop: [...(p.hazop || []), row], updatedAt: Date.now() } : p)) });
        useSkillStore.getState().awardXP('process-safety-lv1', HAZOP_ROW_XP, `HAZOP: ${row.guideWord} ${row.parameter} (${project.name})`);
        toast(`Déviation HAZOP ajoutée · +${HAZOP_ROW_XP} XP`, 'success');
        get().checkBadges();
        return row.id;
      },
      updateHazopRow: (projectId, rowId, updates) =>
        set({
          projects: get().projects.map((p) =>
            p.id === projectId ? { ...p, hazop: (p.hazop || []).map((r) => (r.id === rowId ? { ...r, ...updates } : r)), updatedAt: Date.now() } : p
          ),
        }),
      deleteHazopRow: (projectId, rowId) => {
        const project = get().projects.find((p) => p.id === projectId);
        const row = project?.hazop?.find((r) => r.id === rowId);
        if (row) useSkillStore.getState().removeXP('process-safety-lv1', HAZOP_ROW_XP, 'HAZOP row deleted');
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, hazop: (p.hazop || []).filter((r) => r.id !== rowId), updatedAt: Date.now() } : p)) });
      },

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

      // startDate/endDate/dependencies/progress/milestone/order: added for the
      // project Gantt view (2026-08-27), same fields/engine as businessStore's
      // Gantt (utils/gantt.js is store-agnostic — no change needed there).
      // Defaults keep every pre-existing caller (the plain title/stage task
      // form) working unchanged — a task created without dates is just a
      // same-day, unscheduled bar until someone opens the Gantt to place it.
      addTask: (projectId, data) => {
        const project = get().projects.find((p) => p.id === projectId);
        const start = data.startDate || todayKey();
        const milestone = !!data.milestone;
        const end = milestone ? start : data.endDate && data.endDate >= start ? data.endDate : start;
        const deps = Array.isArray(data.dependencies) ? data.dependencies.filter((d) => (project?.tasks || []).some((t) => t.id === d)) : [];
        const task = {
          id: uid(), title: data.title, stage: data.stage || null, status: 'todo',
          startDate: start, endDate: end, milestone, dependencies: deps,
          progress: Math.max(0, Math.min(100, Number(data.progress) || 0)),
          order: (project?.tasks || []).length,
          createdAt: Date.now(), completedAt: null, googleEventId: null, googleEventLink: null,
        };
        const next = cascadeSchedule([...(project?.tasks || []), task]);
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: next, updatedAt: Date.now() } : p)) });
        return task.id;
      },
      updateTask: (projectId, taskId, updates) => {
        const project = get().projects.find((p) => p.id === projectId);
        const task = project?.tasks.find((t) => t.id === taskId);
        if (!project || !task) return;
        const clean = { ...updates };
        if (clean.title === undefined) delete clean.title;
        if (clean.stage !== undefined) clean.stage = clean.stage || null;
        if (clean.progress != null) clean.progress = Math.max(0, Math.min(100, Number(clean.progress) || 0));
        if (clean.dependencies) clean.dependencies = clean.dependencies.filter((d) => d !== taskId && project.tasks.some((t) => t.id === d));
        const merged = { ...task, ...clean };
        if (merged.milestone) merged.endDate = merged.startDate;
        else if (merged.endDate < merged.startDate) merged.endDate = merged.startDate;
        const next = cascadeSchedule(project.tasks.map((t) => (t.id === taskId ? merged : t)));
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: next, updatedAt: Date.now() } : p)) });
      },
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
        set({
          projects: get().projects.map((p) =>
            p.id === projectId ? { ...p, tasks: pruneDependencies(p.tasks.filter((t) => t.id !== taskId)), updatedAt: Date.now() } : p
          ),
        });
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

      // Deadline urgency — projects that aren't finished yet (stage < last,
      // or last stage but not done) with a deadline that's already passed or
      // within `days`. Same convention as Finance's échéances/Trading's risk
      // banners: computed here once, consumed by both Today.jsx and
      // Engineering.jsx rather than two divergent implementations. NOTE:
      // returns a fresh array — call via getState() inside a useMemo/effect,
      // never as a bare `useEngineeringStore(s => s.getDeadlineAlerts())`
      // selector (see the useSyncExternalStore infinite-loop note in project
      // memory).
      getDeadlineAlerts: (days = 14, today = todayKey()) => {
        const unfinished = get().projects.filter((p) => !(p.stageIndex === ENGINEERING_PROJECT_STAGES.length - 1 && p.stageStatus === 'done') && p.deadline);
        const cutoff = addDaysKey(today, days);
        return unfinished
          .filter((p) => p.deadline <= cutoff)
          .map((p) => ({ project: p, overdue: p.deadline < today }))
          .sort((a, b) => (a.project.deadline < b.project.deadline ? -1 : 1));
      },

      resetAll: () => set({ labEntries: [], projects: [], awardedBadges: [] }),
    }),
    {
      name: 'audax-engineering',
      version: 3,
      // v1 tasks predate the Gantt fields (startDate/endDate/dependencies/
      // milestone/progress/order) — backfill from each task's existing
      // `createdAt` so every task lands somewhere sane on the timeline
      // instead of every pre-existing task colliding on "today".
      migrate: (persisted, version) => {
        let state = persisted;
        if (version < 2) {
          state = {
            ...state,
            projects: (state.projects || []).map((p) => ({
              ...p,
              tasks: (p.tasks || []).map((t, i) => {
                const day = new Date(t.createdAt || Date.now()).toISOString().slice(0, 10);
                return {
                  ...t,
                  startDate: t.startDate || day,
                  endDate: t.endDate || day,
                  milestone: t.milestone ?? false,
                  dependencies: t.dependencies || [],
                  progress: t.progress ?? (t.status === 'done' ? 100 : 0),
                  order: t.order ?? i,
                };
              }),
            })),
          };
        }
        // v2 projects predate the HAZOP worksheet — every existing project
        // just gets an empty one, same "backfill, don't break" convention.
        if (version < 3) {
          state = { ...state, projects: (state.projects || []).map((p) => ({ ...p, hazop: p.hazop || [] })) };
        }
        return state;
      },
    }
  )
);
