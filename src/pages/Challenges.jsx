import { useCallback, useEffect, useState } from 'react';
import { Swords, Plus, Copy, LogOut, Trash2, Trophy, Loader2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { listChallenges, createChallenge, joinChallenge, leaveChallenge, deleteChallenge, pushMyScores } from '../services/challenges';
import { CHALLENGE_METRICS, metricOf, rankMembers } from '../utils/challenges';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { toast } from '../store/uiStore';
import { Card, Button, Field, Input, Select, Modal, EmptyState, Badge, IconButton } from '../components/common/ui';

const addDays = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };

function ChallengeCard({ c, userId, onChange }) {
  const m = metricOf(c.metric);
  const today = todayKey();
  const status = c.starts > today ? 'à venir' : c.ends < today ? 'terminé' : 'en cours';
  const ranked = rankMembers(c.challenge_members || []);
  const mine = c.owner === userId;
  const copy = async () => {
    try { await navigator.clipboard.writeText(c.code); toast('Code copié : envoie-le à tes amis.', 'success'); } catch { toast(`Code : ${c.code}`, 'info'); }
  };
  return (
    <Card
      title={<span className="flex items-center gap-2"><Swords size={15} /> {c.title}</span>}
      action={<Badge color={status === 'en cours' ? 'var(--success)' : 'var(--text-secondary)'}>{status}</Badge>}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute mb-3">
        <span>{m.label}</span>
        <span>du {fmtDateShort(c.starts)} au {fmtDateShort(c.ends)}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 text-accent hover:underline cursor-pointer">
          Code <span className="font-data select-all">{c.code}</span> <Copy size={12} />
        </button>
      </div>
      <ol className="divide-y divide-line/60">
        {ranked.map((p) => (
          <li key={p.user_id} className={`flex items-center gap-3 py-2 ${p.user_id === userId ? 'text-accent font-semibold' : ''}`}>
            <span className="w-6 text-center font-data">{p.place === 1 && status !== 'à venir' ? <Trophy size={15} className="inline text-accent" /> : p.place}</span>
            <span className="flex-1 truncate">{p.display_name || 'Sans nom'}{p.user_id === userId ? ' (toi)' : ''}</span>
            <span className="text-xs text-mute">{p.detail}</span>
            <span className="font-data w-20 text-right">{Number(p.score)}{m.unit === '%' ? ' %' : m.unit ? ` ${m.unit}` : ''}</span>
          </li>
        ))}
      </ol>
      <div className="flex justify-end gap-2 mt-3">
        {mine ? (
          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={async () => { if (confirm(`Supprimer le défi « ${c.title} » pour tout le monde ?`)) { await deleteChallenge(c.id); onChange(); } }}>
            <span className="flex items-center gap-1.5"><Trash2 size={13} /> Supprimer</span>
          </Button>
        ) : (
          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={async () => { if (confirm('Quitter ce défi ?')) { await leaveChallenge(c.id); onChange(); } }}>
            <span className="flex items-center gap-1.5"><LogOut size={13} /> Quitter</span>
          </Button>
        )}
      </div>
    </Card>
  );
}

// Défis: friendly competitions inside the private circle. Members see each
// other's score for the chosen measure — never the underlying data.
export default function Challenges() {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState({ loading: true });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', metric: 'attendance', starts: todayKey(), ends: addDays(todayKey(), 29) });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await listChallenges();
    if (!r.ok) { setState({ loading: false, offline: true }); return; }
    const changed = await pushMyScores(r.challenges, r.userId);
    const fresh = changed ? await listChallenges() : r;
    setState({ loading: false, userId: fresh.userId, challenges: fresh.challenges || [] });
  }, []);
  useEffect(() => { load(); }, [load]);

  const name = user?.name || 'Moi';
  const create = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    const r = await createChallenge({ ...form, name });
    setBusy(false);
    if (!r.ok) { toast('Création impossible pour l’instant.', 'error'); return; }
    setCreating(false);
    setForm({ ...form, title: '' });
    toast(`Défi créé. Code à partager : ${r.challenge.code}`, 'success');
    load();
  };
  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const r = await joinChallenge(code, name);
    setBusy(false);
    if (!r.ok) { toast(r.error === 'unknown_code' ? 'Code inconnu : vérifie-le auprès de la personne qui t’a invité·e.' : 'Impossible de rejoindre pour l’instant.', 'error'); return; }
    setCode('');
    toast('Tu as rejoint le défi.', 'success');
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Défis</h1>
          <p className="text-mute text-sm mt-1">Entre amis : qui arrive le plus souvent à l’heure en cours, tient le mieux ses habitudes, lit le plus… Chacun ne voit que les scores, jamais tes données.</p>
        </div>
        {!state.offline && <Button onClick={() => setCreating(true)}><span className="flex items-center gap-1.5"><Plus size={15} /> Nouveau défi</span></Button>}
      </div>

      {state.loading && <p className="text-sm text-mute flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement…</p>}
      {state.offline && (
        <Card><EmptyState icon={Swords}>Les défis se jouent entre comptes : connecte-toi (Paramètres → Synchronisation) pour en créer ou en rejoindre.</EmptyState></Card>
      )}

      {!state.loading && !state.offline && (
        <>
          <Card title="Rejoindre un défi">
            <div className="flex flex-wrap gap-2">
              <Input className="!w-40 font-data uppercase" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code" aria-label="Code du défi" />
              <Button variant="secondary" disabled={busy || code.trim().length !== 6} onClick={join}>Rejoindre</Button>
              <IconButton label="Actualiser les scores" onClick={load}><RefreshCw size={15} /></IconButton>
            </div>
          </Card>
          {state.challenges?.length ? (
            state.challenges.map((c) => <ChallengeCard key={c.id} c={c} userId={state.userId} onChange={load} />)
          ) : (
            <Card><EmptyState icon={Swords} action={<Button onClick={() => setCreating(true)}>Lancer un défi</Button>}>Aucun défi pour l’instant. Lance-en un et partage son code.</EmptyState></Card>
          )}
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau défi">
        <div className="space-y-3">
          <Field label="Nom du défi"><Input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex. Assiduité du semestre" autoFocus /></Field>
          <Field label="Ce qu’on mesure" hint={metricOf(form.metric).hint}>
            <Select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} options={CHALLENGE_METRICS.map((m) => ({ value: m.key, label: m.label }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début"><Input type="date" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} /></Field>
            <Field label="Fin"><Input type="date" value={form.ends} min={form.starts} onChange={(e) => setForm({ ...form, ends: e.target.value })} /></Field>
          </div>
          <p className="text-xs text-mute">Ton nom affiché : <b className="text-ink">{name}</b>. Les autres verront ton score et le leur, rien d’autre.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreating(false)}>Annuler</Button>
            <Button disabled={busy || !form.title.trim() || form.ends < form.starts} onClick={create}>Créer et obtenir le code</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
