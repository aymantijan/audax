const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// Remote rows can predate fields added to a store since they were written
// (e.g. learning.academic.settings.arriveBeforeMin): replacing a nested object
// wholesale silently dropped those new defaults. Fill every key the store's
// INITIAL state defines but the remote copy lacks, recursively — remote values
// always win, and keys absent from the defaults (records keyed by id, like
// attendance) are left exactly as the remote has them, so deletions stick.
export function fillDefaults(remote, defaults) {
  if (!isPlainObject(remote) || !isPlainObject(defaults)) return remote;
  const out = { ...remote };
  for (const [k, def] of Object.entries(defaults)) {
    if (typeof def === 'function') continue;
    if (!(k in out) || out[k] === undefined) out[k] = def;
    else if (isPlainObject(def) && isPlainObject(out[k])) out[k] = fillDefaults(out[k], def);
  }
  return out;
}

const stamp = (x) => Number(x?.updatedAt || x?.createdAt || 0);

/**
 * First sync of a store on a device that already holds its own data (a store
 * newly added to cloud sync, used separately on several devices): union
 * instead of letting the cloud copy erase this device's work.
 *   arrays of { id } → union by id (newer updatedAt/createdAt wins, else cloud)
 *   plain objects    → merged key by key (records keyed by id: union)
 *   anything else    → cloud value, local only where the cloud has none
 */
export function mergeFirstSync(cloud, local) {
  if (cloud === undefined) return local;
  if (Array.isArray(cloud) && Array.isArray(local)) {
    const keyed = (a) => a.every((x) => isPlainObject(x) && x.id != null);
    if (!keyed(cloud) || !keyed(local)) return cloud.length ? cloud : local;
    const byId = new Map(cloud.map((x) => [x.id, x]));
    for (const x of local) {
      const c = byId.get(x.id);
      if (!c || stamp(x) > stamp(c)) byId.set(x.id, c && isPlainObject(c) ? { ...c, ...x } : x);
    }
    return [...byId.values()];
  }
  if (isPlainObject(cloud) && isPlainObject(local)) {
    const out = { ...cloud };
    for (const [k, v] of Object.entries(local)) {
      if (typeof v === 'function') continue;
      out[k] = k in cloud ? mergeFirstSync(cloud[k], v) : v;
    }
    return out;
  }
  return cloud;
}
