import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, Plus, Trash2, Pencil, Star, ExternalLink } from 'lucide-react';
import { useCreativeStore } from '../store/creativeStore';
import { useFocusStore } from '../store/focusStore';
import { CREATIVE_MEDIUMS, CREATIVE_WORK_STATUSES, SHOWCASE_TYPES } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const STATUS_COLOR = { 'Idée': 'var(--text-secondary)', 'En cours': 'var(--warning)', 'Terminé': 'var(--success)' };
const MEDIUM_COLOR = { Peinture: '#e05e5e', Musique: '#0a66c2', Écriture: 'var(--success)', Photographie: '#b366ff', Sculpture: 'var(--warning)', Design: '#66ccff', Autre: 'var(--text-secondary)' };

const blankWork = () => ({ title: '', medium: 'Autre', status: 'Idée', startDate: todayKey(), notes: '' });
const workFields = [
  { name: 'title', label: 'Titre', type: 'text' },
  { name: 'medium', label: 'Médium', type: 'select', options: CREATIVE_MEDIUMS },
  { name: 'status', label: 'Statut', type: 'select', options: CREATIVE_WORK_STATUSES },
  { name: 'startDate', label: 'Date de début', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
const blankShowcase = (works) => ({ workId: works[0]?.id || '', title: '', venue: '', type: 'Exposition', date: todayKey(), url: '', notes: '' });

export default function Creative() {
  const { works, showcases, addWork, editWork, deleteWork, addShowcase, deleteShowcase, getBadges } = useCreativeStore();
  // Practice hours aren't re-implemented here — read live from focusStore's
  // sessions tagged domain === 'Creative' (see /focus to log a session).
  const focusSessions = useFocusStore((s) => s.sessions);
  const [workModal, setWorkModal] = useState(false);
  const [showcaseModal, setShowcaseModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [workForm, setWorkForm] = useState(blankWork());
  const [showcaseForm, setShowcaseForm] = useState(blankShowcase(works));

  const practiceMinutes = useMemo(() => focusSessions.filter((s) => s.domain === 'Creative').reduce((a, s) => a + (s.durationMinutes || 0), 0), [focusSessions]);
  const completed = works.filter((w) => w.status === 'Terminé');
  const byMedium = useMemo(
    () => CREATIVE_MEDIUMS.map((m) => ({ name: m, count: works.filter((w) => w.medium === m).length })).filter((m) => m.count > 0),
    [works]
  );
  const workName = (id) => works.find((w) => w.id === id)?.title;

  const submitWork = (e) => {
    e.preventDefault();
    const res = addWork(workForm);
    if (!res.ok) return alert(res.error);
    setWorkModal(false);
    setWorkForm(blankWork());
  };
  const submitShowcase = (e) => {
    e.preventDefault();
    const res = addShowcase(showcaseForm);
    if (!res.ok) return alert(res.error);
    setShowcaseModal(false);
    setShowcaseForm(blankShowcase(works));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creative</h1>
          <p className="text-mute text-sm mt-1">Œuvres, pratique et showcases — le travail créatif du début à la scène.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowcaseModal(true)}><span className="flex items-center gap-2"><Star size={16} /> Showcase</span></Button>
          <Button onClick={() => setWorkModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouvelle œuvre</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Œuvres" value={works.length} />
        <Stat label="Terminées" value={completed.length} />
        <Stat label="Showcases" value={showcases.length} />
        <Stat
          label="Heures de pratique"
          value={`${(practiceMinutes / 60).toFixed(1)}h`}
          sub={<Link to="/focus" className="text-accent hover:underline">logger via Deep Work</Link>}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {CREATIVE_WORK_STATUSES.map((status) => {
          const items = works.filter((w) => w.status === status);
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
                <span className="text-xs font-semibold text-mute uppercase tracking-wide">{status}</span>
                <span className="text-xs text-mute">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.length ? items.map((w) => (
                  <div key={w.id} className="bg-card border border-line rounded-lg p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{w.title}</div>
                        <Badge color={MEDIUM_COLOR[w.medium]}>{w.medium}</Badge>
                      </div>
                      <button className="text-mute hover:text-accent cursor-pointer shrink-0" onClick={() => setEditing(w)}><Pencil size={12} /></button>
                    </div>
                    <div className="text-[11px] text-mute mt-1.5">{fmtDateShort(w.startDate)}</div>
                    {status !== 'Terminé' && (
                      <button
                        className="mt-2 text-xs text-accent hover:underline cursor-pointer"
                        onClick={() => editWork(w.id, { status: status === 'Idée' ? 'En cours' : 'Terminé' })}
                      >
                        {status === 'Idée' ? 'Démarrer' : 'Marquer terminé'}
                      </button>
                    )}
                  </div>
                )) : <div className="text-xs text-mute px-1">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {byMedium.length > 1 && (
        <Card title="Répartition par médium">
          <div className="flex flex-wrap gap-2">
            {byMedium.map((m) => (
              <Badge key={m.name} color={MEDIUM_COLOR[m.name]}>{m.name} · {m.count}</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Showcases (${showcases.length})`}>
        {showcases.length ? (
          <ul className="space-y-2">
            {[...showcases].sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm">
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    {s.title}
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-mute hover:text-accent"><ExternalLink size={11} /></a>}
                  </div>
                  <div className="text-xs text-mute">{s.type}{s.venue ? ` · ${s.venue}` : ''} · {fmtDateShort(s.date)}{s.workId && workName(s.workId) ? ` · ${workName(s.workId)}` : ''}</div>
                </div>
                <button className="text-mute hover:text-bad cursor-pointer shrink-0" onClick={() => { if (confirm(`Supprimer "${s.title}" ?`)) deleteShowcase(s.id); }}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState><Palette className="mx-auto mb-2 text-mute" size={26} />Aucun showcase pour l'instant.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={workModal} onClose={() => setWorkModal(false)} title="Nouvelle œuvre">
        <form onSubmit={submitWork} className="space-y-3">
          <Field label="Titre"><Input value={workForm.title} onChange={(e) => setWorkForm({ ...workForm, title: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Médium"><Select value={workForm.medium} onChange={(e) => setWorkForm({ ...workForm, medium: e.target.value })} options={CREATIVE_MEDIUMS} /></Field>
            <Field label="Statut"><Select value={workForm.status} onChange={(e) => setWorkForm({ ...workForm, status: e.target.value })} options={CREATIVE_WORK_STATUSES} /></Field>
            <Field label="Date de début"><Input type="date" value={workForm.startDate} onChange={(e) => setWorkForm({ ...workForm, startDate: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={workForm.notes} onChange={(e) => setWorkForm({ ...workForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setWorkModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showcaseModal} onClose={() => setShowcaseModal(false)} title="Nouveau showcase">
        <form onSubmit={submitShowcase} className="space-y-3">
          <Field label="Titre"><Input value={showcaseForm.title} onChange={(e) => setShowcaseForm({ ...showcaseForm, title: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Select value={showcaseForm.type} onChange={(e) => setShowcaseForm({ ...showcaseForm, type: e.target.value })} options={SHOWCASE_TYPES} /></Field>
            <Field label="Date"><Input type="date" value={showcaseForm.date} onChange={(e) => setShowcaseForm({ ...showcaseForm, date: e.target.value })} /></Field>
          </div>
          <Field label="Lieu / plateforme"><Input value={showcaseForm.venue} onChange={(e) => setShowcaseForm({ ...showcaseForm, venue: e.target.value })} /></Field>
          <Field label="Œuvre liée (optionnel)"><Select value={showcaseForm.workId} onChange={(e) => setShowcaseForm({ ...showcaseForm, workId: e.target.value })} options={[{ value: '', label: '— Aucune —' }, ...works.map((w) => ({ value: w.id, label: w.title }))]} /></Field>
          <Field label="Lien"><Input value={showcaseForm.url} onChange={(e) => setShowcaseForm({ ...showcaseForm, url: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={showcaseForm.notes} onChange={(e) => setShowcaseForm({ ...showcaseForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowcaseModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer l'œuvre"
          fields={workFields}
          initial={editing}
          onSave={(values) => editWork(editing.id, values)}
          onDelete={() => deleteWork(editing.id)}
        />
      )}
    </div>
  );
}
