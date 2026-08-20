import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, Cloud, CloudOff, Calendar, CalendarOff, Bell, BellOff, Plus } from 'lucide-react';
import { FOOD_DB, getServingOptions, lookupFood } from '../utils/nutrition-db';
import { MOROCCO_FOOD_COST_TIERS } from '../utils/morocco-food-budget';
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush, sendTestPush } from '../services/push';
import { isSupabaseConfigured } from '../services/supabase';
import { getSession } from '../services/auth-supabase';
import { isGoogleCalendarConfigured, connectGoogleCalendar, disconnectGoogleCalendar } from '../services/google-calendar';
import { useGoogleCalendarStatus } from '../hooks/useGoogleCalendarStatus';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useFinanceStore } from '../store/financeStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useDealsStore } from '../store/dealsStore';
import { useReadingsStore } from '../store/readingsStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useBusinessStore } from '../store/businessStore';
import { toast } from '../store/uiStore';
import { markDataSeeded } from '../services/storage';
import { CAREER_GOALS } from '../utils/constants';
import { Card, Button, Field, Input, Select } from '../components/common/ui';

const STORE_KEYS = ['audax-auth', 'audax-trading', 'audax-learning', 'audax-finance', 'audax-accounting', 'audax-habits', 'audax-skills', 'audax-deals', 'audax-readings', 'audax-health', 'audax-business', 'audax-synergy-history'];

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

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', primaryDomain: user?.primaryDomain || 'trading', careerGoal: user?.careerGoal || 'Hybrid',
    gender: user?.gender || '', dobYear: user?.dobYear || '', heightCm: user?.heightCm || '',
  });

  // ─────────── Mes aliments & prix ───────────
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
  const fileRef = useRef(null);
  // Cloud status: 'active' (Supabase session live), 'offline' (configured, no session), 'unconfigured'
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? 'checking' : 'unconfigured');
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then((s) => setCloudStatus(s?.user ? 'active' : 'offline'));
  }, []);

  const gcalConfigured = isGoogleCalendarConfigured();
  const { connected: gcalConnected, expiresAt: gcalExpiresAt } = useGoogleCalendarStatus();
  const [gcalBusy, setGcalBusy] = useState(false);
  const connectGcal = async () => {
    setGcalBusy(true);
    try {
      await connectGoogleCalendar();
      toast('Google Calendar connected', 'success');
    } catch (err) {
      toast(`Google Calendar connect failed: ${err.message}`, 'error');
    } finally {
      setGcalBusy(false);
    }
  };

  // Push notifications: null = still checking, false = not subscribed on this
  // device, true = subscribed. Checked fresh on mount since it's real browser
  // state (PushManager), not app state — a subscription made on another
  // device/browser wouldn't show here, which is correct (Push is per-device).
  const [pushSubscribed, setPushSubscribed] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (!isPushSupported()) return setPushSubscribed(false);
    getPushSubscription().then((sub) => setPushSubscribed(!!sub));
  }, []);
  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        toast('Push notifications disabled', 'info');
      } else {
        await subscribeToPush();
        setPushSubscribed(true);
        toast('Push notifications enabled', 'success');
      }
    } catch (err) {
      toast(`Push notifications: ${err.message}`, 'error');
    } finally {
      setPushBusy(false);
    }
  };
  const testPush = async () => {
    setPushBusy(true);
    try {
      const r = await sendTestPush();
      toast(`Test push sent to ${r.sent} device(s)${r.failed ? `, ${r.failed} failed` : ''}`, r.sent ? 'success' : 'warning');
    } catch (err) {
      toast(`Test push failed: ${err.message}`, 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const exportJSON = () => {
    const data = {
      app: 'AUDAX',
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: Object.fromEntries(STORE_KEYS.map((k) => [k, JSON.parse(localStorage.getItem(k) || 'null')])),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audax-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exported', 'success');
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== 'AUDAX' || !data.stores) throw new Error('Not an AUDAX backup');
        for (const [key, value] of Object.entries(data.stores)) {
          if (STORE_KEYS.includes(key) && value !== null) localStorage.setItem(key, JSON.stringify(value));
        }
        markDataSeeded(); // protect the restored data from the one-time demo wipe on reload
        toast('Backup imported — reloading…', 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetAll = () => {
    if (!confirm('This permanently deletes ALL local data (trades, courses, habits, skills, finances). Export a backup first. Continue?')) return;
    useTradingStore.getState().resetAll();
    useLearningStore.getState().resetAll();
    useFinanceStore.getState().resetAll();
    useHabitStore.getState().resetAll();
    useSkillStore.getState().resetAll();
    useDealsStore.getState().resetAll();
    useReadingsStore.getState().resetAll();
    useAccountingStore.getState().resetAll();
    useHealthStore.getState().resetAll();
    useBusinessStore.getState().resetAll();
    localStorage.removeItem('audax-synergy-history');
    toast('All data reset', 'warning');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-mute text-sm mt-1">Profile, data, and preferences.</p>
      </div>

      <Card title="Profile">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Primary domain" hint="75% weight in composite synergy.">
            <Select
              value={form.primaryDomain}
              onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
              options={['trading', 'learning', 'finance', 'health', 'growth']}
            />
          </Field>
          <Field label="Career goal" hint="Focuses the skill tree & deals.">
            <Select
              value={form.careerGoal}
              onChange={(e) => setForm({ ...form, careerGoal: e.target.value })}
              options={CAREER_GOALS}
            />
          </Field>
          <Field label="Gender" hint="Shows/hides the Cycle (female) / Performance (male) tabs in Health.">
            <Select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              options={[{ value: '', label: 'Select…' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
            />
          </Field>
          <Field label="Birth year" hint="Used for BMR/TDEE and age-based estimates in Health.">
            <Input type="number" min="1920" max={new Date().getFullYear()} value={form.dobYear} onChange={(e) => setForm({ ...form, dobYear: e.target.value })} placeholder="e.g. 1998" />
          </Field>
          <Field label="Height (cm)" hint="Used for BMR/TDEE and body-composition estimates in Health.">
            <Input type="number" min="100" max="250" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={() => {
            if (!form.gender) return toast('Select a gender before saving.', 'warning');
            updateProfile({
              ...form,
              dobYear: form.dobYear ? Number(form.dobYear) : null,
              heightCm: form.heightCm ? Number(form.heightCm) : null,
            });
            toast('Profile saved', 'success');
          }}
        >
          Save profile
        </Button>
      </Card>

      <Card title="Sections visibles">
        <p className="text-sm text-mute mb-3">Trading et Deals peuvent être masqués de la navigation si tu ne t'en sers pas — rien n'est supprimé, juste caché.</p>
        <div className="flex flex-wrap gap-3">
          {[{ key: 'trading', label: 'Trading' }, { key: 'deals', label: 'Deals' }].map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={user?.enabledModules?.[m.key] ?? true}
                onChange={(e) => updateProfile({ enabledModules: { ...(user?.enabledModules ?? { trading: true, deals: true }), [m.key]: e.target.checked } })}
                className="cursor-pointer"
              />
              {m.label}
            </label>
          ))}
        </div>
      </Card>

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
              <Input list="all-foods" value={priceEntry.name} onChange={(e) => setPriceEntry({ ...priceEntry, name: e.target.value })} placeholder="ex. Chicken thigh" />
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
              <Input list="all-foods" value={infoEntry.name} onChange={(e) => setInfoEntry({ ...infoEntry, name: e.target.value })} placeholder="ex. Sardines (canned)" />
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

      <Card title="Cloud Sync">
        <div className="flex items-start gap-3">
          {cloudStatus === 'active' ? (
            <Cloud size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
          ) : (
            <CloudOff size={20} className="text-mute shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            {cloudStatus === 'active' && (
              <>
                <span className="font-medium" style={{ color: 'var(--success)' }}>Sync active</span>
                <p className="text-mute mt-1">Every change is saved to the cloud in real time and follows you across devices. Local storage remains the instant source of truth.</p>
              </>
            )}
            {cloudStatus === 'offline' && (
              <>
                <span className="font-medium" style={{ color: 'var(--warning)' }}>Not signed in to the cloud</span>
                <p className="text-mute mt-1">Data is stored locally only. Log in with your cloud account on the Welcome screen to enable cross-device sync.</p>
              </>
            )}
            {cloudStatus === 'unconfigured' && (
              <>
                <span className="font-medium text-mute">Cloud not configured</span>
                <p className="text-mute mt-1">This build runs fully local. Add Supabase credentials to enable sync.</p>
              </>
            )}
            {cloudStatus === 'checking' && <span className="text-mute">Checking cloud session…</span>}
          </div>
        </div>
      </Card>

      <Card title="Google Calendar">
        <div className="flex items-start gap-3">
          {gcalConnected ? (
            <Calendar size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
          ) : (
            <CalendarOff size={20} className="text-mute shrink-0 mt-0.5" />
          )}
          <div className="text-sm flex-1">
            {!gcalConfigured && (
              <>
                <span className="font-medium text-mute">Not configured</span>
                <p className="text-mute mt-1">Set VITE_GOOGLE_CLIENT_ID (see .env.example) to enable "Schedule" buttons on deal tasks, courses, habits, and workouts.</p>
              </>
            )}
            {gcalConfigured && gcalConnected && (
              <>
                <span className="font-medium" style={{ color: 'var(--success)' }}>Connected</span>
                <p className="text-mute mt-1">
                  Session active until {new Date(gcalExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — you'll be asked to reconnect after that.
                </p>
                <Button variant="secondary" className="mt-3" onClick={disconnectGoogleCalendar}>Disconnect</Button>
              </>
            )}
            {gcalConfigured && !gcalConnected && (
              <>
                <span className="font-medium text-mute">Not connected</span>
                <p className="text-mute mt-1">Connect to schedule tasks, courses, habits, or workouts straight into your calendar.</p>
                <Button className="mt-3" onClick={connectGcal} disabled={gcalBusy}>{gcalBusy ? '…' : 'Connect Google Calendar'}</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Notifications">
        <div className="flex items-start gap-3">
          {pushSubscribed ? (
            <Bell size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
          ) : (
            <BellOff size={20} className="text-mute shrink-0 mt-0.5" />
          )}
          <div className="text-sm flex-1">
            {!isPushSupported() && (
              <>
                <span className="font-medium text-mute">Not supported</span>
                <p className="text-mute mt-1">This browser doesn't support push notifications.</p>
              </>
            )}
            {isPushSupported() && pushSubscribed === null && <span className="text-mute">Checking…</span>}
            {isPushSupported() && pushSubscribed === true && (
              <>
                <span className="font-medium" style={{ color: 'var(--success)' }}>Enabled on this device</span>
                <p className="text-mute mt-1">
                  This is per-device — reminders (habit check-ins, trading alerts, overdue échéances) still need the app to have decided to send one; there's no server-side scheduler yet, so use "Send a test" to confirm the pipeline works.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" onClick={togglePush} disabled={pushBusy}>{pushBusy ? '…' : 'Disable'}</Button>
                  <Button onClick={testPush} disabled={pushBusy}>{pushBusy ? '…' : 'Send a test'}</Button>
                </div>
              </>
            )}
            {isPushSupported() && pushSubscribed === false && (
              <>
                <span className="font-medium text-mute">Not enabled</span>
                <p className="text-mute mt-1">Get a real OS notification on this device instead of relying on a browser tab staying open.</p>
                <Button className="mt-3" onClick={togglePush} disabled={pushBusy}>{pushBusy ? '…' : 'Enable push notifications'}</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Data (local-first)">
        <p className="text-sm text-mute mb-4">
          All data lives in this browser's localStorage and syncs to the cloud when you're signed in. Export regularly — a JSON backup restores everything, including skill XP and synergy history.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportJSON}>
            <span className="flex items-center gap-2"><Download size={15} /> Export JSON backup</span>
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <span className="flex items-center gap-2"><Upload size={15} /> Import backup</span>
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importJSON} />
        </div>
      </Card>

      <Card title="Danger Zone">
        <Button variant="danger" onClick={resetAll}>
          <span className="flex items-center gap-2"><Trash2 size={15} /> Reset all data</span>
        </Button>
      </Card>
    </div>
  );
}
