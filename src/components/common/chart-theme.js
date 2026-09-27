// Shared look for every recharts chart: same axes, grid and tooltip everywhere.
export const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-primary)' },
  itemStyle: { color: 'var(--text-primary)' },
};
export const axisTick = { fill: 'var(--text-secondary)', fontSize: 11 };
export const gridProps = { stroke: 'var(--border)', strokeDasharray: '3 3', vertical: false };
// Series colours in order, all theme tokens (readable in the light and dark themes).
export const SERIES = ['var(--accent-primary)', 'var(--accent-secondary)', 'var(--success)', 'var(--warning)', 'var(--error)', 'var(--text-secondary)'];
