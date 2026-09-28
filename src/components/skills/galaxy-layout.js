// Deterministic 3D layout of the visible skill tree: one cluster per model on
// a ring, and inside a cluster the foundations sit close to the core while
// advanced compétences grow outward in shells (depth = longest prerequisite
// path among the visible ones). Pure: same input → same positions.

import { FAMILY_MAP, MODELS } from '../../utils/skill-families.js';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function fibonacciPoint(i, n, r) {
  if (n === 1) return [0, 0, r];
  const y = 1 - ((i + 0.5) / n) * 2;
  const rad = Math.sqrt(1 - y * y);
  const t = i * GOLDEN;
  return [Math.cos(t) * rad * r, y * r * 0.72, Math.sin(t) * rad * r];
}

export function layoutGalaxy(visibleIds) {
  const visible = new Set(visibleIds);
  const byModel = new Map();
  for (const id of visibleIds) {
    const f = FAMILY_MAP[id];
    if (!f) continue;
    if (!byModel.has(f.model)) byModel.set(f.model, []);
    byModel.get(f.model).push(f);
  }
  const models = MODELS.filter((m) => byModel.has(m.id));

  // depth among visible families only (cycle-safe)
  const depthMemo = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = FAMILY_MAP[id].prereqs.filter((p) => visible.has(p) && FAMILY_MAP[p].model === FAMILY_MAP[id].model);
    const d = ps.length ? 1 + Math.max(...ps.map((p) => depthOf(p, seen))) : 0;
    depthMemo.set(id, d);
    return d;
  };

  const K = models.length;
  const ringR = K <= 1 ? 0 : Math.max(22, K * 7.5);
  const clusters = [];
  const nodes = [];
  models.forEach((m, k) => {
    const a = (k / Math.max(1, K)) * Math.PI * 2;
    const center = [Math.cos(a) * ringR, K <= 1 ? 0 : Math.sin(k * 1.7) * 5, Math.sin(a) * ringR];
    const fams = byModel.get(m.id).slice().sort((x, y) => x.branch.localeCompare(y.branch) || x.name.localeCompare(y.name));
    const scale = 1 + Math.sqrt(fams.length) / 7;
    const shells = new Map();
    for (const f of fams) {
      const d = Math.min(depthOf(f.id), 6);
      if (!shells.has(d)) shells.set(d, []);
      shells.get(d).push(f);
    }
    let maxR = 0;
    for (const [d, list] of shells) {
      const r = (3 + d * 3.1) * scale;
      maxR = Math.max(maxR, r);
      // rotate each shell a little so shells don't line up
      const rot = d * 0.9 + k;
      list.forEach((f, i) => {
        const [x, y, z] = fibonacciPoint(i, list.length, r);
        const cx = x * Math.cos(rot) - z * Math.sin(rot);
        const cz = x * Math.sin(rot) + z * Math.cos(rot);
        nodes.push({ id: f.id, model: m.id, depth: d, pos: [center[0] + cx, center[1] + y, center[2] + cz] });
      });
    }
    clusters.push({ model: m.id, label: m.label, center, radius: maxR, count: fams.length });
  });

  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const links = [];
  const roots = [];
  for (const n of nodes) {
    const ps = FAMILY_MAP[n.id].prereqs.filter((p) => index.has(p));
    for (const p of ps) links.push([index.get(p), index.get(n.id)]);
    if (!ps.some((p) => FAMILY_MAP[p].model === n.model)) roots.push(index.get(n.id));
  }
  return { nodes, index, clusters, links, roots, ringR };
}
