import { useEffect, useRef, useState } from 'react';
import { Download, Upload, Trash2, Cloud, CloudOff, Calendar, CalendarOff, Bell, BellOff } from 'lucide-react';
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

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', primaryDomain: user?.primaryDomain || 'trading', careerGoal: user?.careerGoal || 'Hybrid',
    gender: user?.gender || '', dobYear: user?.dobYear || '', heightCm: user?.heightCm || '',
  });
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
