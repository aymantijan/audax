import { useMemo, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { FOOD_DB, getServingOptions } from '../../utils/nutrition-db';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, ProgressBar, EmptyState, Badge } from '../../components/common/ui';

// Rough daily macro targets derived from the protein target (spec: progress bars
// for Protein/Carbs/Fats/Calories) — carbs/fat/kcal are simple ratios, not a full
// TDEE calculator, since no bodyweight/activity intake exists yet.
function macroTargets(proteinTargetG) {
  const kcalFromProtein = proteinTargetG * 4;
  const kcal = Math.round(kcalFromProtein / 0.3); // assume protein ≈ 30% of calories
  return { protein: proteinTargetG, carbs: Math.round((kcal * 0.4) / 4), fat: Math.round((kcal * 0.3) / 9), kcal };
}

export default function NutritionTracker({ pendingPrompt }) {
  const { nutritionLogs, mealTemplates, proteinTargetG, logMeal, deleteMeal, setProteinTarget, saveMealTemplate, deleteMealTemplate, logMealTemplate, getTodayNutrition, getActiveNutritionPlan, logPlanMeal } = useHealthStore();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState('g');
  const [templateName, setTemplateName] = useState('');
  const [logDate, setLogDate] = useState(todayKey());

  const { entries, totals, quality } = getTodayNutrition();
  const activePlan = getActiveNutritionPlan();
  // Prefer the generated plan's real TDEE-based targets over the rough
  // protein-ratio heuristic below, when one exists.
  const targets = activePlan
    ? { protein: activePlan.targetMacros.proteinG, carbs: activePlan.targetMacros.carbsG, fat: activePlan.targetMacros.fatG, kcal: activePlan.targetKcal }
    : macroTargets(proteinTargetG);

  // Unit choices update as the food name changes — e.g. typing "egg" reveals
  // an "egg" option alongside the always-available "g", so 100g of guessing
  // isn't the only way to log a natural-serving food.
  const servingOptions = useMemo(() => getServingOptions(name), [name]);

  const changeName = (v) => {
    setName(v);
    // Default to the food's natural serving when it has one (e.g. "egg" →
    // unit "egg", amount 1) rather than making the user guess grams — 'g' is
    // always still available in the dropdown if they'd rather use it.
    const opts = getServingOptions(v);
    if (opts.length > 1) {
      setUnit(opts[1].label);
      setAmount(1);
    } else {
      setUnit('g');
      setAmount(100);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    logMeal(name.trim(), amount, unit, pendingPrompt?.id, logDate);
    setName('');
    setAmount(100);
    setUnit('g');
    setLogDate(todayKey());
  };

  const saveTemplate = () => {
    if (!templateName.trim() || !entries.length) return;
    saveMealTemplate(templateName.trim(), entries.map((e) => ({ name: e.name, amount: e.amount, unit: e.unit })));
    setTemplateName('');
  };

  return (
    <div className="space-y-6">
      <Card title="Quick Log">
        <form onSubmit={submit} className="flex flex-wrap gap-3 items-end">
          <Field label="Food">
            <Input list="food-db" value={name} onChange={(e) => changeName(e.target.value)} placeholder="e.g. Chicken breast, egg, banana…" />
            <datalist id="food-db">
              {FOOD_DB.map((f) => <option key={f.name} value={f.name} />)}
            </datalist>
          </Field>
          <Field label="Amount">
            <Input type="number" min="0.1" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-24" />
          </Field>
          <Field label="Unit">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} options={servingOptions.map((o) => ({ value: o.label, label: o.label }))} className="w-32" />
          </Field>
          <Field label="Date" hint="Backdate a missed meal">
            <Input type="date" value={logDate} max={todayKey()} onChange={(e) => e.target.value && setLogDate(e.target.value)} />
          </Field>
          <Button type="submit">Log meal</Button>
        </form>
      </Card>

      {activePlan && (
        <Card title="Plan nutritionnel actif" action={<Badge>{activePlan.targetKcal} kcal/j</Badge>}>
          <div className="space-y-1.5">
            {activePlan.sampleMeals.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>
                  <span className="font-medium">{m.mealSlot}:</span>{' '}
                  <span className="text-mute">{m.items.map((it) => `${it.name} (${it.grams}g)`).join(', ')}</span>
                </span>
                <Button variant="secondary" className="!px-2 !py-1 text-xs shrink-0" onClick={() => logPlanMeal(m.mealSlot, logDate)}>Logger</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Today's Macros" action={quality != null && <Badge color={quality >= 70 ? 'var(--success)' : quality >= 40 ? 'var(--warning)' : 'var(--error)'}>{quality}% whole foods</Badge>}>
        <div className="space-y-3">
          {[
            { key: 'protein', label: 'Protein', unit: 'g' },
            { key: 'carbs', label: 'Carbs', unit: 'g' },
            { key: 'fat', label: 'Fat', unit: 'g' },
            { key: 'kcal', label: 'Calories', unit: 'kcal' },
          ].map((m) => (
            <div key={m.key}>
              <div className="flex justify-between text-xs mb-1">
                <span>{m.label}</span>
                <span className="text-mute">{Math.round(totals[m.key])} / {targets[m.key]}{m.unit}</span>
              </div>
              <ProgressBar value={totals[m.key]} max={targets[m.key]} color={totals[m.key] >= targets[m.key] ? 'var(--success)' : 'var(--accent-primary)'} />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Protein target (g/day)">
            <Input type="number" min="0" value={proteinTargetG} onChange={(e) => setProteinTarget(e.target.value)} className="w-32" />
          </Field>
        </div>
      </Card>

      <Card title="Logged Today">
        {entries.length ? (
          <ul className="space-y-1.5">
            {entries.map((en) => (
              <li key={en.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>{en.name} <span className="text-mute text-xs">({en.amount ?? en.grams}{en.unit && en.unit !== 'g' ? ` ${en.unit}${en.amount > 1 ? 's' : ''}` : 'g'}{en.unit && en.unit !== 'g' ? ` · ${en.grams}g` : ''})</span></span>
                <span className="flex items-center gap-3">
                  <span className="text-mute text-xs">{en.kcal} kcal · {en.protein}g P {!en.matched && '· unrecognized'}</span>
                  <button onClick={() => deleteMeal(en.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No meals logged today.</EmptyState>
        )}
        {entries.length > 0 && (
          <div className="flex gap-2 mt-3">
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name (e.g. Breakfast Standard)" />
            <Button variant="secondary" onClick={saveTemplate}><span className="flex items-center gap-2"><Plus size={14} /> Save as template</span></Button>
          </div>
        )}
      </Card>

      {mealTemplates.length > 0 && (
        <Card title="Meal Templates">
          <ul className="space-y-1.5">
            {mealTemplates.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>{t.name} <span className="text-mute text-xs">({t.items.length} items)</span></span>
                <span className="flex items-center gap-3">
                  <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => logMealTemplate(t.id, logDate)}>Log</Button>
                  <button onClick={() => deleteMealTemplate(t.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
