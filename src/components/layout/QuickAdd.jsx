import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, TrendingUp, Wallet, Dumbbell } from 'lucide-react';

// Floating quick-add button, visible on every authenticated page. Each action
// deep-links to the owning page with a `?quickadd=` flag that page reads once
// on mount to jump straight to (and, where the add flow is a modal rather
// than inline on the page, open) the right form — see the `quickadd`
// handling in Trading.jsx / Finance.jsx+Journal.jsx / Health.jsx. Habits
// aren't included here: the fastest habit action is already the inline
// checklist on "Aujourd'hui", a FAB entry would just be a slower detour.
const ACTIONS = [
  { to: '/trading?quickadd=trade', label: 'Log Trade', icon: TrendingUp },
  { to: '/finance?quickadd=journal', label: 'Add Transaction', icon: Wallet },
  { to: '/health?quickadd=workout', label: 'Log Workout', icon: Dumbbell },
];

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
      <div className="fixed z-40 bottom-20 md:bottom-6 right-4 md:right-6">
        {open && (
          <div className="absolute bottom-14 right-0 mb-1 flex flex-col items-end gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.to}
                onClick={() => go(a.to)}
                className="flex items-center gap-2 bg-card border border-line rounded-full pl-3 pr-4 py-2 text-sm shadow-lg hover:border-accent cursor-pointer whitespace-nowrap"
              >
                <a.icon size={15} className="text-accent" /> {a.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close quick add' : 'Quick add'}
          className="rounded-full flex items-center justify-center shadow-xl cursor-pointer transition-transform"
          style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', transform: open ? 'rotate(45deg)' : 'none' }}
        >
          {open ? <X size={22} className="text-black" /> : <Plus size={22} className="text-black" />}
        </button>
      </div>
    </>
  );
}
