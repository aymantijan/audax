import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Rocket, Trash2 } from 'lucide-react';
import { useBusinessStore } from '../store/businessStore';
import { PROJECT_STAGES } from '../utils/constants';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';

const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idée' },
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];
const STATUS_COLOR = { idea: 'var(--text-secondary)', active: 'var(--success)', paused: 'var(--warning)', closed: 'var(--error)' };
const TIER_OPTIONS = [
  { value: 'formel', label: 'Formel — comptabilité, KPIs, Gantt' },
  { value: 'leger', label: 'Léger — juste étapes et tâches' },
];

const blank = () => ({ name: '', sector: '', description: '', status: 'idea', tier: 'formel', url: '' });

// Businesses & side-projects share one store/page since 2026-09-01 (both
// used the same effort/milestone skills and the same progression concept —
// they were the same thing at two different levels of formality). `tier`
// picks which detail view a business gets: formal = phases/Gantt/KPIs/
// accounting, léger = a simple fixed-stage picker + a todo list.
export default function Businesses() {
  const { businesses, addBusiness, deleteBusiness, getBadges } = useBusinessStore();
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
  const formal = businesses.filter((b) => b.tier !== 'leger');
  const light = businesses.filter((b) => b.tier === 'leger');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-mute text-sm">Suivez un business de A à Z (formel, avec comptabilité) ou un side-project léger (juste étapes et tâches) — un seul endroit pour tout ce que vous construisez.</p>
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Nouveau</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total" value={businesses.length} sub={`${active} actifs`} />
        <Stat label="Formels" value={formal.length} sub={`${formal.reduce((a, b) => a + b.phases.filter((p) => p.status === 'done').length, 0)} phases franchies`} />
        <Stat label="Légers" value={light.length} sub={`${light.filter((b) => b.stageIndex >= PROJECT_STAGES.indexOf('Lancement')).length} lancés`} />
        <Stat label="Tâches terminées" value={businesses.reduce((a, b) => a + (b.tasks || []).filter((t) => t.status === 'done').length, 0)} />
      </div>

      {businesses.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {businesses.map((b) => {
            const isLight = b.tier === 'leger';
            const donePhases = b.phases.filter((p) => p.status === 'done').length;
            const tasks = b.tasks || [];
            const doneTasks = tasks.filter((t) => t.status === 'done').length;
            return (
              <Card key={b.id} className="!p-0 overflow-hidden">
                <Link to={`/businesses/${b.id}`} className="block p-4 hover:bg-surface/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-medium flex items-center gap-1.5">
                        {b.name}
                        {isLight && <Badge color="var(--accent-secondary)">Léger</Badge>}
                      </div>
                      {b.sector && <div className="text-xs text-mute">{b.sector}</div>}
                    </div>
                    <Badge color={STATUS_COLOR[b.status]}>{STATUS_OPTIONS.find((s) => s.value === b.status)?.label}</Badge>
                  </div>
                  {b.description && <p className="text-xs text-mute mb-2 line-clamp-2">{b.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-mute">
                    {isLight ? (
                      <>
                        <span>{PROJECT_STAGES[b.stageIndex]}</span>
                        <span>{tasks.length ? `${doneTasks}/${tasks.length} tâches` : 'aucune tâche'}</span>
                      </>
                    ) : (
                      <>
                        <span>{donePhases}/{b.phases.length} phases</span>
                        <span>{b.events.length} événements</span>
                        <span>{b.kpis.length} KPIs</span>
                        <span>{b.journal.length} écritures</span>
                      </>
                    )}
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
          <EmptyState><Rocket className="mx-auto mb-2 text-mute" size={26} />Rien de suivi encore. Créez le premier pour commencer.</EmptyState>
        </Card>
      )}

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Niveau" hint="Formel : comptabilité, KPIs, Gantt, phases datées. Léger : juste un nom, des étapes fixes et une liste de tâches — pour un side-project sans montage financier.">
            <div className="flex gap-2">
              {TIER_OPTIONS.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, tier: t.value })} className={`flex-1 px-3 py-2 rounded-lg text-xs border cursor-pointer text-left ${form.tier === t.value ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Nom">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex : Atelier de torréfaction" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Secteur / domaine (optionnel)">
              <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="ex : F&B, SaaS, e-commerce…" />
            </Field>
            {form.tier === 'formel' ? (
              <Field label="Statut">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />
              </Field>
            ) : (
              <Field label="Lien (optionnel)">
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </Field>
            )}
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
