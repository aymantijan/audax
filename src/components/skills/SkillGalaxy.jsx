import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { createGalaxy } from './galaxy-scene';
import { layoutGalaxy } from './galaxy-layout';

const lowPowerDevice = () => {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  return (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4 || (touch && window.innerWidth < 700);
};

// The 3D skill tree. `states` = computeFamilyStates(); `since` = the states as
// they were at the last visit (played back as animations once on arrival).
const SkillGalaxy = forwardRef(function SkillGalaxy({ states, visibleIds, since, onSelect, onHover, onUnsupported }, ref) {
  const wrapRef = useRef(null);
  const engineRef = useRef(null);
  const prevRef = useRef(null);
  const sinceRef = useRef(since);
  const cbRef = useRef({ onSelect, onHover });
  cbRef.current = { onSelect, onHover };

  const layout = useMemo(() => layoutGalaxy(visibleIds), [visibleIds]);

  useEffect(() => {
    const engine = createGalaxy(wrapRef.current, {
      onSelect: (id) => cbRef.current.onSelect?.(id),
      onHover: (id) => cbRef.current.onHover?.(id),
      lowPower: lowPowerDevice(),
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    });
    if (!engine) { onUnsupported?.(); return undefined; }
    engineRef.current = engine;
    // Light/dark switch → re-read the colour tokens.
    const mo = new MutationObserver(() => engine.refreshTheme());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mo.disconnect(); engine.dispose(); engineRef.current = null; prevRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const prev = prevRef.current;
    engine.setData(layout, states);
    if (prev) engine.playDiff(prev, states, { stagger: 0.2 });
    else if (sinceRef.current) {
      const from = sinceRef.current;
      sinceRef.current = null;
      setTimeout(() => engineRef.current?.playDiff(from, states), 700);
    }
    prevRef.current = states;
  }, [layout, states]);

  useImperativeHandle(ref, () => ({
    flyTo: (t) => engineRef.current?.flyTo(t),
    replay: (from) => engineRef.current?.playDiff(from, prevRef.current || states),
  }), [states]);

  return (
    <div ref={wrapRef} className="sg-wrap" role="img" aria-label="Arbre de compétences en 3D : fais glisser pour tourner, pince ou molette pour zoomer, touche une sphère pour l’ouvrir.">
      <style>{`
        .sg-wrap { position: relative; height: min(72vh, 720px); min-height: 420px; overflow: hidden; border-radius: 12px;
          border: 1px solid var(--border);
          background: radial-gradient(ellipse at 50% 38%, color-mix(in srgb, var(--accent-secondary) 16%, var(--bg-primary)) 0%, var(--bg-primary) 72%); }
        .sg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
        .sg-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .sg-label { position: absolute; left: 0; top: 0; white-space: nowrap; font-size: 11px; color: var(--text-secondary);
          text-shadow: 0 1px 3px var(--bg-primary), 0 0 8px var(--bg-primary); will-change: transform; }
        .sg-strong { color: var(--text-primary); font-weight: 600; font-size: 12.5px; }
        .sg-cluster { pointer-events: auto; cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--accent-primary);
          background: color-mix(in srgb, var(--bg-primary) 65%, transparent); border: 1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent);
          padding: 2px 9px; border-radius: 999px; }
        .sg-cluster:hover { border-color: var(--accent-primary); }
      `}</style>
    </div>
  );
});

export default SkillGalaxy;
