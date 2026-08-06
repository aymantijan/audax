// Scheduling engine for the business Gantt chart — shared between the
// interactive chart (pages/deals/GanttChart.jsx) and its PDF export, both
// keyed on plain 'yyyy-MM-dd' date strings like the rest of the app.
//
// This is what makes it an actual Gantt rather than a row of colored bars:
// tasks can depend on each other (finish-to-start), moving a predecessor
// cascades forward through its dependents, and the critical path is a real
// CPM (forward/backward pass) computation — not a cosmetic label.
const DAY_MS = 86400000;

export const toDate = (s) => new Date(s + 'T00:00:00');

export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY_MS);

// Formats a Date's LOCAL calendar fields back to 'yyyy-MM-dd'. Deliberately
// not toISOString() — that serializes to UTC, which silently shifts the date
// by a day whenever the local offset is non-zero (e.g. local midnight Sep 6
// in a positive-UTC-offset timezone becomes "2026-09-05T...Z"). Every date
// in this file is a local calendar day, never an instant, so it must never
// touch UTC conversion.
const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDaysKey = (s, n) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return fmtKey(d);
};

// Inclusive duration in days — a task spanning a single day has duration 1.
export const durationDays = (t) => diffDays(t.startDate, t.endDate) + 1;

// Splits a [min, max] date range into per-month segments for a Gantt header
// row — each segment carries its day span so callers can size a column/rect
// proportionally to it (works whether rendering to the DOM or to a PDF).
export function monthGroups(min, max) {
  const groups = [];
  const minD = toDate(min);
  const endD = toDate(max);
  let cur = new Date(minD.getFullYear(), minD.getMonth(), 1);
  while (cur <= endD) {
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const monthEndCandidate = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const segStart = monthStart < minD ? minD : monthStart;
    const segEnd = monthEndCandidate > endD ? endD : monthEndCandidate;
    const days = Math.round((segEnd - segStart) / DAY_MS) + 1;
    groups.push({ label: segStart.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }), days });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return groups;
}

// Kahn's algorithm over the dependency graph (edge predecessorId -> taskId).
// Tasks referencing a deleted/unknown predecessor id are simply treated as
// having one fewer constraint. Any leftover nodes (a cycle slipped through)
// are appended in place rather than dropped, so nothing silently vanishes.
function topoOrder(tasks) {
  const ids = tasks.map((t) => t.id);
  const idSet = new Set(ids);
  const indeg = new Map(ids.map((id) => [id, 0]));
  const adj = new Map(ids.map((id) => [id, []]));
  for (const t of tasks) {
    for (const d of t.dependencies || []) {
      if (!idSet.has(d)) continue;
      adj.get(d).push(t.id);
      indeg.set(t.id, (indeg.get(t.id) || 0) + 1);
    }
  }
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const n of adj.get(id) || []) {
      indeg.set(n, indeg.get(n) - 1);
      if (indeg.get(n) === 0) queue.push(n);
    }
  }
  for (const id of ids) if (!order.includes(id)) order.push(id);
  return order;
}

// Would adding "predId is a predecessor of succId" close a cycle? True if
// succId is already a (transitive) predecessor of predId.
export function wouldCreateCycle(tasks, predId, succId) {
  if (predId === succId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set();
  const stack = [predId];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const d of byId.get(cur)?.dependencies || []) {
      if (d === succId) return true;
      stack.push(d);
    }
  }
  return false;
}

// Auto-schedule (finish-to-start, 0 lag): walks the dependency graph in
// topological order and pushes any task that starts before "the day after
// its latest predecessor ends" forward by the same amount, preserving its
// duration — exactly what Project/Asana call auto-scheduling. Tasks with no
// predecessor, or whose date already satisfies the constraint, are untouched
// (so a task can still be scheduled to start *after* its predecessor with a
// gap — only violations get corrected).
export function cascadeSchedule(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  for (const id of topoOrder(tasks)) {
    const t = byId.get(id);
    if (!t) continue;
    const preds = (t.dependencies || []).map((d) => byId.get(d)).filter(Boolean);
    if (!preds.length) continue;
    const minStart = preds.reduce((mx, p) => (p.endDate > mx ? p.endDate : mx), preds[0].endDate);
    const requiredStart = addDaysKey(minStart, 1);
    if (t.startDate < requiredStart) {
      const dur = diffDays(t.startDate, t.endDate);
      t.startDate = requiredStart;
      t.endDate = addDaysKey(requiredStart, dur);
    }
  }
  return tasks.map((t) => byId.get(t.id) || t);
}

// Critical Path Method: forward pass (earliest start/finish) then backward
// pass (latest start/finish) over *logical* durations — independent of the
// actual calendar dates, which may include slack the user left on purpose.
// A task is critical when its float (LS - ES) is zero: any slip there slips
// the whole project.
export function computeCriticalPath(tasks) {
  if (!tasks.length) return new Set();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const order = topoOrder(tasks);
  const dur = (t) => (t.milestone ? 0 : Math.max(1, durationDays(t)));
  const ES = new Map(), EF = new Map();
  for (const id of order) {
    const t = byId.get(id);
    if (!t) continue;
    const preds = (t.dependencies || []).map((d) => EF.get(d)).filter((v) => v != null);
    const es = preds.length ? Math.max(...preds) : 0;
    ES.set(id, es);
    EF.set(id, es + dur(t));
  }
  const projectEnd = Math.max(0, ...[...EF.values()]);
  const successorsOf = new Map(order.map((id) => [id, []]));
  for (const t of tasks) for (const d of t.dependencies || []) successorsOf.get(d)?.push(t.id);
  const LS = new Map(), LF = new Map();
  for (const id of [...order].reverse()) {
    const t = byId.get(id);
    if (!t) continue;
    const succs = (successorsOf.get(id) || []).map((s) => LS.get(s)).filter((v) => v != null);
    const lf = succs.length ? Math.min(...succs) : projectEnd;
    LF.set(id, lf);
    LS.set(id, lf - dur(t));
  }
  const critical = new Set();
  for (const id of order) {
    if ((LS.get(id) ?? 0) - (ES.get(id) ?? 0) === 0) critical.add(id);
  }
  return critical;
}

// Drops references to ids that no longer exist (a task got deleted) from
// every remaining task's dependency list — keeps the graph consistent.
export function pruneDependencies(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks.map((t) => (
    (t.dependencies || []).some((d) => !ids.has(d))
      ? { ...t, dependencies: (t.dependencies || []).filter((d) => ids.has(d)) }
      : t
  ));
}
