import { useMemo } from 'react';
import { useHealthStore } from '../store/healthStore';
import { useHabitStore } from '../store/habitStore';
import { useAccountingStore } from '../store/accountingStore';
import { useLearningStore } from '../store/learningStore';
import { useFocusStore } from '../store/focusStore';
import { useContentStore } from '../store/contentStore';
import { DEFAULT_ACADEMIC_SETTINGS, isAcademic, subjectResult, requiredGrade, fmtGrade, normGrade } from '../utils/academic';
import { calculateCourseProgress } from '../utils/course-progress';
import { minutesBetween, weekStart, fmtMinutes, studySessions } from '../utils/study';
import { levelLabel } from '../utils/tracks';
import { fmtMAD, todayKey } from '../utils/formatters';

export const GOAL_DOMAINS = {
  health: { label: 'Santé', color: '#ef4444', link: '/health?tab=goals' },
  finance: { label: 'Finances', color: '#10b981', link: '/finance?tab=goals' },
  learning: { label: 'Apprentissage', color: '#6366f1', link: '/learning' },
  content: { label: 'Contenu', color: '#f59e0b', link: '/content' },
};

const nf = (v) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const daysTo = (date, today) => Math.round((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);

/**
 * Every goal of the app in one normalized list — each domain keeps its own
 * editor and engine (health metric engine, finance envelopes, academic
 * grades…), this is the read side:
 * { key, domain, title, progress, valueText, detail, targetDate, status, link }
 * status: 'achieved' | 'ontrack' | 'behind' | 'active'
 */
export function useAllGoals() {
  const healthGoals = useHealthStore((s) => s.goals);
  const workouts = useHealthStore((s) => s.workouts);
  const bodyComp = useHealthStore((s) => s.bodyComp);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const journal = useAccountingStore((s) => s.journal);
  const financeGoals = useAccountingStore((s) => s.goals);
  const courses = useLearningStore((s) => s.courses);
  const academicSettings = useLearningStore((s) => s.academic?.settings);
  const sessions = useFocusStore((s) => s.sessions);
  const contentGoal = useContentStore((s) => s.monthlyGoal);
  const posts = useContentStore((s) => s.posts);

  return useMemo(() => {
    const today = todayKey();
    const out = [];

    // ── Santé (metric engine) ──
    for (const g of useHealthStore.getState().getGoalsWithProgress()) {
      const late = g.targetDate && g.targetDate < today && !g.reached;
      out.push({
        key: `h-${g.id}`, domain: 'health', title: g.label,
        progress: g.achieved || g.reached ? 100 : Math.max(0, Math.min(100, Math.round(g.percent || 0))),
        valueText: g.current != null ? `${nf(g.current)}${g.unit ? ` ${g.unit}` : ''} / ${g.target != null ? nf(g.target) : '—'}${g.unit ? ` ${g.unit}` : ''}` : 'pas encore de mesure',
        detail: g.etaWeeks != null && !g.achieved ? `au rythme actuel : ~${g.etaWeeks} sem.` : null,
        targetDate: g.targetDate || null,
        status: g.achieved ? 'achieved' : late ? 'behind' : g.etaWeeks != null && g.targetDate ? (daysTo(g.targetDate, today) / 7 >= g.etaWeeks ? 'ontrack' : 'behind') : 'active',
        link: GOAL_DOMAINS.health.link,
      });
    }

    // ── Finances (envelopes / dedicated account / net worth) ──
    for (const g of useAccountingStore.getState().getGoalRows()) {
      out.push({
        key: `f-${g.id}`, domain: 'finance', title: g.name,
        progress: Math.round(g.progress ?? 0),
        valueText: `${fmtMAD(g.current)} / ${fmtMAD(g.targetAmount)}`,
        detail: !g.achieved && g.neededPerMonth ? `effort : ${fmtMAD(g.neededPerMonth)}/mois` : null,
        targetDate: g.targetDate || null,
        status: g.achieved ? 'achieved' : g.onTrack === true ? 'ontrack' : g.onTrack === false ? 'behind' : 'active',
        link: GOAL_DOMAINS.finance.link,
      });
    }

    // ── Apprentissage ──
    const settings = { ...DEFAULT_ACADEMIC_SETTINGS, ...(academicSettings || {}) };
    for (const c of courses) {
      if (c.status === 'dropped') continue;
      if (isAcademic(c) && c.targetGrade != null) {
        const r = subjectResult(c, settings);
        const req = requiredGrade(c, c.targetGrade, settings);
        const next = (c.evaluations || []).filter((e) => e.date && e.date >= today && normGrade(e, settings) == null).sort((a, b) => a.date.localeCompare(b.date))[0];
        const reached = r.complete && r.value != null && r.value >= c.targetGrade;
        out.push({
          key: `l-${c.id}`, domain: 'learning', title: `${c.name} : ${fmtGrade(c.targetGrade)}/${settings.scale}`,
          progress: r.value != null ? Math.min(100, Math.round((r.value / c.targetGrade) * 100)) : 0,
          valueText: r.value != null ? `moyenne ${fmtGrade(r.value)}/${settings.scale}${r.complete ? '' : ' (provisoire)'}` : 'pas encore de note',
          detail: req ? (req.status === 'secured' ? 'objectif assuré' : req.status === 'impossible' ? 'hors d’atteinte' : `il faut ${fmtGrade(req.needed)} sur ce qui reste`) : null,
          targetDate: next?.date || null,
          status: reached ? 'achieved' : req?.status === 'impossible' ? 'behind' : req?.status === 'secured' ? 'ontrack' : 'active',
          link: `/learning/course/${c.id}`,
        });
      }
      if (!isAcademic(c) && c.trackType && (c.targetLevel || c.targetDate)) {
        const progress = calculateCourseProgress(c);
        const late = c.targetDate && c.targetDate < today && c.status !== 'completed';
        out.push({
          key: `t-${c.id}`, domain: 'learning', title: c.goal || `${c.name} → ${levelLabel(c.trackType, c.targetLevel)}`,
          progress: c.status === 'completed' ? 100 : progress,
          valueText: `niveau ${c.level === 'A0' ? 'débutant' : levelLabel(c.trackType, c.level)} · feuille de route ${progress}%`,
          detail: null, targetDate: c.targetDate || null,
          status: c.status === 'completed' ? 'achieved' : late ? 'behind' : 'active',
          link: `/learning/course/${c.id}`,
        });
      }
    }
    if (Number(settings.weeklyStudyTarget) > 0 && courses.some((c) => c.status === 'active')) {
      const mins = minutesBetween(studySessions(sessions), weekStart(today), today);
      const target = Number(settings.weeklyStudyTarget) * 60;
      out.push({
        key: 'l-weekly', domain: 'learning', title: `${settings.weeklyStudyTarget} h d’étude cette semaine`,
        progress: Math.min(100, Math.round((mins / target) * 100)),
        valueText: `${fmtMinutes(mins)} / ${settings.weeklyStudyTarget} h`, detail: 'objectif hebdomadaire récurrent',
        targetDate: null, status: mins >= target ? 'achieved' : 'active', recurring: true, link: '/learning',
      });
    }

    // ── Contenu ──
    if (contentGoal > 0) {
      const p = useContentStore.getState().getGoalProgress(today);
      out.push({
        key: 'c-monthly', domain: 'content', title: `${contentGoal} publication(s) ce mois-ci`,
        progress: p.pct ?? 0, valueText: `${p.count} / ${p.goal}`, detail: 'objectif mensuel récurrent',
        targetDate: null, status: p.count >= p.goal ? 'achieved' : 'active', recurring: true, link: GOAL_DOMAINS.content.link,
      });
    }
    return out;
  }, [healthGoals, workouts, bodyComp, energyLogs, journal, financeGoals, courses, academicSettings, sessions, contentGoal, posts]); // eslint-disable-line react-hooks/exhaustive-deps
}
