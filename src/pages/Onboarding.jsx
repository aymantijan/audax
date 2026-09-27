import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useHabitStore } from '../store/habitStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useCareerStore } from '../store/careerStore';
import { HABIT_TEMPLATES } from '../utils/habit-templates';
import { CURRENCIES } from '../utils/currency';
import { AIMS, SITUATIONS, COUNTRIES, GOAL_TEMPLATES, buildOnboardingPlan, guessCountry } from '../utils/onboarding-plan';
import { MODULES, POLES, isModuleEnabled } from '../utils/navigation';
import { Button, Card, Field, Input, Select } from '../components/common/ui';

const ALL_TEMPLATE_ITEMS = HABIT_TEMPLATES.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
const templateByName = (name) => ALL_TEMPLATE_ITEMS.find((it) => it.name === name);
const OPTIONAL_MODULES = POLES.flatMap((p) => p.modules).filter((k) => MODULES[k].flag);

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`ui-btn flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors cursor-pointer ${active ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink hover:border-accent'}`}
    >
      {active && <Check size={14} />}
      {children}
    </button>
  );
}

function Steps({ step }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4" aria-label={`Étape ${step + 1} sur 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-accent' : i < step ? 'w-4 bg-accent/50' : 'w-4 bg-line'}`} />
      ))}
    </div>
  );
}

