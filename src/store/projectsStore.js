import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { PROJECT_STAGES } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Generic personal projects / side-hustles — deliberately lighter than
// businessStore (no accounting ledger, no Gantt, no KPI series): this is for
// something built outside the Deals/Business-Projects flow (a personal app,
// a side project with no investor/formal structure), where forcing it
// through Business's PE-flavored machinery would be more overhead than the
// project itself. Same "operator" skill pair as businessStore (ge-thesis /
// ge-scaling-strategy) — a side-hustle is the same kind of work as a formally
// tracked business, just smaller/less formal, so it earns the same skills.
const EFFORT_SKILL = 'ge-thesis';
const MILESTONE_SKILL = 'ge-scaling-strategy';
const TASK_XP = 5;

const LAST_STAGE_INDEX = PROJECT_STAGES.length - 1;

const BADGE_DEFS = [
  { id: 'first-project', name: 'First Project', tier: 'bronze', check: (s) => s.projects.length >= 1 },
  { id: 'shipped', name: 'Shipped', tier: 'silver', check: (s) => s.projects.some((p) => p.stageIndex >= PROJECT_STAGES.indexOf('Lancement')) },
  { id: 'growing', name: 'Growing', tier: 'gold', check: (s) => s.projects.some((p) => p.stageIndex === LAST_STAGE_INDEX - 1) }, // Croissance
  { id: 'serial-builder', name: 'Serial Builder', tier: 'silver', check: (s) => s.projects.length >= 5 },
  { id: 'task-machine', name: 'Task Machine', tier: 'silver', check: (s) => s.projects.reduce((a, p) => a + (p.tasks || []).filter((t) => t.status === 'done').length, 0) >= 25 },
];

export const useProjectsStore = create(
  persist(
    (set, get) => ({
      projects: [], // [{id, name, description, domain, url, stageIndex, status, tasks:[], createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), MILESTONE_SKILL);
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addProject: (data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom est requis.' };
        const project = {
          id: uid(),
          name: data.name.trim(),
          description: data.description || '',
          domain: data.domain || 'General',
          url: data.url || '',
          stageIndex: 0,
          status: 'active', // 'active' | 'paused' | 'closed'
          tasks: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ projects: [...get().projects, project] });
        useSkillStore.getState().awardXP(EFFORT_SKILL, 5, `projet créé : ${project.name}`);
        toast(`Projet créé : ${project.name}`, 'success');
        get().checkBadges();
        return { ok: true, id: project.id };
      },
      editProject: (id, updates) => set({ projects: get().projects.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p)) }),
      deleteProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        set({ projects: get().projects.filter((p) => p.id !== id) });
        if (project) {
          const remove = useSkillStore.getState().removeXP;
          remove(EFFORT_SKILL, 5, 'project deleted');
          for (const t of project.tasks || []) if (t.status === 'done') remove(EFFORT_SKILL, TASK_XP, 'project deleted');
        }
        toast('Projet supprimé', 'info');
      },

      setStage: (id, stageIndex) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project || project.stageIndex === stageIndex) return;
        set({ projects: get().projects.map((p) => (p.id === id ? { ...p, stageIndex, updatedAt: Date.now() } : p)) });
        useSkillStore.getState().awardXP(MILESTONE_SKILL, 12, `étape franchie : ${PROJECT_STAGES[stageIndex]} (${project.name})`);
        toast(`${project.name} → ${PROJECT_STAGES[stageIndex]} · +12 XP`, 'success');
        get().checkBadges();
      },

      addTask: (projectId, data) => {
        const task = { id: uid(), title: data.title, status: 'todo', createdAt: Date.now(), completedAt: null };
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: [...(p.tasks || []), task], updatedAt: Date.now() } : p)) });
        return task.id;
      },
      editTask: (projectId, taskId, { title }) =>
        set({
          projects: get().projects.map((p) =>
            p.id === projectId ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, title: title ?? t.title } : t)), updatedAt: Date.now() } : p
          ),
        }),
      setTaskStatus: (projectId, taskId, status) => {
        const project = get().projects.find((p) => p.id === projectId);
        const task = project?.tasks.find((t) => t.id === taskId);
        if (!project || !task || task.status === status) return;
        const { awardXP, removeXP } = useSkillStore.getState();
        if (status === 'done') {
          awardXP(EFFORT_SKILL, TASK_XP, `task: ${task.title} (${project.name})`);
          toast(`Tâche terminée : ${task.title} · +${TASK_XP} XP`, 'success');
        } else if (task.status === 'done') {
          removeXP(EFFORT_SKILL, TASK_XP, 'task reopened');
        }
        set({
          projects: get().projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status, completedAt: status === 'done' ? Date.now() : null } : t)), updatedAt: Date.now() }
              : p
          ),
        });
        get().checkBadges();
      },
      deleteTask: (projectId, taskId) => {
        const project = get().projects.find((p) => p.id === projectId);
        const task = project?.tasks.find((t) => t.id === taskId);
        if (task?.status === 'done') useSkillStore.getState().removeXP(EFFORT_SKILL, TASK_XP, 'task deleted');
        set({ projects: get().projects.map((p) => (p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId), updatedAt: Date.now() } : p)) });
      },

      resetAll: () => set({ projects: [], awardedBadges: [] }),
    }),
    { name: 'audax-projects' }
  )
);
