import { useMemo, useState } from 'react';
import { Users, Plus, Trash2, Pencil, AlertTriangle, MessageCircle, Star } from 'lucide-react';
import { useNetworkingStore } from '../store/networkingStore';
import { LIFE_DOMAINS } from '../utils/constants';
import { PERSONALITIES } from '../utils/personalities';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const DOMAIN_COLOR = { Trading: 'var(--success)', PE: 'var(--accent-secondary)', Engineering: 'var(--warning)', Business: '#b366ff', General: 'var(--text-secondary)' };
const PERSONALITY_NAMES = PERSONALITIES.map((p) => p.name).sort();

const blankContact = () => ({ name: '', role: '', org: '', domain: 'General', email: '', phone: '', notes: '', linkedPersonalityName: '', nextFollowUpDate: '' });
const contactFields = [
  { name: 'name', label: 'Nom', type: 'text' },
  { name: 'role', label: 'Rôle / poste', type: 'text' },
  { name: 'org', label: 'Organisation', type: 'text' },
  { name: 'domain', label: 'Domaine', type: 'select', options: LIFE_DOMAINS },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'phone', label: 'Téléphone', type: 'text' },
  { name: 'nextFollowUpDate', label: 'Prochaine relance', type: 'date' },
  { name: 'linkedPersonalityName', label: 'Personnalité liée (Leaderboard)', type: 'text', list: 'personality-options', listOptions: PERSONALITY_NAMES },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

