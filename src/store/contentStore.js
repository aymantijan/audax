import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '../utils/formatters';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';
import { evaluateBadges } from '../utils/badges';

// Personal-brand publication tracker — a flat log of posts + their engagement,
// same shape philosophy as engineeringStore's labEntries (one row per
// publication, no workflow/pipeline needed — a post is either published or
// it doesn't exist yet).
const POST_XP = 6;

const BADGE_DEFS = [
  { id: 'first-post', name: 'First Post', tier: 'bronze', check: (s) => s.posts.some((p) => p.status === 'Publié') },
  { id: 'consistent-publisher', name: 'Consistent Publisher', tier: 'silver', check: (s) => s.posts.filter((p) => p.status === 'Publié' && p.publishedDate >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length >= 4 },
  { id: 'prolific', name: 'Prolific', tier: 'gold', check: (s) => s.posts.filter((p) => p.status === 'Publié').length >= 30 },
  { id: 'engaged-audience', name: 'Engaged Audience', tier: 'silver', check: (s) => s.posts.some((p) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) >= 100) },
  { id: 'multi-platform', name: 'Multi-Platform', tier: 'bronze', check: (s) => new Set(s.posts.filter((p) => p.status === 'Publié').map((p) => p.platform)).size >= 3 },
];

// LinkedIn cross-link (2026-08-27, user request: "lien avec LinkedIn ou
// quelque chose pareil"): AUDAX is local-first with no backend, so an actual
// OAuth'd LinkedIn API integration (auto-posting, pulling real engagement
// stats) isn't feasible here — that would need a server. What IS feasible
// and genuinely useful: paste a post URL and have the platform auto-detect,
// instead of manually picking it every time. Exported so Content.jsx can
// call it live as the user types the URL field.
const PLATFORM_HOSTS = [
  [/linkedin\.com/i, 'LinkedIn'],
  [/(youtube\.com|youtu\.be)/i, 'YouTube'],
  [/(twitter\.com|x\.com)/i, 'X/Twitter'],
  [/substack\.com/i, 'Newsletter'],
  [/medium\.com/i, 'Blog'],
];
export function detectPlatformFromUrl(url) {
  if (!url) return null;
  for (const [re, platform] of PLATFORM_HOSTS) if (re.test(url)) return platform;
  return null;
}

export const useContentStore = create(
  persist(
    (set, get) => ({
      posts: [], // [{id, platform, title, url, status, publishedDate, domain, courseId, likes, comments, shares, views, notes, createdAt, updatedAt}]
      awardedBadges: [],
      monthlyGoal: 0, // 0 = no target set; see getGoalProgress

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'written-communication-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      setMonthlyGoal: (n) => set({ monthlyGoal: Math.max(0, Number(n) || 0) }),
      // Posts actually published this calendar month vs the target — 0 target
      // reads as "no goal set" (progress null), not "0/0 = 100%".
      getGoalProgress: (today = todayKey()) => {
        const monthPrefix = today.slice(0, 7);
        const goal = get().monthlyGoal;
        const count = get().posts.filter((p) => p.status === 'Publié' && p.publishedDate?.startsWith(monthPrefix)).length;
        return { goal, count, pct: goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : null };
      },

      addPost: (data) => {
        if (!data.title?.trim()) return { ok: false, error: 'Le titre est requis.' };
        const status = data.status || 'Publié';
        const post = {
          id: uid(),
          platform: data.platform || 'LinkedIn',
          title: data.title.trim(),
          url: data.url || '',
          status,
          publishedDate: status === 'Publié' ? (data.publishedDate || todayKey()) : data.publishedDate || '',
          domain: data.domain || 'General',
          courseId: data.courseId || '',
          likes: Number(data.likes) || 0,
          comments: Number(data.comments) || 0,
          shares: Number(data.shares) || 0,
          views: Number(data.views) || 0,
          notes: data.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ posts: [...get().posts, post].sort(sortPosts) });
        if (status === 'Publié') {
          useSkillStore.getState().awardXP('written-communication-lv1', POST_XP, `post : ${post.title}`);
          toast(`Publication loggée : ${post.title} · +${POST_XP} XP`, 'success');
        } else {
          toast(`Ajouté au pipeline éditorial : ${post.title} (${status})`, 'info');
        }
        get().checkBadges();
        return { ok: true, id: post.id };
      },
      // Awards XP the moment a post transitions INTO 'Publié' (from Idée/
      // Brouillon/Planifié) rather than only at creation — same
      // XP-on-transition shape as careerStore.setStage / dealsStore's stage
      // moves, so planning ahead doesn't cost XP twice or never.
      editPost: (id, updates) => {
        const prev = get().posts.find((p) => p.id === id);
        if (!prev) return;
        const clean = { ...updates };
        for (const k of ['likes', 'comments', 'shares', 'views']) if (clean[k] !== undefined) clean[k] = Number(clean[k]) || 0;
        const becamePublished = prev.status !== 'Publié' && clean.status === 'Publié';
        if (becamePublished && !clean.publishedDate && !prev.publishedDate) clean.publishedDate = todayKey();
        set({ posts: get().posts.map((p) => (p.id === id ? { ...p, ...clean, updatedAt: Date.now() } : p)).sort(sortPosts) });
        if (becamePublished) {
          useSkillStore.getState().awardXP('written-communication-lv1', POST_XP, `post publié : ${prev.title}`);
          toast(`Publié : ${prev.title} · +${POST_XP} XP`, 'success');
        }
        get().checkBadges();
      },
      deletePost: (id) => {
        const post = get().posts.find((p) => p.id === id);
        set({ posts: get().posts.filter((p) => p.id !== id) });
        if (post?.status === 'Publié') useSkillStore.getState().removeXP('written-communication-lv1', POST_XP, 'post deleted');
        toast('Publication supprimée', 'info');
      },

      getTotalEngagement: (post) => (post.likes || 0) + (post.comments || 0) + (post.shares || 0),

      // Performance analysis (2026-08-27): average engagement per PUBLISHED
      // post, grouped by platform and by domain — surfaces "what's actually
      // working" instead of just raw per-post totals. Excludes drafts/ideas
      // (no real engagement to average yet).
      getBestPerformers: () => {
        const published = get().posts.filter((p) => p.status === 'Publié');
        const groupAvg = (key) => {
          const groups = {};
          for (const p of published) {
            const k = p[key] || 'Autre';
            (groups[k] ||= []).push(get().getTotalEngagement(p));
          }
          return Object.entries(groups)
            .map(([name, vals]) => ({ name, avg: r1(vals.reduce((a, b) => a + b, 0) / vals.length), count: vals.length }))
            .sort((a, b) => b.avg - a.avg);
        };
        return { byPlatform: groupAvg('platform'), byDomain: groupAvg('domain') };
      },

      resetAll: () => set({ posts: [], awardedBadges: [], monthlyGoal: 0 }),
    }),
    { name: 'audax-content', version: 1, migrate: (state) => ({ ...state, posts: (state.posts || []).map((p) => ({ status: 'Publié', courseId: '', ...p })), monthlyGoal: state.monthlyGoal || 0 }) }
  )
);

const r1 = (n) => Math.round(n * 10) / 10;
const sortPosts = (a, b) => (a.publishedDate || '') < (b.publishedDate || '') ? 1 : -1;
