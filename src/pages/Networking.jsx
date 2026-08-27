import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Users, Plus, Trash2, Pencil, AlertTriangle, MessageCircle, Star, Flame, Snowflake, Sun, Phone, Coffee, Mail, CalendarDays, MoreHorizontal, Briefcase } from 'lucide-react';
import { useNetworkingStore } from '../store/networkingStore';
import { useCareerStore } from '../store/careerStore';
import { LIFE_DOMAINS, TOUCH_TYPES } from '../utils/constants';
import { PERSONALITIES } from '../utils/personalities';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const DOMAIN_COLOR = { Trading: 'var(--success)', PE: 'var(--accent-secondary)', Engineering: 'var(--warning)', Business: '#b366ff', General: 'var(--text-secondary)' };
const PERSONALITY_NAMES = PERSONALITIES.map((p) => p.name).sort();
const PERSONALITY_OPTIONS = [{ value: '', label: '— Aucune —' }, ...PERSONALITY_NAMES.map((n) => ({ value: n, label: n }))];

const TIER_CONFIG = { hot: { label: 'Chaud', color: 'var(--error)', icon: Flame }, warm: { label: 'Tiède', color: 'var(--warning)', icon: Sun }, cold: { label: 'Froid', color: 'var(--text-secondary)', icon: Snowflake } };
const TOUCH_ICON = { Appel: Phone, Café: Coffee, Email: Mail, Message: MessageCircle, Événement: CalendarDays, Autre: MoreHorizontal };

const blankContact = () => ({ name: '', role: '', org: '', domain: 'General', email: '', phone: '', notes: '', linkedPersonalityName: '', nextFollowUpDate: '' });
const contactFields = [
  { name: 'name', label: 'Nom', type: 'text' },
  { name: 'role', label: 'Rôle / poste', type: 'text' },
  { name: 'org', label: 'Organisation', type: 'text' },
  { name: 'domain', label: 'Domaine', type: 'select', options: LIFE_DOMAINS },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'phone', label: 'Téléphone', type: 'text' },
  { name: 'nextFollowUpDate', label: 'Prochaine relance', type: 'date' },
  { name: 'linkedPersonalityName', label: 'Personnalité liée (Leaderboard)', type: 'select', options: PERSONALITY_OPTIONS },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

