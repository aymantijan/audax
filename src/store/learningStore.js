import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { GRADE_XP } from '../utils/constants';
import { calculateCourseProgress } from '../utils/course-progress';
import { advance, preview, freshMomentumState, LEARNING_MOMENTUM_CONFIG } from '../utils/momentum';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { endRecurringEvent, deleteCalendarEvent } from '../services/google-calendar';
import { DEFAULT_ACADEMIC_SETTINGS, EVALUATION_PRESETS, subjectResult, letterFor, isAcademic } from '../utils/academic';

export const useLearningStore = create(
  persist(
    (set, get) => ({
      courses: [],
      momentum: freshMomentumState(), // learning momentum — see utils/momentum.js
      // Academic curriculum (Cursus): grading rules + semesters + modules.
      // Subjects themselves are `courses` with kind: 'academic' and
      // termId / moduleId / coefficient / evaluations[] / slots[].
      academic: { settings: { ...DEFAULT_ACADEMIC_SETTINGS }, terms: [], modules: [] },

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
          evaluations: (data.evaluations || []).map((e) => ({ id: uid(), grade: null, date: '', ...e })),
          slots: (data.slots || []).map((sl) => ({ id: uid(), ...sl })),
          createdAt: Date.now(),
        };
        delete course.silent;
        set({ courses: [...get().courses, course] });
        if (!data.silent) toast(`${course.kind === 'academic' ? 'Matière' : 'Cours'} ajouté : ${course.name}`, 'success');
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

      // Same momentum bump as completing a checklist item, for activity that
      // legitimately advances a tracked course but isn't itself a checklist
      // tick — currently: engineeringStore.addLabEntry, when a lab entry's
      // free-text "course" field matches a real tracked course name (see the
      // comment there). Exposed as its own action (not exported internals) so
      // another store can record it without reaching into this one's shape.
      recordActivity: () => set({ momentum: advance(get().momentum, todayKey(), LEARNING_MOMENTUM_CONFIG) }),

      // Live learning-momentum multiplier (0.4–1.0) and current streak, reflecting
      // decay accrued since the last completed task even before the next one.
      getLearningMomentum: () => preview(get().momentum, todayKey(), LEARNING_MOMENTUM_CONFIG),

      // The "reasonable score" for one course: raw coefficient-weighted checklist
      // progress, discounted by how consistently you've actually been studying.
      getCourseScore: (course) => Math.round(calculateCourseProgress(course) * get().getLearningMomentum().momentum),

      editCourse: (id, updates) =>
        set({ courses: get().courses.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c)) }),
      updateCourse: (id, updates) => get().editCourse(id, updates), // spec alias

      completeCourse: (id, gradeArg) => {
        const course = get().courses.find((c) => c.id === id);
        if (!course) return;
        // Numerically graded subjects: the letter is derived from the final
        // average so GPA / skill XP keep working.
        let grade = gradeArg;
        if (isAcademic(course)) {
          const settings = get().academic.settings;
          grade = letterFor(subjectResult(course, settings).value, settings) || gradeArg || 'C';
        }
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
        if (course.googleEventId) endRecurringEvent(course.googleEventId);
        toast(`${course.name} terminé${xp ? ` · +${xp} XP par compétence liée` : ''}`, 'success');
      },

      dropCourse: (id) => {
        const course = get().courses.find((c) => c.id === id);
        set({ courses: get().courses.map((c) => (c.id === id ? { ...c, status: 'dropped' } : c)) });
        if (course?.googleEventId) endRecurringEvent(course.googleEventId);
        toast('Cours abandonné', 'info');
      },

      deleteCourse: (id) => {
        const course = get().courses.find((c) => c.id === id);
        set({ courses: get().courses.filter((c) => c.id !== id) });
        if (course?.googleEventId) deleteCalendarEvent(course.googleEventId);
        toast('Cours supprimé', 'info');
      },

      // Records the Google Calendar event a course's "Schedule sessions" action created.
      setCourseCalendarEvent: (id, { eventId, htmlLink }) =>
        set({ courses: get().courses.map((c) => (c.id === id ? { ...c, googleEventId: eventId, googleEventLink: htmlLink } : c)) }),

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

      reopenCourse: (id) =>
        set({ courses: get().courses.map((c) => (c.id === id ? { ...c, status: 'active', completedAt: null, actualGrade: null } : c)) }),

      // ── Cursus (academic) ──
      updateAcademicSettings: (updates) =>
        set({ academic: { ...get().academic, settings: { ...get().academic.settings, ...updates } } }),

      addTerm: (data) => {
        const term = { id: uid(), name: data.name || 'Semestre', year: data.year || '', startDate: data.startDate || '', endDate: data.endDate || '', createdAt: Date.now() };
        const a = get().academic;
        set({ academic: { ...a, terms: [...a.terms, term], settings: { ...a.settings, activeTermId: term.id } } });
        return term.id;
      },
      editTerm: (id, updates) => {
        const a = get().academic;
        set({ academic: { ...a, terms: a.terms.map((t) => (t.id === id ? { ...t, ...updates } : t)) } });
      },
      // Deleting a semester keeps its subjects (they become unfiled) — grades are never lost silently.
      deleteTerm: (id) => {
        const a = get().academic;
        const terms = a.terms.filter((t) => t.id !== id);
        set({
          academic: {
            ...a,
            terms,
            modules: a.modules.filter((m) => m.termId !== id),
            settings: { ...a.settings, activeTermId: a.settings.activeTermId === id ? terms[terms.length - 1]?.id || null : a.settings.activeTermId },
          },
          courses: get().courses.map((c) => (c.termId === id ? { ...c, termId: null, moduleId: null } : c)),
        });
      },
      setActiveTerm: (id) => get().updateAcademicSettings({ activeTermId: id }),

      addModule: (data) => {
        const a = get().academic;
        const module = {
          id: uid(), termId: data.termId, name: data.name || 'Module', coefficient: Number(data.coefficient) || 1,
          credits: data.credits === '' || data.credits == null ? null : Number(data.credits),
          order: a.modules.filter((m) => m.termId === data.termId).length,
        };
        set({ academic: { ...a, modules: [...a.modules, module] } });
        return module.id;
      },
      editModule: (id, updates) => {
        const a = get().academic;
        set({ academic: { ...a, modules: a.modules.map((m) => (m.id === id ? { ...m, ...updates } : m)) } });
      },
      deleteModule: (id) => {
        const a = get().academic;
        set({
          academic: { ...a, modules: a.modules.filter((m) => m.id !== id) },
          courses: get().courses.map((c) => (c.moduleId === id ? { ...c, moduleId: null } : c)),
        });
      },

      // Bulk import of subjects into a semester (modules created on the fly by name).
      importSubjects: (termId, rows, presetKey) => {
        const preset = EVALUATION_PRESETS.find((p) => p.key === presetKey) || EVALUATION_PRESETS[0];
        const moduleIds = {};
        for (const r of rows) {
          let moduleId = null;
          if (r.module) {
            const key = r.module.toLowerCase();
            const existing = get().academic.modules.find((m) => m.termId === termId && m.name.toLowerCase() === key);
            moduleId = existing?.id || moduleIds[key] || get().addModule({ termId, name: r.module });
            moduleIds[key] = moduleId;
          }
          get().addCourse({
            kind: 'academic', silent: true, name: r.name, termId, moduleId,
            coefficient: r.coefficient || 1, credits: r.credits ?? 0,
            institution: get().academic.settings.institution || '', professor: '',
            targetGrade: null, linkedSkills: [], chapters: [],
            evaluations: preset.evals.map(([type, name, weight]) => ({ type, name, weight })),
          });
        }
        toast(`${rows.length} matière(s) ajoutée(s)`, 'success');
      },

      // Evaluations (CC, partiel, examen…) of a subject.
      addEvaluation: (courseId, ev) =>
        set({ courses: get().courses.map((c) => (c.id === courseId ? { ...c, evaluations: [...(c.evaluations || []), { id: uid(), type: 'cc', name: '', weight: 0, date: '', grade: null, ...ev }], updatedAt: Date.now() } : c)) }),
      editEvaluation: (courseId, evId, updates) =>
        set({ courses: get().courses.map((c) => (c.id === courseId ? { ...c, evaluations: (c.evaluations || []).map((e) => (e.id === evId ? { ...e, ...updates } : e)), updatedAt: Date.now() } : c)) }),
      deleteEvaluation: (courseId, evId) =>
        set({ courses: get().courses.map((c) => (c.id === courseId ? { ...c, evaluations: (c.evaluations || []).filter((e) => e.id !== evId) } : c)) }),

      // Weekly timetable slots of a subject.
      addSlot: (courseId, slot) =>
        set({ courses: get().courses.map((c) => (c.id === courseId ? { ...c, slots: [...(c.slots || []), { id: uid(), day: 1, start: '08:30', end: '10:30', kind: 'Cours', room: '', ...slot }] } : c)) }),
      editSlot: (courseId, slotId, updates) =>
        set({ courses: get().courses.map((c) => (c.id === courseId ? { ...c, slots: (c.slots || []).map((sl) => (sl.id === slotId ? { ...sl, ...updates } : sl)) } : c)) }),
      deleteSlot: (courseId, slotId) =>
        set({ courses: get().courses.map((c) => (c.id === courseId ? { ...c, slots: (c.slots || []).filter((sl) => sl.id !== slotId) } : c)) }),

      resetAll: () => set({ courses: [], momentum: freshMomentumState(), academic: { settings: { ...DEFAULT_ACADEMIC_SETTINGS }, terms: [], modules: [] } }),
    }),
    {
      name: 'audax-learning',
      // Deep-merge `academic` so older saves without it (or without newer
      // settings keys) pick up the defaults.
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        academic: {
          ...current.academic,
          ...(persisted?.academic || {}),
          settings: { ...current.academic.settings, ...(persisted?.academic?.settings || {}) },
        },
      }),
    }
  )
);
