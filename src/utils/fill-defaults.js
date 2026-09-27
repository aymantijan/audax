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
