import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, Cloud, CloudOff, Calendar, CalendarOff, Bell, BellOff, Plus, Key, Copy, History } from 'lucide-react';
import { FOOD_DB, getServingOptions, lookupFood } from '../utils/nutrition-db';
import { MOROCCO_FOOD_COST_TIERS } from '../utils/morocco-food-budget';
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush, sendTestPush } from '../services/push';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { listBackups } from '../services/sync-base-store';
import { getSession } from '../services/auth-supabase';
import { getApiKeyStatus, createOrRotateApiKey, revokeApiKey } from '../services/api-keys';
import { isGoogleCalendarConfigured, connectGoogleCalendar, disconnectGoogleCalendar } from '../services/google-calendar';
import { useGoogleCalendarStatus } from '../hooks/useGoogleCalendarStatus';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useFinanceStore } from '../store/financeStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useDealsStore } from '../store/dealsStore';
import { useEngineeringStore } from '../store/engineeringStore';
import { useReadingsStore } from '../store/readingsStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useBusinessStore } from '../store/businessStore';
import { useNetworkingStore } from '../store/networkingStore';
import { useCareerStore } from '../store/careerStore';
import { useContentStore } from '../store/contentStore';
import { useFocusStore } from '../store/focusStore';
import { useFundraisingStore } from '../store/fundraisingStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useCreativeStore } from '../store/creativeStore';
import { useRealEstateStore } from '../store/realEstateStore';
import { toast } from '../store/uiStore';
import { markDataSeeded } from '../services/storage';
import { OCCUPATION_SUGGESTIONS } from '../utils/occupations';
import { Card, Button, Field, Input, Select } from '../components/common/ui';

const STORE_KEYS = ['audax-auth', 'audax-trading', 'audax-learning', 'audax-finance', 'audax-accounting', 'audax-habits', 'audax-skills', 'audax-deals', 'audax-engineering', 'audax-readings', 'audax-health', 'audax-business', 'audax-networking', 'audax-career', 'audax-content', 'audax-focus', 'audax-flashcards', 'audax-fundraising', 'audax-freelance', 'audax-creative', 'audax-realestate', 'audax-synergy-history'];

