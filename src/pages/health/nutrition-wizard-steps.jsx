// Shared nutrition-profile Wizard steps — used by NutritionTracker.jsx (when
// creating/regenerating a plan directly from the Nutrition tab) and by
// ProgramOnboarding.jsx (folded into the program onboarding flow when no
// nutrition plan exists yet). Previously lived in the now-deleted
// PlanSetup.jsx ("My Plan" tab).
import { Field } from '../../components/common/ui';
import { ACTIVITY_MULTIPLIERS } from '../../utils/health-science';
import { MOROCCO_BUDGET_TIERS, MOROCCO_FOOD_COST_TIERS } from '../../utils/morocco-food-budget';

const CATEGORY_LABEL = { protein: 'Protéines', carb: 'Glucides', fat: 'Lipides', veg: 'Légumes', fruit: 'Fruits', dairy: 'Laitier' };

export function Chips({ options, value, onChange, multi = true }) {
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

export const NUTRITION_STEPS = [
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
    key: 'preferences', title: 'Tes préférences alimentaires',
    render: (d, set) => (
      <div className="space-y-4">
        <p className="text-xs text-mute -mt-1">
          Coche ce que tu n'aimes pas ou ne manges pas — le plan proposera d'autres aliments à la place (sans changer ton budget ni tes objectifs).
        </p>
        {Object.entries(CATEGORY_LABEL).map(([cat, label]) => {
          const options = MOROCCO_FOOD_COST_TIERS.filter((f) => f.category === cat).map((f) => ({ value: f.name, label: f.name }));
          if (!options.length) return null;
          return (
            <Field key={cat} label={label}>
              <Chips value={d.dislikedFoods || []} onChange={(v) => set({ dislikedFoods: v })} options={options} />
            </Field>
          );
        })}
      </div>
    ),
  },
];
