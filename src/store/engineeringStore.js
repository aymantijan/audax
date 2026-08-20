import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { toast } from './uiStore';

// Two structures, mirroring the two patterns already established elsewhere:
// - labEntries: a flat dated log, same shape philosophy as tradingStore's
//   trades[] (addTrade) — one row per lab session/experiment, no workflow.
// - projects: a stage pipeline, same shape as dealsStore's deals[]
//   (stageIndex/stageStatus into ENGINEERING_PROJECT_STAGES) — for design
//   projects, PFE, internships, research work that actually moves through
//   real process-engineering gates (spec → lit review → design → simulation
//   → HAZOP → optimization → report → defense).
// No skill-tree XP integration yet — there's no chemical-engineering branch
// in skill-tree-data.js to award into, and fabricating one wasn't part of
// what was asked for. Straightforward to add later if a skill branch exists.
export const useEngineeringStore = create(
  persist(
    (set, get) => ({
      labEntries: [], // [{id, date, title, course, objective, protocol, reagents, yieldPercent, observations, conclusion, tags, createdAt, updatedAt}]
      projects: [], // [{id, name, type, description, deadline, notes, tasks:[], stageIndex, stageStatus, createdAt, updatedAt}]

      addLabEntry: (data) => {
        const entry = { ...data, id: uid(), createdAt: Date.now(), updatedAt: Date.now() };
        set({ labEntries: [...get().labEntries, entry].sort((a, b) => (a.date < b.date ? 1 : -1)) });
        toast(`Entrée loggée : ${entry.title}`, 'success');
        return entry.id;
      },
      editLabEntry: (id, updates) =>
        set({ labEntries: get().labEntries.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e)).sort((a, b) => (a.date < b.date ? 1 : -1)) }),
      deleteLabEntry: (id) => {
        set({ labEntries: get().labEntries.filter((e) => e.id !== id) });
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
      setProjectStage: (id, { stageIndex, stageStatus }) =>
        set({
          projects: get().projects.map((p) => {
            if (p.id !== id) return p;
            const nextIndex = stageIndex ?? p.stageIndex;
            const nextStatus = stageStatus ?? (stageIndex !== undefined && stageIndex !== p.stageIndex ? 'not-started' : p.stageStatus);
            return { ...p, stageIndex: nextIndex, stageStatus: nextStatus, updatedAt: Date.now() };
          }),
        }),

      deleteProject: (id) => {
        set({ projects: get().projects.filter((p) => p.id !== id) });
        toast('Projet supprimé', 'info');
      },

      addTask: (projectId, data) => {
        const task = { id: uid(), title: data.title, stage: data.stage || null, status: 'todo', createdAt: Date.now(), completedAt: null };
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
      setTaskStatus: (projectId, taskId, status) =>
        set({
          projects: get().projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status, completedAt: status === 'done' ? Date.now() : null } : t)), updatedAt: Date.now() }
              : p
          ),
        }),
      deleteTask: (projectId, taskId) =>
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId), updatedAt: Date.now() } : p)) }),

      resetAll: () => set({ labEntries: [], projects: [] }),
    }),
    { name: 'audax-engineering', version: 1 }
  )
);
