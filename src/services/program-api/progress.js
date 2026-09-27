// Programme Supabase layer — wave 3 — discipline, KPIs, goals, trophies, alerts (moved verbatim from program-api.js, F3).
import { supabase } from '../supabase';
import { requireSupabase, getUserId, unwrap } from './shared';

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
