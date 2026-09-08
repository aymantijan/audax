import { useState } from 'react';
import { Plus, Trash2, Salad, UtensilsCrossed } from 'lucide-react';
import { Card, Button, Field, Input, Select, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { estimateMacros } from '../../../utils/nutrition-db';

const TEMPLATE_TYPES = [
  { value: 'training', label: 'Jour d\'entraînement' },
  { value: 'rest', label: 'Jour de repos' },
  { value: 'high_carb', label: 'High carb' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'refeed', label: 'Refeed' },
  { value: 'custom', label: 'Personnalisé' },
];

const BLANK_ITEM = { food_key: '', food_name: '', grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * Manage nutrition templates for a specific phase.
 */
export default function NutritionTemplateEditor({ phaseId }) {
  const store = useProgramStore();
  const templates = store.getNutritionForPhase(phaseId);
  const [editing, setEditing] = useState(null); // template object or null
  const [creating, setCreating] = useState(false);

  return (
    <Card title="Templates Nutrition" action={
      <Button variant="secondary" onClick={() => setCreating(true)}>
        <span className="flex items-center gap-1"><Plus size={14} /> Nouveau template</span>
      </Button>
    }>
      {templates.length === 0 && !creating ? (
        <EmptyState>
          <Salad size={20} className="mx-auto mb-2" />
          Aucun template nutrition pour cette phase.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setEditing(t)}
              className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2 hover:border-accent/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <UtensilsCrossed size={14} className="text-accent" />
                <span className="text-sm font-medium">{t.name}</span>
                <Badge>{TEMPLATE_TYPES.find((tt) => tt.value === t.template_type)?.label || t.template_type}</Badge>
              </div>
              <div className="text-xs text-mute">
                {t.target_kcal ? `${t.target_kcal} kcal` : '—'} · {t.meals?.length || 0} repas
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {(creating || editing) && (
        <TemplateForm
          phaseId={phaseId}
          template={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </Card>
  );
}

function TemplateForm({ phaseId, template, onClose }) {
  const store = useProgramStore();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name || '');
  const [type, setType] = useState(template?.template_type || 'training');
  const [meals, setMeals] = useState(template?.meals || []);
  const [notes, setNotes] = useState(template?.notes || '');
  const [saving, setSaving] = useState(false);

  // Computed macros from meals
  const totals = meals.reduce((acc, meal) => {
    for (const item of (meal.items || [])) {
      acc.kcal += item.kcal || 0;
      acc.protein += item.protein || 0;
      acc.carbs += item.carbs || 0;
      acc.fat += item.fat || 0;
      acc.fiber += item.fiber || 0;
    }
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const addMeal = () => {
    setMeals([...meals, { meal_label: `Repas ${meals.length + 1}`, time: '', items: [] }]);
  };

  const removeMeal = (idx) => {
    setMeals(meals.filter((_, i) => i !== idx));
  };

  const updateMealLabel = (idx, label) => {
    setMeals(meals.map((m, i) => i === idx ? { ...m, meal_label: label } : m));
  };

  const updateMealTime = (idx, time) => {
    setMeals(meals.map((m, i) => i === idx ? { ...m, time } : m));
  };

  const addFoodItem = (mealIdx) => {
    setMeals(meals.map((m, i) => {
      if (i !== mealIdx) return m;
      return { ...m, items: [...(m.items || []), { ...BLANK_ITEM }] };
    }));
  };

  const updateFoodItem = (mealIdx, itemIdx, field, value) => {
    setMeals(meals.map((m, mi) => {
      if (mi !== mealIdx) return m;
      return {
        ...m,
        items: m.items.map((item, ii) => {
          if (ii !== itemIdx) return item;
          const updated = { ...item, [field]: value };
          // Auto-recalc macros when food_name or grams change
          if ((field === 'food_name' || field === 'grams') && updated.food_name) {
            try {
              const macros = estimateMacros(updated.food_name, updated.grams || 100);
              if (macros) {
                updated.kcal = Math.round(macros.kcal);
                updated.protein = Math.round(macros.protein * 10) / 10;
                updated.carbs = Math.round(macros.carbs * 10) / 10;
                updated.fat = Math.round(macros.fat * 10) / 10;
                updated.fiber = Math.round((macros.fiber || 0) * 10) / 10;
              }
            } catch { /* non-matching food name — keep manual values */ }
          }
          return updated;
        }),
      };
    }));
  };

  const removeFoodItem = (mealIdx, itemIdx) => {
    setMeals(meals.map((m, mi) => {
      if (mi !== mealIdx) return m;
      return { ...m, items: m.items.filter((_, ii) => ii !== itemIdx) };
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        template_type: type,
        target_kcal: Math.round(totals.kcal),
        target_protein_g: Math.round(totals.protein),
        target_carbs_g: Math.round(totals.carbs),
        target_fat_g: Math.round(totals.fat),
        target_fiber_g: Math.round(totals.fiber),
        meals,
        notes: notes || null,
      };
      if (isEdit) {
        await store.updateNutritionTemplate(phaseId, template.id, data);
      } else {
        await store.createNutritionTemplate(phaseId, data);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    try {
      await store.removeNutritionTemplate(phaseId, template.id);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Modifier le template' : 'Nouveau template nutrition'}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Jour push — 2400 kcal" />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
        </div>

        {/* Macro summary (auto-computed) */}
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: 'Kcal', value: Math.round(totals.kcal), color: 'text-accent' },
            { label: 'Protéines', value: `${Math.round(totals.protein)}g`, color: 'text-good' },
            { label: 'Glucides', value: `${Math.round(totals.carbs)}g`, color: 'text-warning' },
            { label: 'Lipides', value: `${Math.round(totals.fat)}g`, color: 'text-bad' },
            { label: 'Fibres', value: `${Math.round(totals.fiber)}g`, color: 'text-mute' },
          ].map((m) => (
            <div key={m.label} className="bg-surface border border-line rounded-lg p-2">
              <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-mute">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Meals */}
        {meals.map((meal, mealIdx) => (
          <div key={mealIdx} className="border border-line rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={meal.meal_label}
                onChange={(e) => updateMealLabel(mealIdx, e.target.value)}
                className="!text-sm !font-semibold !py-1"
                placeholder="Nom du repas"
              />
              <Input
                type="time"
                value={meal.time || ''}
                onChange={(e) => updateMealTime(mealIdx, e.target.value)}
                className="!w-24 !py-1 !text-xs"
              />
              <Button variant="ghost" onClick={() => removeMeal(mealIdx)}>
                <Trash2 size={12} />
              </Button>
            </div>

            {/* Food items */}
            {(meal.items || []).map((item, itemIdx) => (
              <div key={itemIdx} className="grid grid-cols-[1fr_60px_55px_55px_55px_24px] gap-1 mb-1 items-center">
                <Input
                  value={item.food_name}
                  onChange={(e) => updateFoodItem(mealIdx, itemIdx, 'food_name', e.target.value)}
                  placeholder="Aliment"
                  className="!text-xs !py-1"
                />
                <Input
                  type="number"
                  value={item.grams}
                  onChange={(e) => updateFoodItem(mealIdx, itemIdx, 'grams', parseInt(e.target.value) || 0)}
                  className="!text-xs !py-1 text-center"
                  placeholder="g"
                />
                <span className="text-[10px] text-mute text-center">{item.kcal || 0} kcal</span>
                <span className="text-[10px] text-good text-center">{item.protein || 0}P</span>
                <span className="text-[10px] text-warning text-center">{item.carbs || 0}G</span>
                <button onClick={() => removeFoodItem(mealIdx, itemIdx)} className="text-mute hover:text-bad cursor-pointer">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}

            <button onClick={() => addFoodItem(mealIdx)} className="text-[10px] text-accent flex items-center gap-0.5 mt-1 cursor-pointer">
              <Plus size={10} /> Ajouter un aliment
            </button>
          </div>
        ))}

        <Button variant="secondary" onClick={addMeal} className="w-full">
          <span className="flex items-center gap-1 justify-center"><Plus size={14} /> Ajouter un repas</span>
        </Button>

        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes sur ce template…" />
        </Field>
      </div>

      <div className="flex gap-2 justify-between mt-4 pt-3 border-t border-line">
        <div>
          {isEdit && (
            <Button variant="danger" onClick={handleDelete}>Supprimer</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
