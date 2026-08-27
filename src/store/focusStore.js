import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { FOCUS_DOMAIN_SKILL } from '../utils/constants';
import { useSkillStore } from './skillStore';
import { useLearningStore } from './learningStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

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
  { id: 'first-session', name: 'First Session', tier: 'bronze', check: (s) => s.sessions.length >= 1 },
  { id: 'focused', name: 'Focused', tier: 'silver', check: (s) => s.sessions.length >= 20 },
  { id: 'deep-worker', name: 'Deep Worker', tier: 'gold', check: (s) => s.sessions.reduce((a, x) => a + x.durationMinutes, 0) >= 20 * 60 },
  { id: 'marathon-session', name: 'Marathon Session', tier: 'silver', check: (s) => s.sessions.some((x) => x.durationMinutes >= 120) },
  { id: 'domain-diverse', name: 'Well-Rounded Focus', tier: 'silver', check: (s) => new Set(s.sessions.map((x) => x.domain)).size >= 5 },
  {
    id: 'consistent-week',
    name: 'Consistent Week',
    tier: 'gold',
    check: (s) => new Set(s.sessions.filter((x) => x.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).map((x) => x.date)).size >= 5,
  },
];

export const useFocusStore = create(
  persist(
    (set, get) => ({
      sessions: [], // [{id, domain, durationMinutes, date, notes, createdAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'deep-focus-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      logSession: (data) => {
        const minutes = Math.round(Number(data.durationMinutes)) || 0;
        if (minutes <= 0) return { ok: false, error: 'La durée doit être positive.' };
        const domain = data.domain || 'General';
        const session = { id: uid(), domain, durationMinutes: minutes, date: data.date || todayKey(), notes: data.notes || '', createdAt: Date.now() };
        set({ sessions: [session, ...get().sessions] });

        const skillId = FOCUS_DOMAIN_SKILL[domain] || 'deep-focus-lv1';
        const xp = XP_PER_SESSION(minutes);
        useSkillStore.getState().awardXP(skillId, xp, `session focus (${domain}, ${minutes}min)`);
        // Same real cross-domain link as engineeringStore.addLabEntry: a
        // Learning-tagged focus session counts as genuine learning-momentum
        // activity, the same mechanism a checklist tick uses.
        if (domain === 'Learning') useLearningStore.getState().recordActivity();
        toast(`Session loggée : ${minutes} min (${domain}) · +${xp} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: session.id };
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

      getTodayMinutes: (today = todayKey()) => get().sessions.filter((s) => s.date === today).reduce((a, s) => a + s.durationMinutes, 0),
      getWeekMinutes: (today = todayKey()) => {
        const weekAgo = new Date(new Date(`${today}T00:00:00`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
        return get().sessions.filter((s) => s.date >= weekAgo && s.date <= today).reduce((a, s) => a + s.durationMinutes, 0);
      },

      resetAll: () => set({ sessions: [], awardedBadges: [] }),
    }),
    { name: 'audax-focus' }
  )
);
