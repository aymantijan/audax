import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Search, Maximize2, Minimize2, Crosshair } from 'lucide-react';
import { useSkillStore } from '../../store/skillStore';
import { SKILL_TREE, XP_TO_NEXT } from '../../utils/constants';

const CATEGORIES = [...new Set(SKILL_TREE.map((s) => s.category))];
const TRACKS = ['all', 'PE', 'GE', 'VC', 'RBF', 'Trading', 'General'];

// Neon palette on a deep-space field. Mastered (Lv5) = gold.
const COLOR = { locked: '#3a4459', available: '#00e5ff', active: '#22e39a', mastered: '#ffcf3f' };
const CAT_COLOR = '#c084fc';

function skillStatus(state) {
  if (!state || state.locked) return 'locked';
  if (state.level >= 5) return 'mastered';
  if (state.level > 1 || state.xp > 0) return 'active';
  return 'available';
}

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
      id: def.id, name: def.name, kind: 'skill',
      description: def.description, track: def.track,
      status: skillStatus(state), level: state?.level ?? 0,
      xp: state?.xp ?? 0, xpNeeded: XP_TO_NEXT[state?.level] ?? 0, locked: !!state?.locked,
    });
  }
  return root;
}

export default function SkillTreeMap({ onSelect }) {
  const skills = useSkillStore((s) => s.skills);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect; // kept in a ref so the d3 effect never re-runs on parent renders
  const transformRef = useRef(null);
  const expandedRef = useRef(new Set(CATEGORIES.map((c) => `cat:${c}`)));
  const refitRef = useRef(true);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 1000, h: 720 });

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 220);
    return () => clearTimeout(t);
  }, [search]);

  const data = useMemo(() => buildData(skills, categoryFilter, trackFilter), [skills, categoryFilter, trackFilter]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: 720 }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: 720 });
    return () => ro.disconnect();
  }, []);

  useEffect(() => { refitRef.current = true; }, [categoryFilter, trackFilter]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
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

    // Gradients only — NO SVG filters or CSS animation classes on SVG elements.
    // All ambient motion lives on the CSS layers behind the SVG, so this SVG only
    // repaints on zoom/data change, never per animation frame.
    const defs = svg.append('defs');
    const coreGrad = defs.append('radialGradient').attr('id', 'stCore');
    coreGrad.append('stop').attr('offset', '0%').attr('stop-color', '#e6fbff');
    coreGrad.append('stop').attr('offset', '50%').attr('stop-color', '#00e5ff');
    coreGrad.append('stop').attr('offset', '100%').attr('stop-color', '#c084fc');
    for (const [id, c] of [['stCyan', '#00e5ff'], ['stGreen', '#22e39a'], ['stGold', '#ffcf3f'], ['stPurple', '#c084fc']]) {
      const g = defs.append('radialGradient').attr('id', id);
      g.append('stop').attr('offset', '0%').attr('stop-color', c).attr('stop-opacity', 0.5);
      g.append('stop').attr('offset', '60%').attr('stop-color', c).attr('stop-opacity', 0.12);
      g.append('stop').attr('offset', '100%').attr('stop-color', c).attr('stop-opacity', 0);
    }

    const g = svg.append('g');
    const rootH = d3.hierarchy(data, (d) => {
      if (d.kind === 'skill') return null;
      if (d.kind === 'root') return d.children;
      return expandedRef.current.has(d.id) ? d.children : null;
    });

    const leaves = rootH.leaves().length;
    const radius = Math.max(300, (leaves * 13) / (2 * Math.PI));
    d3.tree().size([2 * Math.PI, radius]).separation((a, b) => ((a.parent === b.parent ? 1 : 1.6) / Math.max(1, a.depth)))(rootH);

    // Guide rings (static)
    const rings = g.append('g');
    for (const rr of [radius * 0.33, radius * 0.66, radius]) {
      rings.append('circle').attr('r', rr).attr('fill', 'none').attr('stroke', '#17233c').attr('stroke-width', 1);
    }
    rings.append('circle').attr('r', radius + 30).attr('fill', 'none').attr('stroke', '#233752').attr('stroke-width', 1).attr('stroke-dasharray', '2 16');

    const isDim = (d) => q && d.data.kind === 'skill' && !matches.has(d.data.id);

    // Links — static neon
    g.append('g').attr('fill', 'none')
      .selectAll('path').data(rootH.links()).join('path')
      .attr('d', d3.linkRadial().angle((d) => d.x).radius((d) => d.y))
      .style('stroke', (d) => {
        if (d.target.data.kind === 'skill') return d.target.data.status === 'locked' ? '#1e2a42' : COLOR[d.target.data.status];
        return d.target.data.kind === 'category' ? CAT_COLOR : '#2b4a7a';
      })
      .style('stroke-opacity', (d) => (isDim(d.target) ? 0.06 : d.target.data.kind === 'skill' && d.target.data.status === 'locked' ? 0.3 : 0.45))
      .style('stroke-width', (d) => (d.target.data.kind === 'category' ? 1.8 : 1.1));

    const node = g.append('g').selectAll('g').data(rootH.descendants()).join('g')
      .attr('transform', (d) => (d.depth === 0 ? 'translate(0,0)' : `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`))
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.kind === 'skill') onSelectRef.current?.(d.data.id);
        else if (d.data.kind !== 'root') {
          const set = expandedRef.current;
          if (set.has(d.data.id)) set.delete(d.data.id); else set.add(d.data.id);
          refitRef.current = false;
          setTick((t) => t + 1);
        }
      });

    // Cheap per-node hover: scale ONLY the hovered shape, on enter/leave (not continuous).
    node.on('mouseenter', function () { d3.select(this).select('.shape').attr('transform', 'scale(1.6)'); })
      .on('mouseleave', function () { d3.select(this).select('.shape').attr('transform', null); });

    // Center core
    const core = node.filter((d) => d.depth === 0);
    core.append('circle').attr('r', 58).attr('fill', 'url(#stCyan)').style('pointer-events', 'none');
    core.append('circle').attr('class', 'shape').attr('r', 30).attr('fill', 'url(#stCore)');
    core.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle')
      .style('font-size', '11px').style('font-weight', 800).style('letter-spacing', '2px')
      .style('fill', '#04121f').style('pointer-events', 'none').text('AUDAX');

    // Categories — glowing diamonds
    const cats = node.filter((d) => d.data.kind === 'category');
    cats.append('circle').attr('r', 20).attr('fill', 'url(#stPurple)').style('pointer-events', 'none');
    cats.append('rect').attr('class', 'shape').attr('x', -9).attr('y', -9).attr('width', 18).attr('height', 18)
      .attr('transform', 'rotate(45)').attr('rx', 3)
      .attr('fill', (d) => (expandedRef.current.has(d.data.id) ? '#1a1330' : CAT_COLOR))
      .attr('stroke', CAT_COLOR).attr('stroke-width', 2);

    // Subcategories — cyan rings with a count when collapsed
    const subs = node.filter((d) => d.data.kind === 'subcategory');
    subs.filter((d) => !expandedRef.current.has(d.data.id))
      .append('circle').attr('r', 15).attr('fill', 'url(#stCyan)').style('pointer-events', 'none');
    subs.append('circle').attr('class', 'shape').attr('r', 8)
      .attr('fill', (d) => (expandedRef.current.has(d.data.id) ? '#0c1626' : '#0a3547'))
      .attr('stroke', '#00e5ff').attr('stroke-width', 1.6);
    subs.filter((d) => !expandedRef.current.has(d.data.id)).append('text')
      .attr('dy', '0.32em').attr('text-anchor', 'middle')
      .attr('transform', (d) => `rotate(${90 - (d.x * 180) / Math.PI})`)
      .style('font-size', '7.5px').style('font-weight', 700).style('fill', '#7fe9ff').style('pointer-events', 'none')
      .text((d) => d.data.children?.length || '');

    // Skills — halo (unlocked only) + neon orb + XP arc + level number
    const skillNodes = node.filter((d) => d.data.kind === 'skill');
    skillNodes.filter((d) => d.data.status !== 'locked' || (q && matches.has(d.data.id)))
      .append('circle').attr('r', 12)
      .attr('fill', (d) => (q && matches.has(d.data.id) ? 'url(#stGold)' : d.data.status === 'mastered' ? 'url(#stGold)' : d.data.status === 'active' ? 'url(#stGreen)' : 'url(#stCyan)'))
      .style('pointer-events', 'none').style('opacity', (d) => (isDim(d) ? 0.1 : 1));
    skillNodes.append('circle').attr('class', 'shape').attr('r', 6)
      .attr('fill', (d) => COLOR[d.data.status]).attr('fill-opacity', (d) => (d.data.status === 'locked' ? 0.5 : 1))
      .attr('stroke', (d) => (q && matches.has(d.data.id) ? '#ffcf3f' : COLOR[d.data.status]))
      .attr('stroke-width', (d) => (q && matches.has(d.data.id) ? 2.4 : 1))
      .style('opacity', (d) => (isDim(d) ? 0.15 : 1));

    const arc = d3.arc().innerRadius(8).outerRadius(9.6).startAngle(0);
    skillNodes.filter((d) => !d.data.locked && d.data.level < 5 && d.data.xpNeeded > 0 && d.data.xp > 0)
      .append('path').attr('d', (d) => arc({ endAngle: 2 * Math.PI * Math.min(1, d.data.xp / d.data.xpNeeded) }))
      .attr('fill', (d) => COLOR[d.data.status]).attr('fill-opacity', 0.85).style('pointer-events', 'none');
    skillNodes.filter((d) => d.data.level >= 2).append('text')
      .attr('dy', '0.32em').attr('text-anchor', 'middle')
      .attr('transform', (d) => `rotate(${90 - (d.x * 180) / Math.PI})`)
      .style('font-size', '6.5px').style('font-weight', 800).style('fill', '#08131e').style('pointer-events', 'none')
      .text((d) => d.data.level);

    // Labels: categories & subcategories always; skills ONLY when matched by search.
    // (Every node has a native <title> tooltip for its name/details — so hiding the
    //  hundreds of always-on skill labels keeps zoom smooth without losing info.)
    const labelled = node.filter((d) => d.depth > 0 && (d.data.kind !== 'skill' || (q && matches.has(d.data.id))));
    labelled.append('text').attr('dy', '0.32em')
      .attr('x', (d) => (d.x < Math.PI ? (d.data.kind === 'category' ? 16 : 12) : (d.data.kind === 'category' ? -16 : -12)))
      .attr('text-anchor', (d) => (d.x < Math.PI ? 'start' : 'end'))
      .attr('transform', (d) => (d.x >= Math.PI ? 'rotate(180)' : null))
      .style('font-size', (d) => (d.data.kind === 'category' ? '13px' : d.data.kind === 'subcategory' ? '10.5px' : '9px'))
      .style('font-weight', (d) => (d.data.kind === 'skill' ? 400 : 700))
      .style('fill', (d) => (d.data.kind === 'category' ? '#e0ccff' : d.data.kind === 'subcategory' ? '#9fe9ff' : '#ffe08a'))
      .style('pointer-events', 'none').style('paint-order', 'stroke')
      .style('stroke', '#070b14').style('stroke-width', '2.5px')
      .text((d) => d.data.name);

    node.append('title').text((d) =>
      d.data.kind === 'skill'
        ? `${d.data.name}\n${d.data.locked ? '🔒 Locked — prerequisites not met' : `Lv${d.data.level} · ${d.data.xp}/${d.data.xpNeeded} XP`}\n\n${d.data.description}`
        : `${d.data.name}${d.data.kind !== 'root' ? ' — click to ' + (expandedRef.current.has(d.data.id) ? 'collapse' : 'expand') : ''}`
    );

    const zoom = d3.zoom().scaleExtent([0.12, 2.5]).on('zoom', (event) => {
      g.attr('transform', event.transform);
      transformRef.current = event.transform;
    });
    svg.call(zoom).on('dblclick.zoom', null);

    if (refitRef.current || !transformRef.current) {
      const extent = radius + 110;
      const scale = Math.max(0.12, Math.min(1.4, Math.min(size.w, size.h) / (2 * extent)));
      const t = d3.zoomIdentity.translate(size.w / 2, size.h / 2).scale(scale);
      svg.call(zoom.transform, t);
      transformRef.current = t;
      refitRef.current = false;
    } else {
      svg.call(zoom.transform, transformRef.current);
    }
  }, [data, query, size, tick, categoryFilter, trackFilter]);

  const setAll = (open) => {
    const set = new Set(CATEGORIES.map((c) => `cat:${c}`));
    if (open) for (const def of SKILL_TREE) set.add(`sub:${def.category}:${def.subcategory}`);
    expandedRef.current = set;
    refitRef.current = true;
    setTick((t) => t + 1);
  };
  const recenter = () => { refitRef.current = true; setTick((t) => t + 1); };

  return (
    <div className="space-y-3">
      {/* Ambient motion lives on GPU-composited CSS layers only — transform/opacity,
          never touching the SVG paint. This is what keeps the map fast while alive. */}
      <style>{`
        @keyframes st-sweep { to { transform: rotate(360deg); } }
        @keyframes st-pulse { 0%,100% { opacity:.45; transform:scale(1);} 50% { opacity:.8; transform:scale(1.05);} }
        .st-wrap { position:relative; overflow:hidden; border-radius:12px; background:#070b14; }
        /* static grid — no animation, zero continuous cost */
        .st-grid { position:absolute; inset:0; pointer-events:none;
          background-image:linear-gradient(#0e1830 1px,transparent 1px),linear-gradient(90deg,#0e1830 1px,transparent 1px);
          background-size:44px 44px; opacity:.45; }
        .st-vignette { position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(circle at 50% 46%, transparent 45%, rgba(3,6,12,.85) 100%); }
        /* two lightweight GPU-composited ambient animations */
        .st-sweep { position:absolute; left:50%; top:46%; width:760px; height:760px; margin:-380px 0 0 -380px; pointer-events:none;
          background:conic-gradient(from 0deg, rgba(0,229,255,.09), transparent 24%, transparent 76%, rgba(192,132,252,.09));
          border-radius:50%; animation:st-sweep 26s linear infinite; will-change:transform; }
        .st-core { position:absolute; left:50%; top:46%; width:200px; height:200px; margin:-100px 0 0 -100px; pointer-events:none;
          background:radial-gradient(circle, rgba(0,229,255,.2), rgba(192,132,252,.07) 55%, transparent 70%);
          animation:st-pulse 4s ease-in-out infinite; will-change:transform,opacity; }
        .st-svg { position:relative; display:block; }
        @media (prefers-reduced-motion: reduce) { .st-sweep, .st-core { animation:none; } }
      `}</style>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder={`Search ${SKILL_TREE.length} skills…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} title="Career track">
          {TRACKS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All tracks' : t}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setAll(true)} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink border border-line rounded-lg px-3 py-2 cursor-pointer" title="Expand all"><Maximize2 size={14} /> Expand</button>
        <button onClick={() => setAll(false)} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink border border-line rounded-lg px-3 py-2 cursor-pointer" title="Collapse all"><Minimize2 size={14} /> Collapse</button>
        <button onClick={recenter} className="flex items-center gap-1.5 text-sm text-mute hover:text-ink border border-line rounded-lg px-3 py-2 cursor-pointer" title="Recenter"><Crosshair size={14} /> Fit</button>
      </div>

      <div className="flex items-center gap-4 text-xs text-mute">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.mastered }} /> Mastered</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.active }} /> Practiced</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.available }} /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.locked }} /> Locked</span>
        <span className="ml-auto hidden sm:inline">Hover a node for its name · click an orb for details · drag & zoom</span>
      </div>

      <div ref={wrapRef} className="st-wrap border border-line">
        <div className="st-grid" />
        <div className="st-sweep" />
        <div className="st-core" />
        <svg ref={svgRef} width={size.w} height={size.h} className="st-svg cursor-grab active:cursor-grabbing" />
        <div className="st-vignette" />
      </div>
    </div>
  );
}
