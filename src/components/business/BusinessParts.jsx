import { Check } from 'lucide-react';
import { BUSINESS_CHART_OF_ACCOUNTS, BUSINESS_ACCOUNT_CLASSES } from '../../utils/business-accounts';
import { PROJECT_STAGES } from '../../utils/constants';
import { fmtDate } from '../../utils/formatters';
import { Select, EmptyState } from '../common/ui';

export const PHASE_STATUS = [
  { value: 'upcoming', label: 'À venir', color: 'var(--text-secondary)' },
  { value: 'active', label: 'En cours', color: 'var(--warning)' },
  { value: 'done', label: 'Terminée', color: 'var(--success)' },
];
export const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idée' },
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];

// Sélecteur de compte "business" — plus simple que Finance's AccountSelect
// (pas de comptes auxiliaires de trésorerie pour une compta "très simplifiée").
export function BizAccountSelect({ value, onChange, classes }) {
  const allowed = classes?.length ? BUSINESS_CHART_OF_ACCOUNTS.filter((a) => classes.includes(a.cls)) : BUSINESS_CHART_OF_ACCOUNTS;
  const byClass = {};
  for (const a of allowed) (byClass[a.cls] ??= []).push(a);
  return (
    <Select value={value} onChange={onChange}>
      {Object.entries(byClass).map(([cls, accounts]) => (
        <optgroup key={cls} label={`Classe ${cls} — ${BUSINESS_ACCOUNT_CLASSES[cls].label}`}>
          {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

// Timeline horizontale proportionnelle : les phases en bandes, les événements
// (idées/faits) en points, positionnés sur un axe temporel commun.
export function Timeline({ business }) {
  const allDates = [
    ...business.phases.flatMap((p) => [p.startDate, p.endDate].filter(Boolean)),
    ...business.events.map((e) => e.date),
  ].filter(Boolean).sort();

  if (!allDates.length) {
    return <EmptyState>Ajoute des phases ou des événements (idées/faits) pour voir apparaître la timeline.</EmptyState>;
  }

  const minT = new Date(allDates[0] + 'T00:00:00').getTime();
  const maxT = new Date(allDates[allDates.length - 1] + 'T00:00:00').getTime();
  const span = Math.max(1, maxT - minT);
  const pct = (d) => ((new Date(d + 'T00:00:00').getTime() - minT) / span) * 100;
  const sortedEvents = [...business.events].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="space-y-5">
      {business.phases.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-mute uppercase tracking-wide">Phases</div>
          {[...business.phases].sort((a, b) => a.order - b.order).map((p) => {
            const start = p.startDate || allDates[0];
            const end = p.endDate || start;
            const left = pct(start);
            const width = Math.max(1.5, pct(end) - left);
            const color = PHASE_STATUS.find((s) => s.value === p.status)?.color;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs w-32 truncate shrink-0" title={p.name}>{p.name}</span>
                <div className="flex-1 h-5 bg-surface border border-line rounded-full relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: color }} title={`${p.startDate || '—'} → ${p.endDate || 'en cours'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sortedEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-mute uppercase tracking-wide">Idées & faits</div>
            <div className="flex items-center gap-3 text-[10px] text-mute">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Idée</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} /> Fait</span>
            </div>
          </div>
          <div className="relative h-6 bg-surface border border-line rounded-full">
            {sortedEvents.map((e) => (
              <div key={e.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct(e.date)}%` }} title={`${e.date} · ${e.title}`}>
                <div className="w-3 h-3 rounded-full border-2 border-card" style={{ background: e.type === 'idea' ? 'var(--accent-primary)' : 'var(--success)' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-mute mt-1">
            <span>{fmtDate(allDates[0])}</span>
            <span>{fmtDate(allDates[allDates.length - 1])}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── Tier "léger" — fixed-stage stepper + simple task list ───────
// Ported from the now-merged ProjectDetail.jsx: a side-project's progression
// is a fixed 6-stage index (PROJECT_STAGES), not the free-form dated phases
// a formal business uses — deliberately kept as a separate, lighter concept
// rather than forcing every light entry through the phases/Gantt machinery.
export function LightStageStepper({ business, onJump }) {
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {PROJECT_STAGES.map((label, i) => {
        const done = i < business.stageIndex;
        const current = i === business.stageIndex;
        const color = i <= business.stageIndex ? 'var(--accent-primary)' : 'var(--border)';
        return (
          <div key={label} className="flex items-center flex-1 min-w-[92px] last:flex-none last:min-w-0">
            <button type="button" onClick={() => onJump(i)} className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0" title={`Aller à ${label}`}>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 transition-colors"
                style={{ borderColor: color, color: current ? 'var(--ink)' : done ? color : 'var(--text-secondary)', background: done ? color : 'transparent' }}
              >
                {done ? <Check size={13} color="var(--bg-primary)" /> : i + 1}
              </span>
              <span className="text-[11px] text-center w-20 leading-tight" style={{ color: current ? 'var(--ink)' : 'var(--text-secondary)' }}>{label}</span>
            </button>
            {i < PROJECT_STAGES.length - 1 && <div className="h-0.5 flex-1 mb-4" style={{ background: i < business.stageIndex ? 'var(--accent-primary)' : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
}
