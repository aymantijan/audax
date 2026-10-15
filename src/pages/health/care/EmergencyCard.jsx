import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Siren, Plus, X, Maximize2 } from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';
import { BLOOD_TYPES } from '../../../utils/care';
import { Card, Button, Field, Input, Select, Textarea, IconButton } from '../../../components/common/ui';

// Fiche d'urgence (S10): edited here, shown in big print at /urgence
// (also reachable from the profile menu and a long press on the app icon).
export default function EmergencyCard() {
  const { emergencyCard, setEmergencyCard } = useHealthStore();
  const [f, setF] = useState(() => ({ ...emergencyCard, contacts: emergencyCard.contacts?.length ? emergencyCard.contacts : [{ name: '', relation: '', phone: '' }] }));
  const setContact = (i, patch) => setF({ ...f, contacts: f.contacts.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const save = (e) => { e.preventDefault(); setEmergencyCard({ ...f, contacts: f.contacts.filter((c) => c.name || c.phone) }); };

  return (
    <div className="space-y-5">
      <Card title={<span className="flex items-center gap-2"><Siren size={15} /> Fiche d’urgence</span>} action={<Link to="/urgence"><Button variant="secondary" className="!px-3 !py-1.5 text-xs"><span className="flex items-center gap-1"><Maximize2 size={13} /> Afficher en grand</span></Button></Link>}>
        <p className="text-sm text-mute mb-4">Ce qu’un secouriste ou un proche doit savoir. Elle s’ouvre en grand depuis le menu du profil, ou en appui long sur l’icône de VAUDAX quand le site est installé. Tes traitements en cours s’y ajoutent tout seuls.</p>
        <form onSubmit={save} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Groupe sanguin"><Select value={f.bloodType || ''} onChange={(e) => setF({ ...f, bloodType: e.target.value })} options={[{ value: '', label: 'Je ne sais pas' }, ...BLOOD_TYPES.map((b) => ({ value: b, label: b }))]} /></Field>
            <Field label="Médecin traitant (facultatif)"><Input value={f.doctor || ''} onChange={(e) => setF({ ...f, doctor: e.target.value })} placeholder="Nom et téléphone" /></Field>
          </div>
          <Field label="Allergies"><Textarea rows={2} value={f.allergies || ''} onChange={(e) => setF({ ...f, allergies: e.target.value })} placeholder="Ex. pénicilline, arachides. Écris « aucune » si tu n’en as pas." /></Field>
          <Field label="Maladies ou situations à connaître"><Textarea rows={2} value={f.conditions || ''} onChange={(e) => setF({ ...f, conditions: e.target.value })} placeholder="Ex. diabète, asthme, pacemaker, enceinte" /></Field>
          <div>
            <div className="text-sm font-medium mb-1.5">Personnes à prévenir</div>
            <div className="space-y-2">
              {f.contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_8rem_1fr_auto] gap-2 items-center">
                  <Input aria-label="Nom" placeholder="Nom" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                  <Input aria-label="Lien" placeholder="Lien (fille…)" value={c.relation} onChange={(e) => setContact(i, { relation: e.target.value })} className="hidden sm:block" />
                  <Input aria-label="Téléphone" type="tel" placeholder="Téléphone" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
                  <IconButton label="Retirer ce contact" onClick={() => setF({ ...f, contacts: f.contacts.filter((_, k) => k !== i) })}><X size={15} /></IconButton>
                </div>
              ))}
              <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setF({ ...f, contacts: [...f.contacts, { name: '', relation: '', phone: '' }] })}><span className="flex items-center gap-1"><Plus size={13} /> Ajouter une personne</span></Button>
            </div>
          </div>
          <Field label="Autre information (facultatif)"><Textarea rows={2} value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex. directives anticipées, langue parlée, prothèses" /></Field>
          <Button type="submit">Enregistrer la fiche</Button>
        </form>
      </Card>
      <p className="text-xs text-mute">La fiche reste sur ton compte et sur tes appareils : personne d’autre ne la voit. Montre-la toi-même ou laisse ton téléphone ouvert dessus en cas de besoin.</p>
    </div>
  );
}
