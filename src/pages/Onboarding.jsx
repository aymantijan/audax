import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, TrendingUp, Wallet, HeartPulse, BookOpen, Flame, ArrowRight, Check, Sparkles, Handshake, FlaskConical,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useHabitStore } from '../store/habitStore';
import { HABIT_TEMPLATES } from '../utils/habit-templates';
import { Button, Card } from '../components/common/ui';

// Curated cross-domain starter set — one or two easy, high-signal habits per
// domain (not the full 55+ template catalog, which would be overwhelming on
// a first screen). Looked up by exact name from HABIT_TEMPLATES so the real
// XP/skill-link/frequency metadata comes along instead of being re-typed here.
const STARTER_HABIT_NAMES = [
  'Daily trade journal', 'Review daily P&L',
  'Daily reading (30 min)', 'Daily concept review',
  'Daily spending log', 'Weekly budget check',
  'Morning exercise', '8+ hours sleep',
  'Daily Journal', 'Gratitude journaling',
  'Log today\'s lab session', 'Advance a project task',
];
const ALL_TEMPLATE_ITEMS = HABIT_TEMPLATES.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
const STARTER_HABITS = STARTER_HABIT_NAMES.map((name) => ALL_TEMPLATE_ITEMS.find((it) => it.name === name)).filter(Boolean);

const DOMAIN_TOUR = [
  { icon: TrendingUp, title: 'Trading', text: 'Multi-account journal — demo, broker, prop-firm — with risk management, psychology, and AI coaching.' },
  { icon: Wallet, title: 'Finance', text: 'Real double-entry accounting: budgets, treasury forecast, échéances, and goals — not just a transaction list.' },
  { icon: HeartPulse, title: 'Health', text: 'Sleep, workouts, nutrition, recovery, and readiness — all feeding into your cross-domain score.' },
  { icon: BookOpen, title: 'Learning & Skills', text: 'Courses, reading, and a 450+ node skill tree that levels up as you actually do the work.' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addHabit = useHabitStore((s) => s.addHabit);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(() => new Set(STARTER_HABITS.slice(0, 4).map((h) => h.name)));
  const [modules, setModules] = useState(() => ({ trading: user?.enabledModules?.trading ?? true, deals: user?.enabledModules?.deals ?? true, engineering: user?.enabledModules?.engineering ?? true }));

  const toggle = (name) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const finish = () => {
    updateProfile({ enabledModules: modules });
    for (const habit of STARTER_HABITS) {
      if (selected.has(habit.name)) addHabit(habit);
    }
    completeOnboarding();
    navigate('/today');
  };

  const skip = () => {
    completeOnboarding();
    navigate('/today');
  };

  return (
    <div className="min-h-screen bg-base text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Zap size={24} className="text-accent" />
          <span className="text-xl font-bold tracking-widest">AUDAX</span>
        </div>

        {step === 0 && (
          <Card>
            <h1 className="text-xl font-bold mb-1">Welcome, {user?.name}.</h1>
            <p className="text-mute text-sm mb-5">Five domains, one score. Here's what's inside.</p>
            <div className="space-y-3">
              {DOMAIN_TOUR.map((d) => (
                <div key={d.title} className="flex items-start gap-3 bg-surface border border-line rounded-lg px-4 py-3">
                  <d.icon size={18} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-mute">{d.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full mt-5" onClick={() => setStep(1)}>
              <span className="flex items-center justify-center gap-2">Next <ArrowRight size={15} /></span>
            </Button>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <h1 className="text-xl font-bold mb-1">Which sections do you want?</h1>
            <p className="text-mute text-sm mb-5">Turn off anything you don't need — you can change this anytime in Settings.</p>
            <div className="space-y-2">
              {[
                { key: 'trading', icon: TrendingUp, title: 'Trading', text: 'Multi-account journal, risk management, psychology tracking.' },
                { key: 'deals', icon: Handshake, title: 'Deals', text: 'Pipeline/deal tracking for PE, GE, VC, RBF work.' },
                { key: 'engineering', icon: FlaskConical, title: 'Engineering', text: 'Lab journal + design-project pipeline — chemical engineering & related.' },
              ].map((m) => {
                const on = modules[m.key];
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModules((s) => ({ ...s, [m.key]: !s[m.key] }))}
                    className={`w-full flex items-start gap-3 text-left border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      on ? 'border-accent bg-accent/10' : 'border-line hover:text-ink'
                    }`}
                  >
                    <m.icon size={18} className={`shrink-0 mt-0.5 ${on ? 'text-accent' : 'text-mute'}`} />
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-1.5">{m.title} {on && <Check size={13} className="text-accent" />}</div>
                      <div className="text-xs text-mute">{m.text}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                <span className="flex items-center justify-center gap-2">Next <ArrowRight size={15} /></span>
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h1 className="text-xl font-bold mb-1">Pick your starter habits</h1>
            <p className="text-mute text-sm mb-5">These log in one tap from "Aujourd'hui" every day. You can add more or edit these later in Habits.</p>
            <div className="flex flex-wrap gap-2">
              {STARTER_HABITS.map((h) => {
                const on = selected.has(h.name);
                return (
                  <button
                    key={h.name}
                    type="button"
                    onClick={() => toggle(h.name)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      on ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
                    }`}
                  >
                    {on && <Check size={13} />} {h.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                <span className="flex items-center justify-center gap-2">Next ({selected.size} selected) <ArrowRight size={15} /></span>
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <div className="text-center py-4">
              <Sparkles size={32} className="text-accent mx-auto mb-3" />
              <h1 className="text-xl font-bold mb-1">You're set.</h1>
              <p className="text-mute text-sm mb-5">
                {selected.size > 0
                  ? `${selected.size} habit${selected.size !== 1 ? 's' : ''} will show up on "Aujourd'hui" — check them off as you go.`
                  : 'No habits selected — you can add some anytime from the Habits page.'}
              </p>
              <div className="flex items-center gap-2 text-xs text-mute justify-center">
                <Flame size={13} /> First tip: log your morning check-in daily — it feeds your Health score and burnout alerts.
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={finish}>Go to Aujourd'hui</Button>
            </div>
          </Card>
        )}

        {step === 0 && (
          <button onClick={skip} className="w-full text-center text-xs text-mute hover:text-ink mt-4 cursor-pointer">
            Skip setup
          </button>
        )}
      </div>
    </div>
  );
}
