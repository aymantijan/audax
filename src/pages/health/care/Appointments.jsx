import { useState } from 'react';
import { CalendarClock, Plus, Pencil, Trash2, Check, FileImage, Syringe, Camera, AlertTriangle, RotateCcw } from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';
import { deleteWithUndo } from '../../../services/undo';
import { upcomingAppointments, boostersDue, DOC_KINDS } from '../../../utils/care';
import { shrinkPhoto } from '../../../utils/photo';
import { todayKey, fmtDate } from '../../../utils/formatters';
import { toast } from '../../../store/uiStore';
import { Card, Button, Field, Input, Select, Textarea, Modal, IconButton, EmptyState } from '../../../components/common/ui';

const kindLabel = (k) => DOC_KINDS.find((d) => d.value === k)?.label || 'Document';

function AppointmentForm({ appt, onClose }) {
  const { addAppointment, editAppointment } = useHealthStore();
  const [f, setF] = useState(appt || { date: todayKey(), time: '09:00', title: '', place: '', who: '', notes: '' });
  const save = (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.date) return;
    if (appt) { editAppointment(appt.id, { ...f, title: f.title.trim() }); toast('Rendez-vous modifié', 'success'); } else addAppointment({ ...f, title: f.title.trim() });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={appt ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Quoi ?"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex. Cardiologue, prise de sang, dentiste" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jour"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Heure"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Où ? (facultatif)"><Input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} placeholder="Ex. Clinique, adresse" /></Field>
        <Field label="Avec qui ? (facultatif)"><Input value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} placeholder="Ex. Dr Martin" /></Field>
        <Field label="À ne pas oublier (facultatif)"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex. venir à jeun, apporter la carte vitale et les analyses" /></Field>
        <p className="text-xs text-mute">Un rappel arrive la veille à 18 h et 2 heures avant (si les notifications sont activées).</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">{appt ? 'Enregistrer' : 'Ajouter'}</Button></div>
      </form>
    </Modal>
  );
}

function DocForm({ doc, onClose }) {
  const { addHealthDoc, editHealthDoc } = useHealthStore();
  const [f, setF] = useState(doc || { kind: 'prescription', date: todayKey(), title: '', notes: '', photo: null, nextDate: '' });
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { setF({ ...f, photo: await shrinkPhoto(file) }); } catch { toast('Cette image n’a pas pu être lue.', 'error'); }
    setBusy(false);
  };
  const save = (e) => {
    e.preventDefault();
    const title = f.title.trim() || kindLabel(f.kind);
    const clean = { ...f, title, nextDate: f.kind === 'vaccine' ? f.nextDate || null : null };
    if (doc) { editHealthDoc(doc.id, clean); toast('Document modifié', 'success'); } else addHealthDoc(clean);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={doc ? 'Modifier le document' : 'Nouveau document'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={DOC_KINDS} /></Field>
        <Field label={f.kind === 'vaccine' ? 'Quel vaccin ?' : 'Titre'}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.kind === 'vaccine' ? 'Ex. Tétanos, grippe' : 'Ex. Ordonnance Dr Martin'} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          {f.kind === 'vaccine' && <Field label="Prochain rappel (facultatif)"><Input type="date" value={f.nextDate || ''} onChange={(e) => setF({ ...f, nextDate: e.target.value })} /></Field>}
        </div>
        <Field label="Photo (facultatif)" hint="Réduite automatiquement pour rester légère.">
          <div className="flex flex-wrap items-center gap-3">
            <label className="ui-btn inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm cursor-pointer hover:border-accent">
              <Camera size={15} /> {busy ? 'Préparation…' : f.photo ? 'Changer la photo' : 'Prendre ou choisir une photo'}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
            </label>
            {f.photo && <><img src={f.photo} alt="Aperçu" className="h-16 rounded border border-line" /><button type="button" className="text-xs text-bad hover:underline cursor-pointer" onClick={() => setF({ ...f, photo: null })}>Retirer</button></>}
          </div>
        </Field>
        <Field label="Note (facultatif)"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" disabled={busy}>{doc ? 'Enregistrer' : 'Ajouter'}</Button></div>
      </form>
    </Modal>
  );
}

