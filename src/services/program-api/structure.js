// Programme Supabase layer — programmes, phases, sessions, exercises, weekly structure, locations (moved verbatim from program-api.js, F3).
import { supabase } from '../supabase';
import { requireSupabase, getUserId, unwrap, isMissingColumn, explainConstraint } from './shared';

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function fetchPrograms() {
  requireSupabase();
  const uid = await getUserId();
  return unwrap(
    await supabase
      .from('programs')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
  );
}

export async function fetchProgramByStatus(status) {
  requireSupabase();
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('programs')
      .select('*')
      .eq('user_id', uid)
      .eq('status', status)
      .limit(1)
  );
  return rows[0] || null;
}

export async function createProgram(name) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('programs')
      .insert({ user_id: uid, name, status: 'draft' })
      .select()
  );
  return rows[0];
}

export async function updateProgram(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('programs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function activateProgram(id) {
  return updateProgram(id, {
    status: 'active',
    activated_at: new Date().toISOString(),
    start_date: new Date().toISOString().slice(0, 10),
  });
}

export async function archiveProgram(id) {
  return updateProgram(id, {
    status: 'archived',
    archived_at: new Date().toISOString(),
  });
}

export async function deleteProgram(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('programs')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
      .eq('status', 'draft')   // only drafts can be deleted
  );
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export async function fetchPhases(programId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_phases')
      .select('*')
      .eq('program_id', programId)
      .order('phase_order', { ascending: true })
  );
}

export async function createPhase(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_phases')
      .insert({
        program_id: programId,
        user_id: uid,
        name: data.name,
        phase_order: data.phase_order,
        start_date: data.start_date,
        end_date: data.end_date,
        objective: data.objective || null,
      })
      .select()
  );
  return rows[0];
}

export async function updatePhase(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_phases')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deletePhase(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_phases')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function fetchSessions(phaseId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_sessions')
      .select('*')
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: true })
  );
}

export async function createSession(phaseId, data) {
  const uid = await getUserId();
  const row = {
    phase_id: phaseId,
    user_id: uid,
    session_key: data.session_key,
    label: data.label,
    type: data.type,
    estimated_duration_min: data.estimated_duration_min || null,
    notes: data.notes || null,
    config: data.config || {},
  };
  let res = await supabase.from('program_sessions').insert(row).select();
  if (isMissingColumn(res.error, 'config')) {
    // Pre-migration fallback: no config column → keep the legacy notes encoding.
    const { config, ...legacy } = row;
    res = await supabase.from('program_sessions').insert({ ...legacy, notes: data.notesFallback ?? legacy.notes }).select();
  }
  if (res.error) throw explainConstraint(res.error);
  return res.data[0];
}

export async function updateSession(id, updates) {
  const uid = await getUserId();
  const { notesFallback, ...clean } = updates;
  let res = await supabase.from('program_sessions').update(clean).eq('id', id).eq('user_id', uid).select();
  if (isMissingColumn(res.error, 'config')) {
    const { config, ...legacy } = clean;
    res = await supabase.from('program_sessions')
      .update({ ...legacy, ...(notesFallback !== undefined ? { notes: notesFallback } : {}) })
      .eq('id', id).eq('user_id', uid).select();
  }
  if (res.error) throw explainConstraint(res.error);
  return res.data[0];
}

export async function deleteSession(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export async function fetchExercises(sessionId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_session_exercises')
      .select('*')
      .eq('session_id', sessionId)
      .order('exercise_order', { ascending: true })
  );
}

export async function fetchExercisesForPhase(phaseId) {
  requireSupabase();
  // Join through sessions to get all exercises in one call
  const sessions = await fetchSessions(phaseId);
  if (!sessions.length) return {};
  const ids = sessions.map((s) => s.id);
  const all = unwrap(
    await supabase
      .from('program_session_exercises')
      .select('*')
      .in('session_id', ids)
      .order('exercise_order', { ascending: true })
  );
  // Group by session_id
  const map = {};
  for (const ex of all) {
    (map[ex.session_id] ||= []).push(ex);
  }
  return map;
}

export async function upsertExercise(sessionId, data) {
  const uid = await getUserId();
  const repsMin = data.reps_min ?? 8;
  const repsMax = data.reps_max ?? 12;
  const row = {
    session_id: sessionId,
    user_id: uid,
    exercise_order: data.exercise_order,
    exercise_name: data.exercise_name,
    exercise_key: data.exercise_key || null,
    sets_count: data.sets_count ?? 3,
    reps_min: repsMin,
    reps_max: repsMax,
    reps_prefill: data.reps_prefill ?? Math.round((repsMin + repsMax) / 2),
    rest_seconds: data.rest_seconds ?? 90,
    target_rpe: data.target_rpe ?? 7.0,
    tempo: data.tempo || null,
    notes: data.notes || null,
  };
  if (data.id) {
    // update existing
    const rows = unwrap(
      await supabase
        .from('program_session_exercises')
        .update(row)
        .eq('id', data.id)
        .eq('user_id', uid)
        .select()
    );
    return rows[0];
  }
  const rows = unwrap(
    await supabase
      .from('program_session_exercises')
      .insert(row)
      .select()
  );
  return rows[0];
}

export async function deleteExercise(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_session_exercises')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

export async function reorderExercises(sessionId, orderedIds) {
  const uid = await getUserId();
  // Batch update exercise_order
  const promises = orderedIds.map((exId, idx) =>
    supabase
      .from('program_session_exercises')
      .update({ exercise_order: idx })
      .eq('id', exId)
      .eq('user_id', uid)
  );
  await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Weekly Structure
// ---------------------------------------------------------------------------

export async function fetchWeeklyStructure(phaseId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_weekly_structure')
      .select('*')
      .eq('phase_id', phaseId)
      .order('day_of_week', { ascending: true })
  );
}

export async function upsertDayPlan(phaseId, dayOfWeek, data) {
  const uid = await getUserId();
  const row = {
    phase_id: phaseId,
    user_id: uid,
    day_of_week: dayOfWeek,
    is_rest_day: data.is_rest_day ?? false,
    session_ids: data.session_ids || [],
    scheduled_time: data.scheduled_time || null,
    duration_min: data.duration_min || null,
    location_id: data.location_id || null,
    notes: data.notes || null,
    // Per-session time/duration/location: { [sessionId]: { time, duration_min, location_id } }
    session_slots: data.session_slots || {},
  };
  let res = await supabase
    .from('program_weekly_structure')
    .upsert(row, { onConflict: 'phase_id,day_of_week' })
    .select();
  if (isMissingColumn(res.error, 'session_slots')) {
    // Pre-migration fallback: save everything except per-session slots.
    const { session_slots, ...legacy } = row;
    res = await supabase
      .from('program_weekly_structure')
      .upsert(legacy, { onConflict: 'phase_id,day_of_week' })
      .select();
    if (!res.error) {
      // Keep the slots in the returned row so the UI reflects them this session,
      // and flag that they weren't persisted (editor shows a migration notice).
      return { ...res.data[0], session_slots, _slotsNotPersisted: true };
    }
  }
  if (res.error) throw res.error;
  return res.data[0];
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function fetchLocations() {
  requireSupabase();
  const uid = await getUserId();
  return unwrap(
    await supabase
      .from('program_locations')
      .select('*')
      .eq('user_id', uid)
      .order('name', { ascending: true })
  );
}

export async function createLocation(data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_locations')
      .insert({
        user_id: uid,
        name: data.name,
        type: data.type || 'other',
        address: data.address || null,
      })
      .select()
  );
  return rows[0];
}

export async function updateLocation(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_locations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deleteLocation(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_locations')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
