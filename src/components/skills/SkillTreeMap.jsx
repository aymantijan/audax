import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Search, Maximize2, Minimize2, Crosshair } from 'lucide-react';
import { useSkillStore } from '../../store/skillStore';
import { SKILL_TREE, XP_TO_NEXT } from '../../utils/constants';

const CATEGORIES = [...new Set(SKILL_TREE.map((s) => s.category))];
const TRACKS = ['all', 'PE', 'GE', 'VC', 'RBF', 'Trading', 'General'];

// Palette "anime" : néons sur fond nuit. Mastered (Lv5) = or.
// PERF : la lueur est rendue par des halos en dégradé radial (fill), PAS par des
// filtres SVG feDropShadow — les filtres forçaient un re-flou par frame sur des
// centaines de nœuds et rendaient la page inutilisable.
const COLOR = { locked: '#3d4757', available: '#00d9ff', active: '#00d97f', mastered: '#ffd23f' };
const HALO = { available: 'url(#haloCyan)', active: 'url(#haloGreen)', mastered: 'url(#haloGold)' };
const CAT_COLOR = '#b366ff';

function skillStatus(state) {
  if (!state || state.locked) return 'locked';
  if (state.level >= 5) return 'mastered';
  if (state.level > 1 || state.xp > 0) return 'active';
  return 'available';
}

// Étoiles de fond déterministes — statiques (le scintillement de 140 étoiles
// coûtait 140 animations de peinture par frame ; seules ~18 scintillent encore).
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG = mulberry32(42);
const STARS = Array.from({ length: 80 }, (_, i) => ({ x: RNG() * 2 - 1, y: RNG() * 2 - 1, r: RNG() * 1.3 + 0.3, o: RNG() * 0.45 + 0.15, tw: i < 18 }));

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
      status: skillStatus(state),
      level: state?.level ?? 0,
      xp: state?.xp ?? 0,
      xpNeeded: XP_TO_NEXT[state?.level] ?? 0,
      locked: !!state?.locked,
    });
  }
  return root;
}

