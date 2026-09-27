import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, TrendingUp, Wallet, HeartPulse, BookOpen, Flame, ArrowRight, Check, Sparkles, Handshake, FlaskConical,
  Users, Briefcase, Megaphone, Timer, Rocket, Palette, Building2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useHabitStore } from '../store/habitStore';
import { HABIT_TEMPLATES } from '../utils/habit-templates';
import { Button, Card } from '../components/common/ui';

// Curated cross-domain starter set — one or two easy, high-signal habits per
// domain (not the full 55+ template catalog, which would be overwhelming on
// a first screen). Looked up by exact name from HABIT_TEMPLATES so the real
// XP/skill-link/frequency metadata comes along instead of being re-typed here.
// For every profile: body, reading, money and wellbeing first; the first four
// are preselected. (These are the catalogue's French names — they had drifted
// from the English ones, which left this step empty.)
const STARTER_HABIT_NAMES = [
  'Sport le matin', '8 h de sommeil ou plus',
  'Lecture quotidienne (30 min)', 'Noter ses dépenses du jour',
  'Boire 8 verres d’eau', 'Méditation (10 min)',
  'Journal quotidien', 'Journal de gratitude',
  'Vérifier son budget chaque semaine', 'Réviser un concept par jour',
  'Journal de trading quotidien', 'Revoir le P&L du jour',
];
const ALL_TEMPLATE_ITEMS = HABIT_TEMPLATES.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
const STARTER_HABITS = STARTER_HABIT_NAMES.map((name) => ALL_TEMPLATE_ITEMS.find((it) => it.name === name)).filter(Boolean);

