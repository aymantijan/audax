import { useMemo, useState } from 'react';
import { Trash2, Plus, ScanBarcode, Repeat, RefreshCw, Salad, AlertTriangle } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useAuthStore } from '../../store/authStore';
import { FOOD_DB, getServingOptions, estimateMacros } from '../../utils/nutrition-db';
import { getFoodMicros } from '../../utils/food-micronutrients';
import { todayKey } from '../../utils/formatters';
import { MICRONUTRIENT_LABELS, getMicronutrientRDA, convertMicroValue } from '../../utils/micronutrients';
import { Card, Button, Field, Input, Select, ProgressBar, EmptyState, Badge, Wizard } from '../../components/common/ui';
import BarcodeScanner from '../../components/health/BarcodeScanner';
import { NUTRITION_STEPS } from './nutrition-wizard-steps';

// Scales a per-100g micros map to an actual logged portion.
function scaleMicros(micros, grams) {
  if (!micros) return null;
  const factor = grams / 100;
  return Object.fromEntries(Object.entries(micros).map(([k, v]) => [k, { value: Math.round(v.value * factor * 100) / 100, unit: v.unit }]));
}

// Sums today's logged micros across entries that have them (barcode-scanned
// only), converting each entry's unit to the RDA table's unit for that
// nutrient first — sources (OpenFoodFacts included) don't always report a
// given nutrient in the same unit the RDA table uses.
function sumMicros(entries, rda) {
  const totals = {};
  for (const e of entries) {
    if (!e.micros) continue;
    for (const [k, v] of Object.entries(e.micros)) {
      const targetUnit = rda[k]?.unit || v.unit;
      if (!totals[k]) totals[k] = { value: 0, unit: targetUnit };
      totals[k].value += convertMicroValue(v.value, v.unit, targetUnit);
    }
  }
  return totals;
}

// "63g" doesn't mean much on its own — shows the nearest natural unit too
// ("≈0.4 cuisse") when the food has one defined (getServingOptions), so the
// user can picture the actual portion instead of doing gram math.
function naturalUnitHint(name, grams) {
  const options = getServingOptions(name);
  const serving = options[1]; // index 0 is always the plain "g" option
  if (!serving) return null;
  const count = grams / serving.grams;
  return `≈${Math.round(count * 10) / 10} ${serving.label}${count >= 1.5 ? 's' : ''}`;
}

// Rough daily macro targets derived from the protein target (spec: progress bars
// for Protein/Carbs/Fats/Calories) — carbs/fat/kcal are simple ratios, not a full
// TDEE calculator, since no bodyweight/activity intake exists yet.
function macroTargets(proteinTargetG) {
  const kcalFromProtein = proteinTargetG * 4;
  const kcal = Math.round(kcalFromProtein / 0.3); // assume protein ≈ 30% of calories
  return { protein: proteinTargetG, carbs: Math.round((kcal * 0.4) / 4), fat: Math.round((kcal * 0.3) / 9), kcal };
}

