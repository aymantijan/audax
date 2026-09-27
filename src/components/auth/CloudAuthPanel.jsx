import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { register, login, requestPasswordReset } from '../../services/auth-supabase';
import { Button, Field, Input, Select } from '../common/ui';

// Real cloud auth (Supabase). Rendered on Welcome only when configured.
// On a successful session it hydrates the local profile so the rest of the
// app — which is data-local — proceeds unchanged.
export default function CloudAuthPanel() {
  const localRegister = useAuthStore((s) => s.register);
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ email: '', password: '', fullName: '', gender: '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const hydrateLocal = (meta = {}) => {
    if (!user) localRegister({ name: meta.fullName || form.fullName || form.email.split('@')[0], email: form.email, gender: meta.gender || form.gender || null });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (mode === 'register' && !form.gender) return setErr('Choisis une option pour « Sexe » pour continuer.');
    setBusy(true);
    try {
      if (mode === 'register') {
        const r = await register({ email: form.email, password: form.password, fullName: form.fullName, gender: form.gender || null });
        if (r.error) setErr(r.error);
        else if (r.needsVerification) setMsg(r.message);
        else { hydrateLocal({ fullName: form.fullName, gender: form.gender }); }
      } else if (mode === 'login') {
        const r = await login({ email: form.email, password: form.password });
        if (r.error) setErr(r.error);
        else hydrateLocal({ fullName: r.user?.user_metadata?.full_name, gender: r.user?.user_metadata?.gender });
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
        <Tab id="login" label="Connexion" />
        <Tab id="register" label="Créer un compte" />
        <Tab id="forgot" label="Mot de passe oublié" />
      </div>

      {mode === 'register' && (
        <>
          <Field label="Prénom et nom">
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoFocus />
          </Field>
          <Field label="Sexe" hint="Sert aux calculs de la partie Santé (besoins caloriques, cycle).">
            <Select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              options={[{ value: '', label: 'Choisir…' }, { value: 'female', label: 'Femme' }, { value: 'male', label: 'Homme' }]}
            />
          </Field>
        </>
      )}
      <Field label="E-mail">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="toi@exemple.com" />
      </Field>
      {mode !== 'forgot' && (
        <Field label="Mot de passe" hint={mode === 'register' ? '12 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial.' : ''}>
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
      )}

      {err && <p className="text-bad text-sm">{err}</p>}
      {msg && <p className="text-good text-sm">{msg}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? '…' : mode === 'register' ? 'Créer mon compte' : mode === 'forgot' ? 'Envoyer le lien' : 'Se connecter'}
      </Button>
    </form>
  );
}
