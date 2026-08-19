import { useState } from 'react';
import { Dumbbell, Salad, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useAuthStore } from '../../store/authStore';
import { Card, Button, Wizard, Field, Input, Select, Badge, EmptyState } from '../../components/common/ui';
import { MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from '../../utils/exercise-library';
import { ACTIVITY_MULTIPLIERS } from '../../utils/health-science';
import { MOROCCO_BUDGET_TIERS } from '../../utils/morocco-food-budget';

const INJURY_AREAS = [
  { value: 'lower_back', label: 'Bas du dos' }, { value: 'knee', label: 'Genou' },
  { value: 'shoulder', label: 'Épaule' }, { value: 'wrist', label: 'Poignet' },
  { value: 'hip', label: 'Hanche' }, { value: 'ankle', label: 'Cheville' }, { value: 'neck', label: 'Cou' },
];

function Chips({ options, value, onChange, multi = true }) {
  const toggle = (v) => {
    if (!multi) return onChange(v);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const isActive = (v) => (multi ? value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors ${isActive(o.value) ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TRAINING_STEPS = [
  {
    key: 'experience', title: 'Ton expérience',
    validate: (d) => (!d.experienceLevel ? 'Choisis un niveau.' : null),
    render: (d, set) => (
      <Field label="Niveau d'expérience en musculation">
        <Chips multi={false} value={d.experienceLevel} onChange={(v) => set({ experienceLevel: v })} options={[
          { value: 'beginner', label: 'Débutant (<1 an)' }, { value: 'intermediate', label: 'Intermédiaire (1-3 ans)' }, { value: 'advanced', label: 'Avancé (3+ ans)' },
        ]} />
      </Field>
    ),
  },
  {
    key: 'goal', title: 'Ton objectif',
    validate: (d) => (!d.trainingGoal ? 'Choisis un objectif.' : null),
    render: (d, set) => (
      <Field label="Objectif principal">
        <Chips multi={false} value={d.trainingGoal} onChange={(v) => set({ trainingGoal: v })} options={[
          { value: 'strength', label: 'Force' }, { value: 'hypertrophy', label: 'Hypertrophie' }, { value: 'fat_loss', label: 'Perte de gras' },
          { value: 'endurance', label: 'Endurance' }, { value: 'general_fitness', label: 'Forme générale' }, { value: 'recomposition', label: 'Recomposition' },
        ]} />
      </Field>
    ),
  },
  {
    key: 'schedule', title: 'Ton emploi du temps',
    validate: (d) => (!d.daysPerWeek ? 'Choisis un nombre de jours.' : null),
    render: (d, set) => (
      <>
        <Field label="Jours d'entraînement par semaine">
          <Chips multi={false} value={d.daysPerWeek} onChange={(v) => set({ daysPerWeek: v })} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}j` }))} />
        </Field>
        <Field label="Durée par séance">
          <Chips multi={false} value={d.sessionLengthMin} onChange={(v) => set({ sessionLengthMin: v })} options={[30, 45, 60, 75, 90].map((n) => ({ value: n, label: `${n}min` }))} />
        </Field>
      </>
    ),
  },
  {
    key: 'equipment', title: 'Ton équipement',
    validate: (d) => (!d.equipmentAccess?.length ? 'Choisis au moins un équipement.' : null),
    render: (d, set) => (
      <Field label="Équipement disponible" hint="Sélectionne tout ce que tu as accès">
        <Chips value={d.equipmentAccess || []} onChange={(v) => set({ equipmentAccess: v })} options={EQUIPMENT_OPTIONS} />
      </Field>
    ),
  },
  {
    key: 'injuries', title: 'Précautions',
    render: (d, set) => (
      <Field label="Zones sensibles/blessées (optionnel)" hint="Le programme évitera les mouvements à risque pour ces zones — ce n'est pas un avis médical.">
        <Chips value={(d.injuries || []).map((i) => i.area)} onChange={(areas) => set({ injuries: areas.map((area) => ({ area })) })} options={INJURY_AREAS} />
      </Field>
    ),
  },
];

const NUTRITION_STEPS = [
  {
    key: 'activity', title: 'Ton niveau d\'activité',
    validate: (d) => (!d.activityLevel ? 'Choisis un niveau.' : null),
    render: (d, set) => (
      <Field label="Niveau d'activité au quotidien">
        <Chips multi={false} value={d.activityLevel} onChange={(v) => set({ activityLevel: v })} options={Object.entries(ACTIVITY_MULTIPLIERS).map(([k, v]) => ({ value: k, label: v.label }))} />
      </Field>
    ),
  },
  {
    key: 'goal', title: 'Ton objectif nutritionnel',
    validate: (d) => (!d.dietGoal ? 'Choisis un objectif.' : null),
    render: (d, set) => (
      <Field label="Objectif">
        <Chips multi={false} value={d.dietGoal} onChange={(v) => set({ dietGoal: v })} options={[
          { value: 'cut', label: 'Perte de gras' }, { value: 'maintain', label: 'Maintien' }, { value: 'bulk', label: 'Prise de masse' }, { value: 'recomp', label: 'Recomposition' },
        ]} />
      </Field>
    ),
  },
  {
    key: 'budget', title: 'Ton budget (Maroc)',
    validate: (d) => (!d.budgetTier ? 'Choisis un budget.' : null),
    render: (d, set) => (
      <Field label="Budget alimentaire quotidien indicatif">
        <Chips multi={false} value={d.budgetTier} onChange={(v) => set({ budgetTier: v })} options={Object.entries(MOROCCO_BUDGET_TIERS).map(([k, v]) => ({ value: k, label: `${v.label} (~${v.dailyFoodBudgetDH[0]}-${v.dailyFoodBudgetDH[1]} DH/j)` }))} />
      </Field>
    ),
  },
  {
    key: 'restrictions', title: 'Restrictions alimentaires',
    render: (d, set) => (
      <>
        <Field label="Restrictions (optionnel)">
          <Chips value={d.dietaryRestrictions || []} onChange={(v) => set({ dietaryRestrictions: v })} options={[
            { value: 'halal_only', label: 'Halal uniquement' }, { value: 'vegetarian', label: 'Végétarien' }, { value: 'vegan', label: 'Végan' },
            { value: 'lactose_free', label: 'Sans lactose' }, { value: 'gluten_free', label: 'Sans gluten' },
          ]} />
        </Field>
        <Field label="Repas par jour">
          <Chips multi={false} value={d.mealsPerDay} onChange={(v) => set({ mealsPerDay: v })} options={[3, 4, 5, 6].map((n) => ({ value: n, label: `${n}` }))} />
        </Field>
      </>
    ),
  },
  {
    key: 'biometrics', title: 'Tes données',
    validate: (d) => (!d.heightCm || !d.dobYear ? 'Renseigne au moins la taille et l\'année de naissance.' : null),
    render: (d, set) => (
      <>
        <Field label="Taille (cm)"><Input type="number" value={d.heightCm || ''} onChange={(e) => set({ heightCm: Number(e.target.value) })} /></Field>
        <Field label="Année de naissance"><Input type="number" value={d.dobYear || ''} onChange={(e) => set({ dobYear: Number(e.target.value) })} placeholder="ex: 1998" /></Field>
        <Field label="Sexe biologique (pour le calcul métabolique)">
          <Chips multi={false} value={d.sex} onChange={(v) => set({ sex: v })} options={[{ value: 'male', label: 'Homme' }, { value: 'female', label: 'Femme' }]} />
        </Field>
      </>
    ),
  },
];

function ProgramView({ program }) {
  return (
    <Card title="Programme actif" action={<Badge>{program.splitType.replace('_', ' ')}</Badge>}>
      <div className="space-y-3">
        {program.weeklyPlan.map((day) => (
          <div key={day.dayIndex} className="border border-line rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">{day.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {day.exercises.map((ex) => (
                <span key={ex.exerciseId} className="text-xs bg-surface border border-line rounded-full px-2.5 py-1">
                  {ex.name} · {ex.targetSets}×{ex.targetRepRange[0]}-{ex.targetRepRange[1]}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="text-xs text-mute space-y-1 pt-2 border-t border-line">
          {program.notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      </div>
    </Card>
  );
}

function PlanView({ plan }) {
  return (
    <Card title="Plan nutritionnel actif" action={<Badge>{plan.targetKcal} kcal/j</Badge>}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center"><div className="text-lg font-bold">{plan.targetMacros.proteinG}g</div><div className="text-xs text-mute">Protéine</div></div>
        <div className="text-center"><div className="text-lg font-bold">{plan.targetMacros.carbsG}g</div><div className="text-xs text-mute">Glucides</div></div>
        <div className="text-center"><div className="text-lg font-bold">{plan.targetMacros.fatG}g</div><div className="text-xs text-mute">Lipides</div></div>
      </div>
      <div className="space-y-2 mb-4">
        {plan.sampleMeals.map((m, i) => (
          <div key={i} className="text-xs bg-surface border border-line rounded-lg px-3 py-2">
            <span className="font-semibold">{m.mealSlot}:</span> {m.items.map((it) => `${it.name} (${it.grams}g)`).join(', ')}
          </div>
        ))}
      </div>
      <div className="text-xs text-mute space-y-1 pt-2 border-t border-line">
        {plan.explanationNotes.map((n, i) => <div key={i}>{n}</div>)}
      </div>
    </Card>
  );
}

export default function PlanSetup() {
  const { healthProfile, setHealthProfile, completeHealthProfile, generateProgram, generatePlan, getActiveProgram, getActiveNutritionPlan, deleteProgram, deleteNutritionPlan, getActiveCuratedProgram } = useHealthStore();
  const curatedProgram = getActiveCuratedProgram();
  const gender = useAuthStore((s) => s.user?.gender);
  const [activeWizard, setActiveWizard] = useState(null); // 'training' | 'nutrition' | null

  const program = getActiveProgram();
  const plan = getActiveNutritionPlan();
  const profileDirty = program && healthProfile.lastRecomputedAt && healthProfile.lastRecomputedAt > program.generatedAt;
  const planDirty = plan && healthProfile.lastRecomputedAt && healthProfile.lastRecomputedAt > plan.generatedAt;

  const finishTraining = (data) => {
    completeHealthProfile({ ...data, sex: healthProfile.sex ?? gender ?? null });
    generateProgram({ ...healthProfile, ...data });
    setActiveWizard(null);
  };
  const finishNutrition = (data) => {
    completeHealthProfile({ ...data, sex: data.sex ?? healthProfile.sex ?? gender ?? null });
    generatePlan();
    setActiveWizard(null);
  };

  if (activeWizard === 'training') {
    return <Wizard steps={TRAINING_STEPS} initialData={healthProfile} onComplete={finishTraining} onCancel={() => setActiveWizard(null)} />;
  }
  if (activeWizard === 'nutrition') {
    return <Wizard steps={NUTRITION_STEPS} initialData={{ ...healthProfile, sex: healthProfile.sex ?? gender ?? null }} onComplete={finishNutrition} onCancel={() => setActiveWizard(null)} />;
  }

  const cycleOn = healthProfile.cycleTrackingEnabled ?? gender !== 'male';
  const perfOn = healthProfile.maleTrackingEnabled ?? gender !== 'female';

  return (
    <div className="space-y-6">
      <Card title="Onglets de suivi">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={cycleOn} onChange={(e) => setHealthProfile({ cycleTrackingEnabled: e.target.checked })} />
            Suivi du cycle
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={perfOn} onChange={(e) => setHealthProfile({ maleTrackingEnabled: e.target.checked })} />
            Suivi Performance & Récupération
          </label>
        </div>
        <p className="text-[11px] text-mute mt-2">Active les onglets qui te concernent — les deux peuvent être activés en même temps.</p>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card title="Programme d'entraînement">
          {curatedProgram ? (
            <div className="space-y-2">
              <div className="text-sm">Programme actif : <span className="font-medium">{curatedProgram.name}</span></div>
              <p className="text-xs text-mute">Programme donné (non modifiable) — voir et personnaliser via l'onglet <span className="font-medium">Programmes</span> (les modifications s'enregistrent comme variantes).</p>
            </div>
          ) : program ? (
            <div className="space-y-3">
              {profileDirty && (
                <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} /> Ton profil a changé depuis la génération — régénère si besoin.
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setActiveWizard('training')}><span className="flex items-center gap-2 justify-center"><RefreshCw size={13} /> Régénérer</span></Button>
                <Button variant="danger" onClick={() => deleteProgram(program.id)}><Trash2 size={13} /></Button>
              </div>
            </div>
          ) : (
            <EmptyState>
              <Dumbbell size={24} className="mx-auto mb-2 opacity-50" />
              Pas encore de programme personnalisé.
              <div className="mt-3"><Button onClick={() => setActiveWizard('training')}>Créer mon programme</Button></div>
            </EmptyState>
          )}
        </Card>
        <Card title="Plan nutritionnel">
          {plan ? (
            <div className="space-y-3">
              {planDirty && (
                <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} /> Ton profil a changé depuis la génération — régénère si besoin.
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setActiveWizard('nutrition')}><span className="flex items-center gap-2 justify-center"><RefreshCw size={13} /> Régénérer</span></Button>
                <Button variant="danger" onClick={() => deleteNutritionPlan(plan.id)}><Trash2 size={13} /></Button>
              </div>
            </div>
          ) : (
            <EmptyState>
              <Salad size={24} className="mx-auto mb-2 opacity-50" />
              Pas encore de plan nutritionnel.
              <div className="mt-3"><Button onClick={() => setActiveWizard('nutrition')}>Créer mon plan</Button></div>
            </EmptyState>
          )}
        </Card>
      </div>

      {program && <ProgramView program={program} />}
      {plan && <PlanView plan={plan} />}
    </div>
  );
}
