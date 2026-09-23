import { useEffect, useState } from 'react';
import { Target, Pencil, Trash2, Trophy, Landmark, TrendingUp, PiggyBank, Plus, Minus, AlertTriangle, Wallet } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { useFinanceMode } from '../../components/finance/financeMode';
import { fmtMAD } from '../../utils/formatters';

import { Card, Button, Field, Input, Modal, ProgressBar, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';
import { toast } from '../../store/uiStore';

const fmtDate = (d) => (d ? new Date(typeof d === 'string' && d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const KINDS = [
  { value: 'envelope', label: 'Enveloppe', Icon: PiggyBank, desc: 'De l’argent mis de côté sur vos comptes actuels (voyage, fonds d’urgence, frais de scolarité…).' },
  { value: 'account', label: 'Compte dédié', Icon: Landmark, desc: 'Un compte réservé à cet objectif (livret, sous-compte) : sa progression = son solde.' },
  { value: 'networth', label: 'Patrimoine net', Icon: TrendingUp, desc: 'Un jalon de richesse nette (ce que vous possédez − vos dettes).' },
];
const kindMeta = (k) => KINDS.find((x) => x.value === k) || KINDS[0];
const blank = () => ({ kind: 'envelope', name: '', targetAmount: '', targetDate: '', account: '512', initialAmount: '' });

function GoalCard({ g, onEdit, onDelete, onContribute, simple }) {
  const { Icon, label } = kindMeta(g.kind);
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-accent/10"><Icon size={15} className="text-accent" /></span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink truncate">{g.name}</div>
            <div className="text-[11px] text-mute">
              {label} · {fmtMAD(g.targetAmount)}{g.targetDate ? ` d'ici le ${fmtDate(g.targetDate)}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {g.achieved && <Badge color="var(--success)"><span className="flex items-center gap-1"><Trophy size={11} /> {g.badge}</span></Badge>}
          {!g.achieved && g.onTrack !== null && <Badge color={g.onTrack ? 'var(--success)' : 'var(--warning)'}>{g.onTrack ? 'en bonne voie' : 'en retard'}</Badge>}
          {!g.achieved && <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => onEdit(g)} title="Modifier"><Pencil size={13} /></button>}
          <button className="p-1 text-mute hover:text-bad cursor-pointer" onClick={() => onDelete(g)} title="Supprimer"><Trash2 size={13} /></button>
        </div>
      </div>
      <ProgressBar value={g.progress ?? 0} color={g.progress >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
      <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-mute">
        <span className="tabular-nums"><b className="text-ink">{fmtMAD(g.current)}</b> / {fmtMAD(g.targetAmount)} · {Math.round(g.progress ?? 0)}%</span>
        {g.achieved && g.xpAwarded ? <span>atteint le {fmtDate(g.achievedAt)} · +{g.xpAwarded} XP</span> : null}
      </div>
      {!g.achieved && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {g.neededPerMonth != null && g.neededPerMonth > 0 && (
            <span className="text-[11px] rounded-md px-2 py-1 bg-card border border-line text-mute">
              Effort : <b className="text-ink">{fmtMAD(g.neededPerMonth)}/mois</b>
            </span>
          )}
          {g.projected != null && g.onTrack === false && g.current > 0 && (
            <span className="text-[11px] text-warning">Au rythme actuel : {fmtMAD(g.projected)} à l'échéance</span>
          )}
          {g.kind === 'envelope' ? (
            <div className="ml-auto flex gap-1.5">
              {g.current > 0 && <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => onContribute(g, -1)} title="Reprendre de l'argent"><Minus size={12} /></Button>}
              <Button className="!px-2.5 !py-1 text-xs" onClick={() => onContribute(g, 1)}><span className="flex items-center gap-1"><Plus size={12} /> Mettre de côté</span></Button>
            </div>
          ) : g.kind === 'account' ? (
            <span className="ml-auto text-[11px] text-mute">{simple ? 'Faites un transfert vers ce compte pour avancer.' : 'Alimenté par virement vers le compte dédié.'}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function Goals() {
  const simple = useFinanceMode() === 'simple';
  const store = useAccountingStore();
  const { addGoal, editGoal, deleteGoal, checkGoalAchievement, contributeGoal } = store;
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [contrib, setContrib] = useState(null); // { goal, sign }
  const [amount, setAmount] = useState('');
  const [deleting, setDeleting] = useState(null);

  const rows = store.getGoalRows();
  const alloc = store.getGoalAllocation();
  const active = rows.filter((g) => !g.achieved);
  const trophies = rows.filter((g) => g.achieved).sort((a, b) => (a.achievedAt < b.achievedAt ? 1 : -1));
  const emptyEnvelopes = active.filter((g) => g.kind === 'envelope' && g.current === 0);

  useEffect(() => {
    for (const g of rows) if (!g.achieved && g.current >= g.targetAmount) checkGoalAchievement(g.id, g.current);
  }, [rows, checkGoalAchievement]);

  const openAdd = () => { setEditing(null); setForm(blank()); setError(''); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ ...blank(), kind: g.kind, name: g.name, targetAmount: g.targetAmount, targetDate: g.targetDate || '' }); setError(''); setModal(true); };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !Number(form.targetAmount)) return setError('Nom et montant cible requis.');
    if (editing) { editGoal(editing.id, form); setModal(false); return; }
    const res = addGoal(form);
    if (!res.ok) return setError(res.error);
    setModal(false);
  };
  const submitContrib = (e) => {
    e.preventDefault();
    const res = contributeGoal(contrib.goal.id, contrib.sign * Number(String(amount).replace(',', '.')));
    if (!res.ok) return toast(res.error, 'error');
    toast(contrib.sign > 0 ? `${fmtMAD(Number(amount))} mis de côté pour « ${contrib.goal.name} »` : `${fmtMAD(Number(amount))} repris de « ${contrib.goal.name} »`, 'success');
    setContrib(null); setAmount('');
  };

  return (
    <div className="space-y-5">
      {/* Allocation bar */}
      <div className="rounded-2xl border border-line p-5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 10%, transparent), var(--bg-tertiary) 60%)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-mute flex items-center gap-1.5"><Wallet size={13} /> Sur vos comptes</div>
            <div className="text-2xl font-bold text-ink tabular-nums">{fmtMAD(alloc.treasury)}</div>
          </div>
          <Button onClick={openAdd}><span className="flex items-center gap-1.5"><Target size={15} /> Nouvel objectif</span></Button>
        </div>
        {alloc.treasury > 0 && (
          <div className="mt-4">
            <div className="h-2.5 rounded-full bg-surface overflow-hidden flex">
              <div style={{ width: `${Math.min(100, (alloc.allocated / alloc.treasury) * 100)}%`, background: 'var(--accent-primary)' }} />
              <div style={{ width: `${Math.min(100, (alloc.dedicated / alloc.treasury) * 100)}%`, background: 'var(--accent-secondary)' }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-mute">
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'var(--accent-primary)' }} />Mis de côté (enveloppes) : <b className="text-ink">{fmtMAD(alloc.allocated)}</b></span>
              {alloc.dedicated > 0 && <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: 'var(--accent-secondary)' }} />Comptes dédiés : <b className="text-ink">{fmtMAD(alloc.dedicated)}</b></span>}
              <span>Libre : <b className={alloc.unallocated < 0 ? 'text-bad' : 'text-ink'}>{fmtMAD(alloc.unallocated)}</b></span>
            </div>
          </div>
        )}
        {alloc.unallocated < -0.5 && (
          <div className="mt-3 text-xs text-bad flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Vous avez dépensé une partie de l'argent mis de côté : reprenez-le d'une enveloppe pour que vos objectifs reflètent la réalité.</div>
        )}
        {emptyEnvelopes.length > 0 && alloc.unallocated > 0 && (
          <div className="mt-3 text-xs text-mute flex items-start gap-1.5">
            <PiggyBank size={13} className="mt-0.5 shrink-0 text-accent" />
            {emptyEnvelopes.length} objectif(s) à alimenter : chaque objectif compte désormais son propre argent. Répartissez vos {fmtMAD(alloc.unallocated)} libres avec « Mettre de côté ».
          </div>
        )}
      </div>

      <Card title={`Objectifs en cours (${active.length})`}>
        {active.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {active.map((g) => <GoalCard key={g.id} g={g} simple={simple} onEdit={openEdit} onDelete={setDeleting} onContribute={(goal, sign) => { setContrib({ goal, sign }); setAmount(''); }} />)}
          </div>
        ) : (
          <EmptyState>Aucun objectif. Créez une enveloppe (voyage, fonds d'urgence…) et mettez de l'argent de côté au fil des mois.</EmptyState>
        )}
      </Card>

      {trophies.length > 0 && (
        <Card title="🏆 Objectifs atteints">
          <div className="grid md:grid-cols-2 gap-4">
            {trophies.map((g) => <GoalCard key={g.id} g={g} simple={simple} onEdit={openEdit} onDelete={setDeleting} onContribute={() => {}} />)}
          </div>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Modifier l'objectif" : 'Nouvel objectif'}>
        <form onSubmit={submit} className="space-y-3">
          {!editing && (
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <button key={k.value} type="button" onClick={() => setForm({ ...form, kind: k.value })}
                  className={`rounded-xl border p-2.5 text-left cursor-pointer transition-colors ${form.kind === k.value ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50'}`}>
                  <k.Icon size={16} className={form.kind === k.value ? 'text-accent' : 'text-mute'} />
                  <div className="text-xs font-semibold text-ink mt-1">{k.label}</div>
                </button>
              ))}
            </div>
          )}
          {!editing && <p className="text-[11px] text-mute">{kindMeta(form.kind).desc}</p>}
          <Field label="Nom de l'objectif">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === 'networth' ? 'ex : Patrimoine 100 000 DH' : "ex : Fonds d'urgence 6 mois"} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant cible (DH)"><Input type="number" step="any" min="0" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} /></Field>
            <Field label="Date cible (optionnel)"><Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} /></Field>
          </div>
          {!editing && form.kind === 'account' && (
            <Field label="Compte dédié" hint="Son solde actuel devient le point de départ.">
              <AccountSelect simple={simple} classes={[5]} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
            </Field>
          )}
          {!editing && form.kind === 'envelope' && (
            <Field label="Déjà mis de côté (optionnel)" hint={`Libre sur vos comptes : ${fmtMAD(alloc.unallocated)}`}>
              <Input type="number" step="any" min="0" value={form.initialAmount} onChange={(e) => setForm({ ...form, initialAmount: e.target.value })} />
            </Field>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">{editing ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!contrib} onClose={() => setContrib(null)} title={contrib?.sign > 0 ? `Mettre de côté · ${contrib?.goal.name}` : `Reprendre de l'argent · ${contrib?.goal.name}`}>
        <form onSubmit={submitContrib} className="space-y-3">
          <Field label="Montant (DH)" hint={contrib?.sign > 0 ? `Libre sur vos comptes : ${fmtMAD(alloc.unallocated)}${contrib?.goal.neededPerMonth ? ` · effort conseillé : ${fmtMAD(contrib.goal.neededPerMonth)}/mois` : ''}` : `Dans l'enveloppe : ${fmtMAD(contrib?.goal.current || 0)}`}>
            <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <p className="text-[11px] text-mute">L'argent reste sur vos comptes : il est simplement réservé à cet objectif et n'est plus compté comme libre.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setContrib(null)}>Annuler</Button>
            <Button type="submit" disabled={!Number(amount)}>{contrib?.sign > 0 ? 'Mettre de côté' : 'Reprendre'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Supprimer cet objectif ?">
        <p className="text-sm text-mute">« {deleting?.name} » sera supprimé. L'argent mis de côté redevient libre.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { deleteGoal(deleting.id); setDeleting(null); }}>Supprimer</Button>
        </div>
      </Modal>
    </div>
  );
}
