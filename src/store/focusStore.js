import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { FOCUS_DOMAIN_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useLearningStore } from './learningStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

import { addName } from '../utils/custom-lists';
// Deep-work sessions — a cross-cutting focus timer/log, not its own life
// domain: a session targets one of the OTHER domains (Trading, Engineering,
// Learning…) via FOCUS_DOMAIN_SKILL, so this feeds XP into whichever domain
// the user was actually concentrating on — the "discipline" theme already
// central to the synergy formula, made explicit and loggable.
//
// XP scales with duration (unlike every other domain's flat "did the work"
// credit) since duration IS the metric being tracked here — 1 XP per 8
// focused minutes, capped at 15/session so a single very long session can't
// dwarf everything else, floor of 1 so even a short session counts.
const XP_PER_SESSION = (minutes) => Math.max(1, Math.min(15, Math.round(minutes / 8)));

const BADGE_DEFS = [
  { id: 'first-session', name: 'Première session', tier: 'bronze', check: (s) => s.sessions.length >= 1 },
  { id: 'focused', name: 'Concentré', tier: 'silver', check: (s) => s.sessions.length >= 20 },
  { id: 'deep-worker', name: 'Grand concentré', tier: 'gold', check: (s) => s.sessions.reduce((a, x) => a + x.durationMinutes, 0) >= 20 * 60 },
  { id: 'marathon-session', name: 'Session marathon', tier: 'silver', check: (s) => s.sessions.some((x) => x.durationMinutes >= 120) },
  { id: 'domain-diverse', name: 'Concentration variée', tier: 'silver', check: (s) => new Set(s.sessions.map((x) => x.domain)).size >= 5 },
  {
    id: 'consistent-week',
    name: 'Semaine régulière',
    tier: 'gold',
    check: (s) => new Set(s.sessions.filter((x) => x.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).map((x) => x.date)).size >= 5,
  },
];

