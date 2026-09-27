import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { FOOD_DB, getServingOptions, lookupFood } from '../../utils/nutrition-db';
import { MOROCCO_FOOD_COST_TIERS } from '../../utils/morocco-food-budget';
import { useHealthStore } from '../../store/healthStore';
import { toast } from '../../store/uiStore';
import { Card, Button, Field, Input, Select } from '../common/ui';

const FOOD_CATEGORIES = [
  { value: 'protein', label: 'Protéines' }, { value: 'carb', label: 'Glucides' }, { value: 'fat', label: 'Lipides' },
  { value: 'veg', label: 'Légumes' }, { value: 'fruit', label: 'Fruits' }, { value: 'dairy', label: 'Laitier' },
];

// Servings that are legitimately fractional/by-volume in real cooking (cup,
// tbsp…) stay priced per 100g — everything else with a defined serving
// (egg, can, cuisse, steak…) is a physical item you buy as a whole unit, not
// by weight, so pricing switches to "per unit" for those. Same split as
// CONTINUOUS_SERVING_LABELS in nutrition-plan-generator.js/healthStore.js.
const CONTINUOUS_SERVING_LABELS = new Set(['cup', 'tbsp', 'slice', 'handful', 'handful (~23)', 'glass', 'loaf', 'poignée']);
function getDiscreteUnit(foodName) {
  if (!foodName) return null;
  const options = getServingOptions(foodName);
  return options.find((o) => o.grams > 1 && !CONTINUOUS_SERVING_LABELS.has(o.label)) || null;
}

