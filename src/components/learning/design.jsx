/**
 * Shared visual pieces for the Apprentissage (Learning) section.
 * Layout primitives are reused from the Programme design so both sections
 * look like one product.
 */
import { useLearningStore } from '../../store/learningStore';
import { DEFAULT_ACADEMIC_SETTINGS, STATUS_META, fmtGrade, mentionFor } from '../../utils/academic';
import { tint } from '../../pages/health/program/shared/design';

export { SectionHeader, SegmentedTabs, tint } from '../../pages/health/program/shared/design';

// Settings merged with defaults — cloud snapshots may predate newer keys.
export function useAcademicSettings() {
  const settings = useLearningStore((s) => s.academic?.settings);
  return { ...DEFAULT_ACADEMIC_SETTINGS, ...(settings || {}) };
}

// Colour of a grade relative to the pass mark.
export function gradeColor(v, settings) {
  if (v == null) return 'var(--text-secondary)';
  const p = v / settings.scale;
  const pass = settings.passMark / settings.scale;
  if (v < settings.passMark) return 'var(--error)';
  if (p < pass + 0.1) return 'var(--warning)';
  if (p >= 0.7) return 'var(--success)';
  return 'var(--accent-primary)';
}

export function GradePill({ value, settings, size = 'md', suffix = true }) {
  const color = gradeColor(value, settings);
  const cls = size === 'lg' ? 'text-base px-2.5 py-1' : size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`inline-flex items-baseline gap-0.5 rounded-md font-semibold tabular-nums whitespace-nowrap ${cls}`} style={{ background: tint(color, 14), color }}>
      {fmtGrade(value)}
      {suffix && value != null && <span className="text-[0.8em] opacity-70 font-normal">/{settings.scale}</span>}
    </span>
  );
}

export function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.empty;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: tint(m.color, 15), color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function MentionTag({ avg, settings }) {
  const m = mentionFor(avg, settings);
  if (!m) return null;
  return <span className="text-xs font-medium" style={{ color: m.color }}>{m.label}</span>;
}

// Big hero number block used in heroes and stat rows.
export function BigStat({ label, value, sub, color }) {
  return (
    <div className="rounded-xl bg-card/70 border border-line px-4 py-3 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-mute">{label}</div>
      <div className="text-2xl font-bold mt-0.5 tabular-nums truncate" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-mute mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export const frDate = (s, opts = { day: 'numeric', month: 'short' }) =>
  s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('fr-FR', opts) : '—';

export function countdownLabel(days) {
  if (days < 0) return `il y a ${-days} j`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} j`;
}
