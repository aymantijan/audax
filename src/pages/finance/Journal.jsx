import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, Import, Scale } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { useFinanceStore } from '../../store/financeStore';
import { ENTRY_TEMPLATES, accountLabel, ACCOUNT_MAP } from '../../utils/chart-of-accounts';
import { fmtMAD } from '../../utils/formatters';
import { Card, Button, Field, Input, Modal, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';
import { toast } from '../../store/uiStore';

const today = () => new Date().toISOString().slice(0, 10);

const blankExpert = () => ({
  date: today(),
  label: '',
  lines: [
    { account: '511', debit: '', credit: '' },
    { account: '621', debit: '', credit: '' },
  ],
});

// Saisie guidée : un modèle → une écriture équilibrée à deux lignes.
function TemplateForm({ onSubmit, onCancel }) {
  const [templateId, setTemplateId] = useState('expense');
  const tpl = ENTRY_TEMPLATES.find((t) => t.id === templateId);
  const [form, setForm] = useState({ date: today(), label: '', amount: '', debitAccount: tpl.debit.default, creditAccount: tpl.credit.default });

  const pickTemplate = (id) => {
    const t = ENTRY_TEMPLATES.find((x) => x.id === id);
    setTemplateId(id);
    setForm((f) => ({ ...f, debitAccount: t.debit.default, creditAccount: t.credit.default }));
  };

  const submit = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast('Montant invalide', 'error');
    onSubmit({
      date: form.date,
      label: form.label || tpl.label,
      lines: [
        { account: form.debitAccount, debit: amount, credit: 0 },
        { account: form.creditAccount, debit: 0, credit: amount },
      ],
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ENTRY_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickTemplate(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
              t.id === templateId ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-mute">{tpl.hint}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Montant (DH)">
          <Input type="number" step="any" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
        </Field>
        <Field label={`Débit — ${tpl.debit.role}`}>
          <AccountSelect classes={tpl.debit.classes} value={form.debitAccount} onChange={(e) => setForm({ ...form, debitAccount: e.target.value })} />
        </Field>
        <Field label={`Crédit — ${tpl.credit.role}`}>
          <AccountSelect classes={tpl.credit.classes} value={form.creditAccount} onChange={(e) => setForm({ ...form, creditAccount: e.target.value })} />
        </Field>
      </div>
      <Field label="Libellé">
        <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={tpl.label} />
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit">Enregistrer l'écriture</Button>
      </div>
    </form>
  );
}

// Saisie experte : lignes libres, équilibre vérifié en direct.
function ExpertForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial || blankExpert());
  const setLine = (i, patch) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const totalD = form.lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const totalC = form.lines.reduce((a, l) => a + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalD - totalC) < 0.01 && totalD > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Libellé">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex : Salaire du mois" autoFocus />
        </Field>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_110px_110px_32px] gap-2 text-xs text-mute px-1">
          <span>Compte</span><span className="text-right">Débit</span><span className="text-right">Crédit</span><span />
        </div>
        {form.lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2 items-center">
            <AccountSelect value={l.account} onChange={(e) => setLine(i, { account: e.target.value })} />
            <Input type="number" step="any" min="0" className="text-right" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
            <Input type="number" step="any" min="0" className="text-right" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
            <button
              type="button"
              className="text-mute hover:text-bad cursor-pointer disabled:opacity-30"
              disabled={form.lines.length <= 2}
              onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setForm({ ...form, lines: [...form.lines, { account: '511', debit: '', credit: '' }] })}>
          <span className="flex items-center gap-1 text-xs"><Plus size={13} /> Ajouter une ligne</span>
        </Button>
      </div>
      <div className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 ${balanced ? 'border-ok/50 bg-ok/10' : 'border-warn/50 bg-warn/10'}`}
        style={{ borderColor: balanced ? 'var(--success)' : 'var(--warning)' }}>
        <Scale size={15} style={{ color: balanced ? 'var(--success)' : 'var(--warning)' }} />
        <span>Débits : <b>{fmtMAD(totalD)}</b> · Crédits : <b>{fmtMAD(totalC)}</b></span>
        <span className="ml-auto text-xs" style={{ color: balanced ? 'var(--success)' : 'var(--warning)' }}>
          {balanced ? 'Équilibrée ✓' : `Écart : ${fmtMAD(totalD - totalC)}`}
        </span>
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={!balanced}>Enregistrer</Button>
      </div>
    </form>
  );
}

export default function Journal() {
  const { journal, addEntry, editEntry, deleteEntry, importLegacyTransactions, legacyImported } = useAccountingStore();
  const legacyCount = useFinanceStore((s) => s.transactions.length);
  const [modal, setModal] = useState(null); // 'template' | 'expert'
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [monthFilter, setMonthFilter] = useState('');

  const sorted = useMemo(
    () =>
      [...journal]
        .filter((e) => !monthFilter || e.date.startsWith(monthFilter))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)),
    [journal, monthFilter]
  );

  const submit = (entry) => {
    const res = editing ? editEntry(editing.id, entry) : addEntry(entry);
    if (!res.ok) return toast(res.error, 'error');
    setModal(null);
    setEditing(null);
  };

  const entryTotal = (e) => e.lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-44" />
          {monthFilter && (
            <Button variant="ghost" onClick={() => setMonthFilter('')}>Tout</Button>
          )}
        </div>
        <div className="flex gap-2">
          {legacyCount > 0 && !legacyImported && (
            <Button
              variant="secondary"
              onClick={() => {
                const res = importLegacyTransactions();
                if (!res.ok) toast(res.error, 'error');
              }}
            >
              <span className="flex items-center gap-2"><Import size={15} /> Importer {legacyCount} anciennes transactions</span>
            </Button>
          )}
          <Button variant="secondary" onClick={() => { setEditing(null); setModal('expert'); }}>Saisie experte</Button>
          <Button onClick={() => { setEditing(null); setModal('template'); }}>
            <span className="flex items-center gap-2"><Plus size={16} /> Nouvelle écriture</span>
          </Button>
        </div>
      </div>

      <Card title={`Journal général (${sorted.length} écriture${sorted.length > 1 ? 's' : ''})`}>
        {sorted.length ? (
          <div className="space-y-1.5">
            {sorted.map((e) => (
              <div key={e.id} className="border border-line rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface/60 cursor-pointer"
                  onClick={() => setExpanded({ ...expanded, [e.id]: !expanded[e.id] })}
                >
                  {expanded[e.id] ? <ChevronDown size={14} className="text-mute shrink-0" /> : <ChevronRight size={14} className="text-mute shrink-0" />}
                  <span className="text-mute text-xs whitespace-nowrap">{e.date}</span>
                  <Badge color="var(--accent-secondary)">{e.ref}</Badge>
                  <span className="flex-1 truncate">{e.label}</span>
                  <span className="font-medium whitespace-nowrap">{fmtMAD(entryTotal(e))}</span>
                  <button
                    className="text-mute hover:text-accent cursor-pointer"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setEditing(e);
                      setModal('expert');
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="text-mute hover:text-bad cursor-pointer"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (confirm(`Supprimer l'écriture "${e.label}" ?`)) deleteEntry(e.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {expanded[e.id] && (
                  <table className="w-full text-xs border-t border-line">
                    <tbody>
                      {e.lines.map((l, i) => (
                        <tr key={i} className="border-b border-line/40 last:border-0">
                          <td className={`py-1.5 px-3 ${l.credit ? 'pl-10 text-mute' : ''}`}>
                            {accountLabel(l.account)}
                            {ACCOUNT_MAP[l.account]?.group ? <span className="text-mute"> · {ACCOUNT_MAP[l.account].group}</span> : null}
                          </td>
                          <td className="py-1.5 px-3 text-right w-28">{l.debit ? fmtMAD(l.debit) : ''}</td>
                          <td className="py-1.5 px-3 text-right w-28 text-mute">{l.credit ? fmtMAD(l.credit) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>
            Aucune écriture. Commencez par « Soldes d'ouverture » pour inventorier vos avoirs, puis saisissez vos opérations.
          </EmptyState>
        )}
      </Card>

      <Modal open={modal === 'template'} onClose={() => setModal(null)} title="Nouvelle écriture (guidée)" wide>
        <TemplateForm onSubmit={submit} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'expert'} onClose={() => { setModal(null); setEditing(null); }} title={editing ? `Modifier ${editing.ref}` : 'Saisie experte (multi-lignes)'} wide>
        {modal === 'expert' && (
          <ExpertForm
            initial={editing ? { date: editing.date, label: editing.label, lines: editing.lines.map((l) => ({ account: l.account, debit: l.debit || '', credit: l.credit || '' })) } : null}
            onSubmit={submit}
            onCancel={() => { setModal(null); setEditing(null); }}
          />
        )}
      </Modal>
    </div>
  );
}