export default function Appointments() {
  const { appointments, healthDocs, editAppointment, deleteAppointment, deleteHealthDoc } = useHealthStore();
  const [apptForm, setApptForm] = useState(null);
  const [docForm, setDocForm] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [kind, setKind] = useState('all');
  const today = todayKey();
  const upcoming = upcomingAppointments(appointments, today);
  const past = appointments.filter((a) => a.done || a.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const boosters = boostersDue(healthDocs, today);
  const docs = healthDocs.filter((d) => kind === 'all' || d.kind === kind).sort((a, b) => b.date.localeCompare(a.date));

  const apptRow = (a, isPast) => (
    <li key={a.id} className={`flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 ${isPast ? 'opacity-70' : ''}`}>
      <div className="w-24 shrink-0 text-xs"><div className="font-semibold">{fmtDate(a.date)}</div><div className="text-mute font-data">{a.time}</div></div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${a.done ? 'line-through text-mute' : ''}`}>{a.title}</div>
        <div className="text-xs text-mute">{[a.who, a.place].filter(Boolean).join(' · ')}</div>
        {a.notes && <div className="text-xs mt-0.5">{a.notes}</div>}
      </div>
      {!isPast && <IconButton label={`Fait : ${a.title}`} onClick={() => editAppointment(a.id, { done: true })}><Check size={15} /></IconButton>}
      {a.done && <IconButton label={`Pas encore fait : ${a.title}`} onClick={() => editAppointment(a.id, { done: false })}><RotateCcw size={15} /></IconButton>}
      <IconButton label={`Modifier ${a.title}`} onClick={() => setApptForm(a)}><Pencil size={15} /></IconButton>
      <IconButton label={`Supprimer ${a.title}`} tone="danger" onClick={() => deleteWithUndo(a.title, () => deleteAppointment(a.id))}><Trash2 size={15} /></IconButton>
    </li>
  );

  return (
    <div className="space-y-5">
      <Card title={<span className="flex items-center gap-2"><CalendarClock size={15} /> Rendez-vous</span>} action={<Button className="!px-3 !py-1.5 text-xs" onClick={() => setApptForm('new')}><span className="flex items-center gap-1"><Plus size={13} /> Rendez-vous</span></Button>}>
        {upcoming.length ? <ul className="space-y-2">{upcoming.map((a) => apptRow(a, false))}</ul> : <EmptyState icon={CalendarClock}>Aucun rendez-vous à venir.</EmptyState>}
        {past.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-mute cursor-pointer">Rendez-vous passés ({past.length})</summary>
            <ul className="space-y-2 mt-2">{past.map((a) => apptRow(a, true))}</ul>
          </details>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><FileImage size={15} /> Ordonnances, vaccins, comptes rendus</span>} action={<Button className="!px-3 !py-1.5 text-xs" onClick={() => setDocForm('new')}><span className="flex items-center gap-1"><Plus size={13} /> Document</span></Button>}>
        {boosters.length > 0 && (
          <div className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {boosters.map((d) => <div key={d.id} className="flex items-center gap-2"><AlertTriangle size={14} className="text-warning" /> Rappel {d.title} : {d.nextDate < today ? 'en retard depuis' : 'prévu le'} {fmtDate(d.nextDate)}</div>)}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {[{ value: 'all', label: 'Tout' }, ...DOC_KINDS].map((k) => (
            <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)} className={`ui-btn rounded-full border px-3 py-1.5 text-xs cursor-pointer ${kind === k.value ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute'}`}>{k.label}</button>
          ))}
        </div>
        {docs.length ? (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                {d.photo ? <button type="button" onClick={() => setViewing(d)} className="shrink-0 cursor-pointer" aria-label={`Voir la photo : ${d.title}`}><img src={d.photo} alt="" className="h-12 w-12 object-cover rounded border border-line" /></button>
                  : <span className="h-12 w-12 shrink-0 rounded border border-line flex items-center justify-center text-mute">{d.kind === 'vaccine' ? <Syringe size={18} /> : <FileImage size={18} />}</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="text-xs text-mute">{kindLabel(d.kind)} · {fmtDate(d.date)}{d.nextDate ? ` · rappel ${fmtDate(d.nextDate)}` : ''}</div>
                </div>
                <IconButton label={`Modifier ${d.title}`} onClick={() => setDocForm(d)}><Pencil size={15} /></IconButton>
                <IconButton label={`Supprimer ${d.title}`} tone="danger" onClick={() => deleteWithUndo(d.title, () => deleteHealthDoc(d.id))}><Trash2 size={15} /></IconButton>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={FileImage}>Photographie tes ordonnances et ton carnet de vaccins pour les avoir toujours sur toi.</EmptyState>}
      </Card>

      {apptForm && <AppointmentForm appt={apptForm === 'new' ? null : apptForm} onClose={() => setApptForm(null)} />}
      {docForm && <DocForm doc={docForm === 'new' ? null : docForm} onClose={() => setDocForm(null)} />}
      {viewing && <Modal open onClose={() => setViewing(null)} title={viewing.title} wide><img src={viewing.photo} alt={viewing.title} className="w-full rounded" />{viewing.notes && <p className="text-sm mt-2">{viewing.notes}</p>}</Modal>}
    </div>
  );
}
