import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { GRADE_XP } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

export const useLearningStore = create(
  persist(
    (set, get) => ({
      courses: [],

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

      toggleChecklistItem: (courseId, chapterId, itemId) =>
        set({
          courses: get().courses.map((c) => {
            if (c.id !== courseId) return c;
            return {
              ...c,
              chapters: c.chapters.map((ch) => {
                if (ch.id !== chapterId) return ch;
                return {
                  ...ch,
                  checklistItems: ch.checklistItems.map((it) =>
                    it.id === itemId ? { ...it, completed: !it.completed, completedDate: !it.completed ? Date.now() : null } : it
                  ),
                };
              }),
            };
          }),
        }),

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

      resetAll: () => set({ courses: [] }),
    }),
    { name: 'audax-learning' }
  )
);
