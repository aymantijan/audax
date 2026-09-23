import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, Import, Scale, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Circle } from 'lucide-react';
import { useFinanceMode, describeEntry, SIMPLE_TEMPLATES } from '../../components/finance/financeMode';
import { useAccountingStore } from '../../store/accountingStore';
import { useFinanceStore } from '../../store/financeStore';
import { ENTRY_TEMPLATES, accountLabel, classOf } from '../../utils/chart-of-accounts';
import { fmtMAD } from '../../utils/formatters';
import { Card, Button, Field, Input, Modal, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';
import { toast } from '../../store/uiStore';

const today = () => new Date().toISOString().slice(0, 10);

// Libellé avec autocomplétion (libellés déjà utilisés pour CE compte de dépense)
// + suggestion "voulez-vous dire ?" en cas de quasi-doublon (ex : "Omar Café" vs
// "Omar's Café" déjà saisi) — account=null (compte non-charge) désactive les deux.
function LabelField({ label, value, onChange, account, placeholder }) {
  const { getLabelSuggestions, getLabelDidYouMean } = useAccountingStore();
  const suggestions = account ? getLabelSuggestions(account, value) : [];
  const didYouMean = account ? getLabelDidYouMean(account, value) : null;
  const listId = `label-suggestions-${account || 'none'}`;

  return (
    <Field label={label}>
      <Input list={account ? listId : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {account && (
        <datalist id={listId}>
          {suggestions.map((s) => <option key={s.label} value={s.label} />)}
        </datalist>
      )}
      {didYouMean && (
        <button
          type="button"
          onClick={() => onChange(didYouMean.label)}
          className="block text-[11px] text-accent hover:underline mt-1 cursor-pointer"
        >
          Vous voulez dire : « {didYouMean.label} » ?
        </button>
      )}
    </Field>
  );
}

const blankExpert = () => ({
  date: today(),
  label: '',
  lines: [
    { account: '511', debit: '', credit: '' },
    { account: '621', debit: '', credit: '' },
  ],
});

// Saisie guidée : un modèle → une écriture équilibrée à deux lignes.
const MAIN_SIMPLE = ['expense', 'income', 'transfer'];

// Which template a 2-line entry corresponds to (for editing in guided mode).
function templateForEntry(entry) {
  const d = entry.lines.find((l) => Number(l.debit) > 0);
  const c = entry.lines.find((l) => Number(l.credit) > 0);
  if (!d || !c || entry.lines.length !== 2) return null;
  return ENTRY_TEMPLATES.find((t) => t.debit.classes.includes(classOf(d.account)) && t.credit.classes.includes(classOf(c.account))) || null;
}

function TemplateForm({ onSubmit, onCancel, simple = false, initial = null }) {
  const initTpl = initial ? templateForEntry(initial) : null;
  const [templateId, setTemplateId] = useState(initTpl?.id || 'expense');
  const [showAll, setShowAll] = useState(!!initTpl && !MAIN_SIMPLE.includes(initTpl.id));
  const tpl = ENTRY_TEMPLATES.find((t) => t.id === templateId);
  const [form, setForm] = useState(() => {
    if (initial && initTpl) {
      const d = initial.lines.find((l) => Number(l.debit) > 0);
      const c = initial.lines.find((l) => Number(l.credit) > 0);
      return { date: initial.date, label: initial.label, amount: String(d.debit), debitAccount: d.account, creditAccount: c.account };
    }
    return { date: today(), label: '', amount: '', debitAccount: tpl.debit.default, creditAccount: tpl.credit.default };
  });
  const words = SIMPLE_TEMPLATES[templateId];
  const visibleTemplates = simple && !showAll ? ENTRY_TEMPLATES.filter((t) => MAIN_SIMPLE.includes(t.id)) : ENTRY_TEMPLATES;

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
      label: form.label || (simple ? words.label : tpl.label),
      lines: [
        { account: form.debitAccount, debit: amount, credit: 0 },
        { account: form.creditAccount, debit: 0, credit: amount },
      ],
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {visibleTemplates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickTemplate(t.id)}
            className={`${simple && MAIN_SIMPLE.includes(t.id) ? 'px-4 py-2 text-sm font-medium' : 'px-3 py-1.5 text-xs'} rounded-lg border transition-colors cursor-pointer ${
              t.id === templateId ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'
            }`}
          >
            {simple ? SIMPLE_TEMPLATES[t.id].label : t.label}
          </button>
        ))}
        {simple && !showAll && (
          <button type="button" onClick={() => setShowAll(true)} className="px-3 py-1.5 rounded-lg text-xs text-mute hover:text-ink cursor-pointer">Autres…</button>
        )}
      </div>
      {!simple && <p className="text-xs text-mute">{tpl.hint}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Montant (DH)">
          <Input type="number" step="any" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
        </Field>
        <Field label={simple ? words.debit : `Débit — ${tpl.debit.role}`}>
          <AccountSelect simple={simple} classes={tpl.debit.classes} value={form.debitAccount} onChange={(e) => setForm({ ...form, debitAccount: e.target.value })} />
        </Field>
        <Field label={simple ? words.credit : `Crédit — ${tpl.credit.role}`}>
          <AccountSelect simple={simple} classes={tpl.credit.classes} value={form.creditAccount} onChange={(e) => setForm({ ...form, creditAccount: e.target.value })} />
        </Field>
      </div>
      <LabelField
        label="Libellé"
        value={form.label}
        onChange={(v) => setForm({ ...form, label: v })}
        account={classOf(form.debitAccount) === 6 ? form.debitAccount : null}
        placeholder={simple ? (templateId === 'expense' ? 'ex : Café Omar, Marjane…' : words.label) : tpl.label}
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit">{simple ? 'Enregistrer' : "Enregistrer l'écriture"}</Button>
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
  const expenseAccount = form.lines.find((l) => classOf(l.account) === 6)?.account || null;

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
        <LabelField
          label="Libellé"
          value={form.label}
          onChange={(v) => setForm({ ...form, label: v })}
          account={expenseAccount}
          placeholder="ex : Salaire du mois"
        />
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
  const { journal, addEntry, editEntry, deleteEntry, importLegacyTransactions, legacyImported, getAccountMap } = useAccountingStore();
  const accountMap = getAccountMap();
  const legacyCount = useFinanceStore((s) => s.transactions.length);
  // QuickAdd FAB (via Finance.jsx defaulting the tab to 'journal') opens
  // straight into the guided entry form — read once on mount, same one-shot
  // pattern as Trading.jsx's quickadd handling.
  const [modal, setModal] = useState(() => (new URLSearchParams(window.location.search).get('quickadd') === 'journal' ? 'template' : null)); // 'template' | 'expert'
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [monthFilter, setMonthFilter] = useState('');
  const [deleting, setDeleting] = useState(null);
  const mode = useFinanceMode();
  const simple = mode === 'simple';
  // Simple mode edits 2-line entries in the guided form; anything else opens the expert form.
  const openEdit = (e) => { setEditing(e); setModal(simple && templateForEntry(e) ? 'template' : 'expert'); };

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
          {!simple && <Button variant="secondary" onClick={() => { setEditing(null); setModal('expert'); }}>Saisie experte</Button>}
          <Button onClick={() => { setEditing(null); setModal('template'); }}>
            <span className="flex items-center gap-2"><Plus size={16} /> {simple ? 'Nouvelle opération' : 'Nouvelle écriture'}</span>
          </Button>
        </div>
      </div>

      <Card title={simple ? `Opérations (${sorted.length})` : `Journal général (${sorted.length} écriture${sorted.length > 1 ? 's' : ''})`}>
        {sorted.length && simple ? (
          <div className="divide-y divide-line/60">
            {sorted.map((e) => {
              const d = describeEntry(e, accountMap);
              const meta = {
                expense: { Icon: ArrowUpRight, color: 'var(--error)', sign: '−' },
                income: { Icon: ArrowDownLeft, color: 'var(--success)', sign: '+' },
                transfer: { Icon: ArrowLeftRight, color: 'var(--accent-primary)', sign: '' },
                other: { Icon: Circle, color: 'var(--text-secondary)', sign: '' },
              }[d.kind];
              return (
                <div key={e.id} className="flex items-center gap-3 py-2.5 px-1 group">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
                    <meta.Icon size={15} style={{ color: meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink truncate">{e.label}</div>
                    <div className="text-[11px] text-mute truncate">
                      {new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {d.category && d.kind !== 'transfer' ? ` · ${d.category}` : ''}{d.via ? ` · ${d.via}` : ''}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: d.kind === 'other' ? undefined : meta.color }}>{meta.sign}{fmtMAD(d.amount)}</span>
                  <button className="p-1 text-mute hover:text-accent cursor-pointer" title="Modifier" onClick={() => openEdit(e)}><Pencil size={13} /></button>
                  <button className="p-1 text-mute hover:text-bad cursor-pointer" title="Supprimer" onClick={() => setDeleting(e)}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        ) : sorted.length ? (
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
                      openEdit(e);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="text-mute hover:text-bad cursor-pointer"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDeleting(e);
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
                            {accountLabel(l.account, accountMap)}
                            {accountMap[l.account]?.group ? <span className="text-mute"> · {accountMap[l.account].group}</span> : null}
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
            {simple
              ? <>Aucune opération. Commencez par « Nouvelle opération » → Autres… → « Soldes de départ » pour indiquer ce que vous avez sur chaque compte, puis ajoutez vos dépenses et revenus.</>
              : <>Aucune écriture. Commencez par « Soldes d'ouverture » pour inventorier vos avoirs, puis saisissez vos opérations.</>}
          </EmptyState>
        )}
      </Card>

      <Modal open={modal === 'template'} onClose={() => { setModal(null); setEditing(null); }} title={editing ? 'Modifier l’opération' : simple ? 'Nouvelle opération' : 'Nouvelle écriture (guidée)'} wide>
        {modal === 'template' && (
          <TemplateForm key={editing?.id || 'new'} simple={simple} initial={editing} onSubmit={submit} onCancel={() => { setModal(null); setEditing(null); }} />
        )}
      </Modal>
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={simple ? 'Supprimer cette opération ?' : 'Supprimer cette écriture ?'}>
        <p className="text-sm text-mute">« {deleting?.label} » sera supprimée, ainsi que son effet sur vos soldes, budgets et états.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { deleteEntry(deleting.id); setDeleting(null); }}>Supprimer</Button>
        </div>
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
