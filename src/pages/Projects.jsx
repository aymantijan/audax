import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Plus, Trash2 } from 'lucide-react';
import { useProjectsStore } from '../store/projectsStore';
import { PROJECT_STAGES, LIFE_DOMAINS } from '../utils/constants';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];
const STATUS_COLOR = { active: 'var(--success)', paused: 'var(--warning)', closed: 'var(--text-secondary)' };

const blank = () => ({ name: '', description: '', domain: 'General', url: '' });

export default function Projects() {
  const { projects, addProject, deleteProject, getBadges } = useProjectsStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());

  const submit = (e) => {
    e.preventDefault();
    const res = addProject(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };

  const active = projects.filter((p) => p.status === 'active').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-mute text-sm mt-1">Projets personnels et side-hustles — hors Deals, sans montage investisseur.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouveau projet</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Projets" value={projects.length} sub={`${active} actifs`} />
        <Stat label="Lancés" value={projects.filter((p) => p.stageIndex >= PROJECT_STAGES.indexOf('Lancement')).length} />
        <Stat label="Tâches terminées" value={projects.reduce((a, p) => a + (p.tasks || []).filter((t) => t.status === 'done').length, 0)} />
        <Stat label="Domaines" value={new Set(projects.map((p) => p.domain)).size} sub={`sur ${LIFE_DOMAINS.length}`} />
      </div>

      {projects.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const tasks = p.tasks || [];
            const done = tasks.filter((t) => t.status === 'done').length;
            return (
              <Card key={p.id} className="!p-0 overflow-hidden">
                <Link to={`/projects/${p.id}`} className="block p-4 hover:bg-surface/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.domain && <div className="text-xs text-mute">{p.domain}</div>}
                    </div>
                    <Badge color={STATUS_COLOR[p.status]}>{STATUS_OPTIONS.find((s) => s.value === p.status)?.label}</Badge>
                  </div>
                  {p.description && <p className="text-xs text-mute mb-2 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-mute">
                    <span>{PROJECT_STAGES[p.stageIndex]}</span>
                    <span>{tasks.length ? `${done}/${tasks.length} tâches` : 'aucune tâche'}</span>
                  </div>
                </Link>
                <div className="flex justify-end px-4 py-2 border-t border-line">
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) deleteProject(p.id); }} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState><Rocket className="mx-auto mb-2 text-mute" size={26} />Aucun projet suivi. Créez le premier pour commencer.</EmptyState>
        </Card>
      )}

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau projet">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. App perso, blog technique…" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={LIFE_DOMAINS} /></Field>
            <Field label="Lien (optionnel)"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
          </div>
          <Field label="Description (optionnel)"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
