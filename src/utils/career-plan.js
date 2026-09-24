// Career plan maths (Carrière n°2): objective progress/status and the routine week.
import { todayKey } from './formatters';

/** Monday-based week containing `day`. */
export function weekRange(day = todayKey()) {
  const d = new Date(`${day}T12:00:00`);
  const start = new Date(d); start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return [start.toLocaleDateString('sv-SE'), end.toLocaleDateString('sv-SE')];
}

/**
 * Progress of an objective: required skills (manual tick, or auto when the
 * linked skill-tree node reaches its target level) + milestones.
 */
export function planProgress(plan, skillLevels, today = todayKey()) {
  const skillDone = (s) => s.done || (s.skillId && (skillLevels?.[s.skillId]?.level || 0) >= (Number(s.targetLevel) || 3));
  const items = [...(plan.skills || []).map(skillDone), ...(plan.milestones || []).map((m) => !!m.done)];
  const pct = items.length ? Math.round((items.filter(Boolean).length / items.length) * 100) : 0;
  const overdueMilestones = (plan.milestones || []).filter((m) => !m.done && m.due && m.due < today);
  let status = 'active';
  if (plan.status === 'achieved') status = 'achieved';
  else if (plan.targetDate && plan.targetDate < today) status = 'behind';
  else if (plan.targetDate && plan.createdAt) {
    const total = new Date(`${plan.targetDate}T12:00:00`) - plan.createdAt;
    const elapsed = Date.now() - plan.createdAt;
    const timePct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
    // Behind: a milestone is overdue, or preparation lags the calendar by 25+ points.
    status = overdueMilestones.length || (items.length && pct + 25 < timePct) ? 'behind' : items.length ? 'ontrack' : 'active';
  }
  return { pct, status, skillDone, overdueMilestones, skillsLeft: (plan.skills || []).filter((s) => !skillDone(s)).length };
}

