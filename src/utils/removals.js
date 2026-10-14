// "Rien n'est définitif" (chantier 2): what a deletion removed, and how to put
// it back. Compares a store's data before and after an action and lists every
// record that disappeared, with where it lived, so "Annuler" (and the trash)
// can restore exactly those records without touching anything else.
// Pure: tests/removals.test.mjs.
//
// A removal is { path, kind: 'item', item, index }  — a record ({ id, … }) taken
//                                                      out of an array
//            or { path, kind: 'key', key, value }   — an entry removed from an
//                                                      object keyed by id/date/name
// path = list of steps from the top of the store: a key (string) or { id }
// (the record with that id in an array).

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isRecordList = (arr) => arr.length > 0 && arr.every((x) => isObj(x) && x.id != null);

export function findRemovals(before, after, path = []) {
  if (before === after || before == null || after == null) return [];
  const out = [];
  if (Array.isArray(before) && Array.isArray(after)) {
    if (!isRecordList(before)) return out; // arrays of plain values or lines: edits, not deletions
    const next = new Map(after.filter((x) => isObj(x) && x.id != null).map((x) => [x.id, x]));
    before.forEach((item, index) => {
      if (!next.has(item.id)) out.push({ path, kind: 'item', item, index });
      else out.push(...findRemovals(item, next.get(item.id), [...path, { id: item.id }]));
    });
    return out;
  }
  if (isObj(before) && isObj(after)) {
    for (const [key, value] of Object.entries(before)) {
      if (typeof value === 'function') continue;
      if (!(key in after)) {
        if (value !== undefined) out.push({ path, kind: 'key', key, value });
      } else {
        out.push(...findRemovals(value, after[key], [...path, key]));
      }
    }
  }
  return out;
}

// Rebuilds `node` with `fn` applied at `path`; returns `node` itself when the
// path no longer exists (the parent record was deleted since).
function updateAt(node, path, fn) {
  if (!path.length) return fn(node);
  const [step, ...rest] = path;
  if (typeof step === 'string') {
    if (!isObj(node) || !(step in node)) return node;
    const child = updateAt(node[step], rest, fn);
    return child === node[step] ? node : { ...node, [step]: child };
  }
  if (!Array.isArray(node)) return node;
  const i = node.findIndex((x) => isObj(x) && x.id === step.id);
  if (i < 0) return node;
  const child = updateAt(node[i], rest, fn);
  if (child === node[i]) return node;
  const copy = node.slice();
  copy[i] = child;
  return copy;
}

// Puts one removal back into `data`. Returns the new data, or the same object
// when there is nothing to do (already there, or its parent is gone).
export function restoreRemoval(data, removal) {
  return updateAt(data, removal.path, (container) => {
    if (removal.kind === 'item') {
      if (!Array.isArray(container) || container.some((x) => isObj(x) && x.id === removal.item.id)) return container;
      const copy = container.slice();
      copy.splice(Math.min(removal.index, copy.length), 0, removal.item);
      return copy;
    }
    if (!isObj(container) || removal.key in container) return container;
    return { ...container, [removal.key]: removal.value };
  });
}

// Removals are applied parents first (shorter paths), so a deleted record and
// what was deleted inside it both come back.
export function restoreAll(data, removals) {
  return [...removals]
    .sort((a, b) => a.path.length - b.path.length)
    .reduce((d, r) => restoreRemoval(d, r), data);
}

// A short human label for a removed record ("Course à pied", "Courses"…).
export function recordLabel(r) {
  const v = r.kind === 'item' ? r.item : r.value;
  if (!isObj(v)) return r.key || '';
  return String(v.name || v.title || v.label || v.exercise || v.front || v.food || v.date || r.key || '').slice(0, 60);
}
