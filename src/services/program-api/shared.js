// Shared helpers of the Programme Supabase layer (moved verbatim from program-api.js, F3).
import { supabase, isSupabaseConfigured } from '../supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Programme requires Supabase — configure VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }
}

export async function getUserId() {
  requireSupabase();
  // Use getSession() (local, cached, auto-refreshing) rather than getUser()
  // (a network round-trip that transiently returns null during token refresh
  // or a flaky connection). Programme calls this on every read, so getUser()
  // spuriously threw "Not authenticated" and crashed the whole tab a minute
  // in; getSession() reads the persisted session and refreshes it in place.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  return session.user.id;
}

export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// True when Supabase rejected a write because a column from a newer migration
// (e.g. 004's session_slots / config) doesn't exist yet. Lets callers retry
// without the new field so the app keeps working until the migration is run.
export function isMissingColumn(error, column) {
  if (!error) return false;
  const msg = `${error.message || ''} ${error.details || ''}`;
  return (error.code === 'PGRST204' || error.code === '42703') && (!column || msg.includes(column));
}

// Clear message for the 'agility' session type before migration 004.
export function explainConstraint(error) {
  if (error?.code === '23514' && String(error.message || '').includes('type_check')) {
    const e = new Error("Le type « Agilité » nécessite la migration 004 (supabase/migrations/004_program_session_slots_agility.sql).");
    e.code = error.code;
    return e;
  }
  return error;
}
