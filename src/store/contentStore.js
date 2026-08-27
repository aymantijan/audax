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
  { id: 'first-post', name: 'First Post', tier: 'bronze', check: (s) => s.posts.length >= 1 },
  { id: 'consistent-publisher', name: 'Consistent Publisher', tier: 'silver', check: (s) => s.posts.filter((p) => p.publishedDate >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length >= 4 },
  { id: 'prolific', name: 'Prolific', tier: 'gold', check: (s) => s.posts.length >= 30 },
  { id: 'engaged-audience', name: 'Engaged Audience', tier: 'silver', check: (s) => s.posts.some((p) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) >= 100) },
  { id: 'multi-platform', name: 'Multi-Platform', tier: 'bronze', check: (s) => new Set(s.posts.map((p) => p.platform)).size >= 3 },
];

export const useContentStore = create(
  persist(
    (set, get) => ({
      posts: [], // [{id, platform, title, url, publishedDate, domain, likes, comments, shares, views, notes, createdAt, updatedAt}]
      awardedBadges: [],

      checkBadges: () => {
        const awardedBadges = evaluateBadges(BADGE_DEFS, get(), 'written-communication-lv1');
        if (awardedBadges !== get().awardedBadges) set({ awardedBadges });
      },
      getBadges: () => BADGE_DEFS.map((b) => ({ id: b.id, name: b.name, tier: b.tier, earned: get().awardedBadges.includes(b.id) })),

      addPost: (data) => {
        if (!data.title?.trim()) return { ok: false, error: 'Le titre est requis.' };
        const post = {
          id: uid(),
          platform: data.platform || 'LinkedIn',
          title: data.title.trim(),
          url: data.url || '',
          publishedDate: data.publishedDate || todayKey(),
          domain: data.domain || 'General',
          likes: Number(data.likes) || 0,
          comments: Number(data.comments) || 0,
          shares: Number(data.shares) || 0,
          views: Number(data.views) || 0,
          notes: data.notes || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ posts: [...get().posts, post].sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1)) });
        useSkillStore.getState().awardXP('written-communication-lv1', POST_XP, `post : ${post.title}`);
        toast(`Publication loggée : ${post.title} · +${POST_XP} XP`, 'success');
        get().checkBadges();
        return { ok: true, id: post.id };
      },
      editPost: (id, updates) => {
        const clean = { ...updates };
        for (const k of ['likes', 'comments', 'shares', 'views']) if (clean[k] !== undefined) clean[k] = Number(clean[k]) || 0;
        set({ posts: get().posts.map((p) => (p.id === id ? { ...p, ...clean, updatedAt: Date.now() } : p)).sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1)) });
      },
      deletePost: (id) => {
        const post = get().posts.find((p) => p.id === id);
        set({ posts: get().posts.filter((p) => p.id !== id) });
        if (post) useSkillStore.getState().removeXP('written-communication-lv1', POST_XP, 'post deleted');
        toast('Publication supprimée', 'info');
      },

      getTotalEngagement: (post) => (post.likes || 0) + (post.comments || 0) + (post.shares || 0),

      resetAll: () => set({ posts: [], awardedBadges: [] }),
    }),
    { name: 'audax-content' }
  )
);
