import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Salad, UtensilsCrossed, Search, ChevronDown } from 'lucide-react';
import { Card, Button, Field, Input, Select, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { FOOD_DB, estimateMacros } from '../../../utils/nutrition-db';

const TEMPLATE_TYPES = [
  { value: 'training', label: 'Jour d\'entraînement' },
  { value: 'rest', label: 'Jour de repos' },
  { value: 'high_carb', label: 'High carb' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'refeed', label: 'Refeed' },
  { value: 'custom', label: 'Personnalisé' },
];

// ── Food autocomplete component ──
function FoodSearch({ value, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);

  // Filter FOOD_DB by query
  const results = useMemo(() => {
    if (!query || query.length < 1) return FOOD_DB.slice(0, 20);
    const q = query.toLowerCase();
    return FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 15);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (food) => {
    setQuery(food.name);
    setOpen(false);
    onSelect(food);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[highlightIdx]) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlightIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un aliment…"
          className="w-full text-xs py-1.5 pl-6 pr-2 bg-surface border border-line rounded-md text-ink placeholder:text-mute focus:outline-none focus:border-accent"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-line rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((food, i) => (
            <button
              key={food.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(food)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`w-full text-left px-2 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                i === highlightIdx ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-surface'
              }`}
            >
              <span className="font-medium truncate">{food.name}</span>
              <span className="text-[10px] text-mute whitespace-nowrap flex gap-1.5">
                <span>{food.kcal} kcal</span>
                <span className="text-good">{food.protein}P</span>
                <span className="text-warning">{food.carbs}G</span>
                <span className="text-bad">{food.fat}L</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Serving selector ──
function ServingPicker({ food, grams, onChangeGrams }) {
  const foodEntry = FOOD_DB.find((f) => f.name === food);
  const servings = foodEntry?.servings || [];

  if (servings.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={grams}
          onChange={(e) => onChangeGrams(parseInt(e.target.value) || 0)}
          className="w-14 text-xs py-1 px-1.5 text-center bg-surface border border-line rounded-md text-ink focus:outline-none focus:border-accent"
        />
        <span className="text-[10px] text-mute">g</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={grams}
        onChange={(e) => onChangeGrams(parseInt(e.target.value) || 0)}
        className="w-14 text-xs py-1 px-1.5 text-center bg-surface border border-line rounded-md text-ink focus:outline-none focus:border-accent"
      />
      <select
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'g') return;
          const serving = servings.find((s) => s.label === val);
          if (serving) onChangeGrams(serving.grams);
        }}
        className="text-[10px] py-1 px-0.5 bg-surface border border-line rounded-md text-mute cursor-pointer focus:outline-none"
        defaultValue="g"
      >
        <option value="g">g</option>
        {servings.map((s) => (
          <option key={s.label} value={s.label}>{s.label} ({s.grams}g)</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Manage nutrition templates for a specific phase.
 */
export default function NutritionTemplateEditor({ phaseId }) {
  const store = useProgramStore();
  const templates = store.getNutritionForPhase(phaseId);
  const [editing, setEditing] = useState(null);
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

  const selectFood = (mealIdx, itemIdx, food) => {
    setMeals(meals.map((m, mi) => {
      if (mi !== mealIdx) return m;
      return {
        ...m,
        items: m.items.map((item, ii) => {
          if (ii !== itemIdx) return item;
          const grams = item.grams || 100;
          const macros = estimateMacros(food.name, grams);
          return {
            ...item,
            food_key: food.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            food_name: food.name,
            grams,
            kcal: macros ? Math.round(macros.kcal) : 0,
            protein: macros ? Math.round(macros.protein * 10) / 10 : 0,
            carbs: macros ? Math.round(macros.carbs * 10) / 10 : 0,
            fat: macros ? Math.round(macros.fat * 10) / 10 : 0,
            fiber: 0,
          };
        }),
      };
    }));
  };

  const updateGrams = (mealIdx, itemIdx, grams) => {
    setMeals(meals.map((m, mi) => {
      if (mi !== mealIdx) return m;
      return {
        ...m,
        items: m.items.map((item, ii) => {
          if (ii !== itemIdx) return item;
          const updated = { ...item, grams };
          if (updated.food_name) {
            const macros = estimateMacros(updated.food_name, grams);
            if (macros) {
              updated.kcal = Math.round(macros.kcal);
              updated.protein = Math.round(macros.protein * 10) / 10;
              updated.carbs = Math.round(macros.carbs * 10) / 10;
              updated.fat = Math.round(macros.fat * 10) / 10;
            }
          }
          return updated;
        }),
      };
    }));
  };

  const addFoodItem = (mealIdx) => {
    setMeals(meals.map((m, i) => {
      if (i !== mealIdx) return m;
      return { ...m, items: [...(m.items || []), { food_key: '', food_name: '', grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }] };
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
            { label: 'Calories', value: Math.round(totals.kcal), unit: 'kcal', color: 'text-accent' },
            { label: 'Protéines', value: Math.round(totals.protein), unit: 'g', color: 'text-good' },
            { label: 'Glucides', value: Math.round(totals.carbs), unit: 'g', color: 'text-warning' },
            { label: 'Lipides', value: Math.round(totals.fat), unit: 'g', color: 'text-bad' },
            { label: 'Fibres', value: Math.round(totals.fiber), unit: 'g', color: 'text-mute' },
          ].map((m) => (
            <div key={m.label} className="bg-surface border border-line rounded-lg p-2">
              <div className={`text-lg font-bold ${m.color}`}>{m.value}<span className="text-[10px] font-normal ml-0.5">{m.unit}</span></div>
              <div className="text-[10px] text-mute">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Meals */}
        {meals.map((meal, mealIdx) => (
          <div key={mealIdx} className="border border-line rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
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

            {/* Column headers */}
            {(meal.items || []).length > 0 && (
              <div className="grid grid-cols-[1fr_auto_55px_55px_55px_55px_24px] gap-1 mb-1 px-0.5">
                <span className="text-[9px] text-mute font-medium uppercase">Aliment</span>
                <span className="text-[9px] text-mute font-medium uppercase text-center w-[76px]">Quantité</span>
                <span className="text-[9px] text-mute font-medium uppercase text-center">Kcal</span>
                <span className="text-[9px] text-good font-medium uppercase text-center">Prot.</span>
                <span className="text-[9px] text-warning font-medium uppercase text-center">Gluc.</span>
                <span className="text-[9px] text-bad font-medium uppercase text-center">Lip.</span>
                <span></span>
              </div>
            )}

            {/* Food items */}
            {(meal.items || []).map((item, itemIdx) => (
              <div key={itemIdx} className="grid grid-cols-[1fr_auto_55px_55px_55px_55px_24px] gap-1 mb-1.5 items-center">
                <FoodSearch
                  value={item.food_name}
                  onSelect={(food) => selectFood(mealIdx, itemIdx, food)}
                />
                <ServingPicker
                  food={item.food_name}
                  grams={item.grams}
                  onChangeGrams={(g) => updateGrams(mealIdx, itemIdx, g)}
                />
                <span className="text-[10px] text-mute text-center font-medium">{item.kcal || 0}</span>
                <span className="text-[10px] text-good text-center font-medium">{item.protein || 0}g</span>
                <span className="text-[10px] text-warning text-center font-medium">{item.carbs || 0}g</span>
                <span className="text-[10px] text-bad text-center font-medium">{item.fat || 0}g</span>
                <button onClick={() => removeFoodItem(mealIdx, itemIdx)} className="text-mute hover:text-bad cursor-pointer">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}

            {/* Meal subtotal */}
            {(meal.items || []).length > 0 && (() => {
              const mealTotals = (meal.items || []).reduce((acc, item) => ({
                kcal: acc.kcal + (item.kcal || 0),
                protein: acc.protein + (item.protein || 0),
                carbs: acc.carbs + (item.carbs || 0),
                fat: acc.fat + (item.fat || 0),
              }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
              return (
                <div className="grid grid-cols-[1fr_auto_55px_55px_55px_55px_24px] gap-1 mt-1 pt-1 border-t border-line/50">
                  <span className="text-[10px] text-mute font-semibold">Sous-total</span>
                  <span className="w-[76px]"></span>
                  <span className="text-[10px] text-mute text-center font-bold">{Math.round(mealTotals.kcal)}</span>
                  <span className="text-[10px] text-good text-center font-bold">{Math.round(mealTotals.protein)}g</span>
                  <span className="text-[10px] text-warning text-center font-bold">{Math.round(mealTotals.carbs)}g</span>
                  <span className="text-[10px] text-bad text-center font-bold">{Math.round(mealTotals.fat)}g</span>
                  <span></span>
                </div>
              );
            })()}

            <button onClick={() => addFoodItem(mealIdx)} className="text-[10px] text-accent flex items-center gap-0.5 mt-2 cursor-pointer hover:underline">
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
