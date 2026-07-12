import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { GRADE_XP } from '../utils/constants';
import { calculateCourseProgress } from '../utils/course-progress';
import { advance, preview, freshMomentumState, LEARNING_MOMENTUM_CONFIG } from '../utils/momentum';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

export const useLearningStore = create(
  persist(
    (set, get) => ({
      courses: [],
      momentum: freshMomentumState(), // learning momentum — see utils/momentum.js

      addCourse: (data) => {
        const course = {
          ...data,
          id: uid(),
          status: 'active',
          actualGrade: null,
          chapters: (data.chapters || []).map((ch) => ({
            id: uid(),
            title: ch.title,
            coefficient: Number(ch.coefficient) || 1,
            checklistItems: (ch.checklistItems || []).map((it) => ({
              id: uid(),
              title: it.title,
              coefficient: Number(it.coefficient) || 1,
              completed: false,
              completedDate: null,
            })),
          })),
          readings: data.readings || [],
          assignments: data.assignments || [],
          createdAt: Date.now(),
        };
        set({ courses: [...get().courses, course] });
        toast(`Course added: ${course.name}`, 'success');
        return course.id;
      },

      // Toggling a task ON records a learning-momentum activity event for today
      // (see utils/momentum.js) — this is the single place that feeds the
      // course score's "reasonable pace" mechanic. Toggling OFF just removes
      // the task's weighted contribution to the raw score; it never touches
      // momentum (unchecking isn't cheating your streak, it's just undoing).
      toggleChecklistItem: (courseId, chapterId, itemId) => {
        let completingNow = false;
        set({
          courses: get().courses.map((c) => {
            if (c.id !== courseId) return c;
            return {
              ...c,
              chapters: c.chapters.map((ch) => {
                if (ch.id !== chapterId) return ch;
                return {
                  ...ch,
                  checklistItems: ch.checklistItems.map((it) => {
                    if (it.id !== itemId) return it;
                    completingNow = !it.completed;
                    return { ...it, completed: !it.completed, completedDate: !it.completed ? Date.now() : null };
                  }),
                };
              }),
            };
          }),
        });
        if (completingNow) set({ momentum: advance(get().momentum, todayKey(), LEARNING_MOMENTUM_CONFIG) });
      },

      // Live learning-momentum multiplier (0.4–1.0) and current streak, reflecting
      // decay accrued since the last completed task even before the next one.
      getLearningMomentum: () => preview(get().momentum, todayKey(), LEARNING_MOMENTUM_CONFIG),

      // The "reasonable score" for one course: raw coefficient-weighted checklist
      // progress, discounted by how consistently you've actually been studying.
      getCourseScore: (course) => Math.round(calculateCourseProgress(course) * get().getLearningMomentum().momentum),

      editCourse: (id, updates) =>
        set({ courses: get().courses.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)) }),
      updateCourse: (id, updates) => get().editCourse(id, updates), // spec alias

      completeCourse: (id, grade) => {
        const course = get().courses.find((c) => c.id === id);
        if (!course) return;
        set({
          courses: get().courses.map((c) =>
            c.id === id ? { ...c, status: 'completed', actualGrade: grade, progressPercent: 100, completedAt: Date.now() } : c
          ),
        });
        const xp = GRADE_XP[grade] ?? 0;
        if (xp > 0 && course.linkedSkills?.length) {
          const award = useSkillStore.getState().awardXP;
          for (const skillId of course.linkedSkills) award(skillId, xp, `course: ${course.name}`);
        }
        toast(`${course.name} completed with ${grade}${xp ? ` · +${xp} XP per linked skill` : ''}`, 'success');
      },

      dropCourse: (id) => {
        set({ courses: get().courses.map((c) => (c.id === id ? { ...c, status: 'dropped' } : c)) });
        toast('Course dropped', 'info');
      },

      deleteCourse: (id) => {
        set({ courses: get().courses.filter((c) => c.id !== id) });
        toast('Course deleted', 'info');
      },

      toggleReading: (courseId, index) =>
        set({
          courses: get().courses.map((c) => {
            if (c.id !== courseId) return c;
            const readings = c.readings.map((r, i) => (i === index ? { ...r, completed: !r.completed } : r));
            return { ...c, readings };
          }),
        }),

      addReading: (courseId, reading) =>
        set({
          courses: get().courses.map((c) =>
            c.id === courseId ? { ...c, readings: [...(c.readings || []), { ...reading, completed: false }] } : c
          ),
        }),

      resetAll: () => set({ courses: [], momentum: freshMomentumState() }),
    }),
    { name: 'audax-learning' }
  )
);
