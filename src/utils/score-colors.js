// Shared 0-100 "motivation" color scale: red -> yellow -> green -> blue -> LED shiny blue.
// Used for reading progress bars and library popularity scores.
const STOPS = [
  { max: 20, color: '#ff6b6b', label: 'Just started' },
  { max: 40, color: '#ffa500', label: 'Building' },
  { max: 65, color: '#00d97f', label: 'Good pace' },
  { max: 90, color: '#3b82f6', label: 'Strong' },
  { max: 100, color: '#22e5ff', label: 'Elite', glow: true },
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
    style: stop.glow ? { color: stop.color, textShadow: `0 0 8px ${stop.color}, 0 0 16px ${stop.color}88` } : { color: stop.color },
    glow: !!stop.glow,
    label: stop.label,
  };
}
