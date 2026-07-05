import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { CAREER_GOALS } from '../utils/constants';
import { isSupabaseConfigured } from '../services/supabase';
import CloudAuthPanel from '../components/auth/CloudAuthPanel';
import { Button, Field, Input, Select } from '../components/common/ui';

const CAREER_LABELS = {
  PE: 'Private Equity', GE: 'Growth Equity', VC: 'Venture Capital', RBF: 'Revenue-Based Financing', Trading: 'Trading', Hybrid: 'Hybrid (PE + Trading)',
};

// When Supabase is configured, cloud accounts are the ONLY path — a local-only
// "just type a name" fallback next to it would let anyone on a shared deployed
// URL spin up an indistinguishable, unsynced, device-local profile (which is
// exactly what happened in production: every visitor looked like they had the
// same default $52k demo account, because they did — nothing tied it to them).
// The local-only flow still exists for people running AUDAX purely offline
// with no Supabase project at all.
export default function Welcome() {
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ name: '', email: '', primaryDomain: 'trading', careerGoal: 'Hybrid' });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Enter your name to continue.');
    register(form);
  };

  return (
    <div className="min-h-screen bg-base text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap size={28} className="text-accent" />
          <h1 className="text-3xl font-bold tracking-widest">AUDAX</h1>
        </div>
        <p className="text-center text-mute mb-8 text-sm">
          {isSupabaseConfigured
            ? 'Your life & trading companion. Sign in or create an account to get started.'
            : 'Your life & trading companion. Local-first — everything stays on this machine.'}
        </p>

        {isSupabaseConfigured ? (
          <CloudAuthPanel />
        ) : (
          <form onSubmit={submit} className="bg-card border border-line rounded-xl p-6 space-y-4 glow">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoFocus />
            </Field>
            <Field label="Email (optional)">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </Field>
            <Field label="Primary domain" hint="Weighted 75% in your composite synergy score.">
              <Select
                value={form.primaryDomain}
                onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
                options={[
                  { value: 'trading', label: 'Trading' },
                  { value: 'learning', label: 'Learning' },
                  { value: 'finance', label: 'Finance' },
                  { value: 'health', label: 'Health' },
                  { value: 'growth', label: 'Growth' },
                ]}
              />
            </Field>
            <Field label="Career goal" hint="Focuses your skill tree and deal tracking.">
              <Select
                value={form.careerGoal}
                onChange={(e) => setForm({ ...form, careerGoal: e.target.value })}
                options={CAREER_GOALS.map((g) => ({ value: g, label: CAREER_LABELS[g] }))}
              />
            </Field>
            {error && <p className="text-bad text-sm">{error}</p>}
            <Button type="submit" className="w-full">
              Start your journey
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