const DOMAIN_TOUR = [
  { icon: BookOpen, title: 'Études et apprentissage', text: 'Cursus, emploi du temps, assiduité, fiches de révision, lectures, et un arbre de plus de 450 compétences qui progresse avec ce que tu fais vraiment.' },
  { icon: Wallet, title: 'Argent', text: 'Dépenses, budgets, épargne, échéances et patrimoine, avec une vraie comptabilité en arrière-plan.' },
  { icon: HeartPulse, title: 'Santé', text: 'Sommeil, sport, nutrition, récupération et forme du jour.' },
  { icon: TrendingUp, title: 'Travail, projets et trading', text: 'Carrière, freelance, projets, et un journal de trading multi-comptes pour ceux qui tradent.' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addHabit = useHabitStore((s) => s.addHabit);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(() => new Set(STARTER_HABITS.slice(0, 4).map((h) => h.name)));
  // pe/business both seed from the same first choice — Onboarding asks one
  // combined "Deals & Business" question; independent on/off per page lives
  // in Settings for anyone who later wants just one of the two.
  const [modules, setModules] = useState(() => ({
    trading: user?.enabledModules?.trading ?? true,
    pe: user?.enabledModules?.pe ?? user?.enabledModules?.deals ?? true,
    business: user?.enabledModules?.business ?? user?.enabledModules?.deals ?? true,
    engineering: user?.enabledModules?.engineering ?? false,
    networking: user?.enabledModules?.networking ?? true,
    career: user?.enabledModules?.career ?? true,
    content: user?.enabledModules?.content ?? true,
    focus: user?.enabledModules?.focus ?? true,
    fundraising: user?.enabledModules?.fundraising ?? false,
    freelance: user?.enabledModules?.freelance ?? true,
    creative: user?.enabledModules?.creative ?? false,
    realEstate: user?.enabledModules?.realEstate ?? false,
  }));

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
          <span className="text-xl font-bold tracking-widest">VAUDAX</span>
        </div>

        {step === 0 && (
          <Card>
            <h1 className="text-xl font-bold mb-1">Bienvenue, {user?.name}.</h1>
            <p className="text-mute text-sm mb-5">Toute ta vie au même endroit. Voici ce que tu peux y suivre.</p>
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
              <span className="flex items-center justify-center gap-2">Suivant <ArrowRight size={15} /></span>
            </Button>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <h1 className="text-xl font-bold mb-1">Quelles sections veux-tu ?</h1>
            <p className="text-mute text-sm mb-5">Désactive ce dont tu n’as pas besoin : tu pourras changer ça à tout moment dans Paramètres.</p>
            <div className="space-y-2">
              {[
                { key: 'trading', icon: TrendingUp, title: 'Trading', text: 'Journal multi-comptes, gestion du risque, suivi de la psychologie.' },
                // One combined question toggles BOTH `pe`/`business` at once — the two
                // pages (Deals split from Business Projects, 2026-08-26) can be turned
                // on/off independently later in Settings, but onboarding stays one step.
                { key: 'dealsAndBusiness', keys: ['pe', 'business'], icon: Handshake, title: 'Investissements et projets business', text: 'Suivi de deals (private equity, capital-risque) et de projets, du petit projet perso (étapes et tâches) à la vraie entreprise (phases, KPIs, comptabilité).' },
                { key: 'engineering', icon: FlaskConical, title: 'Ingénierie', text: 'Journal de laboratoire et suivi de projets de conception (génie chimique et domaines proches).' },
                { key: 'networking', icon: Users, title: 'Réseau', text: 'Contacts, relances et historique des échanges : recruteurs, mentors, anciens élèves.' },
                { key: 'career', icon: Briefcase, title: 'Carrière', text: 'Suivi des candidatures : envoyée, entretien, offre.' },
                { key: 'content', icon: Megaphone, title: 'Contenu', text: 'Publications et engagement : LinkedIn, blog, portfolio.' },
                { key: 'focus', icon: Timer, title: 'Deep Work', text: 'Un minuteur de concentration et l’historique de tes sessions, qui font progresser le domaine travaillé.' },
                { key: 'fundraising', icon: Rocket, title: 'Levée de fonds', text: 'Suivi des investisseurs pour les fondateurs qui lèvent des fonds : contacté, term sheet, closing.' },
                { key: 'freelance', icon: Briefcase, title: 'Freelance', text: 'Clients, heures et factures, pour les indépendants et consultants.' },
                { key: 'creative', icon: Palette, title: 'Création', text: 'Œuvres, pratique et expositions, pour les artistes, musiciens et auteurs.' },
                { key: 'realEstate', icon: Building2, title: 'Immobilier', text: 'Biens locatifs : cash-flow et rentabilité par bien.' },
              ].map((m) => {
                const keys = m.keys || [m.key];
                const on = keys.every((k) => modules[k]);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModules((s) => { const next = { ...s }; for (const k of keys) next[k] = !on; return next; })}
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
              <Button variant="secondary" className="flex-1" onClick={() => setStep(0)}>Retour</Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                <span className="flex items-center justify-center gap-2">Suivant <ArrowRight size={15} /></span>
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h1 className="text-xl font-bold mb-1">Choisis tes premières habitudes</h1>
            <p className="text-mute text-sm mb-5">Elles se cochent en un geste depuis « Aujourd’hui ». Tu pourras en ajouter ou les modifier plus tard dans Habitudes.</p>
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
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Retour</Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                <span className="flex items-center justify-center gap-2">Suivant ({selected.size} choisie{selected.size > 1 ? 's' : ''}) <ArrowRight size={15} /></span>
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <div className="text-center py-4">
              <Sparkles size={32} className="text-accent mx-auto mb-3" />
              <h1 className="text-xl font-bold mb-1">C’est prêt.</h1>
              <p className="text-mute text-sm mb-5">
                {selected.size > 0
                  ? `${selected.size} habitude${selected.size > 1 ? 's' : ''} t’attend${selected.size > 1 ? 'ent' : ''} dans « Aujourd’hui » : coche-les au fil de la journée.`
                  : 'Aucune habitude choisie : tu pourras en ajouter à tout moment depuis Habitudes.'}
              </p>
              <div className="flex items-center gap-2 text-xs text-mute justify-center">
                <Flame size={13} /> Premier conseil : fais ton check-in du matin chaque jour, il nourrit ton score Santé et les alertes d’épuisement.
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>Retour</Button>
              <Button className="flex-1" onClick={finish}>Aller à Aujourd’hui</Button>
            </div>
          </Card>
        )}

        {step === 0 && (
          <button onClick={skip} className="w-full text-center text-xs text-mute hover:text-ink mt-4 cursor-pointer">
            Passer cette étape
          </button>
        )}
      </div>
    </div>
  );
}
