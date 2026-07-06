import { useEffect, useState } from 'react';
import { Target, Pencil, Trash2, Trophy, Landmark, TrendingUp } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { GOAL_TYPES } from '../../utils/chart-of-accounts';
import { fmtMAD, fmtDate } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Modal, ProgressBar, Badge, EmptyState } from '../../components/common/ui';

const blank = () => ({ type: 'treasury', name: '', targetAmount: '', targetDate: '' });

function GoalCard({ g, onEdit, onDelete }) {
  const Icon = g.type === 'treasury' ? Landmark : TrendingUp;
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2.5">
          <Icon size={16} className="text-mute mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium">{g.name}</div>
            <div className="text-xs text-mute">
              {fmtMAD(g.targetAmount)}{g.targetDate ? ` d'ici le ${fmtDate(g.targetDate)}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {g.achieved && (
            <Badge color="var(--success)"><span className="flex items-center gap-1"><Trophy size={11} /> {g.badge}</span></Badge>
          )}
          {!g.achieved && g.onTrack !== null && (
            <Badge color={g.onTrack ? 'var(--success)' : 'var(--error)'}>{g.onTrack ? 'en bonne voie' : 'hors rythme'}</Badge>
          )}
          <button className="text-mute hover:text-accent cursor-pointer" onClick={() => onEdit(g)} title="Modifier">
            <Pencil size={13} />
          </button>
          <button className="text-mute hover:text-bad cursor-pointer" onClick={() => onDelete(g)} title="Supprimer">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {g.progress !== null ? (
        <>
          <ProgressBar value={g.progress} color={g.progress >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
          <div className="text-[11px] text-mute mt-1.5">
            {fmtMAD(g.current)} sur {fmtMAD(g.targetAmount)} ({Math.round(g.progress)}%)
            {g.achieved && g.xpAwarded
              ? ` · atteint le ${fmtDate(g.achievedAt)} · +${g.xpAwarded} XP`
              : g.projected !== null && ` · au rythme actuel : ${fmtMAD(g.projected)} à l'échéance`}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-mute">Définissez un montant cible pour suivre la progression.</div>
      )}
    </div>
  );
}

export default function Goals() {
  const store = useAccountingStore();
  const { addGoal, editGoal, deleteGoal, checkGoalAchievement } = store;
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(null);

  const rows = store.getGoalRows();
  const treasuryGoals = rows.filter((g) => g.type === 'treasury');
  const networthGoals = rows.filter((g) => g.type === 'networth');

  useEffect(() => {
    for (const g of rows) if (!g.achieved && g.current >= g.targetAmount) checkGoalAchievement(g.id, g.current);
  }, [rows, checkGoalAchievement]);

  const openAdd = (type) => { setEditing(null); setForm({ ...blank(), type }); setModal(true); };
  const openEdit = (g) => { setEditing(g); setForm({ type: g.type, name: g.name, targetAmount: g.targetAmount, targetDate: g.targetDate || '' }); setModal(true); };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !Number(form.targetAmount)) return;
    if (editing) editGoal(editing.id, form);
    else addGoal(form);
    setModal(false);
    setEditing(null);
    setForm(blank());
  };

  return (
    <div className="space-y-6">
      <Card
        title="Objectifs de Trésorerie"
        action={
          <Button variant="ghost" onClick={() => openAdd('treasury')}>
            <span className="flex items-center gap-2"><Target size={15} /></span>
          </Button>
        }
      >
        <p className="text-xs text-mute mb-4">
          Basé sur le solde de la classe 5 (comptes de trésorerie) et le rythme mensuel des 6 derniers mois — issu automatiquement du journal.
        </p>
        {treasuryGoals.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {treasuryGoals.map((g) => (
              <GoalCard key={g.id} g={g} onEdit={openEdit} onDelete={(gg) => { if (confirm(`Supprimer l'objectif "${gg.name}" ?`)) deleteGoal(gg.id); }} />
            ))}
          </div>
        ) : (
          <EmptyState>Aucun objectif de trésorerie. Fixez un solde disponible à atteindre.</EmptyState>
        )}
      </Card>

      <Card
        title="Objectifs de Patrimoine (Net Worth)"
        action={
          <Button variant="ghost" onClick={() => openAdd('networth')}>
            <span className="flex items-center gap-2"><Target size={15} /></span>
          </Button>
        }
      >
        <p className="text-xs text-mute mb-4">
          Basé sur l'Actif Net Comptable Corrigé (ANCC) et son rythme mensuel des 6 derniers mois.
        </p>
        {networthGoals.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {networthGoals.map((g) => (
              <GoalCard key={g.id} g={g} onEdit={openEdit} onDelete={(gg) => { if (confirm(`Supprimer l'objectif "${gg.name}" ?`)) deleteGoal(gg.id); }} />
            ))}
          </div>
        ) : (
          <EmptyState>Aucun objectif de patrimoine. Fixez un ANCC cible à atteindre.</EmptyState>
        )}
      </Card>

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Modifier l'objectif" : 'Nouvel objectif'}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom de l'objectif">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex : Fonds d'urgence 6 mois" autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={GOAL_TYPES} />
            </Field>
            <Field label="Montant cible (DH)">
              <Input type="number" step="any" min="0" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
            </Field>
            <Field label="Date cible">
              <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-between gap-3 pt-2 border-t border-line">
            {editing ? (
              <Button type="button" variant="danger" onClick={() => { deleteGoal(editing.id); setModal(false); setEditing(null); }}>
                <span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span>
              </Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => { setModal(false); setEditing(null); }}>Annuler</Button>
              <Button type="submit">{editing ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
