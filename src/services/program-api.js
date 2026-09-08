/**
 * program-api.js — Supabase CRUD layer for Programme.
 *
 * Programme is 100% database-backed (no localStorage).  Every function here
 * talks directly to Supabase and returns plain JS objects.  The programStore
 * caches the results in memory.
 *
 * Convention: every mutating function returns the upserted row(s) so the
 * caller can update its in-memory cache without a second round-trip.
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Programme requires Supabase — configure VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }
}

async function getUserId() {
  requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

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
  const rows = unwrap(
    await supabase
      .from('program_sessions')
      .insert({
        phase_id: phaseId,
        user_id: uid,
        session_key: data.session_key,
        label: data.label,
        type: data.type,
        estimated_duration_min: data.estimated_duration_min || null,
        notes: data.notes || null,
      })
      .select()
  );
  return rows[0];
}

export async function updateSession(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
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
  };
  const rows = unwrap(
    await supabase
      .from('program_weekly_structure')
      .upsert(row, { onConflict: 'phase_id,day_of_week' })
      .select()
  );
  return rows[0];
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
// Event Overrides (Wave 2)
// ===========================================================================

export async function fetchOverrides(programId, dateFrom, dateTo) {
  requireSupabase();
  let q = supabase
    .from('program_event_overrides')
    .select('*')
    .eq('program_id', programId)
    .order('target_date', { ascending: true });
  if (dateFrom) q = q.gte('target_date', dateFrom);
  if (dateTo) q = q.lte('target_date', dateTo);
  return unwrap(await q);
}

export async function fetchOverridesForDate(programId, date) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_event_overrides')
      .select('*')
      .eq('program_id', programId)
      .eq('target_date', date)
  );
}

export async function createOverride(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_event_overrides')
      .upsert({
        program_id: programId,
        user_id: uid,
        target_date: data.target_date,
        original_session_id: data.original_session_id,
        action: data.action,
        new_date: data.new_date || null,
        new_time: data.new_time || null,
        new_session_id: data.new_session_id || null,
        new_location_id: data.new_location_id || null,
        exercise_overrides: data.exercise_overrides || null,
        reason_code: data.reason_code || null,
        reason_note: data.reason_note || null,
        cascade_applied: data.cascade_applied || false,
      }, { onConflict: 'program_id,target_date,original_session_id' })
      .select()
  );
  return rows[0];
}

export async function deleteOverride(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_event_overrides')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
// Session Logs (Wave 2)
// ===========================================================================

export async function fetchSessionLogs(programId, dateFrom, dateTo) {
  requireSupabase();
  let q = supabase
    .from('program_session_logs')
    .select('*')
    .eq('program_id', programId)
    .order('actual_date', { ascending: false });
  if (dateFrom) q = q.gte('actual_date', dateFrom);
  if (dateTo) q = q.lte('actual_date', dateTo);
  return unwrap(await q);
}

export async function fetchSessionLogsForDate(programId, date) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_session_logs')
      .select('*')
      .eq('program_id', programId)
      .eq('planned_date', date)
  );
}

export async function createSessionLog(data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_session_logs')
      .insert({
        program_id: data.program_id,
        phase_id: data.phase_id,
        session_id: data.session_id,
        user_id: uid,
        planned_date: data.planned_date,
        actual_date: data.actual_date || data.planned_date,
        planned_time: data.planned_time || null,
        actual_start: data.actual_start || null,
        actual_end: data.actual_end || null,
        duration_min: data.duration_min || null,
        location_id: data.location_id || null,
        exercises_performed: data.exercises_performed || [],
        session_rpe: data.session_rpe || null,
        energy_level: data.energy_level || null,
        notes: data.notes || null,
        status: data.status || 'completed',
      })
      .select()
  );
  return rows[0];
}

export async function updateSessionLog(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_session_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deleteSessionLog(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_session_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
// Nutrition Templates (Wave 2)
// ===========================================================================

export async function fetchNutritionTemplates(phaseId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_nutrition_templates')
      .select('*')
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: true })
  );
}

export async function fetchAllNutritionTemplates(programId) {
  requireSupabase();
  // Get all phases for this program, then all templates
  const phases = await fetchPhases(programId);
  if (!phases.length) return {};
  const phaseIds = phases.map((p) => p.id);
  const all = unwrap(
    await supabase
      .from('program_nutrition_templates')
      .select('*')
      .in('phase_id', phaseIds)
      .order('created_at', { ascending: true })
  );
  const map = {};
  for (const t of all) (map[t.phase_id] ||= []).push(t);
  return map;
}

export async function createNutritionTemplate(phaseId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_nutrition_templates')
      .insert({
        phase_id: phaseId,
        user_id: uid,
        name: data.name,
        template_type: data.template_type || 'training',
        target_kcal: data.target_kcal || null,
        target_protein_g: data.target_protein_g || null,
        target_carbs_g: data.target_carbs_g || null,
        target_fat_g: data.target_fat_g || null,
        target_fiber_g: data.target_fiber_g || null,
        meals: data.meals || [],
        micro_targets: data.micro_targets || null,
        notes: data.notes || null,
        is_default: data.is_default || false,
      })
      .select()
  );
  return rows[0];
}

export async function updateNutritionTemplate(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_nutrition_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deleteNutritionTemplate(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_nutrition_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
// Habit Links (Wave 2)
// ===========================================================================

export async function fetchHabitLinks(programId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_habit_links')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: true })
  );
}

export async function createHabitLink(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_habit_links')
      .upsert({
        program_id: programId,
        user_id: uid,
        phase_id: data.phase_id || null,
        session_id: data.session_id || null,
        habit_id: data.habit_id,
        habit_name: data.habit_name,
        link_type: data.link_type || 'bidirectional',
        fulfilment_percent: data.fulfilment_percent ?? 100,
      }, { onConflict: 'program_id,session_id,habit_id' })
      .select()
  );
  return rows[0];
}

export async function updateHabitLink(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_habit_links')
      .update(updates)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deleteHabitLink(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_habit_links')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
// Discipline Daily (Wave 3)
// ===========================================================================

export async function fetchDisciplineScores(programId, dateFrom, dateTo) {
  requireSupabase();
  let q = supabase
    .from('program_discipline_daily')
    .select('*')
    .eq('program_id', programId)
    .order('score_date', { ascending: true });
  if (dateFrom) q = q.gte('score_date', dateFrom);
  if (dateTo) q = q.lte('score_date', dateTo);
  return unwrap(await q);
}

export async function upsertDisciplineScore(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_discipline_daily')
      .upsert({
        program_id: programId,
        user_id: uid,
        score_date: data.score_date,
        timing_score: data.timing_score,
        completion_score: data.completion_score,
        nutrition_score: data.nutrition_score,
        sleep_score: data.sleep_score,
        recovery_score: data.recovery_score,
        habits_score: data.habits_score,
        overall_score: data.overall_score,
        details: data.details || null,
      }, { onConflict: 'program_id,score_date' })
      .select()
  );
  return rows[0];
}

// ===========================================================================
// KPIs (Wave 3)
// ===========================================================================

export async function fetchKpis(programId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_kpis')
      .select('*')
      .eq('program_id', programId)
      .order('display_order', { ascending: true })
  );
}

export async function createKpi(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_kpis')
      .insert({
        program_id: programId,
        user_id: uid,
        kpi_key: data.kpi_key || null,
        custom_name: data.custom_name || null,
        custom_unit: data.custom_unit || null,
        custom_source: data.custom_source || null,
        target_value: data.target_value ?? null,
        target_direction: data.target_direction || null,
        target_min: data.target_min ?? null,
        target_max: data.target_max ?? null,
        display_order: data.display_order ?? 0,
        is_pinned: data.is_pinned ?? false,
      })
      .select()
  );
  return rows[0];
}

export async function updateKpi(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_kpis')
      .update(updates)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deleteKpi(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_kpis')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
// KPI Values — time-series (Wave 3)
// ===========================================================================

export async function fetchKpiValues(kpiId, dateFrom, dateTo) {
  requireSupabase();
  let q = supabase
    .from('program_kpi_values')
    .select('*')
    .eq('kpi_id', kpiId)
    .order('value_date', { ascending: true });
  if (dateFrom) q = q.gte('value_date', dateFrom);
  if (dateTo) q = q.lte('value_date', dateTo);
  return unwrap(await q);
}

export async function fetchAllKpiValues(programId, dateFrom, dateTo) {
  requireSupabase();
  // Get all KPIs for this program, then their values
  const kpis = await fetchKpis(programId);
  if (!kpis.length) return {};
  const kpiIds = kpis.map((k) => k.id);
  let q = supabase
    .from('program_kpi_values')
    .select('*')
    .in('kpi_id', kpiIds)
    .order('value_date', { ascending: true });
  if (dateFrom) q = q.gte('value_date', dateFrom);
  if (dateTo) q = q.lte('value_date', dateTo);
  const all = unwrap(await q);
  const map = {};
  for (const v of all) (map[v.kpi_id] ||= []).push(v);
  return map;
}

export async function upsertKpiValue(kpiId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_kpi_values')
      .upsert({
        kpi_id: kpiId,
        user_id: uid,
        value_date: data.value_date,
        value: data.value,
        source: data.source || 'auto',
      }, { onConflict: 'kpi_id,value_date' })
      .select()
  );
  return rows[0];
}

// ===========================================================================
// Goals (Wave 3)
// ===========================================================================

export async function fetchGoals(programId) {
  requireSupabase();
  return unwrap(
    await supabase
      .from('program_goals')
      .select('*')
      .eq('program_id', programId)
      .order('display_order', { ascending: true })
  );
}

export async function createGoal(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_goals')
      .insert({
        program_id: programId,
        phase_id: data.phase_id || null,
        user_id: uid,
        title: data.title,
        description: data.description || null,
        kpi_id: data.kpi_id || null,
        target_value: data.target_value ?? null,
        target_direction: data.target_direction || null,
        current_value: data.current_value ?? null,
        progress_pct: data.progress_pct ?? 0,
        priority: data.priority || 'medium',
        display_order: data.display_order ?? 0,
      })
      .select()
  );
  return rows[0];
}

export async function updateGoal(id, updates) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_goals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function deleteGoal(id) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
  );
}

// ===========================================================================
// Trophies (Wave 3)
// ===========================================================================

export async function fetchTrophies(programId) {
  requireSupabase();
  if (programId) {
    return unwrap(
      await supabase
        .from('program_trophies')
        .select('*')
        .eq('program_id', programId)
        .order('achieved_at', { ascending: false })
    );
  }
  // All trophies across programs
  const uid = await getUserId();
  return unwrap(
    await supabase
      .from('program_trophies')
      .select('*')
      .eq('user_id', uid)
      .order('achieved_at', { ascending: false })
  );
}

export async function createTrophy(data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_trophies')
      .insert({
        program_id: data.program_id,
        goal_id: data.goal_id || null,
        user_id: uid,
        title: data.title,
        description: data.description || null,
        trophy_type: data.trophy_type || 'goal',
        achieved_value: data.achieved_value ?? null,
        target_value: data.target_value ?? null,
        discipline_score: data.discipline_score ?? null,
        phase_name: data.phase_name || null,
        program_name: data.program_name || null,
        duration_days: data.duration_days ?? null,
        icon: data.icon || '🏆',
        tier: data.tier || 'bronze',
      })
      .select()
  );
  return rows[0];
}

// ===========================================================================
// Alerts (Wave 3)
// ===========================================================================

export async function fetchAlerts(programId, unacknowledgedOnly = false) {
  requireSupabase();
  let q = supabase
    .from('program_alerts')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (unacknowledgedOnly) q = q.eq('acknowledged', false);
  return unwrap(await q);
}

export async function createAlert(programId, data) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_alerts')
      .insert({
        program_id: programId,
        user_id: uid,
        alert_type: data.alert_type,
        severity: data.severity || 'warning',
        title: data.title,
        message: data.message,
        context: data.context || null,
      })
      .select()
  );
  return rows[0];
}

export async function acknowledgeAlert(id) {
  const uid = await getUserId();
  const rows = unwrap(
    await supabase
      .from('program_alerts')
      .update({ acknowledged: true })
      .eq('id', id)
      .eq('user_id', uid)
      .select()
  );
  return rows[0];
}

export async function acknowledgeAllAlerts(programId) {
  const uid = await getUserId();
  unwrap(
    await supabase
      .from('program_alerts')
      .update({ acknowledged: true })
      .eq('program_id', programId)
      .eq('user_id', uid)
      .eq('acknowledged', false)
  );
}