export const useFocusStore = create(
  persist(
    (set, get) => ({
      sessions: [], // [{id, domain, durationMinutes, date, notes, createdAt, courseId?, startedAt?}]
      awardedBadges: [],
      // Running study/focus timer — persisted (and cloud-synced) so it survives
      // navigation, reloads and switching device. Elapsed time is always
      // derived from timestamps, never from a ticking counter.
      // { startedAt, accumulatedMs, pausedAt, domain, courseId, targetMin }
      activeTimer: null,

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'deep-focus-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      logSession: (data) => {
        const minutes = Math.round(Number(data.durationMinutes)) || 0;
        if (minutes <= 0) return { ok: false, error: 'La durée doit être positive.' };
        const domain = data.domain || 'General';
        const session = {
          id: uid(), domain, durationMinutes: minutes, date: data.date || todayKey(), notes: data.notes || '', createdAt: Date.now(),
          ...(data.courseId ? { courseId: data.courseId } : {}),
          ...(data.startedAt ? { startedAt: data.startedAt } : {}),
        };
        set({ sessions: [session, ...get().sessions] });

        const skillId = FOCUS_DOMAIN_SKILL[domain] || 'deep-focus-lv1';
        const xp = XP_PER_SESSION(minutes);
        useSkillStore.getState().awardXP(skillId, xp, `session focus (${domain}, ${minutes}min)`);
        // Same real cross-domain link as engineeringStore.addLabEntry: a
        // Learning-tagged focus session counts as genuine learning-momentum
        // activity, the same mechanism a checklist tick uses.
        if (domain === 'Learning') useLearningStore.getState().recordActivity();
        toast(`Session enregistrée : ${minutes} min${data.courseLabel ? ` · ${data.courseLabel}` : ` (${domain})`} · +${xp} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: session.id };
      },
      // Corrects a session (day, length, domain, note). XP follows: the old
      // amount is taken back and the new one given, nothing more.
      editSession: (id, patch) => {
        const old = get().sessions.find((s) => s.id === id);
        if (!old) return { ok: false, error: 'Session introuvable.' };
        const minutes = patch.durationMinutes != null ? Math.round(Number(patch.durationMinutes)) || 0 : old.durationMinutes;
        if (minutes <= 0) return { ok: false, error: 'La durée doit être positive.' };
        const next = { ...old, ...patch, durationMinutes: minutes, updatedAt: Date.now() };
        set({ sessions: get().sessions.map((s) => (s.id === id ? next : s)) });
        const oldSkill = FOCUS_DOMAIN_SKILL[old.domain] || 'deep-focus-lv1';
        const newSkill = FOCUS_DOMAIN_SKILL[next.domain] || 'deep-focus-lv1';
        const oldXp = XP_PER_SESSION(old.durationMinutes);
        const newXp = XP_PER_SESSION(minutes);
        const skills = useSkillStore.getState();
        if (oldSkill !== newSkill) { skills.removeXP(oldSkill, oldXp, 'session modifiée'); skills.awardXP(newSkill, newXp, 'session modifiée'); }
        else if (newXp < oldXp) skills.removeXP(oldSkill, oldXp - newXp, 'session modifiée');
        else if (newXp > oldXp) skills.awardXP(oldSkill, newXp - oldXp, 'session modifiée');
        toast('Session modifiée', 'success');
        return { ok: true };
      },

      deleteSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        set({ sessions: get().sessions.filter((s) => s.id !== id) });
        if (session) {
          const skillId = FOCUS_DOMAIN_SKILL[session.domain] || 'deep-focus-lv1';
          useSkillStore.getState().removeXP(skillId, XP_PER_SESSION(session.durationMinutes), 'session deleted');
        }
        toast('Session supprimée', 'info');
      },

      // ── Live timer ──
      startTimer: ({ domain = 'Learning', courseId = null, targetMin = null } = {}) =>
        set({ activeTimer: { startedAt: Date.now(), accumulatedMs: 0, pausedAt: null, domain, courseId, targetMin } }),
      pauseTimer: () => {
        const t = get().activeTimer;
        if (!t || t.pausedAt) return;
        const now = Date.now();
        set({ activeTimer: { ...t, accumulatedMs: t.accumulatedMs + (now - t.startedAt), pausedAt: now } });
      },
      resumeTimer: () => {
        const t = get().activeTimer;
        if (!t || !t.pausedAt) return;
        set({ activeTimer: { ...t, startedAt: Date.now(), pausedAt: null } });
      },
      cancelTimer: () => set({ activeTimer: null }),
      // Stops the timer and logs it (sessions under a minute are discarded).
      stopTimer: ({ courseLabel, notes } = {}) => {
        const t = get().activeTimer;
        if (!t) return { ok: false };
        const ms = t.accumulatedMs + (t.pausedAt ? 0 : Date.now() - t.startedAt);
        set({ activeTimer: null });
        const minutes = Math.round(ms / 60000);
        if (minutes < 1) {
          toast('Session de moins d’une minute : non enregistrée', 'info');
          return { ok: false };
        }
        return get().logSession({ domain: t.domain, courseId: t.courseId, durationMinutes: minutes, date: todayKey(), courseLabel, notes, startedAt: Date.now() - ms });
      },

      getTodayMinutes: (today = todayKey()) => get().sessions.filter((s) => s.date === today).reduce((a, s) => a + s.durationMinutes, 0),
      getWeekMinutes: (today = todayKey()) => {
        const weekAgo = new Date(new Date(`${today}T00:00:00`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
        return get().sessions.filter((s) => s.date >= weekAgo && s.date <= today).reduce((a, s) => a + s.durationMinutes, 0);
      },

      // The person's own focus domains (M2): piano, permis, couture…
      customDomains: [],
      addDomain: (name) => { const list = addName(get().customDomains || [], name); set({ customDomains: list }); return String(name).trim() || null; },
      removeDomain: (name) => set({ customDomains: (get().customDomains || []).filter((d) => d !== name) }),

      resetAll: () => set({ sessions: [], awardedBadges: [], activeTimer: null, customDomains: [] }),
    }),
    { name: 'audax-focus' }
  )
);
