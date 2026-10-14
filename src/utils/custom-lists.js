// « À ta façon » (chantier 5): the person's own categories and the order of
// their lists. Pure helpers, shared by the stores; tests/custom-lists.test.mjs.

const norm = (s) => String(s || '').trim();
const same = (a, b) => norm(a).toLocaleLowerCase('fr') === norm(b).toLocaleLowerCase('fr');

// Adds a name to a list of names (no blank, no duplicate whatever the case).
export function addName(list = [], name) {
  const n = norm(name);
  if (!n || list.some((x) => same(x, n))) return list;
  return [...list, n];
}

export function renameName(list = [], from, to) {
  const n = norm(to);
  if (!n || (list.some((x) => same(x, n)) && !same(from, n))) return list;
  return list.map((x) => (same(x, from) ? n : x));
}

// Moves the item with `id` one place up (-1) or down (+1) among the items
// that pass `visible` (e.g. not archived); hidden items keep their place.
export function moveAmong(items, id, dir, visible = () => true) {
  const shown = items.map((x, i) => [x, i]).filter(([x]) => visible(x));
  const k = shown.findIndex(([x]) => x.id === id);
  const j = k + dir;
  if (k < 0 || j < 0 || j >= shown.length) return items;
  const copy = items.slice();
  const a = shown[k][1];
  const b = shown[j][1];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}

// Options of a category picker: built-in ones not hidden, then the person's
// own, then the current value if it is neither (an old or removed category).
export function categoryChoices(builtIn, custom = [], hidden = [], current = null) {
  const list = [...builtIn.filter((c) => !hidden.includes(c)), ...custom];
  if (current && !list.includes(current)) list.push(current);
  return list;
}
