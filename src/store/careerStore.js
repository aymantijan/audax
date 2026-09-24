import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { CAREER_STAGES, CAREER_STAGE_SKILL, DEFAULT_INTERVIEW_QUESTIONS } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useNetworkingStore } from './networkingStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Kanban-style application pipeline — same shape philosophy as dealsStore's
// deals[] (a flat entity moving through CAREER_STAGES) but simpler: no
// per-application task list, since a job application's real "work" already
// happens on Networking (outreach) and Engineering/Learning (skills built) —
// this store's job is just to track the funnel, not re-host effort logging.
const APP_XP = 4; // logging an application — the "did the outreach" credit
const STAGE_XP = 8; // advancing a stage — awarded to the stage-specific skill

const BADGE_DEFS = [
  { id: 'first-application', name: 'Première candidature', tier: 'bronze', check: (s) => s.applications.length >= 1 },
  { id: 'persistent', name: 'Persévérant', tier: 'silver', check: (s) => s.applications.length >= 15 },
  { id: 'interview-landed', name: 'Entretien décroché', tier: 'silver', check: (s) => s.applications.some((a) => CAREER_STAGES.indexOf(a.stage) >= CAREER_STAGES.indexOf('Interview')) },
  { id: 'offer-received', name: 'Offre reçue', tier: 'gold', check: (s) => s.applications.some((a) => a.stage === 'Offer' || a.stage === 'Accepted') },
  { id: 'domain-diverse', name: 'Large filet', tier: 'bronze', check: (s) => new Set(s.applications.map((a) => a.domain).filter(Boolean)).size >= 3 },
];

