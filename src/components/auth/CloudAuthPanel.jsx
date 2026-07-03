import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { CAREER_GOALS } from '../../utils/constants';
import { register, login, requestPasswordReset } from '../../services/auth-supabase';
import { Button, Field, Input, Select } from '../common/ui';

// Real cloud auth (Supabase). Rendered on Welcome only when configured.
// On a successful session it hydrates the local profile so the rest of the
// app — which is data-local — proceeds unchanged.
export default function CloudAuthPanel() {
  const localRegister = useAuthStore((s) => s.register);
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ email: '', password: '', fullName: '', careerGoal: 'Hybrid' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const hydrateLocal = (meta = {}) => {
    if (!user) localRegister({ name: meta.fullName || form.fullName || form.email.split('@')[0], email: form.email, careerGoal: meta.careerGoal || form.careerGoal });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === 'register') {
        const r = await register({ email: form.email, password: form.password, fullName: form.fullName, careerGoal: form.careerGoal });
        if (r.error) setErr(r.error);
        else if (r.needsVerification) setMsg(r.message);
        else { hydrateLocal({ fullName: form.fullName, careerGoal: form.careerGoal }); }
      } else if (mode === 'login') {
        const r = await login({ email: form.email, password: form.password });
        if (r.error) setErr(r.error);
        else hydrateLocal({ fullName: r.user?.user_metadata?.full_name, careerGoal: r.user?.user_metadata?.career_goal });
      } else {
        const r = await requestPasswordReset(form.email);
        setMsg(r.message || r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const Tab = ({ id, label }) => (
    <button type="button" onClick={() => { setMode(id); setErr(null); setMsg(null); }} className={`text-sm pb-1 border-b-2 cursor-pointer ${mode === id ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}>
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="bg-card border border-line rounded-xl p-6 space-y-4 glow">
      <div className="flex gap-5">
        <Tab id="login" label="Log in" />
        <Tab id="register" label="Register" />
        <Tab id="forgot" label="Forgot?" />
      </div>

      {mode === 'register' && (
        <>
          <Field label="Full name">
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoFocus />
          </Field>
          <Field label="Career goal">
            <Select value={form.careerGoal} onChange={(e) => setForm({ ...form, careerGoal: e.target.value })} options={CAREER_GOALS} />
          </Field>
        </>
      )}
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
      </Field>
      {mode !== 'forgot' && (
        <Field label="Password" hint={mode === 'register' ? 'Min 12 chars · upper, lower, number, special.' : ''}>
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      )}

      {err && <p className="text-bad text-sm">{err}</p>}
      {msg && <p className="text-good text-sm">{msg}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? '…' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Log in'}
      </Button>
    </form>
  );
}
