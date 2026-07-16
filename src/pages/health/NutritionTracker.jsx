import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { FOOD_DB } from '../../utils/nutrition-db';
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
  const { nutritionLogs, mealTemplates, proteinTargetG, logMeal, deleteMeal, setProteinTarget, saveMealTemplate, deleteMealTemplate, logMealTemplate, getTodayNutrition } = useHealthStore();
  const [name, setName] = useState('');
  const [grams, setGrams] = useState(100);
  const [templateName, setTemplateName] = useState('');

  const { entries, totals, quality } = getTodayNutrition();
  const targets = macroTargets(proteinTargetG);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    logMeal(name.trim(), grams, pendingPrompt?.id);
    setName('');
    setGrams(100);
  };

  const saveTemplate = () => {
    if (!templateName.trim() || !entries.length) return;
    saveMealTemplate(templateName.trim(), entries.map((e) => ({ name: e.name, grams: e.grams })));
    setTemplateName('');
  };

  return (
    <div className="space-y-6">
      <Card title="Quick Log">
        <form onSubmit={submit} className="flex flex-wrap gap-3 items-end">
          <Field label="Food">
            <Input list="food-db" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken breast" />
            <datalist id="food-db">
              {FOOD_DB.map((f) => <option key={f.name} value={f.name} />)}
            </datalist>
          </Field>
          <Field label="Grams">
            <Input type="number" min="1" value={grams} onChange={(e) => setGrams(Number(e.target.value))} className="w-24" />
          </Field>
          <Button type="submit">Log meal</Button>
        </form>
      </Card>

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
                <span>{en.name} <span className="text-mute text-xs">({en.grams}g)</span></span>
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
                  <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => logMealTemplate(t.id)}>Log</Button>
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
