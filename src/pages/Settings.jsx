import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, Cloud, CloudOff, Calendar, CalendarOff, Bell, BellOff, Key, Copy, History } from 'lucide-react';
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
import FoodsCard from '../components/settings/FoodsCard';

const STORE_KEYS = ['audax-auth', 'audax-trading', 'audax-learning', 'audax-finance', 'audax-accounting', 'audax-habits', 'audax-skills', 'audax-deals', 'audax-engineering', 'audax-readings', 'audax-health', 'audax-business', 'audax-networking', 'audax-career', 'audax-content', 'audax-focus', 'audax-flashcards', 'audax-fundraising', 'audax-freelance', 'audax-creative', 'audax-realestate', 'audax-synergy-history'];

// Sports programme data lives only in Supabase tables (programStore is not
// persisted locally): the export includes them (own rows only, RLS).
const PROGRAM_TABLES = ['programs', 'program_phases', 'program_sessions', 'program_session_exercises', 'program_session_logs', 'program_weekly_structure', 'program_event_overrides', 'program_locations', 'program_goals', 'program_kpis', 'program_kpi_values', 'program_habit_links', 'program_discipline_daily', 'program_trophies', 'program_alerts', 'program_nutrition_templates'];


export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', primaryDomain: user?.primaryDomain || 'metiersVentures', occupation: user?.occupation || '',
    gender: user?.gender || '', dobYear: user?.dobYear || '', heightCm: user?.heightCm || '',
  });

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

      <FoodsCard />

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
