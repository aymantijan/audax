// Shared 0-100 "motivation" color scale: red -> amber -> green -> amethyst -> glowing gold.
// Used for reading progress bars and library popularity scores.
const STOPS = [
  { max: 20, color: 'var(--error)', label: 'Tout juste commencé' },
  { max: 40, color: 'var(--warning)', label: 'En construction' },
  { max: 65, color: 'var(--success)', label: 'Bon rythme' },
  { max: 90, color: 'var(--accent-secondary)', label: 'Solide' },
  { max: 100, color: 'var(--accent-primary)', label: 'Excellent', glow: true },
];

export function scoreColor(value) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const stop = STOPS.find((s) => v <= s.max) || STOPS[STOPS.length - 1];
  return stop;
}

// Inline style + optional glow className for the "LED shiny blue" top tier.
export function scoreStyle(value) {
  const stop = scoreColor(value);
  return {
    color: stop.color,
    style: stop.glow ? { color: stop.color, textShadow: `0 0 8px ${stop.color}, 0 0 16px color-mix(in srgb, ${stop.color} 55%, transparent)` } : { color: stop.color },
    glow: !!stop.glow,
    label: stop.label,
  };
}