export default function SkillTreeMap({ onSelect }) {
  const skills = useSkillStore((s) => s.skills);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const transformRef = useRef(null);
  const expandedRef = useRef(new Set(CATEGORIES.map((c) => `cat:${c}`)));
  const refitRef = useRef(true);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(''); // recherche debouncée — évite un redraw complet par frappe
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 1000, h: 720 });

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
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

  useEffect(() => {
    refitRef.current = true;
  }, [categoryFilter, trackFilter]);

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

    // ── Defs : dégradés (aucun filtre SVG — voir note perf en tête de fichier) ──
    const defs = svg.append('defs');
    const coreGrad = defs.append('radialGradient').attr('id', 'coreGrad');
    coreGrad.append('stop').attr('offset', '0%').attr('stop-color', '#e0f7ff');
    coreGrad.append('stop').attr('offset', '45%').attr('stop-color', '#00d9ff');
    coreGrad.append('stop').attr('offset', '100%').attr('stop-color', '#b366ff');
    const bgGrad = defs.append('radialGradient').attr('id', 'bgGrad');
    bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#101726');
    bgGrad.append('stop').attr('offset', '70%').attr('stop-color', '#0a0f1a');
    bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#060a12');
    // Halos : dégradé radial couleur → transparent, réutilisé par référence.
    for (const [name, color] of [['haloCyan', '#00d9ff'], ['haloGreen', '#00d97f'], ['haloGold', '#ffd23f'], ['haloPurple', '#b366ff']]) {
      const gr = defs.append('radialGradient').attr('id', name);
      gr.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.55);
      gr.append('stop').attr('offset', '55%').attr('stop-color', color).attr('stop-opacity', 0.18);
      gr.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);
    }

    // ── Fond : nuit + étoiles (statiques pour la plupart) ──
    svg.append('rect').attr('width', size.w).attr('height', size.h).attr('fill', 'url(#bgGrad)');
    const starG = svg.append('g');
    const starScale = Math.max(size.w, size.h) / 2;
    for (const s of STARS) {
      starG.append('circle')
        .attr('cx', size.w / 2 + s.x * starScale)
        .attr('cy', size.h / 2 + s.y * starScale)
        .attr('r', s.r)
        .attr('fill', '#9fd8ff')
        .attr('class', s.tw ? 'astar' : null)
        .attr('opacity', s.o);
    }

    const g = svg.append('g');

    // ── Hiérarchie avec état plié/déplié ──
    const rootH = d3.hierarchy(data, (d) => {
      if (d.kind === 'skill') return null;
      if (d.kind === 'root') return d.children;
      return expandedRef.current.has(d.id) ? d.children : null;
    });

    const leaves = rootH.leaves().length;
    const radius = Math.max(300, (leaves * 13) / (2 * Math.PI));
    d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => ((a.parent === b.parent ? 1 : 1.6) / Math.max(1, a.depth)))(rootH);

    // ── Anneaux de guidage (cercle magique) ──
    const rings = g.append('g');
    for (const rr of [radius * 0.33, radius * 0.66, radius]) {
      rings.append('circle').attr('r', rr).attr('fill', 'none').attr('stroke', '#1d2a44').attr('stroke-width', 1);
    }
    rings.append('circle').attr('r', radius + 26).attr('fill', 'none').attr('stroke', '#274069')
      .attr('stroke-width', 1.2).attr('stroke-dasharray', '3 14').attr('class', 'ring-spin');
    rings.append('circle').attr('r', radius + 40).attr('fill', 'none').attr('stroke', '#1b2c4c')
      .attr('stroke-width', 0.8).attr('stroke-dasharray', '40 22 6 22').attr('class', 'ring-spin-rev');

    // ── Liens radiaux ──
    // PERF : le flux animé (stroke-dashoffset) n'est appliqué qu'aux liens des
    // skills pratiquées, et seulement s'il y en a moins de 60 à l'écran.
    const activeLinks = rootH.links().filter((l) => l.target.data.kind === 'skill' && (l.target.data.status === 'active' || l.target.data.status === 'mastered'));
    const animateFlow = activeLinks.length <= 60;
    const isDim = (d) => q && d.data.kind === 'skill' && !matches.has(d.data.id);
    g.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(rootH.links())
      .join('path')
      .attr('d', d3.linkRadial().angle((d) => d.x).radius((d) => d.y))
      .attr('class', (d) => (animateFlow && d.target.data.kind === 'skill' && (d.target.data.status === 'active' || d.target.data.status === 'mastered') ? 'link-flow' : ''))
      .style('stroke', (d) => {
        if (d.target.data.kind === 'skill') {
          const c = COLOR[d.target.data.status];
          return d.target.data.status === 'locked' ? '#25314a' : c;
        }
        return d.target.data.kind === 'category' ? CAT_COLOR : '#31548a';
      })
      .style('stroke-opacity', (d) => (isDim(d.target) ? 0.08 : d.target.data.kind === 'skill' && d.target.data.status === 'locked' ? 0.35 : 0.5))
      .style('stroke-width', (d) => (d.target.data.kind === 'category' ? 2 : 1.3));

    // ── Nœuds ──
    const node = g.append('g')
      .selectAll('g')
      .data(rootH.descendants())
      .join('g')
      .attr('transform', (d) => (d.depth === 0 ? 'translate(0,0)' : `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`))
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.kind === 'skill') onSelect?.(d.data.id);
        else if (d.data.kind !== 'root') {
          const set = expandedRef.current;
          if (set.has(d.data.id)) set.delete(d.data.id);
          else set.add(d.data.id);
          refitRef.current = false;
          setTick((t) => t + 1);
        }
      });

    // Cœur central pulsant (1 seule animation)
    const core = node.filter((d) => d.depth === 0);
    core.append('circle').attr('r', 60).attr('fill', 'url(#haloCyan)');
    core.append('circle').attr('r', 44).attr('fill', 'none').attr('stroke', '#00d9ff').attr('stroke-opacity', 0.35).attr('class', 'core-pulse');
    core.append('circle').attr('r', 30).attr('fill', 'url(#coreGrad)');
    core.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle')
      .style('font-size', '11px').style('font-weight', 800).style('letter-spacing', '2px')
      .style('fill', '#04121f').style('pointer-events', 'none').text('AUDAX');

    // Catégories : losanges violets + halo dégradé
    const cats = node.filter((d) => d.data.kind === 'category');
    cats.append('circle').attr('r', 20).attr('fill', 'url(#haloPurple)').style('pointer-events', 'none');
    cats.append('rect')
      .attr('x', -9).attr('y', -9).attr('width', 18).attr('height', 18)
      .attr('transform', 'rotate(45)')
      .attr('rx', 3.5)
      .attr('fill', (d) => (expandedRef.current.has(d.data.id) ? '#171230' : CAT_COLOR))
      .attr('stroke', CAT_COLOR).attr('stroke-width', 2)
      .attr('class', 'node-core');

    // Sous-catégories : anneaux cyan (halo quand repliées, avec compteur)
    const subs = node.filter((d) => d.data.kind === 'subcategory');
    subs.filter((d) => !expandedRef.current.has(d.data.id))
      .append('circle').attr('r', 15).attr('fill', 'url(#haloCyan)').style('pointer-events', 'none');
    subs.append('circle')
      .attr('r', 8)
      .attr('fill', (d) => (expandedRef.current.has(d.data.id) ? '#0b1526' : '#0a3947'))
      .attr('stroke', '#00d9ff').attr('stroke-width', 1.8)
      .attr('class', 'node-core');
    subs.filter((d) => !expandedRef.current.has(d.data.id))
      .append('text')
      .attr('dy', '0.32em').attr('text-anchor', 'middle')
      .attr('transform', (d) => `rotate(${90 - (d.x * 180) / Math.PI})`)
      .style('font-size', '7.5px').style('font-weight', 700).style('fill', '#7fe7ff').style('pointer-events', 'none')
      .text((d) => d.data.children?.length || '');

    // Skills : halo dégradé + orbe plein + arc XP + niveau
    const skillNodes = node.filter((d) => d.data.kind === 'skill');
    skillNodes.filter((d) => d.data.status !== 'locked' || (q && matches.has(d.data.id)))
      .append('circle')
      .attr('r', 13)
      .attr('fill', (d) => (q && matches.has(d.data.id) ? 'url(#haloGold)' : HALO[d.data.status] || null))
      .style('pointer-events', 'none')
      .style('opacity', (d) => (isDim(d) ? 0.1 : 1));
    skillNodes.append('circle')
      .attr('r', 6.5)
      .attr('fill', (d) => COLOR[d.data.status])
      .attr('fill-opacity', (d) => (d.data.status === 'locked' ? 0.5 : 1))
      .attr('stroke', (d) => (q && matches.has(d.data.id) ? '#ffd23f' : COLOR[d.data.status]))
      .attr('stroke-width', (d) => (q && matches.has(d.data.id) ? 2.5 : 1))
      .attr('class', 'node-core')
      .style('opacity', (d) => (isDim(d) ? 0.15 : 1));

    // Arc XP autour du nœud (progression vers le niveau suivant)
    const arcGen = d3.arc().innerRadius(8.6).outerRadius(10.4).startAngle(0);
    skillNodes.filter((d) => !d.data.locked && d.data.level < 5 && d.data.xpNeeded > 0 && d.data.xp > 0)
      .append('path')
      .attr('d', (d) => arcGen({ endAngle: 2 * Math.PI * Math.min(1, d.data.xp / d.data.xpNeeded) }))
      .attr('fill', (d) => COLOR[d.data.status])
      .attr('fill-opacity', 0.85)
      .style('opacity', (d) => (isDim(d) ? 0.1 : 1));

    // Niveau (Lv2+) au centre de l'orbe
    skillNodes.filter((d) => d.data.level >= 2)
      .append('text')
      .attr('dy', '0.32em').attr('text-anchor', 'middle')
      .attr('transform', (d) => `rotate(${90 - (d.x * 180) / Math.PI})`)
      .style('font-size', '7px').style('font-weight', 800)
      .style('fill', '#071019').style('pointer-events', 'none')
      .text((d) => d.data.level);

    // ── Libellés radiaux ──
    node.filter((d) => d.depth > 0)
      .append('text')
      .attr('dy', '0.32em')
      .attr('x', (d) => {
        const off = d.data.kind === 'category' ? 16 : 12;
        return d.x < Math.PI ? off : -off;
      })
      .attr('text-anchor', (d) => (d.x < Math.PI ? 'start' : 'end'))
      .attr('transform', (d) => (d.x >= Math.PI ? 'rotate(180)' : null))
      .style('font-size', (d) => (d.data.kind === 'category' ? '13px' : d.data.kind === 'subcategory' ? '10.5px' : '9px'))
      .style('font-weight', (d) => (d.data.kind === 'skill' ? 400 : 700))
      .style('fill', (d) => {
        if (isDim(d)) return '#3a4a66';
        if (d.data.kind === 'category') return '#d9c6ff';
        if (d.data.kind === 'subcategory') return '#9fd8ff';
        return d.data.status === 'locked' ? '#5d6c85' : '#dbe7f7';
      })
      .style('pointer-events', 'none')
      .style('paint-order', 'stroke')
      .style('stroke', '#0a0f1a')
      .style('stroke-width', '2.5px')
      .text((d) => d.data.name);

    node.append('title').text((d) =>
      d.data.kind === 'skill'
        ? `${d.data.name}\n${d.data.locked ? '🔒 Locked — prerequisites not met' : `Lv${d.data.level} · ${d.data.xp}/${d.data.xpNeeded} XP`}\n\n${d.data.description}`
        : d.data.name
    );

    // ── Zoom / pan + ajustement ──
    const zoom = d3.zoom().scaleExtent([0.12, 2.5]).on('zoom', (event) => {
      g.attr('transform', event.transform);
      transformRef.current = event.transform;
    });
    svg.call(zoom).on('dblclick.zoom', null);

    if (refitRef.current || !transformRef.current) {
      const extent = radius + 120;
      const scale = Math.max(0.12, Math.min(1.4, Math.min(size.w, size.h) / (2 * extent)));
      const t = d3.zoomIdentity.translate(size.w / 2, size.h / 2).scale(scale);
      svg.call(zoom.transform, t);
      transformRef.current = t;
      refitRef.current = false;
    } else {
      svg.call(zoom.transform, transformRef.current);
    }
  }, [data, query, size, tick, categoryFilter, trackFilter, onSelect]);

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
      {/* Animations : volontairement peu nombreuses (2 anneaux, 1 pulsation, ~18 étoiles, flux plafonné) */}
      <style>{`
        @keyframes ringSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ringSpinRev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .ring-spin { animation: ringSpin 90s linear infinite; transform-origin: 0 0; }
        .ring-spin-rev { animation: ringSpinRev 140s linear infinite; transform-origin: 0 0; }
        @keyframes corePulse { 0%,100% { transform: scale(1); opacity: .35; } 50% { transform: scale(1.18); opacity: .12; } }
        .core-pulse { animation: corePulse 3.2s ease-in-out infinite; transform-origin: 0 0; }
        @keyframes flow { to { stroke-dashoffset: -20; } }
        .link-flow { stroke-dasharray: 5 5; animation: flow 1.4s linear infinite; }
        @keyframes twinkle { 0%,100% { opacity: .55; } 50% { opacity: .1; } }
        .astar { animation: twinkle 3.4s ease-in-out infinite; }
        .node-core { transition: transform .18s ease; transform-box: fill-box; transform-origin: center; }
        g:hover > .node-core { transform: scale(1.5); }
      `}</style>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder={`Search ${SKILL_TREE.length} skills…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} title="Career track">
          {TRACKS.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All tracks' : t}</option>
          ))}
        </select>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
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
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.mastered }} /> Mastered Lv5</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.active }} /> Practiced</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.available }} /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR.locked }} /> Locked</span>
        <span className="ml-auto hidden sm:inline">Drag · zoom · click a diamond/ring to expand · click an orb for details</span>
      </div>

      <div ref={wrapRef} className="w-full rounded-xl overflow-hidden border border-line" style={{ background: '#0a0f1a' }}>
        <svg ref={svgRef} width={size.w} height={size.h} className="cursor-grab active:cursor-grabbing block" />
      </div>
    </div>
  );
}
