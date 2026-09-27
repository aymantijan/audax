// Programme Supabase layer — wave 2 — overrides, session logs, nutrition templates, habit links (moved verbatim from program-api.js, F3).
import { supabase } from '../supabase';
import { requireSupabase, getUserId, unwrap } from './shared';

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
