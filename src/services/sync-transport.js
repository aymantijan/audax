// Supabase transport for one synced store (see utils/sync-engine.js). The
// client is passed in, so the same code runs in the app and in the live
// end-to-end check (scripts/e2e-sync.mjs, Node + service role).
//
// `updated_at` is the row version: an update only lands if the row is still at
// the version this device last saw; otherwise the engine fetches, merges and
// retries.
export const SYNC_TABLE = 'app_state';

export function makeTransport(client, userId, name) {
  const row = () => client.from(SYNC_TABLE);
  const fail = (what, error) => { console.error(`[cloud-sync] ${what} ${name} failed:`, error.message); return { error }; };
  return {
    async fetch() {
      const { data, error } = await row().select('data, updated_at').eq('user_id', userId).eq('store_name', name).maybeSingle();
      if (error) return fail('fetch', error);
      return { row: data ? { data: data.data, version: data.updated_at } : null };
    },
    async insert(data) {
      const { data: res, error } = await row().insert({ user_id: userId, store_name: name, data, updated_at: new Date().toISOString() }).select('updated_at').single();
      if (error) return error.code === '23505' ? { conflict: true } : fail('insert', error);
      return { version: res.updated_at };
    },
    async update(data, version) {
      const { data: res, error } = await row().update({ data, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('store_name', name).eq('updated_at', version).select('updated_at');
      if (error) return fail('update', error);
      if (!res?.length) return { conflict: true };
      return { version: res[0].updated_at };
    },
  };
}
