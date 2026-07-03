import { useRef, useState } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useFinanceStore } from '../store/financeStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useDealsStore } from '../store/dealsStore';
import { toast } from '../store/uiStore';
import { markDataSeeded } from '../services/storage';
import { CAREER_GOALS } from '../utils/constants';
import { Card, Button, Field, Input, Select } from '../components/common/ui';

const STORE_KEYS = ['audax-auth', 'audax-trading', 'audax-learning', 'audax-finance', 'audax-habits', 'audax-skills', 'audax-deals', 'audax-synergy-history'];

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', primaryDomain: user?.primaryDomain || 'trading', careerGoal: user?.careerGoal || 'Hybrid' });
  const fileRef = useRef(null);

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
        </div>
        <Button
          className="mt-4"
          onClick={() => {
            updateProfile(form);
            toast('Profile saved', 'success');
          }}
        >
          Save profile
        </Button>
      </Card>

      <Card title="Data (local-first)">
        <p className="text-sm text-mute mb-4">
          All data lives in this browser's localStorage. Export regularly — a JSON backup restores everything, including skill XP and synergy history. Cloud sync (Firebase) is planned as an optional Phase 4 layer.
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
