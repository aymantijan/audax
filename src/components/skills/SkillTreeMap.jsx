import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Search, Maximize2, Minimize2, Crosshair } from 'lucide-react';
import { useSkillStore } from '../../store/skillStore';
import { SKILL_TREE, XP_TO_NEXT } from '../../utils/constants';

const CATEGORIES = [...new Set(SKILL_TREE.map((s) => s.category))];

// Status → node fill. Theme-independent hex so it matches the legend in both themes.
const COLOR = { locked: '#556070', available: '#3b82f6', active: '#00d97f' };

function skillStatus(state) {
  if (!state || state.locked) return 'locked';
  if (state.level > 1 || state.xp > 0) return 'active'; // unlocked & practiced
  return 'available'; // unlocked, untouched
}

// Build root → category → subcategory → skill hierarchy.
// Filters by category and career track, then prunes empty branches.
function buildData(skills, categoryFilter, trackFilter) {
  const root = { id: 'root', name: 'AUDAX', kind: 'root', children: [] };
  const catMap = {};
  const subMap = {};
  for (const def of SKILL_TREE) {
    if (categoryFilter !== 'all' && def.category !== categoryFilter) continue;
    if (trackFilter !== 'all' && def.track !== trackFilter) continue;
    if (!catMap[def.category]) {
      catMap[def.category] = { id: `cat:${def.category}`, name: def.category, kind: 'category', children: [] };
      root.children.push(catMap[def.category]);
    }
    const subId = `sub:${def.category}:${def.subcategory}`;
    if (!subMap[subId]) {
      subMap[subId] = { id: subId, name: def.subcategory, kind: 'subcategory', children: [] };
      catMap[def.category].children.push(subMap[subId]);
    }
    const state = skills[def.id];
    subMap[subId].children.push({
      id: def.id,
      name: def.name,
      kind: 'skill',
      description: def.description,
      track: def.track,
      status: skillStatus(state),
      level: state?.level ?? 0,
      xp: state?.xp ?? 0,
      xpNeeded: XP_TO_NEXT[state?.level] ?? 0,
      locked: !!state?.locked,
    });
  }
  return root;
}

const TRACKS = ['all', 'PE', 'GE', 'VC', 'RBF', 'Trading', 'General'];