// First run: start from what the person wants to change in their life, not
// from a list of modules. Everything proposed here stays editable afterwards.
export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addHabit = useHabitStore((s) => s.addHabit);

  const [step, setStep] = useState(0);
  const [aims, setAims] = useState([]);
  const [situation, setSituation] = useState(null);
  const [country, setCountry] = useState(() => {
    try { return guessCountry(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return 'OTHER'; }
  });
  const [currency, setCurrency] = useState(() => COUNTRIES.find((c) => c.key === country)?.currency || 'EUR');

  // Proposal (step 3), recomputed from the answers until the person edits it.
  const plan = useMemo(() => buildOnboardingPlan({ aims, situation }), [aims, situation]);
  const [modules, setModules] = useState(null);
  const [habits, setHabits] = useState(null);
  const [goals, setGoals] = useState(null);
  const [savingsAmount, setSavingsAmount] = useState('');

  const toggleIn = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const toProposal = () => {
    setModules(plan.modules);
    setHabits(plan.habits);
    setGoals(plan.goals);
    setStep(2);
  };

  const pickCountry = (key) => {
    setCountry(key);
    setCurrency(COUNTRIES.find((c) => c.key === key)?.currency || currency);
  };

  const finish = () => {
    updateProfile({ enabledModules: modules, situation, country, aims });
    // Currency: only on an empty ledger (a new account), never re-based silently.
    const acc = useAccountingStore.getState();
    if (!acc.journal?.length && acc.setBaseCurrency) acc.setBaseCurrency(currency);
    for (const name of habits) {
      const t = templateByName(name);
      if (t) addHabit(t);
    }
    for (const g of goals) {
      if (g === 'savings') {
        const amount = Number(String(savingsAmount).replace(/\s/g, '').replace(',', '.'));
        if (amount > 0) useAccountingStore.getState().addGoal({ name: 'Épargne de précaution', kind: 'envelope', targetAmount: amount });
      } else if (g === 'workouts') {
        useHealthStore.getState().addGoal({ title: GOAL_TEMPLATES.workouts.label, metric: { key: 'workout_frequency' }, target: 3, direction: 'higher', silent: true });
      } else if (g === 'sleep') {
        useHealthStore.getState().addGoal({ title: GOAL_TEMPLATES.sleep.label, metric: { key: 'sleep_hours' }, target: 7.5, direction: 'higher', silent: true });
      } else if (g === 'job' || g === 'launch') {
        useCareerStore.getState().addPlan({ title: GOAL_TEMPLATES[g].label, domain: user?.occupation || 'Général' });
      }
    }
    completeOnboarding();
    navigate('/today');
  };

  const skip = () => {
    completeOnboarding();
    navigate('/today');
  };

  const currencyOptions = CURRENCIES.filter((c) => c.code !== 'BTC').map((c) => ({ value: c.code, label: `${c.label} (${c.short})` }));

  return (
    <div className="min-h-screen bg-base text-ink flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-5">
          <Zap size={24} className="text-accent" />
          <span className="font-display text-2xl tracking-widest">VAUDAX</span>
        </div>
        <Steps step={step} />

        {step === 0 && (
          <Card>
            <h1 className="text-2xl font-bold mb-1">Bienvenue, {user?.name}.</h1>
            <p className="text-mute text-sm mb-5">Qu’est-ce que tu veux améliorer ? Choisis autant de réponses que tu veux.</p>
            <div className="flex flex-wrap gap-2">
              {AIMS.map((a) => (
                <Chip key={a.key} active={aims.includes(a.key)} onClick={() => setAims((l) => toggleIn(l, a.key))}>{a.label}</Chip>
              ))}
            </div>
            <Button className="w-full mt-6" onClick={() => setStep(1)}>
              <span className="flex items-center justify-center gap-2">Suivant <ArrowRight size={15} /></span>
            </Button>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <h1 className="text-2xl font-bold mb-1">Ta situation</h1>
            <p className="text-mute text-sm mb-4">Pour te proposer les bons outils.</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {SITUATIONS.map((s) => (
                <Chip key={s.key} active={situation === s.key} onClick={() => setSituation(situation === s.key ? null : s.key)}>{s.label}</Chip>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Pays">
                <Select value={country} onChange={(e) => pickCountry(e.target.value)} options={COUNTRIES.map((c) => ({ value: c.key, label: c.label }))} />
              </Field>
              <Field label="Devise" hint="Celle de tes comptes. Modifiable plus tard dans Finances.">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)} options={currencyOptions} />
              </Field>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>Retour</Button>
              <Button className="flex-1" onClick={toProposal}>
                <span className="flex items-center justify-center gap-2">Voir ma proposition <ArrowRight size={15} /></span>
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && modules && (
          <Card>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><Sparkles size={20} className="text-accent" /> Voici ce que je te propose</h1>
            <p className="text-mute text-sm mb-5">Tout reste modifiable plus tard. Études, Santé, Finances, Habitudes et Objectifs sont toujours là.</p>

            <section className="mb-5">
              <h2 className="text-xs text-mute uppercase tracking-wide mb-2">Modules en plus</h2>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_MODULES.map((k) => {
                  const active = isModuleEnabled({ enabledModules: modules }, k);
                  const flags = Array.isArray(MODULES[k].flag) ? MODULES[k].flag : [MODULES[k].flag];
                  return (
                    <Chip key={k} active={active} onClick={() => setModules((m) => ({ ...m, ...Object.fromEntries(flags.map((f) => [f, !active])) }))}>
                      {MODULES[k].label}
                    </Chip>
                  );
                })}
              </div>
            </section>

            <section className="mb-5">
              <h2 className="text-xs text-mute uppercase tracking-wide mb-2">Premières habitudes</h2>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...plan.habits, ...habits])].filter(templateByName).map((name) => (
                  <Chip key={name} active={habits.includes(name)} onClick={() => setHabits((l) => toggleIn(l, name))}>{name}</Chip>
                ))}
              </div>
            </section>

            {plan.goals.length > 0 && (
              <section className="mb-2">
                <h2 className="text-xs text-mute uppercase tracking-wide mb-2">Objectifs de départ</h2>
                <div className="space-y-2">
                  {plan.goals.map((g) => (
                    <div key={g} className="flex flex-wrap items-center gap-3">
                      <Chip active={goals.includes(g)} onClick={() => setGoals((l) => toggleIn(l, g))}>{GOAL_TEMPLATES[g].label}</Chip>
                      {g === 'savings' && goals.includes(g) && (
                        <div className="w-40">
                          <Input inputMode="decimal" aria-label={`Montant à mettre de côté (${currency})`} placeholder={`Montant (${currency})`} value={savingsAmount} onChange={(e) => setSavingsAmount(e.target.value)} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {goals.includes('savings') && !(Number(String(savingsAmount).replace(',', '.')) > 0) && (
                  <p className="text-[11px] text-mute mt-1.5">Sans montant, l’objectif d’épargne ne sera pas créé : tu pourras le faire dans Finances.</p>
                )}
              </section>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Retour</Button>
              <Button className="flex-1" onClick={finish}>C’est parti</Button>
            </div>
          </Card>
        )}

        <button type="button" onClick={skip} className="w-full text-center text-xs text-mute hover:text-ink mt-4 cursor-pointer">
          Passer et tout régler plus tard
        </button>
      </div>
    </div>
  );
}