export const useCareerStore = create(
  persist(
    (set, get) => ({
      applications: [], // [{id, company, role, domain, stage, appliedDate, location, salary, url, notes, stageHistory:[{stage,date}], createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'written-communication-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addApplication: (data) => {
        if (!data.company?.trim() || !data.role?.trim()) return { ok: false, error: "L'entreprise et le rôle sont requis." };
        const app = {
          id: uid(),
          company: data.company.trim(),
          role: data.role.trim(),
          domain: data.domain || 'General',
          stage: 'Applied',
          appliedDate: data.appliedDate || todayKey(),
          location: data.location || '',
          salary: data.salary || '',
          url: data.url || '',
          notes: data.notes || '',
          referralContactId: data.referralContactId || '', // links to a networkingStore contact — see setStage
          planId: data.planId || '', // career objective this application serves (Carrière n°2)
          type: data.type || '', // APPLICATION_TYPES (Carrière n°3)
          interviews: [], // [{ id, date, time, kind, with, notes, feeling (1-5), thankYouSent, createdAt }]
          prep: { companyNotes: '', questionIds: [], storyIds: [], askThem: '' },
          offer: null, // { salary, currency, bonus, benefits, location, startDate, deadline, learning, career, culture, notes }
          stageHistory: [{ stage: 'Applied', date: todayKey() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ applications: [...get().applications, app] });
        useSkillStore.getState().awardXP('written-communication-lv1', APP_XP, `candidature : ${app.company}`);
        toast(`Candidature loggée : ${app.company} · +${APP_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: app.id };
      },
      editApplication: (id, updates) => set({ applications: get().applications.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a)) }),
      deleteApplication: (id) => {
        const app = get().applications.find((a) => a.id === id);
        set({ applications: get().applications.filter((a) => a.id !== id) });
        if (app) {
          const remove = useSkillStore.getState().removeXP;
          remove('written-communication-lv1', APP_XP, 'application deleted');
          for (const h of app.stageHistory || []) {
            const skillId = CAREER_STAGE_SKILL[h.stage] || 'written-communication-lv1';
            if (h.stage !== 'Applied') remove(skillId, STAGE_XP, 'application deleted');
          }
        }
        toast('Candidature supprimée', 'info');
      },

      // Moving to a NEW stage (not re-selecting the current one) awards XP to
      // that stage's skill and appends to stageHistory — the pipeline's audit
      // trail (when did this actually move, not just where is it now).
      setStage: (id, stage) => {
        const app = get().applications.find((a) => a.id === id);
        if (!app || app.stage === stage) return;
        set({
          applications: get().applications.map((a) =>
            a.id === id ? { ...a, stage, stageHistory: [...(a.stageHistory || []), { stage, date: todayKey() }], updatedAt: Date.now() } : a
          ),
        });
        if (stage !== 'Applied') {
          const skillId = CAREER_STAGE_SKILL[stage] || 'written-communication-lv1';
          useSkillStore.getState().awardXP(skillId, STAGE_XP, `${stage}: ${app.company}`);
          toast(`${app.company} → ${stage} · +${STAGE_XP} XP`, 'success');
        }
        // Real progress on a referred application is exactly when a referrer
        // deserves an update — nudge their next-follow-up date so they don't
        // fall off the radar right as the referral pays off.
        if (app.referralContactId && stage !== 'Applied' && stage !== 'Rejected' && stage !== 'Withdrawn') {
          useNetworkingStore.getState().nudgeFollowUp(app.referralContactId);
        }
        get().checkBadges();
      },

      // Applications sitting in an open stage with no movement in `days` —
      // same shape/convention as networkingStore.getFollowUpAlerts and
      // engineeringStore.getDeadlineAlerts. "No movement" = the last
      // stageHistory entry (or appliedDate, if somehow empty) is older than
      // the cutoff. Closed stages (Accepted/Rejected/Withdrawn) never stall.
      getStaleApplications: (days = 14, today = todayKey()) => {
        const cutoffMs = new Date(`${today}T00:00:00`).getTime() - days * 86400000;
        return get()
          .applications.filter((a) => !['Accepted', 'Rejected', 'Withdrawn'].includes(a.stage))
          .map((a) => {
            const lastMoveDate = a.stageHistory?.length ? a.stageHistory[a.stageHistory.length - 1].date : a.appliedDate;
            return { app: a, lastMoveDate, staleMs: cutoffMs - new Date(`${lastMoveDate}T00:00:00`).getTime() };
          })
          .filter((x) => x.staleMs >= 0)
          .sort((a, b) => b.staleMs - a.staleMs);
      },

      // Real funnel conversion — "ever reached this stage" from stageHistory,
      // not just current stage, so an application that got an offer and was
      // later marked Accepted still counts toward the Interview→Offer rate.
      getConversionStats: () => {
        const apps = get().applications;
        const reached = (stage) => apps.filter((a) => (a.stageHistory || []).some((h) => h.stage === stage)).length;
        const applied = apps.length;
        const interview = reached('Interview');
        const offer = apps.filter((a) => (a.stageHistory || []).some((h) => h.stage === 'Offer' || h.stage === 'Accepted')).length;
        return {
          applied,
          interview,
          offer,
          appliedToInterviewPct: applied ? Math.round((interview / applied) * 100) : 0,
          interviewToOfferPct: interview ? Math.round((offer / interview) * 100) : 0,
        };
      },

      // ── Interviews, preparation, offers (Carrière n°3) ──
      addInterview: (appId, data) => {
        const app = get().applications.find((a) => a.id === appId);
        if (!app) return;
        const itw = { id: uid(), date: data.date || todayKey(), time: data.time || '', kind: data.kind || 'Autre', with: data.with || '', notes: data.notes || '', feeling: data.feeling || null, thankYouSent: false, createdAt: Date.now() };
        set({ applications: get().applications.map((a) => (a.id === appId ? { ...a, interviews: [...(a.interviews || []), itw], updatedAt: Date.now() } : a)) });
        // A scheduled interview means the application reached (at least) that stage.
        if (CAREER_STAGES.indexOf(app.stage) < CAREER_STAGES.indexOf('Interview')) get().setStage(appId, 'Interview');
        toast(`Entretien ajouté — ${app.company}`, 'success');
      },
      editInterview: (appId, id, updates) => set({ applications: get().applications.map((a) => (a.id === appId ? { ...a, interviews: (a.interviews || []).map((i) => (i.id === id ? { ...i, ...updates } : i)), updatedAt: Date.now() } : a)) }),
      deleteInterview: (appId, id) => set({ applications: get().applications.map((a) => (a.id === appId ? { ...a, interviews: (a.interviews || []).filter((i) => i.id !== id) } : a)) }),
      setPrep: (appId, patch) => set({ applications: get().applications.map((a) => (a.id === appId ? { ...a, prep: { companyNotes: '', questionIds: [], storyIds: [], askThem: '', ...(a.prep || {}), ...patch } } : a)) }),
      setOffer: (appId, offer) => {
        const app = get().applications.find((a) => a.id === appId);
        set({ applications: get().applications.map((a) => (a.id === appId ? { ...a, offer: offer ? { ...(a.offer || {}), ...offer } : null, updatedAt: Date.now() } : a)) });
        if (offer && app && CAREER_STAGES.indexOf(app.stage) < CAREER_STAGES.indexOf('Offer')) get().setStage(appId, 'Offer');
      },

      // Question bank (starter questions, editable) + STAR stories
      questions: DEFAULT_INTERVIEW_QUESTIONS.map(([category, question], i) => ({ id: `q${i + 1}`, category, question, answer: '', practiced: 0, lastPracticed: null })),
      addQuestion: (data) => set({ questions: [...(get().questions || []), { id: uid(), category: data.category || 'Motivation', question: data.question.trim(), answer: data.answer || '', practiced: 0, lastPracticed: null }] }),
      editQuestion: (id, updates) => set({ questions: (get().questions || []).map((q) => (q.id === id ? { ...q, ...updates } : q)) }),
      deleteQuestion: (id) => set({ questions: (get().questions || []).filter((q) => q.id !== id) }),
      practiceQuestion: (id) => set({ questions: (get().questions || []).map((q) => (q.id === id ? { ...q, practiced: (q.practiced || 0) + 1, lastPracticed: todayKey() } : q)) }),
      stories: [], // [{ id, title, situation, task, action, result, tags: [] }]
      addStory: (data) => { const s = { id: uid(), title: '', situation: '', task: '', action: '', result: '', tags: [], ...data }; set({ stories: [...(get().stories || []), s] }); return s.id; },
      editStory: (id, updates) => set({ stories: (get().stories || []).map((s) => (s.id === id ? { ...s, ...updates } : s)) }),
      deleteStory: (id) => set({ stories: (get().stories || []).filter((s) => s.id !== id) }),
      offerWeights: { salary: 3, learning: 3, career: 3, culture: 2 },
      setOfferWeights: (w) => set({ offerWeights: { ...get().offerWeights, ...w } }),

      // ── Career plan (Carrière n°2) ──
      // Objectives: a target role with a date, the skills it requires (linked
      // to the skill tree / a Learning course when possible) and milestones.
      plans: [], // [{ id, title, domain, type, targetDate, why, status: 'active'|'achieved'|'dropped', skills: [{ id, name, skillId, targetLevel, courseId, done }], milestones: [{ id, title, due, done, doneAt }], createdAt }]
      weeklyTargets: { applications: 3, touches: 3, posts: 1 },
      setWeeklyTargets: (t) => set({ weeklyTargets: { ...get().weeklyTargets, ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])) } }),
      addPlan: (data) => {
        if (!data.title?.trim()) return { ok: false, error: 'Donnez un intitulé à l’objectif.' };
        const plan = { id: uid(), title: data.title.trim(), domain: data.domain || 'Général', type: data.type || '', targetDate: data.targetDate || '', why: data.why || '', status: 'active', skills: [], milestones: [], createdAt: Date.now() };
        set({ plans: [...(get().plans || []), plan] });
        toast('Objectif de carrière créé', 'success');
        return { ok: true, id: plan.id };
      },
      editPlan: (id, updates) => {
        const before = (get().plans || []).find((p) => p.id === id);
        set({ plans: (get().plans || []).map((p) => (p.id === id ? { ...p, ...updates, ...(updates.status === 'achieved' && p.status !== 'achieved' ? { achievedAt: todayKey() } : {}) } : p)) });
        if (updates.status === 'achieved' && before?.status !== 'achieved') {
          useSkillStore.getState().awardXP('written-communication-lv1', 25, `objectif atteint : ${before.title}`);
          toast(`Objectif atteint : ${before.title} 🎉`, 'success');
        }
      },
      deletePlan: (id) => set({
        plans: (get().plans || []).filter((p) => p.id !== id),
        applications: get().applications.map((a) => (a.planId === id ? { ...a, planId: '' } : a)),
      }),
      addPlanItem: (planId, list, data) => set({ plans: (get().plans || []).map((p) => (p.id === planId ? { ...p, [list]: [...(p[list] || []), { done: false, ...data, id: uid() }] } : p)) }),
      editPlanItem: (planId, list, itemId, updates) => set({
        plans: (get().plans || []).map((p) => (p.id === planId ? { ...p, [list]: (p[list] || []).map((x) => (x.id === itemId ? { ...x, ...updates, ...(updates.done === true && !x.done ? { doneAt: todayKey() } : {}) } : x)) } : p)),
      }),
      deletePlanItem: (planId, list, itemId) => set({ plans: (get().plans || []).map((p) => (p.id === planId ? { ...p, [list]: (p[list] || []).filter((x) => x.id !== itemId) } : p)) }),

      // ── Domains (user-editable; empty = DEFAULT_CAREER_DOMAINS) ──
      domains: [],
      setDomains: (list) => set({ domains: [...new Set(list.map((d) => String(d).trim()).filter(Boolean))] }),

      // ── Profile / CV (Carrière n°1) ──
      // Sections are lists of dated items; `history` view merges them with the
      // pipeline, contacts and posts into one career timeline.
      profile: {
        headline: '', summary: '', location: '', email: '', phone: '',
        links: [], // [{ id, label, url }]
        languages: [], // [{ id, name, level }]
        education: [], // [{ id, school, degree, field, start, end, current, notes }]
        experiences: [], // [{ id, org, title, type, start, end, current, location, description }]
        certifications: [], // [{ id, name, issuer, date, url }]
        skills: [], // strings
      },
      setProfileFields: (data) => set({ profile: { ...get().profile, ...data } }),
      addProfileItem: (section, data) => {
        const item = { ...data, id: uid() };
        set({ profile: { ...get().profile, [section]: [...(get().profile[section] || []), item] } });
        return item.id;
      },
      editProfileItem: (section, id, data) => set({ profile: { ...get().profile, [section]: (get().profile[section] || []).map((x) => (x.id === id ? { ...x, ...data } : x)) } }),
      deleteProfileItem: (section, id) => set({ profile: { ...get().profile, [section]: (get().profile[section] || []).filter((x) => x.id !== id) } }),

      resetAll: () => set({ applications: [], awardedBadges: [], domains: [], plans: [], weeklyTargets: { applications: 3, touches: 3, posts: 1 }, profile: { headline: '', summary: '', location: '', email: '', phone: '', links: [], languages: [], education: [], experiences: [], certifications: [], skills: [] } }),
    }),
    {
      name: 'audax-career',
      // Older saves have no profile: keep the defaults for every missing field.
      merge: (persisted, current) => ({ ...current, ...persisted, profile: { ...current.profile, ...(persisted?.profile || {}) }, weeklyTargets: { ...current.weeklyTargets, ...(persisted?.weeklyTargets || {}) }, offerWeights: { ...current.offerWeights, ...(persisted?.offerWeights || {}) } }),
    }
  )
);