// Your own foods, prices and corrections: used by the nutrition plan generator.
export default function FoodsCard() {
  const { customFoods, addCustomFood, deleteCustomFood, foodPrices, setFoodPrice, deleteFoodPrice, foodOverrides, setFoodOverride, deleteFoodOverride } = useHealthStore();
  const [newFood, setNewFood] = useState({ name: '', category: 'protein', protein: '', carbs: '', fat: '', kcal: '', pricePerGram: '', isUnit: false, unitLabel: '', unitGrams: '', unitPrice: '' });
  // priceMode: 'weight' (Dh/100g, always available) or 'unit' — every food
  // can be priced either way now (not just ones with a built-in serving like
  // eggs), same flexibility as MyFitnessPal's per-serving logging. If the
  // food has no defined unit yet, unitLabel/unitGrams below define one on
  // the fly instead of requiring a separate trip to the correction form.
  const [priceEntry, setPriceEntry] = useState({ name: '', price: '', priceMode: 'weight', unitLabel: '', unitGrams: '' });
  const [infoEntry, setInfoEntry] = useState({ name: '', protein: '', carbs: '', fat: '', kcal: '', unitLabel: '', unitGrams: '' });
  const allFoodNames = [...new Set([...FOOD_DB.map((f) => f.name), ...MOROCCO_FOOD_COST_TIERS.map((f) => f.name), ...customFoods.map((f) => f.name)])].sort();
  const priceEntryUnit = getDiscreteUnit(priceEntry.name.trim());
  const infoEntryFood = infoEntry.name.trim() ? lookupFood(infoEntry.name.trim()) : null;
  const infoEntryUnit = infoEntryFood?.servings?.[0] || null;

  const submitNewFood = (e) => {
    e.preventDefault();
    if (!newFood.name.trim() || !newFood.protein || !newFood.kcal) return toast('Nom, protéine et calories sont requis.', 'warning');
    if (newFood.isUnit && (!newFood.unitLabel.trim() || !newFood.unitGrams)) return toast("Nom de l'unité et poids d'une unité sont requis pour un aliment compté en unités.", 'warning');
    addCustomFood({
      name: newFood.name.trim(), category: newFood.category,
      protein: Number(newFood.protein) || 0, carbs: Number(newFood.carbs) || 0, fat: Number(newFood.fat) || 0, kcal: Number(newFood.kcal) || 0,
      ...(newFood.isUnit
        ? {
            whole: true,
            servings: [{ label: newFood.unitLabel.trim(), grams: Number(newFood.unitGrams) }],
            pricePerGram: newFood.unitPrice ? Number(newFood.unitPrice) / Number(newFood.unitGrams) : null,
          }
        : { pricePerGram: newFood.pricePerGram ? Number(newFood.pricePerGram) / 100 : null }),
    });
    setNewFood({ name: '', category: 'protein', protein: '', carbs: '', fat: '', kcal: '', pricePerGram: '', isUnit: false, unitLabel: '', unitGrams: '', unitPrice: '' });
  };

  const submitPrice = (e) => {
    e.preventDefault();
    const name = priceEntry.name.trim();
    if (!name || !priceEntry.price) return;
    if (priceEntry.priceMode === 'weight') {
      setFoodPrice(name, Number(priceEntry.price) / 100);
    } else {
      // Priced per unit: use the food's existing purchase unit if it has
      // one, otherwise define one right here from the label/grams fields
      // (e.g. "Chicken breast" has no built-in unit — the user can price it
      // as "1 barquette = 500g" without a separate trip to the correction
      // form below).
      let unitGrams = priceEntryUnit?.grams;
      if (!priceEntryUnit) {
        if (!priceEntry.unitLabel.trim() || !priceEntry.unitGrams) return toast("Nom de l'unité et poids d'une unité sont requis pour cet aliment (il n'a pas encore d'unité définie).", 'warning');
        setFoodOverride(name, { unitLabel: priceEntry.unitLabel.trim(), unitGrams: Number(priceEntry.unitGrams) });
        unitGrams = Number(priceEntry.unitGrams);
      }
      setFoodPrice(name, Number(priceEntry.price) / unitGrams);
    }
    setPriceEntry({ name: '', price: '', priceMode: 'weight', unitLabel: '', unitGrams: '' });
  };

  // Corrects a generic FOOD_DB/Morocco-list estimate for the specific
  // product the user actually has — e.g. their can of sardines nets 55g,
  // not the generic 106g assumed (which silently makes an "8Dh" can read as
  // cheap when it's really ~14.5Dh/100g). Partial: only the fields actually
  // filled in are stored, everything else keeps the generic default.
  const submitFoodInfo = (e) => {
    e.preventDefault();
    const name = infoEntry.name.trim();
    if (!name) return;
    const patch = {};
    for (const k of ['protein', 'carbs', 'fat', 'kcal']) if (infoEntry[k] !== '') patch[k] = Number(infoEntry[k]);
    if (infoEntry.unitLabel.trim() !== '') patch.unitLabel = infoEntry.unitLabel.trim();
    if (infoEntry.unitGrams !== '') patch.unitGrams = Number(infoEntry.unitGrams);
    if (patch.unitGrams != null && !patch.unitLabel && !infoEntryUnit) return toast("Donne aussi un nom d'unité (ex. \"barquette\") pour un aliment qui n'en a pas encore.", 'warning');
    if (!Object.keys(patch).length) return toast('Renseigne au moins une valeur à corriger.', 'warning');
    setFoodOverride(name, patch);
    setInfoEntry({ name: '', protein: '', carbs: '', fat: '', kcal: '', unitLabel: '', unitGrams: '' });
    toast('Fiche corrigée', 'success');
  };

  return (
    <Card title="Mes aliments & prix">
      <p className="text-sm text-mute mb-4">
        Le prix réel que tu paies pour chaque aliment — propre à toi, pas une moyenne générique. Dès qu'un prix est renseigné, le générateur de plan nutritionnel privilégie tes aliments les moins chers en premier.
      </p>

      <div className="mb-5">
        <div className="text-xs text-mute uppercase tracking-wide mb-2">Ajouter un aliment</div>
        <form onSubmit={submitNewFood} className="grid sm:grid-cols-3 gap-2 items-end">
          <Field label="Nom">
            <Input value={newFood.name} onChange={(e) => setNewFood({ ...newFood, name: e.target.value })} placeholder="ex. Poulet fermier local" />
          </Field>
          <Field label="Catégorie">
            <Select value={newFood.category} onChange={(e) => setNewFood({ ...newFood, category: e.target.value })} options={FOOD_CATEGORIES} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-mute cursor-pointer sm:col-span-1">
            <input type="checkbox" checked={newFood.isUnit} onChange={(e) => setNewFood({ ...newFood, isUnit: e.target.checked })} className="cursor-pointer" />
            Se compte en unités (pas en grammes) — ex. œuf, boîte
          </label>

          {newFood.isUnit ? (
            <>
              <Field label="Nom de l'unité">
                <Input value={newFood.unitLabel} onChange={(e) => setNewFood({ ...newFood, unitLabel: e.target.value })} placeholder="ex. œuf" />
              </Field>
              <Field label="Poids d'une unité (g)">
                <Input type="number" min="1" value={newFood.unitGrams} onChange={(e) => setNewFood({ ...newFood, unitGrams: e.target.value })} placeholder="ex. 50" />
              </Field>
              <Field label={`Prix par ${newFood.unitLabel.trim() || 'unité'} (Dh)`}>
                <Input type="number" min="0" step="0.1" value={newFood.unitPrice} onChange={(e) => setNewFood({ ...newFood, unitPrice: e.target.value })} />
              </Field>
            </>
          ) : (
            <Field label="Prix / 100g (Dh)">
              <Input type="number" min="0" step="0.1" value={newFood.pricePerGram} onChange={(e) => setNewFood({ ...newFood, pricePerGram: e.target.value })} />
            </Field>
          )}
          <Field label="Protéine /100g (g)">
            <Input type="number" min="0" step="0.1" value={newFood.protein} onChange={(e) => setNewFood({ ...newFood, protein: e.target.value })} />
          </Field>
          <Field label="Glucides /100g (g)">
            <Input type="number" min="0" step="0.1" value={newFood.carbs} onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })} />
          </Field>
          <Field label="Lipides /100g (g)">
            <Input type="number" min="0" step="0.1" value={newFood.fat} onChange={(e) => setNewFood({ ...newFood, fat: e.target.value })} />
          </Field>
          <Field label="Calories /100g">
            <Input type="number" min="0" value={newFood.kcal} onChange={(e) => setNewFood({ ...newFood, kcal: e.target.value })} />
          </Field>
          <Button type="submit" className="sm:col-span-2"><span className="flex items-center gap-2 justify-center"><Plus size={14} /> Ajouter à mes aliments</span></Button>
        </form>
        <p className="text-[11px] text-mute mt-1.5">Les macros restent toujours saisies pour 100g (fait nutritionnel indépendant de l'unité d'achat) — seule l'unité de prix/achat change.</p>
      </div>

      {customFoods.length > 0 && (
        <div className="mb-5">
          <div className="text-xs text-mute uppercase tracking-wide mb-2">Tes aliments ajoutés</div>
          <ul className="space-y-1.5">
            {customFoods.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>{f.name} <span className="text-mute text-xs">({FOOD_CATEGORIES.find((c) => c.value === f.category)?.label} · {f.kcal}kcal · {f.protein}g P{f.pricePerGram ? ` · ${f.servings?.[0] ? `${(f.pricePerGram * f.servings[0].grams).toFixed(2)}Dh/${f.servings[0].label}` : `${(f.pricePerGram * 100).toFixed(1)}Dh/100g`}` : ''})</span></span>
                <button onClick={() => deleteCustomFood(f.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-2">
        <div className="text-xs text-mute uppercase tracking-wide mb-2">Prix d'un aliment existant</div>
        <p className="text-[11px] text-mute mb-2">
          Par défaut, tout se prix au poids (100g) — sauf les œufs et quelques aliments avec une unité connue (boîte, cuisse…). Comme dans MyFitnessPal, tu peux choisir de prix n'importe quel aliment par unité à la place (ex. "1 barquette de poulet = 45Dh"), même s'il n'en avait pas une au départ.
        </p>
        <form onSubmit={submitPrice} className="flex flex-wrap gap-2 items-end">
          <Field label="Aliment">
            <Input list="all-foods" value={priceEntry.name} onChange={(e) => setPriceEntry({ ...priceEntry, name: e.target.value })} placeholder="ex. Cuisse de poulet" />
            <datalist id="all-foods">
              {allFoodNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </Field>
          <Field label="Mode de prix">
            <Select
              value={priceEntry.priceMode}
              onChange={(e) => setPriceEntry({ ...priceEntry, priceMode: e.target.value })}
              options={[{ value: 'weight', label: 'Par poids (100g)' }, { value: 'unit', label: 'Par unité' }]}
            />
          </Field>
          {priceEntry.priceMode === 'unit' && !priceEntryUnit && (
            <>
              <Field label="Nom de l'unité">
                <Input value={priceEntry.unitLabel} onChange={(e) => setPriceEntry({ ...priceEntry, unitLabel: e.target.value })} placeholder="ex. barquette" className="w-32" />
              </Field>
              <Field label="Poids d'une unité (g)">
                <Input type="number" min="1" value={priceEntry.unitGrams} onChange={(e) => setPriceEntry({ ...priceEntry, unitGrams: e.target.value })} placeholder="ex. 500" className="w-32" />
              </Field>
            </>
          )}
          <Field label={priceEntry.priceMode === 'unit' ? `Prix par ${priceEntryUnit?.label || priceEntry.unitLabel.trim() || 'unité'} (Dh)` : 'Prix / 100g (Dh)'}>
            <Input type="number" min="0" step="0.1" value={priceEntry.price} onChange={(e) => setPriceEntry({ ...priceEntry, price: e.target.value })} className="w-32" />
          </Field>
          <Button type="submit" variant="secondary">Enregistrer le prix</Button>
        </form>
        {priceEntry.priceMode === 'unit' && priceEntryUnit && <p className="text-[11px] text-mute mt-1.5">"{priceEntry.name.trim()}" a déjà une unité connue : {priceEntryUnit.label} ({priceEntryUnit.grams}g).</p>}
      </div>

      {Object.keys(foodPrices).length > 0 && (
        <ul className="space-y-1.5 mt-3">
          {Object.entries(foodPrices).map(([name, pricePerGram]) => {
            const unit = getDiscreteUnit(name);
            return (
              <li key={name} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>{name} <span className="text-mute text-xs">{unit ? `${(pricePerGram * unit.grams).toFixed(2)}Dh/${unit.label}` : `${(pricePerGram * 100).toFixed(1)}Dh/100g`}</span></span>
                <button onClick={() => deleteFoodPrice(name)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mb-2 mt-5 border-t border-line pt-4">
        <div className="text-xs text-mute uppercase tracking-wide mb-2">Corriger la fiche d'un aliment existant</div>
        <p className="text-[11px] text-mute mb-2">
          Les valeurs génériques ne correspondent pas toujours à ton produit réel — ex. une boîte de sardines assumée à 106g de poids net alors que la tienne n'en fait que 55g (ce qui change complètement le prix réel au 100g). Marche aussi pour donner une unité à un aliment qui n'en a pas encore (ex. une barquette de poulet). Corrige uniquement ce qui diffère, le reste garde la valeur générique.
        </p>
        <form onSubmit={submitFoodInfo} className="grid sm:grid-cols-3 gap-2 items-end">
          <Field label="Aliment">
            <Input list="all-foods" value={infoEntry.name} onChange={(e) => setInfoEntry({ ...infoEntry, name: e.target.value })} placeholder="ex. Sardines en boîte" />
          </Field>
          <Field label="Nom de l'unité" hint={infoEntryUnit ? `générique : ${infoEntryUnit.label}` : "aucune pour l'instant"}>
            <Input value={infoEntry.unitLabel} onChange={(e) => setInfoEntry({ ...infoEntry, unitLabel: e.target.value })} placeholder={infoEntryUnit?.label || 'ex. barquette'} />
          </Field>
          <Field label="Poids réel d'une unité (g)" hint={infoEntryUnit ? `générique : ${infoEntryUnit.grams}g` : undefined}>
            <Input type="number" min="1" value={infoEntry.unitGrams} onChange={(e) => setInfoEntry({ ...infoEntry, unitGrams: e.target.value })} placeholder={infoEntryUnit ? String(infoEntryUnit.grams) : ''} />
          </Field>
          <Field label="Protéine /100g (g)" hint={infoEntryFood ? `générique : ${infoEntryFood.protein}g` : undefined}>
            <Input type="number" min="0" step="0.1" value={infoEntry.protein} onChange={(e) => setInfoEntry({ ...infoEntry, protein: e.target.value })} placeholder={infoEntryFood ? String(infoEntryFood.protein) : ''} />
          </Field>
          <Field label="Glucides /100g (g)" hint={infoEntryFood ? `générique : ${infoEntryFood.carbs}g` : undefined}>
            <Input type="number" min="0" step="0.1" value={infoEntry.carbs} onChange={(e) => setInfoEntry({ ...infoEntry, carbs: e.target.value })} placeholder={infoEntryFood ? String(infoEntryFood.carbs) : ''} />
          </Field>
          <Field label="Lipides /100g (g)" hint={infoEntryFood ? `générique : ${infoEntryFood.fat}g` : undefined}>
            <Input type="number" min="0" step="0.1" value={infoEntry.fat} onChange={(e) => setInfoEntry({ ...infoEntry, fat: e.target.value })} placeholder={infoEntryFood ? String(infoEntryFood.fat) : ''} />
          </Field>
          <Field label="Calories /100g" hint={infoEntryFood ? `générique : ${infoEntryFood.kcal}` : undefined}>
            <Input type="number" min="0" value={infoEntry.kcal} onChange={(e) => setInfoEntry({ ...infoEntry, kcal: e.target.value })} placeholder={infoEntryFood ? String(infoEntryFood.kcal) : ''} />
          </Field>
          <Button type="submit" variant="secondary" className="sm:col-span-1">Corriger</Button>
        </form>
      </div>

      {Object.keys(foodOverrides).length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {Object.entries(foodOverrides).map(([name, ov]) => (
            <li key={name} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
              <span>
                {name} <span className="text-mute text-xs">
                  ({[
                    (ov.unitLabel != null || ov.unitGrams != null) && `unité${ov.unitLabel ? ` "${ov.unitLabel}"` : ''}${ov.unitGrams != null ? ` = ${ov.unitGrams}g` : ''}`,
                    ov.protein != null && `${ov.protein}g P`,
                    ov.carbs != null && `${ov.carbs}g G`,
                    ov.fat != null && `${ov.fat}g L`,
                    ov.kcal != null && `${ov.kcal}kcal`,
                  ].filter(Boolean).join(' · ')})
                </span>
              </span>
              <button onClick={() => deleteFoodOverride(name)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
