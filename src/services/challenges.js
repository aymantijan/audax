import { supabase, isSupabaseConfigured } from './supabase';
import { makeCode, challengeScore } from '../utils/challenges';
import { useHabitStore } from '../store/habitStore';
import { useFocusStore } from '../store/focusStore';
import { useReadingsStore } from '../store/readingsStore';
import { useHealthStore } from '../store/healthStore';
import { useLearningStore } from '../store/learningStore';
import { todayKey } from '../utils/formatters';

// Challenges live in Supabase (migration 010, RLS): members only, joined by code.
async function session() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function challengesAvailable() {
  return !!(await session());
}

// My challenges with every member's score.
export async function listChallenges() {
  const s = await session();
  if (!s) return { ok: false };
  const { data, error } = await supabase.from('challenges').select('*, challenge_members(*)').order('starts', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: s.user.id, challenges: data || [] };
}

export async function createChallenge({ title, metric, starts, ends, name }) {
  const s = await session();
  if (!s) return { ok: false };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase.from('challenges')
      .insert({ title: title.trim(), metric, starts, ends, code: makeCode(), owner: s.user.id })
      .select().single();
    if (error?.code === '23505') continue; // code already taken: draw another
    if (error) return { ok: false, error: error.message };
    const m = await supabase.from('challenge_members').insert({ challenge_id: data.id, user_id: s.user.id, display_name: name.slice(0, 40) });
    if (m.error) return { ok: false, error: m.error.message };
    return { ok: true, challenge: data };
  }
  return { ok: false, error: 'code' };
}

export async function joinChallenge(code, name) {
  if (!(await session())) return { ok: false };
  const { data, error } = await supabase.rpc('join_challenge', { p_code: code, p_name: name });
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true, id: data } : { ok: false, error: 'unknown_code' };
}

export async function leaveChallenge(challengeId) {
  const s = await session();
  if (!s) return { ok: false };
  const { error } = await supabase.from('challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', s.user.id);
  return { ok: !error };
}

export async function deleteChallenge(challengeId) {
  const { error } = await supabase.from('challenges').delete().eq('id', challengeId);
  return { ok: !error };
}

// My own data, for scoring (read from the local stores).
export function myChallengeData() {
  const h = useHabitStore.getState();
  const l = useLearningStore.getState();
  return {
    habits: h.habits, logs: h.logs, sessions: useFocusStore.getState().sessions, readLog: useReadingsStore.getState().readLog,
    workouts: useHealthStore.getState().workouts, courses: l.courses, academic: l.academic, attendance: l.attendance,
  };
}

// Once after the app opens: refresh my score in every running challenge.
export async function syncChallengeScores() {
  const r = await listChallenges();
  if (r.ok && r.challenges.length) await pushMyScores(r.challenges, r.userId);
}

// Publishes my current score in each running challenge (only score + detail).
export async function pushMyScores(challenges, userId) {
  const today = todayKey();
  const data = myChallengeData();
  const updates = [];
  for (const c of challenges) {
    if (c.starts > today) continue;
    const me = (c.challenge_members || []).find((m) => m.user_id === userId);
    if (!me) continue;
    // Keep publishing up to one day after the end, then the score is frozen.
    if (c.ends < today && me.updated_at && me.updated_at.slice(0, 10) > c.ends) continue;
    const { score, detail } = challengeScore(c.metric, data, { starts: c.starts, ends: c.ends, today });
    if (Number(me.score) === score && me.detail === detail) continue;
    updates.push(supabase.from('challenge_members').update({ score, detail, updated_at: new Date().toISOString() }).eq('challenge_id', c.id).eq('user_id', userId));
  }
  await Promise.all(updates);
  return updates.length;
}
