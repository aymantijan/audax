import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Plus, Trash2, Pencil, ArrowRight, AlertTriangle, Target, UserRound } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useFundraisingStore } from '../store/fundraisingStore';
import { useNetworkingStore } from '../store/networkingStore';
import { FUNDRAISING_STAGES, INVESTOR_TYPES } from '../utils/constants';
import { fmtDateShort, fmtMoney, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STAGE_COLOR = {
  Contacted: 'var(--text-secondary)', Meeting: 'var(--accent-primary)', Diligence: 'var(--warning)',
  'Term Sheet': 'var(--accent-secondary)', Closed: 'var(--success)', Passed: 'var(--text-secondary)',
};
const OPEN_STAGES = FUNDRAISING_STAGES.filter((s) => !['Passed'].includes(s));

const blank = () => ({ name: '', firm: '', type: 'Angel', amountTarget: '', contactDate: todayKey(), url: '', notes: '', referralContactId: '' });
const investorFields = (contacts) => [
  { name: 'name', label: 'Nom', type: 'text' },
  { name: 'firm', label: 'Firme / fonds', type: 'text' },
  { name: 'type', label: 'Type', type: 'select', options: INVESTOR_TYPES },
  { name: 'stage', label: 'Étape', type: 'select', options: FUNDRAISING_STAGES },
  { name: 'amountTarget', label: 'Montant visé', type: 'number' },
  { name: 'amountCommitted', label: 'Montant engagé (si Closed)', type: 'number' },
  { name: 'contactDate', label: 'Date de premier contact', type: 'date' },
  { name: 'url', label: 'Lien', type: 'text' },
  {
    name: 'referralContactId', label: 'Contact référent (Networking)', type: 'select',
    options: [{ value: '', label: '— Aucun —' }, ...contacts.map((c) => ({ value: c.id, label: c.org ? `${c.name} · ${c.org}` : c.name }))],
  },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Fundraising() {
  const { investors, addInvestor, editInvestor, deleteInvestor, setStage, getBadges, getStaleInvestors, getRaiseProgress, setRoundTarget } = useFundraisingStore();
  const contacts = useNetworkingStore((s) => s.contacts);
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [targetInput, setTargetInput] = useState(() => useFundraisingStore.getState().roundTarget || '');

  const byStage = useMemo(() => FUNDRAISING_STAGES.map((s) => ({ name: s, count: investors.filter((i) => i.stage === s).length })).filter((s) => s.count > 0), [investors]);
  const active = investors.filter((i) => OPEN_STAGES.includes(i.stage));
  const stale = useMemo(() => getStaleInvestors(), [investors]);
  const progress = getRaiseProgress();
  const contactName = (id) => contacts.find((c) => c.id === id)?.name;

  const submit = (e) => {
    e.preventDefault();
    const res = addInvestor(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };
  const advance = (inv) => setStage(inv.id, FUNDRAISING_STAGES[FUNDRAISING_STAGES.indexOf(inv.stage) + 1]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fundraising</h1>
          <p className="text-mute text-sm mt-1">Pipeline investisseurs — lever un tour de financement.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouvel investisseur</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Investisseurs" value={investors.length} />
        <Stat label="En cours" value={active.length} />
        <Stat label="Term Sheet+" value={investors.filter((i) => FUNDRAISING_STAGES.indexOf(i.stage) >= FUNDRAISING_STAGES.indexOf('Term Sheet') && i.stage !== 'Passed').length} />
        <Stat label="Engagé" value={fmtMoney(progress.committed)} color={progress.committed ? 'var(--success)' : undefined} />
      </div>

      <Card title="Objectif du tour">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Target size={16} className="text-mute" />
            <Input
              type="number" className="!w-28" placeholder="0" value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={() => { if (targetInput !== '') setRoundTarget(targetInput); }}
            />
            <span className="text-xs text-mute">$ visés</span>
          </div>
          {progress.pct != null ? (
            <div className="flex-1">
              <div className="flex justify-between text-xs text-mute mb-1"><span>{fmtMoney(progress.committed)} / {fmtMoney(progress.target)}</span><span>{progress.pct}%</span></div>
              <ProgressBar value={progress.pct} color={progress.pct >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
            </div>
          ) : (
            <span className="text-xs text-mute">Fixe une taille de tour pour suivre ta progression.</span>
          )}
        </div>
      </Card>

      {stale.length > 0 && (
        <div className="space-y-1.5">
          {stale.map(({ investor, lastMoveDate }) => (
            <div key={investor.id} className="flex items-center gap-2 text-sm border border-warn/50 bg-warn/10 text-warn rounded-lg px-4 py-2.5 cursor-pointer" onClick={() => setEditing(investor)}>
              <AlertTriangle size={14} className="shrink-0" />
              <span className="font-medium">{investor.name}{investor.firm ? ` (${investor.firm})` : ''}</span>
              <span>— stagnant depuis {fmtDateShort(lastMoveDate)} (étape "{investor.stage}")</span>
            </div>
          ))}
        </div>
      )}

      {byStage.length > 1 && (
        <Card title="Pipeline par étape">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStage}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byStage.map((s) => <Cell key={s.name} fill={STAGE_COLOR[s.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {investors.length ? (
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {FUNDRAISING_STAGES.map((stage) => {
            const items = investors.filter((i) => i.stage === stage);
            if (!items.length && !OPEN_STAGES.includes(stage)) return null;
            return (
              <div key={stage} className="min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                  <span className="text-xs font-semibold text-mute uppercase tracking-wide">{stage}</span>
                  <span className="text-xs text-mute">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((inv) => (
                    <div key={inv.id} className="bg-card border border-line rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{inv.name}</div>
                          <div className="text-xs text-mute">{inv.firm || inv.type}</div>
                        </div>
                        <button className="text-mute hover:text-accent cursor-pointer shrink-0" onClick={() => setEditing(inv)}><Pencil size={12} /></button>
                      </div>
                      {inv.amountTarget > 0 && <div className="text-[11px] text-mute mt-1">{fmtMoney(inv.amountTarget)}</div>}
                      {inv.referralContactId && contactName(inv.referralContactId) && (
                        <button className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer mt-1" onClick={() => navigate(`/networking?contact=${inv.referralContactId}`)}>
                          <UserRound size={10} /> {contactName(inv.referralContactId)}
                        </button>
                      )}
                      {OPEN_STAGES.includes(inv.stage) && stage !== 'Closed' && (
                        <button className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer" onClick={() => advance(inv)}>
                          Avancer <ArrowRight size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState><Rocket className="mx-auto mb-2 text-mute" size={26} />Aucun investisseur. Loggez le premier pour démarrer le pipeline.</EmptyState></Card>
      )}

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvel investisseur">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="Firme / fonds"><Input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={INVESTOR_TYPES} /></Field>
            <Field label="Montant visé"><Input type="number" value={form.amountTarget} onChange={(e) => setForm({ ...form, amountTarget: e.target.value })} /></Field>
            <Field label="Date de contact"><Input type="date" value={form.contactDate} onChange={(e) => setForm({ ...form, contactDate: e.target.value })} /></Field>
          </div>
          <Field label="Contact référent (Networking)"><Select value={form.referralContactId} onChange={(e) => setForm({ ...form, referralContactId: e.target.value })} options={[{ value: '', label: '— Aucun —' }, ...contacts.map((c) => ({ value: c.id, label: c.org ? `${c.name} · ${c.org}` : c.name }))]} /></Field>
          <Field label="Lien"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer l'investisseur"
          fields={investorFields(contacts)}
          initial={editing}
          wide
          onSave={(values) => editInvestor(editing.id, values)}
          onDelete={() => deleteInvestor(editing.id)}
        />
      )}
    </div>
  );
}
