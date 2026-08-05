import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Rocket, Trash2 } from 'lucide-react';
import { useBusinessStore } from '../../store/businessStore';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';

const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idée' },
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];
const STATUS_COLOR = { idea: 'var(--text-secondary)', active: 'var(--success)', paused: 'var(--warning)', closed: 'var(--error)' };

const blank = () => ({ name: '', sector: '', description: '', status: 'idea' });

export default function Businesses() {
  const { businesses, addBusiness, deleteBusiness } = useBusinessStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());

  const submit = (e) => {
    e.preventDefault();
    const res = addBusiness(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };

  const active = businesses.filter((b) => b.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-mute text-sm">Suivez un business de A à Z — phases, idées, faits, KPIs, timeline, et une comptabilité générale simplifiée par business.</p>
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Nouveau business</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Businesses" value={businesses.length} sub={`${active} actifs`} />
        <Stat label="Phases franchies" value={businesses.reduce((a, b) => a + b.phases.filter((p) => p.status === 'done').length, 0)} />
        <Stat label="Idées loggées" value={businesses.reduce((a, b) => a + b.events.filter((e) => e.type === 'idea').length, 0)} />
        <Stat label="Faits loggés" value={businesses.reduce((a, b) => a + b.events.filter((e) => e.type === 'fact').length, 0)} />
      </div>

      {businesses.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {businesses.map((b) => {
            const donePhases = b.phases.filter((p) => p.status === 'done').length;
            return (
              <Card key={b.id} className="!p-0 overflow-hidden">
                <Link to={`/deals/business/${b.id}`} className="block p-4 hover:bg-surface/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      {b.sector && <div className="text-xs text-mute">{b.sector}</div>}
                    </div>
                    <Badge color={STATUS_COLOR[b.status]}>{STATUS_OPTIONS.find((s) => s.value === b.status)?.label}</Badge>
                  </div>
                  {b.description && <p className="text-xs text-mute mb-2 line-clamp-2">{b.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-mute">
                    <span>{donePhases}/{b.phases.length} phases</span>
                    <span>{b.events.length} événements</span>
                    <span>{b.kpis.length} KPIs</span>
                    <span>{b.journal.length} écritures</span>
                  </div>
                </Link>
                <div className="flex justify-end px-4 py-2 border-t border-line">
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${b.name}" et toutes ses données ?`)) deleteBusiness(b.id); }} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState><Rocket className="mx-auto mb-2 text-mute" size={26} />Aucun business suivi. Créez le premier pour commencer.</EmptyState>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau business">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex : Atelier de torréfaction" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Secteur (optionnel)">
              <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="ex : F&B, SaaS, e-commerce…" />
            </Field>
            <Field label="Statut">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />
            </Field>
          </div>
          <Field label="Description (optionnel)">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="L'idée en une phrase" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