function ContactDetailModal({ contact, onClose, logTouch, deleteTouch }) {
  const [note, setNote] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  if (!contact) return null;

  const submit = (e) => {
    e.preventDefault();
    logTouch(contact.id, { date: todayKey(), note, nextFollowUpDate: nextFollowUpDate || undefined });
    setNote('');
    setNextFollowUpDate('');
  };

  return (
    <Modal open={!!contact} onClose={onClose} title={contact.name} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
          {contact.role && <span>{contact.role}</span>}
          {contact.org && <span>· {contact.org}</span>}
          <Badge color={DOMAIN_COLOR[contact.domain]}>{contact.domain}</Badge>
          {contact.linkedPersonalityName && (
            <span className="flex items-center gap-1 text-accent"><Star size={12} /> {contact.linkedPersonalityName}</span>
          )}
        </div>
        {contact.nextFollowUpDate && (
          <div className="text-xs text-mute">Prochaine relance : {fmtDateShort(contact.nextFollowUpDate)}</div>
        )}

        <form onSubmit={submit} className="space-y-2 bg-surface border border-line rounded-lg p-3">
          <Field label="Logger un contact (appel, café, email…)">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Café pour discuter du stage PE, très encourageant" />
          </Field>
          <Field label="Prochaine relance (optionnel)">
            <Input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit"><span className="flex items-center gap-2"><MessageCircle size={14} /> Logger</span></Button>
          </div>
        </form>

        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Historique ({(contact.touches || []).length})</div>
          {contact.touches?.length ? (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto">
              {[...contact.touches].sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                  <div>
                    <div className="text-xs text-mute">{fmtDateShort(t.date)}</div>
                    {t.note && <div>{t.note}</div>}
                  </div>
                  <button className="text-mute hover:text-bad cursor-pointer shrink-0" onClick={() => deleteTouch(contact.id, t.id)}><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Aucun contact loggé pour l'instant.</EmptyState>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Networking() {
  const { contacts, addContact, editContact, deleteContact, logTouch, deleteTouch, getFollowUpAlerts, getBadges } = useNetworkingStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(blankContact());
  const [domainFilter, setDomainFilter] = useState('all');
  // Re-derived from the live `contacts` array (not a snapshot captured at
  // click time) so logging a touch updates the open modal's history
  // immediately instead of needing a close/reopen.
  const detail = contacts.find((c) => c.id === detailId) || null;

  const alerts = useMemo(() => getFollowUpAlerts(), [contacts]);
  const filtered = useMemo(() => (domainFilter === 'all' ? contacts : contacts.filter((c) => c.domain === domainFilter)), [contacts, domainFilter]);
  const totalTouches = contacts.reduce((a, c) => a + (c.touches || []).length, 0);

  const submit = (e) => {
    e.preventDefault();
    const res = addContact(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blankContact());
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Networking</h1>
          <p className="text-mute text-sm mt-1">Contacts, relances, et historique de relation — recruteurs, mentors, alumni.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouveau contact</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Contacts" value={contacts.length} />
        <Stat label="Interactions loggées" value={totalTouches} />
        <Stat label="Domaines couverts" value={new Set(contacts.map((c) => c.domain)).size} sub={`sur ${LIFE_DOMAINS.length}`} />
        <Stat label="Relances à venir" value={alerts.length} color={alerts.some((a) => a.overdue) ? 'var(--error)' : undefined} />
      </div>

      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map(({ contact, overdue }) => (
            <div key={contact.id} className={`flex items-center gap-2 text-sm border rounded-lg px-4 py-2.5 cursor-pointer ${overdue ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`} onClick={() => setDetailId(contact.id)}>
              <AlertTriangle size={14} className="shrink-0" />
              <span className="font-medium">{contact.name}</span>
              <span>{overdue ? `— relance en retard (${fmtDateShort(contact.nextFollowUpDate)})` : `— relance le ${fmtDateShort(contact.nextFollowUpDate)}`}</span>
            </div>
          ))}
        </div>
      )}

      <Card
        title={`Contacts (${filtered.length})`}
        action={<Select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} options={[{ value: 'all', label: 'Tous les domaines' }, ...LIFE_DOMAINS.map((d) => ({ value: d, label: d }))]} className="w-44" />}
      >
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Rôle</th>
                  <th className="py-2 pr-4">Domaine</th>
                  <th className="py-2 pr-4">Dernier contact</th>
                  <th className="py-2 pr-4">Prochaine relance</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => b.updatedAt - a.updatedAt).map((c) => {
                  const lastTouch = [...(c.touches || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
                  return (
                    <tr key={c.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4">
                        <button className="hover:text-accent cursor-pointer text-left" onClick={() => setDetailId(c.id)}>{c.name}</button>
                        {c.linkedPersonalityName && <span className="text-accent text-xs ml-1.5" title={c.linkedPersonalityName}><Star size={11} className="inline" /></span>}
                      </td>
                      <td className="py-2.5 pr-4 text-mute">{c.role}{c.org ? ` · ${c.org}` : ''}</td>
                      <td className="py-2.5 pr-4"><Badge color={DOMAIN_COLOR[c.domain]}>{c.domain}</Badge></td>
                      <td className="py-2.5 pr-4 text-mute">{lastTouch ? fmtDateShort(lastTouch.date) : '—'}</td>
                      <td className="py-2.5 pr-4 text-mute">{c.nextFollowUpDate ? fmtDateShort(c.nextFollowUpDate) : '—'}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(c)} title="Éditer"><Pencil size={14} /></button>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${c.name}" ?`)) deleteContact(c.id); }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><Users className="mx-auto mb-2 text-mute" size={26} />Aucun contact pour l'instant.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau contact">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rôle / poste"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
            <Field label="Organisation"><Input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={LIFE_DOMAINS} /></Field>
            <Field label="Prochaine relance"><Input type="date" value={form.nextFollowUpDate} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} /></Field>
          </div>
          <Field label="Personnalité liée (optionnel)" hint="Fait le lien avec une personnalité suivie sur le Leaderboard.">
            <Input list="personality-options-add" value={form.linkedPersonalityName} onChange={(e) => setForm({ ...form, linkedPersonalityName: e.target.value })} placeholder="ex. Warren Buffett" />
            <datalist id="personality-options-add">{PERSONALITY_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
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
          title="Éditer le contact"
          fields={contactFields}
          initial={editing}
          wide
          onSave={(values) => editContact(editing.id, values)}
          onDelete={() => deleteContact(editing.id)}
        />
      )}

      <ContactDetailModal contact={detail} onClose={() => setDetailId(null)} logTouch={logTouch} deleteTouch={deleteTouch} />
    </div>
  );
}
