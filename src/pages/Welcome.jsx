import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured } from '../services/supabase';
import CloudAuthPanel from '../components/auth/CloudAuthPanel';
import { Button, Field, Input, Select } from '../components/common/ui';

// When Supabase is configured, cloud accounts are the ONLY path — a local-only
// "just type a name" fallback next to it would let anyone on a shared deployed
// URL spin up an indistinguishable, unsynced, device-local profile (which is
// exactly what happened in production: every visitor looked like they had the
// same default $52k demo account, because they did — nothing tied it to them).
// The local-only flow still exists for people running AUDAX purely offline
// with no Supabase project at all.
export default function Welcome() {
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ name: '', email: '', primaryDomain: 'learning', gender: '' });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Indique ton prénom pour continuer.');
    if (!form.gender) return setError('Choisis une option pour « Sexe » pour continuer.');
    register(form);
  };

  return (
    <div className="min-h-screen bg-base text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap size={28} className="text-accent" />
          <h1 className="text-3xl font-bold tracking-widest">VAUDAX</h1>
        </div>
        <p className="text-center text-mute mb-8 text-sm">
          {isSupabaseConfigured
            ? 'Études, argent, santé, travail, habitudes : organise ta vie au même endroit. Connecte-toi ou crée ton compte.'
            : 'Études, argent, santé, travail, habitudes : organise ta vie au même endroit. Tout reste sur cet appareil.'}
        </p>

        {isSupabaseConfigured ? (
          <CloudAuthPanel />
        ) : (
          <form onSubmit={submit} className="bg-card border border-line rounded-xl p-6 space-y-4 glow">
            <Field label="Prénom">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ton prénom" autoFocus />
            </Field>
            <Field label="E-mail (facultatif)">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="toi@exemple.com" />
            </Field>
            <Field label="Ce qui compte le plus pour toi en ce moment" hint="Pèse davantage dans ton score global. Modifiable dans les paramètres.">
              <Select
                value={form.primaryDomain}
                onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
                options={[
                  { value: 'learning', label: 'Études et apprentissage' },
                  { value: 'finance', label: 'Argent et finances' },
                  { value: 'health', label: 'Santé et forme' },
                  { value: 'careerDevelopment', label: 'Carrière et réseau' },
                  { value: 'metiersVentures', label: 'Métier, entreprise et trading' },
                  { value: 'growthOutput', label: 'Progression et création' },
                ]}
              />
            </Field>
            <Field label="Sexe" hint="Sert aux calculs de la partie Santé (besoins caloriques, cycle).">
              <Select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                options={[{ value: '', label: 'Choisir…' }, { value: 'female', label: 'Femme' }, { value: 'male', label: 'Homme' }]}
              />
            </Field>
            {error && <p className="text-bad text-sm">{error}</p>}
            <Button type="submit" className="w-full">
              Commencer
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
