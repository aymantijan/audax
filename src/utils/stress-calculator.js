// 10-item checklist, each 0-3 → normalized 1-10 stress level (nearest 0.5).
export function calculateStressLevel(checklist) {
  const total = Object.values(checklist || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const stressLevel = (total / 30) * 10;
  return Math.min(10, Math.max(1, Math.round(stressLevel * 2) / 2));
}

export function stressLabel(level) {
  if (level <= 3) return 'Relaxed';
  if (level <= 5) return 'Mild';
  if (level <= 7) return 'Moderate';
  if (level <= 8.5) return 'High';
  return 'Severe';
}
