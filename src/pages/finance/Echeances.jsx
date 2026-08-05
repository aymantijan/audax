import { useState } from 'react';
import { CalendarClock, Plus, Pencil, Trash2, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { fmtMAD, fmtDate, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Ponctuelle' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'yearly', label: 'Annuelle' },
];

const blank = () => ({ label: '', type: 'charge', natureAccount: '621', treasuryAccount: '511', amount: '', dueDate: todayKey(), recurrence: 'monthly', endDate: '' });

export default function Echeances() {
  const { echeances, addEcheance, editEcheance, deleteEcheance, toggleEcheanceActive, markEcheancePaid, getUpcomingEcheances } = useAccountingStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [payDate, setPayDate] = useState({}); // { [echId+occurrenceDate]: 'YYYY-MM-DD' } — date de règlement éditable

  const upcoming = getUpcomingEcheances(60);
  const charges = echeances.filter((e) => e.type === 'charge');
  const produits = echeances.filter((e) => e.type === 'produit');

  const openAdd = (type) => { setEditing(null); setForm({ ...blank(), type, natureAccount: type === 'produit' ? '711' : '621' }); setModal(true); };
  const openEdit = (e) => { setEditing(e); setForm({ label: e.label, type: e.type, natureAccount: e.natureAccount, treasuryAccount: e.treasuryAccount, amount: e.amount, dueDate: e.dueDate, recurrence: e.recurrence, endDate: e.endDate || '' }); setModal(true); };

  const submit = (ev) => {
    ev.preventDefault();
    const res = editing ? editEcheance(editing.id, form) : addEcheance(form);
    if (res && res.ok === false) return alert(res.error);
    setModal(false);
    setEditing(null);
  };

  const payKey = (row) => `${row.id}|${row.occurrenceDate}`;
  const submitPay = (row) => {
    const date = payDate[payKey(row)] || row.occurrenceDate;
    const res = markEcheancePaid(row.id, date);
    if (!res.ok) alert(res.error);
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-mute -mt-2">
        Une échéance est un mouvement de trésorerie <strong>concret et daté</strong> (ponctuel ou récurrent) — à la différence d'un budget (enveloppe mensuelle lissée pour le contrôle), c'est elle qui alimente la prévision de trésorerie jour par jour dans l'onglet Trésorerie.
      </p>

      <Card title="À venir (60 jours)" action={<CalendarClock size={16} className="text-mute" />}>
        {upcoming.length ? (
          <ul className="space-y-1.5">
            {upcoming.map((row) => (
              <li key={payKey(row)} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm flex-wrap">
                <Badge color={row.type === 'produit' ? 'var(--success)' : 'var(--error)'}>{row.type === 'produit' ? 'Produit' : 'Charge'}</Badge>
                <span className="flex-1 min-w-[10rem]">{row.label}</span>
                <span className="text-mute text-xs">{fmtDate(row.occurrenceDate)}</span>
                <span className="font-medium">{fmtMAD(row.amount)}</span>
                <Input
                  type="date"
                  value={payDate[payKey(row)] || row.occurrenceDate}
                  onChange={(e) => setPayDate({ ...payDate, [payKey(row)]: e.target.value })}
                  className="!py-1 !px-2 text-xs w-36"
                />
                <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => submitPay(row)}>
                  <span className="flex items-center gap-1"><CheckCircle2 size={13} /> Marquer payé</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Aucune échéance à venir dans les 60 prochains jours.</EmptyState>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <EcheanceList title="Charges programmées" rows={charges} onAdd={() => openAdd('charge')} onEdit={openEdit} onDelete={deleteEcheance} onToggle={toggleEcheanceActive} />
        <EcheanceList title="Produits programmés" rows={produits} onAdd={() => openAdd('produit')} onEdit={openEdit} onDelete={deleteEcheance} onToggle={toggleEcheanceActive} />
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Modifier l'échéance" : 'Nouvelle échéance'}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Libellé">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={form.type === 'produit' ? 'ex : Salaire' : 'ex : Loyer'} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, natureAccount: e.target.value === 'produit' ? '711' : '621' })} options={[{ value: 'charge', label: 'Charge (sortie)' }, { value: 'produit', label: 'Produit (entrée)' }]} />
            </Field>
            <Field label="Montant (DH)">
              <Input type="number" step="any" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nature">
              <AccountSelect classes={[form.type === 'produit' ? 7 : 6]} value={form.natureAccount} onChange={(e) => setForm({ ...form, natureAccount: e.target.value })} />
            </Field>
            <Field label="Compte de trésorerie">
              <AccountSelect classes={[5, 4]} value={form.treasuryAccount} onChange={(e) => setForm({ ...form, treasuryAccount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date (1ère échéance)">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
            <Field label="Récurrence">
              <Select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })} options={RECURRENCE_OPTIONS} />
            </Field>
            <Field label="Fin (optionnel)">
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={form.recurrence === 'once'} />
            </Field>
          </div>
          <div className="flex justify-between gap-3 pt-2 border-t border-line">
            {editing ? (
              <Button type="button" variant="danger" onClick={() => { deleteEcheance(editing.id); setModal(false); setEditing(null); }}>
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

function EcheanceList({ title, rows, onAdd, onEdit, onDelete, onToggle }) {
  return (
    <Card title={title} action={<Button variant="ghost" onClick={onAdd}><Plus size={15} /></Button>}>
      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.map((e) => (
            <li key={e.id} className={`flex items-center gap-2 text-sm bg-surface border border-line rounded-lg px-3 py-2 ${!e.active ? 'opacity-50' : ''}`}>
              <span className="flex-1 truncate">{e.label}</span>
              <span className="text-mute text-xs">{RECURRENCE_OPTIONS.find((r) => r.value === e.recurrence)?.label}</span>
              <span className="font-medium whitespace-nowrap">{fmtMAD(e.amount)}</span>
              {!e.active && <Badge color="var(--text-secondary)">Inactive</Badge>}
              <button className="text-mute hover:text-accent cursor-pointer" onClick={() => onToggle(e.id)} title={e.active ? 'Mettre en pause' : 'Réactiver'}>
                {e.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
              </button>
              <button className="text-mute hover:text-accent cursor-pointer" onClick={() => onEdit(e)} title="Modifier"><Pencil size={13} /></button>
              <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer l'échéance "${e.label}" ?`)) onDelete(e.id); }} title="Supprimer"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Aucune échéance {title.toLowerCase()}.</EmptyState>
      )}
    </Card>
  );
}