function ContactDetailModal({ contact, onClose, logTouch, deleteTouch, tier, referrals }) {
  const [type, setType] = useState('Autre');
  const [note, setNote] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  if (!contact) return null;

  const submit = (e) => {
    e.preventDefault();
    logTouch(contact.id, { date: todayKey(), type, note, nextFollowUpDate: nextFollowUpDate || undefined });
    setType('Autre');
    setNote('');
    setNextFollowUpDate('');
  };
  const TierIcon = TIER_CONFIG[tier].icon;

  return (
    <Modal open={!!contact} onClose={onClose} title={contact.name} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
          {contact.role && <span>{contact.role}</span>}
          {contact.org && <span>· {contact.org}</span>}
          <Badge color={DOMAIN_COLOR[contact.domain]}>{contact.domain}</Badge>
          <span className="flex items-center gap-1" style={{ color: TIER_CONFIG[tier].color }}><TierIcon size={12} /> {TIER_CONFIG[tier].label}</span>
          {contact.linkedPersonalityName && (
            <span className="flex items-center gap-1 text-accent"><Star size={12} /> {contact.linkedPersonalityName}</span>
          )}
        </div>
        {contact.nextFollowUpDate && (
          <div className="text-xs text-mute">Prochaine relance : {fmtDateShort(contact.nextFollowUpDate)}</div>
        )}
        {referrals.length > 0 && (
          <div className="text-xs bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5 text-accent font-medium"><Briefcase size={12} /> Référent pour {referrals.length} candidature{referrals.length > 1 ? 's' : ''}</div>
            {referrals.map((a) => (
              <Link key={a.id} to="/career" className="block text-mute hover:text-accent">{a.role} @ {a.company} · {a.stage}</Link>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-2 bg-surface border border-line rounded-lg p-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)} options={TOUCH_TYPES} /></Field>
            <div className="col-span-2"><Field label="Prochaine relance (optionnel)"><Input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} /></Field></div>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Café pour discuter du stage PE, très encourageant" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit"><span className="flex items-center gap-2"><MessageCircle size={14} /> Logger</span></Button>
          </div>
        </form>

        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Historique ({(contact.touches || []).length})</div>
          {contact.touches?.length ? (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto">
              {[...contact.touches].sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => {
                const Icon = TOUCH_ICON[t.type] || MoreHorizontal;
                return (
                  <li key={t.id} className="flex items-start justify-between gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Icon size={14} className="text-mute shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-mute">{fmtDateShort(t.date)}{t.type ? ` · ${t.type}` : ''}</div>
                        {t.note && <div>{t.note}</div>}
                      </div>
                    </div>
                    <button className="text-mute hover:text-bad cursor-pointer shrink-0" onClick={() => deleteTouch(contact.id, t.id)}><Trash2 size={13} /></button>
                  </li>
                );
              })}
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
  const { contacts, addContact, editContact, deleteContact, logTouch, deleteTouch, getFollowUpAlerts, getContactTier, getBadges } = useNetworkingStore();
  const applications = useCareerStore((s) => s.applications);
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(blankContact());
  const [domainFilter, setDomainFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [personalityFilter, setPersonalityFilter] = useState('');
  // Re-derived from the live `contacts` array (not a snapshot captured at
  // click time) so logging a touch updates the open modal's history
  // immediately instead of needing a close/reopen.
  const detail = contacts.find((c) => c.id === detailId) || null;
  const detailReferrals = useMemo(() => (detail ? applications.filter((a) => a.referralContactId === detail.id) : []), [detail, applications]);

  // Deep links: /networking?contact=id (from Career's referral chip) opens
  // straight to that contact's detail modal; /networking?personality=Name
  // (from Leaderboard's "linked contacts" indicator) filters to contacts tied
  // to that personality. Both params are cleared once consumed so a refresh
  // doesn't re-trigger them.
  useEffect(() => {
    const id = searchParams.get('contact');
    const personality = searchParams.get('personality');
    if (id) setDetailId(id);
    if (personality) setPersonalityFilter(personality);
    if (id || personality) {
      const next = new URLSearchParams(searchParams);
      next.delete('contact');
      next.delete('personality');
      setSearchParams(next, { replace: true });
    }
  }, []);

  const alerts = useMemo(() => getFollowUpAlerts(), [contacts]);
  const tiers = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, getContactTier(c)])), [contacts]);
  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          (domainFilter === 'all' || c.domain === domainFilter) &&
          (tierFilter === 'all' || tiers[c.id] === tierFilter) &&
          (!personalityFilter || c.linkedPersonalityName === personalityFilter)
      ),
    [contacts, domainFilter, tierFilter, tiers, personalityFilter]
  );
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

      {personalityFilter && (
        <div className="flex items-center gap-2 text-sm bg-accent/10 border border-accent/30 text-accent rounded-lg px-4 py-2 w-fit">
          <Star size={13} />
          Filtré : lié à {personalityFilter}
          <button className="text-mute hover:text-ink cursor-pointer ml-1" onClick={() => setPersonalityFilter('')}>✕</button>
        </div>
      )}

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
        action={
          <div className="flex items-center gap-2">
            <Select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} options={[{ value: 'all', label: 'Toute température' }, { value: 'hot', label: 'Chaud' }, { value: 'warm', label: 'Tiède' }, { value: 'cold', label: 'Froid' }]} className="w-36" />
            <Select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} options={[{ value: 'all', label: 'Tous les domaines' }, ...LIFE_DOMAINS.map((d) => ({ value: d, label: d }))]} className="w-44" />
          </div>
        }
      >
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Rôle</th>
                  <th className="py-2 pr-4">Domaine</th>
                  <th className="py-2 pr-4">Température</th>
                  <th className="py-2 pr-4">Dernier contact</th>
                  <th className="py-2 pr-4">Prochaine relance</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => b.updatedAt - a.updatedAt).map((c) => {
                  const lastTouch = [...(c.touches || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
                  const tier = tiers[c.id];
                  const TierIcon = TIER_CONFIG[tier].icon;
                  return (
                    <tr key={c.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4">
                        <button className="hover:text-accent cursor-pointer text-left" onClick={() => setDetailId(c.id)}>{c.name}</button>
                        {c.linkedPersonalityName && <span className="text-accent text-xs ml-1.5" title={c.linkedPersonalityName}><Star size={11} className="inline" /></span>}
                      </td>
                      <td className="py-2.5 pr-4 text-mute">{c.role}{c.org ? ` · ${c.org}` : ''}</td>
                      <td className="py-2.5 pr-4"><Badge color={DOMAIN_COLOR[c.domain]}>{c.domain}</Badge></td>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1 text-xs" style={{ color: TIER_CONFIG[tier].color }}><TierIcon size={12} /> {TIER_CONFIG[tier].label}</span>
                      </td>
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
            <Select value={form.linkedPersonalityName} onChange={(e) => setForm({ ...form, linkedPersonalityName: e.target.value })} options={PERSONALITY_OPTIONS} />
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

      <ContactDetailModal contact={detail} onClose={() => setDetailId(null)} logTouch={logTouch} deleteTouch={deleteTouch} tier={detail ? tiers[detail.id] : 'cold'} referrals={detailReferrals} />
    </div>
  );
}
