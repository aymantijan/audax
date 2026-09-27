/**
 * Three-way merge for cloud sync (F2 · synchronisation sans perte).
 *
 *   base   = the last version this device and the server agreed on
 *   local  = this device now
 *   remote = the server now
 *
 * Comparing both sides to the base tells who added, changed or deleted what,
 * so concurrent edits on two devices are combined instead of the last write
 * erasing the other. Pure and deterministic.
 *
 *  - Arrays of objects with an `id` (courses, trades, habits…): merged item by
 *    item; an item edited on both sides is merged field by field.
 *  - Other arrays (logs of plain entries): treated as sets — additions from both
 *    sides kept, removals from either side applied.
 *  - Plain objects (settings, records keyed by id): merged key by key.
 *  - Same primitive changed on both sides: the remote value wins, so every
 *    device converges on what the server holds.
 * Without a base (first sync of a device), nothing can be seen as deleted:
 * both sides are united (`mergeFirstSync`).
 */
import { mergeFirstSync } from './fill-defaults.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a == null || b == null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

const keyed = (arr) => Array.isArray(arr) && arr.every((x) => isObj(x) && x.id != null);

function mergeKeyed(base, local, remote) {
  const B = new Map((base || []).map((x) => [x.id, x]));
  const L = new Map(local.map((x) => [x.id, x]));
  const R = new Map(remote.map((x) => [x.id, x]));
  const out = [];
  const done = new Set();
  const decide = (id) => {
    const b = B.get(id); const l = L.get(id); const r = R.get(id);
    const inB = B.has(id);
    if (l && r) return merge3(b, l, r);
    if (l) return inB && deepEqual(l, b) ? undefined : l; // deleted remotely (unless changed here) / added here
    if (r) return inB && deepEqual(r, b) ? undefined : r; // deleted here (unless changed remotely) / added remotely
    return undefined;
  };
  for (const r of remote) { const v = decide(r.id); done.add(r.id); if (v !== undefined) out.push(v); }
  for (const l of local) { if (done.has(l.id)) continue; done.add(l.id); const v = decide(l.id); if (v !== undefined) out.push(v); }
  return out;
}

function mergeSet(base, local, remote) {
  const key = (x) => JSON.stringify(x);
  const B = new Set((base || []).map(key));
  const L = new Set(local.map(key));
  const R = new Set(remote.map(key));
  const out = remote.filter((x) => { const k = key(x); return !(B.has(k) && !L.has(k)); });
  for (const x of local) { const k = key(x); if (!B.has(k) && !R.has(k)) out.push(x); }
  return out;
}

export function merge3(base, local, remote) {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (deepEqual(local, remote)) return remote;
  if (base === undefined) return mergeFirstSync(remote, local);
  if (deepEqual(local, base)) return remote;
  if (deepEqual(remote, base)) return local;
  // Both sides changed.
  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    return keyed(local) && keyed(remote) && keyed(b) ? mergeKeyed(b, local, remote) : mergeSet(b, local, remote);
  }
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const inB = k in b; const inL = k in local; const inR = k in remote;
      let v;
      if (inL && inR) v = merge3(b[k], local[k], remote[k]);
      else if (inL) v = inB && deepEqual(local[k], b[k]) ? undefined : local[k]; // removed remotely unless changed here
      else v = inB && deepEqual(remote[k], b[k]) ? undefined : remote[k]; // removed here unless changed remotely
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return remote;
}