export default function SkillTreeMap({ onSelect }) {
  const skills = useSkillStore((s) => s.skills);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const zoomRef = useRef(null);
  const transformRef = useRef(null); // preserved pan/zoom across redraws
  const expandedRef = useRef(new Set(CATEGORIES.map((c) => `cat:${c}`))); // categories open by default
  const refitRef = useRef(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [tick, setTick] = useState(0); // bump to redraw after expand/collapse
  const [size, setSize] = useState({ w: 1000, h: 640 });

  const data = useMemo(() => buildData(skills, categoryFilter, trackFilter), [skills, categoryFilter, trackFilter]);

  // Track container width
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: 640 }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: 640 });
    return () => ro.disconnect();
  }, []);

  // Refit whenever a filter changes (structure changes materially)
  useEffect(() => {
    refitRef.current = true;
  }, [categoryFilter, trackFilter]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    const matches = new Set();
    if (q) {
      for (const def of SKILL_TREE) {
        if (categoryFilter !== 'all' && def.category !== categoryFilter) continue;
        if (trackFilter !== 'all' && def.track !== trackFilter) continue;
        if (def.name.toLowerCase().includes(q) || def.subcategory.toLowerCase().includes(q) || def.description.toLowerCase().includes(q)) {
          matches.add(def.id);
          expandedRef.current.add(`cat:${def.category}`);
          expandedRef.current.add(`sub:${def.category}:${def.subcategory}`);
        }
      }
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g');

    // Apply collapse state: hide children of internal nodes not in expandedRef
    const rootH = d3.hierarchy(data, (d) => {
      if (d.kind === 'skill') return null;
      if (d.kind === 'root') return d.children; // root always open
      return expandedRef.current.has(d.id) ? d.children : null;
    });

    const dx = 24; // vertical gap between sibling nodes
    const dy = size.w < 700 ? 170 : 230; // horizontal gap per depth
    d3.tree().nodeSize([dx, dy])(rootH);

    // Links
    g.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(rootH.links())
      .join('path')
      .attr('d', d3.linkHorizontal().x((d) => d.y).y((d) => d.x))
      .style('stroke', 'var(--border)')
      .style('stroke-width', 1.5)
      .style('opacity', q ? 0.3 : 0.6);

    const node = g
      .append('g')
      .selectAll('g')
      .data(rootH.descendants())
      .join('g')
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.kind === 'skill') {
          onSelect?.(d.data.id);
        } else if (d.data.kind !== 'root') {
          const set = expandedRef.current;
          if (set.has(d.data.id)) set.delete(d.data.id);
          else set.add(d.data.id);
          refitRef.current = false;
          setTick((t) => t + 1);
        }
      });

    const radius = (d) => (d.data.kind === 'root' ? 7 : d.data.kind === 'category' ? 8 : d.data.kind === 'subcategory' ? 6 : 5);
    const isDim = (d) => q && d.data.kind === 'skill' && !matches.has(d.data.id);

    node
      .append('circle')
      .attr('r', radius)
      .style('fill', (d) => {
        if (d.data.kind === 'skill') return COLOR[d.data.status];
        // collapsed internal node = solid accent, expanded = surface (hollow)
        const collapsed = d._children || (d.data.children?.length && !d.children);
        if (d.data.kind === 'root') return 'var(--accent-secondary)';
        return collapsed ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
      })
      .style('stroke', (d) => {
        if (q && d.data.kind === 'skill' && matches.has(d.data.id)) return '#ffd23f';
        if (d.data.kind === 'skill') return COLOR[d.data.status];
        return 'var(--accent-primary)';
      })
      .style('stroke-width', (d) => (q && matches.has(d.data.id) ? 3 : 1.8))
      .style('opacity', (d) => (isDim(d) ? 0.25 : 1));

    node
      .append('text')
      .attr('dy', '0.32em')
      .attr('x', (d) => (d.data.kind === 'skill' ? radius(d) + 6 : -(radius(d) + 6)))
      .attr('text-anchor', (d) => (d.data.kind === 'skill' ? 'start' : 'end'))
      .style('font-size', (d) => (d.data.kind === 'skill' ? '11px' : d.data.kind === 'category' ? '13px' : '12px'))
      .style('font-weight', (d) => (d.data.kind === 'skill' ? 400 : 600))
      .style('fill', (d) => (isDim(d) ? 'var(--text-secondary)' : 'var(--text-primary)'))
      .style('opacity', (d) => (isDim(d) ? 0.35 : 1))
      .style('pointer-events', 'none')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--bg-secondary)')
      .style('stroke-width', '3px')
      .text((d) => {
        const count = d.data.children?.length;
        if (d.data.kind === 'category') return `${d.data.name} (${d.data.children.reduce((a, s) => a + s.children.length, 0)})`;
        if (d.data.kind === 'subcategory') return `${d.data.name} (${count})`;
        return d.data.name;
      });

    node
      .append('title')
      .text((d) =>
        d.data.kind === 'skill'
          ? `${d.data.name}\n${d.data.locked ? 'Locked — prerequisites not met' : `Lv${d.data.level} · ${d.data.xp}/${d.data.xpNeeded} XP`}\n\n${d.data.description}`
          : d.data.name
      );

    // Zoom / pan
    const zoom = d3
      .zoom()
      .scaleExtent([0.15, 1.6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        transformRef.current = event.transform;
      });
    zoomRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);

    // Fit-to-view on first render / filter change; otherwise preserve prior transform
    if (refitRef.current || !transformRef.current) {
      const nodes = rootH.descendants();
      const xs = nodes.map((d) => d.x);
      const ys = nodes.map((d) => d.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const contentH = Math.max(1, x1 - x0);
      const contentW = Math.max(1, y1 - y0);
      const pad = 60;
      const scale = Math.max(0.15, Math.min(1.2, Math.min((size.w - pad) / (contentW + 160), (size.h - pad) / contentH)));
      const tx = pad / 2 - y0 * scale + 40;
      const ty = size.h / 2 - ((x0 + x1) / 2) * scale;
      const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
      svg.call(zoom.transform, t);
      transformRef.current = t;
      refitRef.current = false;
    } else {
      svg.call(zoom.transform, transformRef.current);
    }
  }, [data, search, size, tick, categoryFilter, onSelect]);

  const setAll = (open) => {
    const set = new Set(CATEGORIES.map((c) => `cat:${c}`));
    if (open) for (const def of SKILL_TREE) set.add(`sub:${def.category}:${def.subcategory}`);
    expandedRef.current = set;
    refitRef.current = true;
    setTick((t) => t + 1);
  };

  const recenter = () => {
    refitRef.current = true;
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Search 211 skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink"
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
          title="Career track"
        >
          {TRACKS.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All tracks' : t}</option>
          ))}
        </select>
        <select
          className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setAll(true)} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink border border-line rounded-lg px-3 py-2 cursor-pointer" title="Expand all">
          <Maximize2 size={14} /> Expand
        </button>
        <button onClick={() => setAll(false)} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink border border-line rounded-lg px-3 py-2 cursor-pointer" title="Collapse all">
          <Minimize2 size={14} /> Collapse
        </button>
        <button onClick={recenter} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink border border-line rounded-lg px-3 py-2 cursor-pointer" title="Recenter">
          <Crosshair size={14} /> Fit
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-mute">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.active }} /> Unlocked</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.available }} /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.locked }} /> Locked</span>
        <span className="ml-auto hidden sm:inline">Drag to pan · scroll to zoom · click a branch to expand · click a skill for details</span>
      </div>

      <div ref={wrapRef} className="w-full bg-card border border-line rounded-xl overflow-hidden">
        <svg ref={svgRef} width={size.w} height={size.h} className="cursor-grab active:cursor-grabbing block" />
      </div>
    </div>
  );
}
