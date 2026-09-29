/**
 * Shared design primitives for the Programme section.
 * One source of truth for session-type colours/icons, plus the layout pieces
 * (hero header, segmented tabs, section headers) used across Programme screens.
 */
import { Dumbbell, HeartPulse, Zap, StretchHorizontal, Trophy, Leaf, CalendarRange, Flag, Check } from 'lucide-react';

export const SESSION_TYPES = [
  { value: 'strength', label: 'Musculation', short: 'Muscu', icon: Dumbbell, color: 'var(--accent-primary)' },
  { value: 'cardio', label: 'Cardio', short: 'Cardio', icon: HeartPulse, color: 'var(--success)' },
  { value: 'agility', label: 'Agilité', short: 'Agilité', icon: Zap, color: 'var(--accent-secondary)' },
  { value: 'mobility', label: 'Mobilité', short: 'Mobilité', icon: StretchHorizontal, color: 'var(--warning)' },
  { value: 'sport', label: 'Sport', short: 'Sport', icon: Trophy, color: '#3b82f6' },
  { value: 'recovery', label: 'Récupération', short: 'Récup', icon: Leaf, color: 'var(--text-secondary)' },
];

export const typeMeta = (type) => SESSION_TYPES.find((t) => t.value === type) || SESSION_TYPES[0];

// Session types whose content is a list of drills/exercises (vs a cardio modality).
export const EXERCISE_TYPES = new Set(['strength', 'agility', 'mobility']);
export const DRILL_TYPES = new Set(['agility', 'mobility']);

export function tint(color, pct = 14) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function TypeBadge({ type, compact = false }) {
  const m = typeMeta(type);
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ background: tint(m.color), color: m.color }}
    >
      <Icon size={12} />
      {!compact && m.short}
    </span>
  );
}

export function TypePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {SESSION_TYPES.map((t) => {
        const Icon = t.icon;
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className="flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors cursor-pointer"
            style={active
              ? { borderColor: t.color, background: tint(t.color), color: t.color }
              : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <Icon size={16} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2">
          {Icon && <Icon size={16} className="text-accent shrink-0" />}
          {title}
        </h3>
        {subtitle && <p className="text-xs text-mute mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-surface border border-line overflow-x-auto">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
              active ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:text-ink'
            }`}
          >
            {Icon && <Icon size={15} className={active ? 'text-accent' : ''} />}
            {t.label}
            {t.count != null && (
              <span className={`text-[10px] rounded-full px-1.5 ${active ? 'bg-accent/15 text-accent' : 'bg-card text-mute'}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const STATUS = {
  draft: { label: 'Brouillon', color: 'var(--warning)' },
  active: { label: 'Actif', color: 'var(--success)' },
  archived: { label: 'Archivé', color: 'var(--text-secondary)' },
};

const fmtDate = (s) => (s ? new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '…');

const localToday = () => new Date().toLocaleDateString('sv-SE');

/**
 * Where a phase stands, from its dates (and an explicit "completed"):
 * 'done' — reached, kept for the record, can no longer be run;
 * 'current' — today falls in it; 'upcoming' — not started yet.
 */
export function phaseState(phase, today = localToday()) {
  if (!phase) return 'upcoming';
  if (phase.status === 'completed' || (phase.end_date && phase.end_date < today)) return 'done';
  if (phase.start_date <= today && phase.end_date >= today) return 'current';
  return 'upcoming';
}
export const PHASE_STATE = {
  done: { label: 'Atteinte', color: 'var(--success)' },
  current: { label: 'En cours', color: 'var(--accent-primary)' },
  upcoming: { label: 'À venir', color: 'var(--text-secondary)' },
};

export function PhaseStateBadge({ phase }) {
  const s = PHASE_STATE[phaseState(phase)];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: tint(s.color, 16), color: s.color }}>
      {phaseState(phase) === 'done' && <Check size={11} />}
      {s.label}
    </span>
  );
}

/** The phases in order: reached ones stay listed (dimmed), the current one stands out. */
export function PhaseList({ phases = [] }) {
  if (phases.length < 2) return null;
  const sorted = [...phases].sort((a, b) => a.phase_order - b.phase_order);
  return (
    <ol className="mt-5 space-y-2">
      {sorted.map((p) => {
        const st = phaseState(p);
        return (
          <li key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${st === 'current' ? 'border-accent/50 bg-card' : 'border-line'} ${st === 'done' ? 'opacity-70' : ''}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: tint(PHASE_STATE[st].color, 18), color: PHASE_STATE[st].color }}>
              {st === 'done' ? <Check size={14} /> : p.phase_order}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">Phase {p.phase_order} · {p.name}</span>
              <span className="block text-[11px] text-mute">{fmtDate(p.start_date)} → {fmtDate(p.end_date)}{st === 'done' ? ' · consultable, ne peut plus être lancée' : ''}</span>
            </span>
            <PhaseStateBadge phase={p} />
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Hero header: program name + status, current phase, block progress bar
 * (week X of Y, days left) and an action slot.
 */
export function ProgramHero({ program, phases = [], actions }) {
  const today = localToday();
  const status = STATUS[program.status] || STATUS.draft;
  const current = phases.find((p) => phaseState(p, today) === 'current')
    || phases.find((p) => p.status === 'active' && phaseState(p, today) !== 'done') || null;

  let progress = null;
  if (current) {
    const start = new Date(current.start_date + 'T12:00:00');
    const end = new Date(current.end_date + 'T12:00:00');
    const now = new Date(today + 'T12:00:00');
    const total = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const elapsed = Math.min(total, Math.max(0, Math.round((now - start) / 86400000) + 1));
    progress = {
      pct: Math.round((elapsed / total) * 100),
      week: Math.min(Math.ceil(elapsed / 7), Math.ceil(total / 7)),
      weeks: Math.ceil(total / 7),
      left: total - elapsed,
    };
  }

  return (
    <div
      className="rounded-2xl border border-line p-5 sm:p-6"
      style={{ background: `linear-gradient(135deg, ${tint('var(--accent-primary)', 10)}, var(--bg-tertiary) 55%)` }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: tint(status.color, 18), color: status.color }}
            >
              {program.status === 'active' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: status.color }} />}
              {status.label}
            </span>
            <span className="text-xs text-mute flex items-center gap-1">
              <CalendarRange size={12} /> {fmtDate(program.start_date)} → {fmtDate(program.end_date)}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-ink mt-2 leading-tight">{program.name}</h2>
          <div className="text-sm text-mute mt-1 flex items-center gap-1.5">
            <Flag size={13} />
            {current ? <>Phase {current.phase_order} · <span className="text-ink">{current.name}</span></> : `${phases.length} phase(s)`}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>

      {progress && (
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-ink font-medium">Semaine {progress.week} / {progress.weeks}</span>
            <span className="text-mute">{progress.left > 0 ? `${progress.left} jour(s) restants` : 'Dernier jour de la phase'}</span>
          </div>
          <div className="h-2 rounded-full bg-surface overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress.pct}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
          </div>
        </div>
      )}

      <PhaseList phases={phases} />
    </div>
  );
}
