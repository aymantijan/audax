import { X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-card border border-line rounded-xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-sm font-semibold tracking-wide text-mute uppercase">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, color }) {
  return (
    <div className="bg-card border border-line rounded-xl p-4">
      <div className="text-xs text-mute mb-1">{label}</div>
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-mute mt-1">{sub}</div>}
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-accent text-black hover:opacity-90 font-semibold',
    secondary: 'bg-surface border border-line text-ink hover:border-accent',
    ghost: 'text-mute hover:text-ink',
    danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25',
  };
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
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

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-10 px-4" onClick={onClose}>
      <div
        className={`bg-card border border-line rounded-xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-mute hover:text-ink cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="text-center text-mute text-sm py-8">{children}</div>;
}

// Suspense fallback while a lazy-loaded route chunk downloads.
export function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" style={{ borderTopColor: 'var(--accent-primary)' }} />
        <span className="text-xs text-mute">Loading…</span>
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
