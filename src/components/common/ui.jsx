import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-card border border-line rounded-xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          {title && <h3 className="text-sm font-semibold tracking-wide text-mute uppercase">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Figures (amounts, times, ratios) get the data face; words keep the UI face.
const FIGURE_RE = /^[\s\d.,:;%+\-−–#/×x€$£¥—~≈<>()]*(DH|MAD|EUR|USD|h|min|j|k|K|M|XP|R|pts?)?[\s\d.,:;%+\-−–#/×x€$£¥—~≈<>()]*$/;
export const isFigure = (v) => typeof v === 'number' || (typeof v === 'string' && /\d/.test(v) && FIGURE_RE.test(v.trim()));

export function Stat({ label, value, sub, color }) {
  return (
    <div className="bg-card border border-line rounded-xl p-4">
      <div className="text-xs text-mute mb-1">{label}</div>
      <div className={`text-2xl font-bold ${isFigure(value) ? 'font-data' : ''}`} style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-mute mt-1">{sub}</div>}
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-accent text-on-accent hover:opacity-90 font-semibold',
    secondary: 'bg-surface border border-line text-ink hover:border-accent',
    ghost: 'text-mute hover:text-ink',
    danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25',
  };
  return (
    <button
      className={`ui-btn px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-xs text-mute mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-mute mt-1">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent';

export function Input(props) {
  return <input className={inputCls} {...props} />;
}

export function Textarea(props) {
  return <textarea rows={2} className={inputCls} {...props} />;
}

export function Select({ options, children, ...props }) {
  return (
    <select className={inputCls} {...props}>
      {children ||
        options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
    </select>
  );
}

export function ProgressBar({ value, max = 100, color = 'var(--accent-primary)', height = 8 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full bg-surface rounded-full overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Toggle-able weekday chips — e.g. picking Mon/Wed/Fri for a custom-schedule habit.
export function WeekdayPicker({ value = [], onChange, options }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((d) => {
        const active = value.includes(d.value);
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => toggle(d.value)}
            className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${
              active ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
            }`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

// Generic multi-step wizard engine — reused for both the training and
// nutrition questionnaires (and any future one) so only the `steps` config
// differs per use. Each step: { key, title, render: (data, setData) => node,
// validate?: (data) => string|null (returns an error to block Next) }.
export function Wizard({ steps, onComplete, onCancel, initialData = {} }) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState('');
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const setField = (patch) => setData((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));

  const next = () => {
    const err = step.validate?.(data);
    if (err) { setError(err); return; }
    setError('');
    if (isLast) onComplete(data);
    else setIndex((i) => i + 1);
  };
  const back = () => {
    setError('');
    if (index === 0) onCancel?.();
    else setIndex((i) => i - 1);
  };

  return (
    <Card>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-mute">Étape {index + 1}/{steps.length}</span>
          <span className="text-sm font-semibold">{step.title}</span>
        </div>
        <ProgressBar value={index + 1} max={steps.length} />
      </div>
      <div className="space-y-4">{step.render(data, setField)}</div>
      {error && <div className="text-xs text-bad mt-3">{error}</div>}
      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={back}>
          <span className="flex items-center gap-1"><ChevronLeft size={14} /> {index === 0 ? 'Annuler' : 'Précédent'}</span>
        </Button>
        <Button onClick={next}>
          <span className="flex items-center gap-1">{isLast ? 'Terminer' : 'Suivant'} {!isLast && <ChevronRight size={14} />}</span>
        </Button>
      </div>
    </Card>
  );
}

export function Badge({ children, color = 'var(--accent-primary)' }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

// The one validation animation: call on the element the user just ticked
// (habit done, class attended, week closed). Skipped when "reduce motion" is on.
export function playSeal(el) {
  if (!el?.animate) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  // Web Animations API: survives React re-rendering the element's classes.
  el.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 0 0 0 color-mix(in srgb, var(--accent-primary) 45%, transparent)' },
      { transform: 'scale(1.12)', offset: 0.4 },
      { transform: 'scale(1)', boxShadow: '0 0 0 12px color-mix(in srgb, var(--accent-primary) 0%, transparent)' },
    ],
    { duration: 450, easing: 'ease-out' },
  );
}

// Open modals, innermost last: Escape closes only the top one.
const modalStack = [];

// One modal for the whole app: a centred window on a computer, a sheet that
// rises from the bottom on a phone. Escape closes it; the page behind stops
// scrolling while it is open.
export function Modal({ open, onClose, title, children, wide }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    modalStack.push(token);
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-start justify-center bg-black/60 backdrop-blur-sm sm:overflow-y-auto sm:py-10 sm:px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`sheet-enter bg-card border border-line w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} shadow-2xl rounded-t-2xl sm:rounded-xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:p-6 max-h-[92dvh] overflow-y-auto sm:max-h-none sm:overflow-visible`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="ui-icon-btn -mr-2 flex items-center justify-center rounded-lg p-1.5 text-mute hover:text-ink cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Empty state: one sentence, optionally an icon and one button to get started.
export function EmptyState({ children, icon: Icon, action }) {
  return (
    <div className="text-center text-mute text-sm py-8">
      {Icon && <Icon className="mx-auto mb-2 text-mute" size={26} />}
      {children}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// Icon-only button: always has an accessible name, 44 px on touch screens.
export function IconButton({ label, children, className = '', tone = 'default', ...props }) {
  const tones = { default: 'text-mute hover:text-accent', danger: 'text-mute hover:text-bad', ink: 'text-mute hover:text-ink' };
  return (
    <button type="button" aria-label={label} title={label} className={`ui-icon-btn inline-flex items-center justify-center rounded-md p-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${tones[tone] || tones.default} ${className}`} {...props}>
      {children}
    </button>
  );
}

// Dense list that stays readable on a phone: a table from 640 px up, one card
// per row below. columns: [{ key, label, render?, align?, hideOnMobile?, className? }].
export function DataTable({ columns, rows, rowKey = (r) => r.id, empty, onRowClick }) {
  if (!rows.length) return empty ? <EmptyState>{empty}</EmptyState> : null;
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key]);
  const [first, ...rest] = columns.filter((c) => !c.hideOnMobile);
  return (
    <>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-mute border-b border-line">
              {columns.map((c) => (
                <th key={c.key} className={`py-2 pr-4 font-medium ${c.align === 'right' ? 'text-right' : ''} ${c.className || ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={`border-b border-line/50 hover:bg-surface/50 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={`py-2.5 pr-4 ${c.align === 'right' ? 'text-right' : ''} ${c.className || ''}`}>{cell(c, r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="sm:hidden divide-y divide-line/60">
        {rows.map((r) => (
          <li key={rowKey(r)} className={`py-3 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
            {first && <div className="font-medium mb-1.5">{cell(first, r)}</div>}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {rest.map((c) => (
                <div key={c.key} className="contents">
                  {c.label ? <dt className="text-mute">{c.label}</dt> : null}
                  <dd className={c.label ? 'text-right' : 'col-span-2 text-right'}>{cell(c, r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

// Suspense fallback while a lazy-loaded route chunk downloads.
export function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" style={{ borderTopColor: 'var(--accent-primary)' }} />
        <span className="text-xs text-mute">Chargement…</span>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useUiStore();
  const colors = { success: 'var(--success)', error: 'var(--error)', warning: 'var(--warning)', info: 'var(--accent-primary)' };
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-enter bg-card border rounded-lg px-4 py-3 text-sm shadow-xl flex items-start justify-between gap-3"
          style={{ borderColor: colors[t.type] || colors.info }}
        >
          <span>{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-mute hover:text-ink shrink-0 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