// Sports programme data lives only in Supabase tables (programStore is not
// persisted locally): the export includes them (own rows only, RLS).
const PROGRAM_TABLES = ['programs', 'program_phases', 'program_sessions', 'program_session_exercises', 'program_session_logs', 'program_weekly_structure', 'program_event_overrides', 'program_locations', 'program_goals', 'program_kpis', 'program_kpi_values', 'program_habit_links', 'program_discipline_daily', 'program_trophies', 'program_alerts', 'program_nutrition_templates'];

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
    name: user?.name || '', email: user?.email || '', primaryDomain: user?.primaryDomain || 'metiersVentures', occupation: user?.occupation || '',
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
  const [safetyCopies, setSafetyCopies] = useState([]);
  useEffect(() => {
    let owner = null;
    try { owner = JSON.parse(localStorage.getItem('audax-data-owner') || 'null'); } catch { owner = null; }
    if (owner) listBackups(owner).then(setSafetyCopies).catch(() => {});
  }, []);
  // Put back the local copy taken before the switch to the new sync (F2):
  // written into the stores' saved state, then the reload syncs it.
  const restoreSafetyCopies = () => {
    if (!safetyCopies.length) return;
    if (!confirm('Remettre les données telles qu’elles étaient sur cet appareil avant la nouvelle synchronisation ? Les modifications faites depuis dans ces sections seront remplacées.')) return;
    for (const b of safetyCopies) {
      const key = `audax-${b.name}`;
      if (!STORE_KEYS.includes(key) || !b.data) continue;
      let version = 0;
      try { version = JSON.parse(localStorage.getItem(key) || '{}').version ?? 0; } catch { version = 0; }
      localStorage.setItem(key, JSON.stringify({ state: b.data, version }));
    }
    markDataSeeded();
    toast('Copie de sécurité restaurée, rechargement…', 'success');
    setTimeout(() => window.location.reload(), 800);
  };
  // Cloud status: 'active' (Supabase session live), 'offline' (configured, no session), 'unconfigured'
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? 'checking' : 'unconfigured');
  const [cloudUserId, setCloudUserId] = useState(null); // needed by the API Access card below — cloudStatus alone doesn't carry the id
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then((s) => { setCloudStatus(s?.user ? 'active' : 'offline'); setCloudUserId(s?.user?.id || null); });
  }, []);

  // API Access (Finance export key — see services/api-keys.js + api/finance-data.js)
  const [apiKeyStatus, setApiKeyStatus] = useState(null); // { createdAt, lastUsedAt } | null | undefined(loading)
  const [newApiKey, setNewApiKey] = useState(''); // only ever populated right after (re)generating — never re-fetched
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  useEffect(() => {
    if (!cloudUserId) return;
    getApiKeyStatus(cloudUserId).then(setApiKeyStatus);
  }, [cloudUserId]);
  const generateApiKey = async () => {
    setApiKeyBusy(true);
    try {
      const key = await createOrRotateApiKey(cloudUserId);
      setNewApiKey(key);
      setApiKeyStatus(await getApiKeyStatus(cloudUserId));
      toast('Clé créée : copie-la maintenant, elle ne sera plus affichée', 'success');
    } catch (e) {
      toast(`Impossible de créer la clé : ${e.message}`, 'error');
    } finally {
      setApiKeyBusy(false);
    }
  };
  const revokeApiKeyNow = async () => {
    if (!confirm('Révoquer cette clé ? Tout ce qui l’utilise (par exemple une conversation avec une IA) cessera de fonctionner jusqu’à ce que tu en crées une nouvelle.')) return;
    setApiKeyBusy(true);
    try {
      await revokeApiKey(cloudUserId);
      setApiKeyStatus(null);
      setNewApiKey('');
      toast('Clé révoquée', 'info');
    } catch (e) {
      toast(`Impossible de révoquer la clé : ${e.message}`, 'error');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const gcalConfigured = isGoogleCalendarConfigured();
  const { connected: gcalConnected, expiresAt: gcalExpiresAt } = useGoogleCalendarStatus();
  const [gcalBusy, setGcalBusy] = useState(false);
  const connectGcal = async () => {
    setGcalBusy(true);
    try {
      await connectGoogleCalendar();
      toast('Google Agenda connecté', 'success');
    } catch (err) {
      toast(`Connexion à Google Agenda impossible : ${err.message}`, 'error');
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
        toast('Notifications désactivées sur cet appareil', 'info');
      } else {
        await subscribeToPush();
        setPushSubscribed(true);
        toast('Notifications activées sur cet appareil', 'success');
      }
    } catch (err) {
      toast(`Notifications : ${err.message}`, 'error');
    } finally {
      setPushBusy(false);
    }
  };
  const testPush = async () => {
    setPushBusy(true);
    try {
      const r = await sendTestPush();
      toast(`Notification de test envoyée à ${r.sent} appareil(s)${r.failed ? `, ${r.failed} en échec` : ''}`, r.sent ? 'success' : 'warning');
    } catch (err) {
      toast(`Échec du test : ${err.message}`, 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const exportJSON = async () => {
    const data = {
      app: 'AUDAX',
      version: 1,
      exportedAt: new Date().toISOString(),
      stores: Object.fromEntries(STORE_KEYS.map((k) => [k, JSON.parse(localStorage.getItem(k) || 'null')])),
    };
    // Signed in: add the sports programme (Supabase-only data). Read-only here;
    // restoring it from a file is not supported yet (the file keeps it safe).
    if (isSupabaseConfigured && (await getSession())) {
      const cloudTables = {};
      for (const t of PROGRAM_TABLES) {
        const { data: rows, error } = await supabase.from(t).select('*');
        if (!error) cloudTables[t] = rows;
      }
      data.cloudTables = cloudTables;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vaudax-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Sauvegarde téléchargée', 'success');
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== 'AUDAX' || !data.stores) throw new Error('ce fichier n’est pas une sauvegarde Vaudax');
        for (const [key, value] of Object.entries(data.stores)) {
          if (STORE_KEYS.includes(key) && value !== null) localStorage.setItem(key, JSON.stringify(value));
        }
        markDataSeeded(); // protect the restored data from the one-time demo wipe on reload
        toast('Sauvegarde restaurée, rechargement…', 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        toast(`Restauration impossible : ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetAll = () => {
    if (!confirm('Cela supprime définitivement TOUTES les données de cet appareil (trades, cours, habitudes, compétences, finances). Télécharge une sauvegarde avant. Continuer ?')) return;
    useTradingStore.getState().resetAll();
    useLearningStore.getState().resetAll();
    useFinanceStore.getState().resetAll();
    useHabitStore.getState().resetAll();
    useSkillStore.getState().resetAll();
    useDealsStore.getState().resetAll();
    useEngineeringStore.getState().resetAll();
    useReadingsStore.getState().resetAll();
    useAccountingStore.getState().resetAll();
    useHealthStore.getState().resetAll();
    useBusinessStore.getState().resetAll();
    useNetworkingStore.getState().resetAll();
    useCareerStore.getState().resetAll();
    useContentStore.getState().resetAll();
    useFocusStore.getState().resetAll();
    useFundraisingStore.getState().resetAll();
    useFreelanceStore.getState().resetAll();
    useCreativeStore.getState().resetAll();
    useRealEstateStore.getState().resetAll();
    localStorage.removeItem('audax-synergy-history');
    toast('Toutes les données ont été effacées', 'warning');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-mute text-sm mt-1">Profil, données et préférences.</p>
      </div>

      <Card title="Profil">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Prénom et nom">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Ce qui compte le plus pour toi" hint="Pèse davantage dans ton score global (75 %).">
            <Select
              value={form.primaryDomain}
              onChange={(e) => setForm({ ...form, primaryDomain: e.target.value })}
              options={[
                { value: 'learning', label: 'Études et apprentissage' },
                { value: 'finance', label: 'Argent et finances' },
                { value: 'health', label: 'Santé et forme' },
                { value: 'metiersVentures', label: 'Métier, entreprise et trading' },
                { value: 'careerDevelopment', label: 'Carrière et réseau' },
                { value: 'growthOutput', label: 'Progression et création' },
              ]}
            />
          </Field>
          <Field label="Métier ou domaine (facultatif)" hint="Écris librement ou choisis une suggestion. Affiché sur ton tableau de bord et dans le classement.">
            <Input list="occupation-suggestions" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="Ex. étudiant·e, infirmier·e, développeur·se…" />
            <datalist id="occupation-suggestions">{OCCUPATION_SUGGESTIONS.map((o) => <option key={o} value={o} />)}</datalist>
          </Field>
          <Field label="Sexe" hint="Adapte la partie Santé (onglet Cycle ou Performance, besoins caloriques).">
            <Select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              options={[{ value: '', label: 'Choisir…' }, { value: 'female', label: 'Femme' }, { value: 'male', label: 'Homme' }]}
            />
          </Field>
          <Field label="Année de naissance" hint="Sert aux calculs de la partie Santé (métabolisme, besoins caloriques).">
            <Input type="number" min="1920" max={new Date().getFullYear()} value={form.dobYear} onChange={(e) => setForm({ ...form, dobYear: e.target.value })} placeholder="ex. 1998" />
          </Field>
          <Field label="Taille (cm)" hint="Sert aux calculs de la partie Santé (métabolisme, composition corporelle).">
            <Input type="number" min="100" max="250" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={() => {
            if (!form.gender) return toast('Choisis une option pour « Sexe » avant d’enregistrer.', 'warning');
            updateProfile({
              ...form,
              dobYear: form.dobYear ? Number(form.dobYear) : null,
              heightCm: form.heightCm ? Number(form.heightCm) : null,
            });
            toast('Profil enregistré', 'success');
          }}
        >
          Enregistrer le profil
        </Button>
      </Card>

      <Card title="Sections visibles">
        <p className="text-sm text-mute mb-3">Chaque section peut être masquée de la navigation si tu ne t'en sers pas — rien n'est supprimé, juste caché.</p>
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'trading', label: 'Trading', default: true },
            { key: 'pe', label: 'Private equity (deals)', default: true },
            { key: 'business', label: 'Projets business (et projets perso)', default: true },
            { key: 'engineering', label: 'Ingénierie', default: false },
            { key: 'career', label: 'Carrière (candidatures, profil & CV, réseau, contenu)', default: false, keys: ['career', 'networking', 'content'] },
            { key: 'focus', label: 'Deep Work', default: false },
            { key: 'fundraising', label: 'Levée de fonds', default: false },
            { key: 'freelance', label: 'Freelance', default: false },
            { key: 'creative', label: 'Création', default: false },
            { key: 'realEstate', label: 'Immobilier', default: false },
          ].map((m) => (
            <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={m.keys ? m.keys.some((k) => user?.enabledModules?.[k]) : user?.enabledModules?.[m.key] ?? m.default}
                onChange={(e) => updateProfile({ enabledModules: { ...(user?.enabledModules ?? { trading: true, pe: true, business: true, engineering: false, networking: false, career: false, content: false, focus: false, fundraising: false, freelance: false, creative: false, realEstate: false }), ...Object.fromEntries((m.keys || [m.key]).map((k) => [k, e.target.checked])) } })}
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

      <Card title="Synchronisation">
        <div className="flex items-start gap-3">
          {cloudStatus === 'active' ? (
            <Cloud size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
          ) : (
            <CloudOff size={20} className="text-mute shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            {cloudStatus === 'active' && (
              <>
                <span className="font-medium" style={{ color: 'var(--success)' }}>Synchronisation active</span>
                <p className="text-mute mt-1">Chaque modification est enregistrée sur ton compte en temps réel et te suit sur tous tes appareils. Cet appareil garde aussi sa propre copie, utilisable hors connexion.</p>
              </>
            )}
            {cloudStatus === 'offline' && (
              <>
                <span className="font-medium" style={{ color: 'var(--warning)' }}>Non connecté à ton compte</span>
                <p className="text-mute mt-1">Tes données restent sur cet appareil uniquement. Connecte-toi depuis l’écran d’accueil pour les retrouver sur tous tes appareils.</p>
              </>
            )}
            {cloudStatus === 'unconfigured' && (
              <>
                <span className="font-medium text-mute">Synchronisation indisponible</span>
                <p className="text-mute mt-1">Cette version fonctionne uniquement sur l’appareil.</p>
              </>
            )}
            {cloudStatus === 'checking' && <span className="text-mute">Vérification de la connexion…</span>}
          </div>
        </div>
      </Card>

      {cloudStatus === 'active' && (
        <Card title="Accès à tes données (clé API)">
          <div className="flex items-start gap-3 mb-3">
            <Key size={20} className="shrink-0 mt-0.5 text-mute" />
            <div className="text-sm flex-1 min-w-0">
              <p className="text-mute">
                Crée une clé personnelle pour donner accès à tes données à un outil externe (par exemple une IA, avec l’une de ces adresses). La clé ne donne accès qu’à ton compte, en lecture seule, et se révoque à tout moment.
              </p>
              <ul className="text-xs text-mute mt-2 space-y-1">
                <li><code className="bg-surface px-1 py-0.5 rounded">{window.location.origin}/api/account-data?key=TA_CLE</code> : tout (trading, finances, santé, habitudes, deals, études, compétences…)</li>
                <li><code className="bg-surface px-1 py-0.5 rounded">{window.location.origin}/api/finance-data?key=TA_CLE</code> : finances uniquement</li>
              </ul>

              {newApiKey && (
                <div className="mt-3 bg-surface border border-accent/40 rounded-lg p-3">
                  <p className="text-xs text-warning mb-2">Copie-la maintenant : elle ne sera plus affichée.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate text-xs bg-card border border-line rounded px-2 py-1.5">{newApiKey}</code>
                    <button
                      className="shrink-0 text-mute hover:text-accent cursor-pointer"
                      title="Copier"
                      onClick={() => { navigator.clipboard.writeText(newApiKey); toast('Copiée', 'success'); }}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>
              )}

              {apiKeyStatus && !newApiKey && (
                <p className="text-xs text-mute mt-3">
                  Clé créée le {new Date(apiKeyStatus.createdAt).toLocaleDateString('fr-FR')}
                  {apiKeyStatus.lastUsedAt ? ` · dernière utilisation ${new Date(apiKeyStatus.lastUsedAt).toLocaleString('fr-FR')}` : ' · jamais utilisée'}. Elle n’est plus affichée : crée-en une nouvelle si tu l’as perdue.
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <Button className="!px-3 !py-1.5 text-xs" disabled={apiKeyBusy} onClick={generateApiKey}>
                  {apiKeyStatus ? 'Recréer la clé' : 'Créer une clé'}
                </Button>
                {apiKeyStatus && (
                  <Button variant="danger" className="!px-3 !py-1.5 text-xs" disabled={apiKeyBusy} onClick={revokeApiKeyNow}>Révoquer</Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card title="Google Agenda">
        <div className="flex items-start gap-3">
          {gcalConnected ? (
            <Calendar size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
          ) : (
            <CalendarOff size={20} className="text-mute shrink-0 mt-0.5" />
          )}
          <div className="text-sm flex-1">
            {!gcalConfigured && (
              <>
                <span className="font-medium text-mute">Indisponible</span>
                <p className="text-mute mt-1">La connexion à Google Agenda n’est pas activée sur cette version.</p>
              </>
            )}
            {gcalConfigured && gcalConnected && (
              <>
                <span className="font-medium" style={{ color: 'var(--success)' }}>Connecté</span>
                <p className="text-mute mt-1">
                  Connexion valable jusqu’à {new Date(gcalExpiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} : il faudra te reconnecter ensuite.
                </p>
                <Button variant="secondary" className="mt-3" onClick={disconnectGoogleCalendar}>Déconnecter</Button>
              </>
            )}
            {gcalConfigured && !gcalConnected && (
              <>
                <span className="font-medium text-mute">Non connecté</span>
                <p className="text-mute mt-1">Connecte ton agenda pour y placer directement tâches, cours, habitudes ou séances.</p>
                <Button className="mt-3" onClick={connectGcal} disabled={gcalBusy}>{gcalBusy ? '…' : 'Connecter Google Agenda'}</Button>
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
                <span className="font-medium text-mute">Non disponible</span>
                <p className="text-mute mt-1">Ce navigateur ne gère pas les notifications. Installe VAUDAX sur l’écran d’accueil de ton téléphone.</p>
              </>
            )}
            {isPushSupported() && pushSubscribed === null && <span className="text-mute">Vérification…</span>}
            {isPushSupported() && pushSubscribed === true && (
              <>
                <span className="font-medium" style={{ color: 'var(--success)' }}>Activées sur cet appareil</span>
                <p className="text-mute mt-1">
                  Les rappels de cours et de santé arrivent même quand l’application est fermée. À activer sur chaque appareil. « Envoyer un test » vérifie que tout fonctionne.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" onClick={togglePush} disabled={pushBusy}>{pushBusy ? '…' : 'Désactiver'}</Button>
                  <Button onClick={testPush} disabled={pushBusy}>{pushBusy ? '…' : 'Envoyer un test'}</Button>
                </div>
              </>
            )}
            {isPushSupported() && pushSubscribed === false && (
              <>
                <span className="font-medium text-mute">Désactivées</span>
                <p className="text-mute mt-1">Reçois de vraies notifications sur cet appareil, même quand l’application est fermée.</p>
                <Button className="mt-3" onClick={togglePush} disabled={pushBusy}>{pushBusy ? '…' : 'Activer les notifications'}</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Tes données">
        <p className="text-sm text-mute mb-4">
          Tes données sont d’abord sur cet appareil, puis synchronisées sur ton compte quand tu es connecté. Télécharge une sauvegarde de temps en temps : elle contient tout (y compris ton programme sportif si tu es connecté) et se restaure en un clic.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportJSON}>
            <span className="flex items-center gap-2"><Download size={15} /> Télécharger une sauvegarde</span>
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <span className="flex items-center gap-2"><Upload size={15} /> Restaurer une sauvegarde</span>
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importJSON} />
        </div>
        {safetyCopies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line text-sm">
            <p className="text-mute">
              <b className="text-ink">Copie de sécurité automatique</b> : prise sur cet appareil le {new Date(safetyCopies[safetyCopies.length - 1].at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}, juste avant la nouvelle synchronisation ({safetyCopies.length} section{safetyCopies.length > 1 ? 's' : ''}). À n’utiliser que si des données ont disparu.
            </p>
            <Button variant="secondary" className="mt-3" onClick={restoreSafetyCopies}>
              <span className="flex items-center gap-2"><History size={15} /> Restaurer la copie de sécurité</span>
            </Button>
          </div>
        )}
      </Card>

      <Card title="Zone sensible">
        <Button variant="danger" onClick={resetAll}>
          <span className="flex items-center gap-2"><Trash2 size={15} /> Effacer toutes les données de cet appareil</span>
        </Button>
      </Card>
    </div>
  );
}
