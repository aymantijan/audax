import { useState } from 'react';
import { CalendarClock, Plus, Pencil, Trash2, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { ENTRY_TEMPLATES } from '../../utils/chart-of-accounts';
import { fmtMAD, fmtDate, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

// Seuls les modèles pertinents pour un mouvement RÉCURRENT/PROGRAMMÉ (pas les
// soldes d'ouverture, ponctuels par nature). transfer (virement interne, ex :
// épargne automatique mensuelle) est neutre sur le total trésorerie classe 5
// ET sur le patrimoine — les deux jambes sont en classe 5, treasuryDelta et
// ancDelta s'annulent déjà correctement (voir accounting-engine.js).
const ECHEANCE_TEMPLATES = ENTRY_TEMPLATES.filter((t) => ['income', 'expense', 'invest', 'borrow', 'repay', 'transfer'].includes(t.id));

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Ponctuelle' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'yearly', label: 'Annuelle' },
];

const blank = () => {
  const t = ECHEANCE_TEMPLATES.find((x) => x.id === 'expense');
  return { label: '', templateId: 'expense', debitAccount: t.debit.default, creditAccount: t.credit.default, amount: '', dueDate: todayKey(), recurrence: 'monthly', endDate: '' };
};

export default function Echeances() {
  const { echeances, addEcheance, editEcheance, deleteEcheance, toggleEcheanceActive, markEcheancePaid, getUpcomingEcheances } = useAccountingStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [payDate, setPayDate] = useState({}); // { [echId+occurrenceDate]: 'YYYY-MM-DD' } — date de règlement éditable

  const tpl = ECHEANCE_TEMPLATES.find((t) => t.id === form.templateId) || ECHEANCE_TEMPLATES[0];
  const upcoming = getUpcomingEcheances(60);

  const openAdd = (templateId) => {
    setEditing(null);
    const t = ECHEANCE_TEMPLATES.find((x) => x.id === templateId);
    setForm({ ...blank(), templateId, debitAccount: t.debit.default, creditAccount: t.credit.default });
    setModal(true);
  };
  const openEdit = (e) => {
    setEditing(e);
    // Rétro-compatibilité : une échéance créée avant la généralisation porte encore type+natureAccount+treasuryAccount.
    const debitAccount = e.debitAccount ?? (e.type === 'produit' ? e.treasuryAccount : e.natureAccount);
    const creditAccount = e.creditAccount ?? (e.type === 'produit' ? e.natureAccount : e.treasuryAccount);
    setForm({ label: e.label, templateId: e.templateId || (e.type === 'produit' ? 'income' : 'expense'), debitAccount, creditAccount, amount: e.amount, dueDate: e.dueDate, recurrence: e.recurrence, endDate: e.endDate || '' });
    setModal(true);
  };

  const pickTemplate = (templateId) => {
    const t = ECHEANCE_TEMPLATES.find((x) => x.id === templateId);
    setForm((f) => ({ ...f, templateId, debitAccount: t.debit.default, creditAccount: t.credit.default }));
  };

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

  const templateOf = (e) => ECHEANCE_TEMPLATES.find((t) => t.id === e.templateId) || ECHEANCE_TEMPLATES.find((t) => t.id === (e.type === 'produit' ? 'income' : 'expense'));

  return (
    <div className="space-y-6">
      <p className="text-xs text-mute -mt-2">
        Une échéance est un mouvement concret et daté (ponctuel ou récurrent) — à la différence d'un budget (enveloppe mensuelle lissée pour le contrôle), c'est elle qui alimente les prévisions jour par jour (Trésorerie, et Patrimoine dans Analyse). Un emprunt/investissement (achat, remboursement) est neutre sur le patrimoine — il ne fait que convertir de la trésorerie en dette ou en actif. Un virement entre vos propres comptes (ex : épargne automatique) est neutre à la fois sur le patrimoine et sur le total trésorerie. Seul un produit/charge fait vraiment bouger l'un ou l'autre.
      </p>

      <div className="flex flex-wrap gap-2">
        {ECHEANCE_TEMPLATES.map((t) => (
          <Button key={t.id} variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAdd(t.id)}>
            <span className="flex items-center gap-2"><Plus size={13} /> {t.label}</span>
          </Button>
        ))}
      </div>

      <Card title="À venir (60 jours)" action={<CalendarClock size={16} className="text-mute" />}>
        {upcoming.length ? (
          <ul className="space-y-1.5">
            {upcoming.map((row) => {
              const t = templateOf(row);
              return (
                <li key={payKey(row)} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm flex-wrap">
                  <Badge>{t?.label}</Badge>
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
              );
            })}
          </ul>
        ) : (
          <EmptyState>Aucune échéance à venir dans les 60 prochains jours.</EmptyState>
        )}
      </Card>

      <Card title="Toutes les échéances">
        {echeances.length ? (
          <ul className="space-y-1.5">
            {echeances.map((e) => {
              const t = templateOf(e);
              return (
                <li key={e.id} className={`flex items-center gap-2 text-sm bg-surface border border-line rounded-lg px-3 py-2 flex-wrap ${!e.active ? 'opacity-50' : ''}`}>
                  <Badge>{t?.label}</Badge>
                  <span className="flex-1 min-w-[8rem] truncate">{e.label}</span>
                  <span className="text-mute text-xs">{RECURRENCE_OPTIONS.find((r) => r.value === e.recurrence)?.label}</span>
                  <span className="font-medium whitespace-nowrap">{fmtMAD(e.amount)}</span>
                  {!e.active && <Badge color="var(--text-secondary)">Inactive</Badge>}
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => toggleEcheanceActive(e.id)} title={e.active ? 'Mettre en pause' : 'Réactiver'}>
                    {e.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                  </button>
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openEdit(e)} title="Modifier"><Pencil size={13} /></button>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer l'échéance "${e.label}" ?`)) deleteEcheance(e.id); }} title="Supprimer"><Trash2 size={13} /></button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Aucune échéance programmée.</EmptyState>
        )}
      </Card>

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? "Modifier l'échéance" : 'Nouvelle échéance'}>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ECHEANCE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                  t.id === form.templateId ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-mute">{tpl.hint}</p>
          <Field label="Libellé">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={tpl.label} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant (DH)">
              <Input type="number" step="any" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date (1ère échéance)">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Débit — ${tpl.debit.role}`}>
              <AccountSelect classes={tpl.debit.classes} value={form.debitAccount} onChange={(e) => setForm({ ...form, debitAccount: e.target.value })} />
            </Field>
            <Field label={`Crédit — ${tpl.credit.role}`}>
              <AccountSelect classes={tpl.credit.classes} value={form.creditAccount} onChange={(e) => setForm({ ...form, creditAccount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