export default function NutritionTracker({ pendingPrompt }) {
  const { nutritionLogs, mealTemplates, proteinTargetG, logMeal, deleteMeal, setProteinTarget, saveMealTemplate, deleteMealTemplate, logMealTemplate, getTodayNutrition, getActiveNutritionPlan, logPlanMeal, getSwapOptionsForItem, swapPlanMealItem, healthProfile, completeHealthProfile, generatePlan, deleteNutritionPlan, getCyclePhaseCoaching } = useHealthStore();
  const user = useAuthStore((s) => s.user);
  const gender = user?.gender;
  const profileComplete = !!(user?.gender && user?.heightCm && user?.dobYear);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState('g');
  const [templateName, setTemplateName] = useState('');
  const [logDate, setLogDate] = useState(todayKey());
  const [scanOpen, setScanOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanQty, setScanQty] = useState(100);
  const [swapFor, setSwapFor] = useState(null); // { mealSlot, itemIndex } | null
  const [microsFor, setMicrosFor] = useState(null); // { mealSlot, itemIndex } | null — which item's micro breakdown is expanded

  const { entries, totals, quality } = getTodayNutrition();
  const activePlan = getActiveNutritionPlan();
  const planDirty = activePlan && healthProfile.lastRecomputedAt && healthProfile.lastRecomputedAt > activePlan.generatedAt;
  const microRDA = useMemo(() => getMicronutrientRDA(gender), [gender]);
  const microTotals = useMemo(() => sumMicros(entries, microRDA), [entries, microRDA]);
  // Prefer the generated plan's real TDEE-based targets over the rough
  // protein-ratio heuristic below, when one exists.
  const targets = activePlan
    ? { protein: activePlan.targetMacros.proteinG, carbs: activePlan.targetMacros.carbsG, fat: activePlan.targetMacros.fatG, kcal: activePlan.targetKcal }
    : macroTargets(proteinTargetG);

  // Iron needs are higher during menstruation (blood loss) — the RDA table
  // already accounts for this (18mg vs 8mg, see micronutrients.js), but a
  // number alone doesn't help someone decide what to actually eat. Surfaces
  // the plan's own best iron sources instead of a generic list, so it's
  // something to act on today, not just informational text.
  const cycleCoaching = gender === 'female' ? getCyclePhaseCoaching() : null;
  const ironHighlights = useMemo(() => {
    if (cycleCoaching?.phase !== 'menstrual' || !activePlan) return [];
    const items = activePlan.sampleMeals.flatMap((m) => m.items.map((it) => ({ ...it, mealSlot: m.mealSlot })));
    return items
      .map((it) => ({ ...it, iron: getFoodMicros(it.name, it.grams)?.iron?.value || 0 }))
      .filter((it) => it.iron > 0)
      .sort((a, b) => b.iron - a.iron)
      .slice(0, 3);
  }, [cycleCoaching?.phase, activePlan]);

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

  const finishNutrition = (data) => {
    completeHealthProfile(data);
    generatePlan();
    setWizardOpen(false);
  };

  const onScannedProduct = (product) => {
    setScannedProduct(product);
    setScanQty(100);
    setScanOpen(false);
  };

  const confirmScannedProduct = () => {
    if (!scannedProduct) return;
    const factor = scanQty / 100;
    logMeal(scannedProduct.name, scanQty, 'g', pendingPrompt?.id, logDate, undefined, {
      grams: scanQty,
      protein: Math.round(scannedProduct.protein * factor * 10) / 10,
      carbs: Math.round(scannedProduct.carbs * factor * 10) / 10,
      fat: Math.round(scannedProduct.fat * factor * 10) / 10,
      kcal: Math.round(scannedProduct.kcal * factor),
      whole: false,
      micros: scaleMicros(scannedProduct.micros, scanQty),
      barcode: scannedProduct.barcode,
    });
    setScannedProduct(null);
  };

  if (wizardOpen) {
    return <Wizard steps={NUTRITION_STEPS} initialData={healthProfile} onComplete={finishNutrition} onCancel={() => setWizardOpen(false)} />;
  }

  return (
    <div className="space-y-6">
      {!profileComplete && (
        <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="shrink-0" />
          Complète ton profil (genre, taille, année de naissance) dans <a href="/settings" className="underline font-medium">Réglages</a> pour générer un plan nutritionnel.
        </div>
      )}

      {!activePlan ? (
        <Card title="Plan nutritionnel">
          <EmptyState>
            <Salad size={24} className="mx-auto mb-2 opacity-50" />
            Pas encore de plan nutritionnel.
            <div className="mt-3"><Button onClick={() => setWizardOpen(true)} disabled={!profileComplete}>Créer mon plan</Button></div>
          </EmptyState>
        </Card>
      ) : planDirty ? (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
          <AlertTriangle size={13} /> Ton profil a changé depuis la génération — régénère si besoin.
        </div>
      ) : null}

      <Card title="Quick Log" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setScanOpen(true)}><span className="flex items-center gap-1.5"><ScanBarcode size={13} /> Scanner un code-barres</span></Button>}>
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

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onProduct={onScannedProduct} />

      {scannedProduct && (
        <Card title="Produit scanné">
          <div className="flex items-start gap-3">
            {scannedProduct.imageUrl && <img src={scannedProduct.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{scannedProduct.name}</div>
              <div className="text-xs text-mute mt-0.5">
                Pour 100g — {scannedProduct.kcal} kcal · {scannedProduct.protein}g P · {scannedProduct.carbs}g G · {scannedProduct.fat}g L
              </div>
              {Object.keys(scannedProduct.micros || {}).length > 0 && (
                <div className="text-[11px] text-mute mt-1">
                  {Object.entries(scannedProduct.micros).slice(0, 6).map(([k, v]) => `${MICRONUTRIENT_LABELS[k] || k}: ${v.value}${v.unit}`).join(' · ')}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-end gap-3 mt-3">
            <Field label="Quantité (g)">
              <Input type="number" min="1" value={scanQty} onChange={(e) => setScanQty(Number(e.target.value) || 0)} className="w-28" />
            </Field>
            <Button onClick={confirmScannedProduct}>Logger ce produit</Button>
            <Button variant="secondary" onClick={() => setScannedProduct(null)}>Annuler</Button>
          </div>
        </Card>
      )}

      {ironHighlights.length > 0 && (
        <Card title="Fer & phase menstruelle">
          <p className="text-sm text-mute mb-2">
            Les pertes de sang augmentent le besoin en fer pendant les règles (RDA à 18mg au lieu de 8mg). Tes meilleures sources dans le plan d'aujourd'hui :
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ironHighlights.map((it, i) => (
              <span key={i} className="text-xs bg-panel border border-line rounded-full px-2.5 py-1">
                {it.name} ({it.mealSlot}) — {it.iron}mg
              </span>
            ))}
          </div>
        </Card>
      )}

      {healthProfile.reminderPrefs?.mealWindows?.length > 0 && (
        <Card title="Timing recommandé">
          <p className="text-sm text-mute">
            Basé sur ton planning de programme : {healthProfile.reminderPrefs.mealWindows.join(' · ')}.
            Répartir les repas sur ces créneaux (plutôt que tout en 1-2 gros repas) aide à la fois la digestion pendant l'entraînement et l'apport régulier en protéines/micronutriments dans la journée.
          </p>
        </Card>
      )}

      {activePlan && (
        <Card title="Plan nutritionnel actif" action={
          <div className="flex items-center gap-2">
            <Badge>{activePlan.targetKcal} kcal/j</Badge>
            <button title="Régénérer" onClick={() => setWizardOpen(true)} className="text-mute hover:text-accent cursor-pointer"><RefreshCw size={13} /></button>
            <button title="Supprimer le plan" onClick={() => deleteNutritionPlan(activePlan.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
          </div>
        }>
          <div className="space-y-2">
            {activePlan.sampleMeals.map((m) => (
              <div key={m.mealSlot} className="bg-surface border border-line rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{m.mealSlot}</span>
                  <Button variant="secondary" className="!px-2 !py-1 text-xs shrink-0" onClick={() => logPlanMeal(m.mealSlot, logDate)}>Logger</Button>
                </div>
                <div className="mt-1.5 space-y-1">
                  {m.items.map((it, i) => {
                    const est = estimateMacros(it.name, it.grams, 'g');
                    const micros = getFoodMicros(it.name, it.grams);
                    const unitHint = naturalUnitHint(it.name, it.grams);
                    const isSwapping = swapFor?.mealSlot === m.mealSlot && swapFor?.itemIndex === i;
                    const isShowingMicros = microsFor?.mealSlot === m.mealSlot && microsFor?.itemIndex === i;
                    return (
                      <div key={i} className="bg-panel border border-line rounded-lg px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0">
                            <span className="font-medium">{it.name}</span>{' '}
                            <span className="text-mute">{it.grams}g{unitHint ? ` (${unitHint})` : ''}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {micros && (
                              <button title="Vitamines & minéraux" onClick={() => setMicrosFor((s) => (isShowingMicros ? null : { mealSlot: m.mealSlot, itemIndex: i }))} className="text-mute hover:text-ink cursor-pointer text-[10px] underline">
                                micros
                              </button>
                            )}
                            {it.category && (
                              <button title="Remplacer" onClick={() => setSwapFor((s) => (isSwapping ? null : { mealSlot: m.mealSlot, itemIndex: i }))} className="text-mute hover:text-ink cursor-pointer">
                                <Repeat size={11} />
                              </button>
                            )}
                          </span>
                        </div>
                        {est && (
                          <div className="text-[10px] text-mute mt-0.5">{est.kcal} kcal · {est.protein}g P · {est.carbs}g G · {est.fat}g L</div>
                        )}
                        {isShowingMicros && micros && (
                          <div className="text-[10px] text-mute mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-line pt-1.5">
                            {Object.entries(micros).filter(([, v]) => v.value > 0).map(([k, v]) => (
                              <span key={k}>{MICRONUTRIENT_LABELS[k] || k}: {v.value}{v.unit}</span>
                            ))}
                          </div>
                        )}
                        {isSwapping && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 border-t border-line pt-1.5">
                            {getSwapOptionsForItem(it).map((alt) => (
                              <button
                                key={alt.name}
                                onClick={() => { swapPlanMealItem(activePlan.id, m.mealSlot, i, alt.name); setSwapFor(null); }}
                                className="text-xs px-2 py-1 rounded-full bg-surface border border-line hover:border-accent-primary cursor-pointer"
                              >
                                {alt.name}
                              </button>
                            ))}
                            {!getSwapOptionsForItem(it).length && <span className="text-xs text-mute">Aucune alternative pour ce budget.</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Object.keys(microTotals).length > 0 && (
        <Card title="Micronutriments du jour">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries(microRDA).map(([key, rda]) => {
              const logged = microTotals[key]?.value ?? 0;
              if (!logged) return null;
              return (
                <div key={key}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>{MICRONUTRIENT_LABELS[key] || key}</span>
                    <span className="text-mute">{Math.round(logged * 100) / 100}{rda.unit} / {rda.value}{rda.unit}</span>
                  </div>
                  <ProgressBar value={logged} max={rda.value} color={logged >= rda.value ? 'var(--success)' : 'var(--accent-primary)'} />
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-mute mt-3">Basé sur les aliments scannés (code-barres) et les repas du plan nutritionnel loggés depuis "Plan nutritionnel actif" — un aliment tapé à la main dans Quick Log n'a pas de données vitamines/minéraux.</p>
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
