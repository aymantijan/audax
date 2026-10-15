import { useMemo, useState } from 'react';
import { Pill, Plus, Pencil, Trash2, Check, X, PackageOpen, AlertTriangle, FileText } from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';
import { deleteWithUndo } from '../../../services/undo';
import { dosesOn, stockStatus, adherence, addDays } from '../../../utils/care';
import { todayKey, fmtDate } from '../../../utils/formatters';
import { Card, Button, Field, Input, Select, Textarea, Modal, IconButton, EmptyState, Badge, DayPicker, WeekdayPicker } from '../../../components/common/ui';
import DoctorReport from './DoctorReport';

const FREQ = [
  { value: 'daily', label: 'Tous les jours' },
  { value: 'weekdays', label: 'Certains jours' },
  { value: 'asNeeded', label: 'Au besoin (sans horaire)' },
];
const WEEKDAY_OPTIONS = [
  { value: 'mon', label: 'L' }, { value: 'tue', label: 'M' }, { value: 'wed', label: 'M' }, { value: 'thu', label: 'J' },
  { value: 'fri', label: 'V' }, { value: 'sat', label: 'S' }, { value: 'sun', label: 'D' },
];
const blank = () => ({ name: '', dose: '', frequency: 'daily', times: ['08:00'], weekdays: ['mon'], startDate: todayKey(), endDate: '', stock: '', perDose: 1, notes: '', remind: true });

function MedForm({ med, onClose }) {
  const { addMedication, editMedication } = useHealthStore();
  const [f, setF] = useState(() => (med ? { ...blank(), ...med, endDate: med.endDate || '', stock: med.stock ?? '' } : blank()));
  const setTime = (i, v) => setF({ ...f, times: f.times.map((x, k) => (k === i ? v : x)) });
  const save = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const clean = {
      ...f, name: f.name.trim(), endDate: f.endDate || null,
      times: f.frequency === 'asNeeded' ? [] : [...new Set(f.times.filter(Boolean))].sort(),
      stock: f.stock === '' ? null : Number(f.stock), perDose: Number(f.perDose) || 1,
    };
    if (med) editMedication(med.id, { ...clean, stockDate: clean.stock !== med.stock ? todayKey() : med.stockDate });
    else addMedication(clean);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={med ? 'Modifier le traitement' : 'Nouveau traitement'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Nom du médicament"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Doliprane" /></Field>
        <Field label="Dose (facultatif)"><Input value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="Ex. 1 comprimé, 10 gouttes" /></Field>
        <Field label="Quand ?"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} options={FREQ} /></Field>
        {f.frequency === 'weekdays' && <Field label="Quels jours ?"><WeekdayPicker value={f.weekdays} onChange={(v) => setF({ ...f, weekdays: v })} options={WEEKDAY_OPTIONS} /></Field>}
        {f.frequency !== 'asNeeded' && (
          <Field label="Heures de prise" hint="Une ligne par prise. Un rappel arrive à chaque heure (si les notifications sont activées).">
            <div className="space-y-2">
              {f.times.map((time, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="time" value={time} onChange={(e) => setTime(i, e.target.value)} className="!w-36" aria-label={`Heure de la prise ${i + 1}`} />
                  {f.times.length > 1 && <IconButton label="Retirer cette heure" onClick={() => setF({ ...f, times: f.times.filter((_, k) => k !== i) })}><X size={15} /></IconButton>}
                </div>
              ))}
              <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setF({ ...f, times: [...f.times, '20:00'] })}><span className="flex items-center gap-1"><Plus size={13} /> Ajouter une heure</span></Button>
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label="Fin (facultatif)" hint="Vide = sans fin."><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actuel (facultatif)" hint="Comprimés, doses… pour être prévenu avant la fin."><Input type="number" min="0" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></Field>
          <Field label="Par prise"><Input type="number" min="0.25" step="0.25" value={f.perDose} onChange={(e) => setF({ ...f, perDose: e.target.value })} /></Field>
        </div>
        <Field label="Note (facultatif)"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex. pendant le repas" /></Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.remind !== false} onChange={(e) => setF({ ...f, remind: e.target.checked })} /> Me rappeler à chaque prise</label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{med ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// The doses of a day, each with « Pris » / « Pas pris » (a second tap undoes).
export function DoseList({ date, compact = false }) {
  const { medications, medLogs, markDose } = useHealthStore();
  const doses = dosesOn(medications, medLogs, date);
  if (!doses.length) return compact ? null : <EmptyState icon={Pill}>Aucune prise prévue ce jour-là.</EmptyState>;
  const btn = (on, tone) => `ui-btn flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs cursor-pointer ${on ? (tone === 'good' ? 'border-good bg-good/15 text-ink' : 'border-bad bg-bad/10 text-ink') : 'border-line text-mute hover:border-accent'}`;
  return (
    <ul className="space-y-2">
      {doses.map((d) => (
        <li key={`${d.med.id}-${d.time}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <span className="font-data text-sm w-12 shrink-0">{d.time || '—'}</span>
          <div className="flex-1 min-w-[8rem]">
            <div className={`text-sm font-medium ${d.status === 'taken' ? 'line-through text-mute' : ''}`}>{d.med.name}</div>
            {(d.med.dose || d.med.notes) && <div className="text-xs text-mute">{[d.med.dose, d.med.notes].filter(Boolean).join(' · ')}</div>}
          </div>
          <div className="flex gap-1.5">
            <button type="button" aria-pressed={d.status === 'taken'} onClick={() => markDose(d.med.id, date, d.time, 'taken')} className={btn(d.status === 'taken', 'good')}><Check size={13} /> Pris</button>
            <button type="button" aria-pressed={d.status === 'skipped'} onClick={() => markDose(d.med.id, date, d.time, 'skipped')} className={btn(d.status === 'skipped', 'bad')}><X size={13} /> Pas pris</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Medications() {
  const { medications, medLogs, deleteMedication, logAsNeeded, refillMedication, editMedication } = useHealthStore();
  const [date, setDate] = useState(todayKey());
  const [form, setForm] = useState(null); // null | 'new' | med
  const [refill, setRefill] = useState(null); // { med, value }
  const [report, setReport] = useState(false);
  const today = todayKey();
  const active = medications.filter((m) => m.active !== false);
  const stopped = medications.filter((m) => m.active === false);
  const asNeeded = active.filter((m) => m.frequency === 'asNeeded');
  const month = useMemo(() => adherence(medications, medLogs, addDays(today, -29), today, new Date().toTimeString().slice(0, 5)), [medications, medLogs, today]);
  const recentAsNeeded = medLogs.filter((l) => l.asNeeded).sort((a, b) => b.at - a.at).slice(0, 5);

  const remove = (m) => deleteWithUndo(m.name, () => deleteMedication(m.id));

  return (
    <div className="space-y-5">
      <Card title={<span className="flex items-center gap-2"><Pill size={15} /> Prises du jour</span>} action={<Button className="!px-3 !py-1.5 text-xs" onClick={() => setForm('new')}><span className="flex items-center gap-1"><Plus size={13} /> Traitement</span></Button>}>
        <DayPicker value={date} onChange={setDate} className="mb-3" />
        {active.length ? <DoseList date={date} /> : (
          <EmptyState icon={Pill} action={<Button onClick={() => setForm('new')}>Ajouter un traitement</Button>}>
            Note tes médicaments : VAUDAX te rappelle chaque prise et te prévient avant la fin de la boîte.
          </EmptyState>
        )}
        {asNeeded.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="text-xs text-mute mb-2">Au besoin</div>
            <div className="flex flex-wrap gap-2">
              {asNeeded.map((m) => <Button key={m.id} variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => logAsNeeded(m.id, date)}>J’ai pris : {m.name}</Button>)}
            </div>
            {recentAsNeeded.length > 0 && (
              <ul className="mt-2 text-xs text-mute space-y-0.5">
                {recentAsNeeded.map((l) => <li key={l.id}>{fmtDate(l.date)} {l.time} · {medications.find((m) => m.id === l.medId)?.name || '—'}</li>)}
              </ul>
            )}
          </div>
        )}
      </Card>

      {active.length > 0 && (
        <Card title="Mes traitements" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setReport(true)}><span className="flex items-center gap-1"><FileText size={13} /> Pour le médecin</span></Button>}>
          {month.pct != null && <p className="text-sm text-mute mb-3">Sur 30 jours : <strong className="text-ink font-data">{month.pct} %</strong> des prises notées comme prises ({month.taken}/{month.planned}).</p>}
          <ul className="space-y-2">
            {active.map((m) => {
              const st = stockStatus(m, medLogs);
              return (
                <li key={m.id} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{m.name}{m.dose ? <span className="text-mute font-normal"> · {m.dose}</span> : null}</div>
                      <div className="text-xs text-mute">
                        {m.frequency === 'asNeeded' ? 'Au besoin' : `${m.frequency === 'weekdays' ? 'Certains jours' : 'Tous les jours'} · ${(m.times || []).join(', ')}`}
                        {m.endDate ? ` · jusqu’au ${fmtDate(m.endDate)}` : ''}
                      </div>
                      {st && (
                        <div className={`text-xs mt-1 flex items-center gap-1 ${st.low ? 'text-warning' : 'text-mute'}`}>
                          {st.low && <AlertTriangle size={12} />} Reste {st.left}{st.days != null ? ` · environ ${st.days} jour${st.days > 1 ? 's' : ''}` : ''}{st.low ? ' : pense à racheter' : ''}
                        </div>
                      )}
                    </div>
                    <IconButton label={`Nouvelle boîte : ${m.name}`} onClick={() => setRefill({ med: m, value: m.stock ?? '' })}><PackageOpen size={15} /></IconButton>
                    <IconButton label={`Modifier ${m.name}`} onClick={() => setForm(m)}><Pencil size={15} /></IconButton>
                    <IconButton label={`Supprimer ${m.name}`} tone="danger" onClick={() => remove(m)}><Trash2 size={15} /></IconButton>
                  </div>
                  <button type="button" className="text-xs text-accent hover:underline cursor-pointer mt-1" onClick={() => editMedication(m.id, { active: false, endDate: m.endDate || today })}>Arrêter ce traitement</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {stopped.length > 0 && (
        <Card title="Traitements arrêtés">
          <ul className="space-y-1.5">
            {stopped.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-mute">{m.name}{m.endDate ? ` · arrêté le ${fmtDate(m.endDate)}` : ''}</span>
                <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => editMedication(m.id, { active: true, endDate: null })}>Reprendre</Button>
                <IconButton label={`Supprimer ${m.name}`} tone="danger" onClick={() => remove(m)}><Trash2 size={15} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-mute">VAUDAX t’aide à te souvenir, il ne remplace pas l’avis de ton médecin ou de ton pharmacien.</p>

      {form && <MedForm med={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {refill && (
        <Modal open onClose={() => setRefill(null)} title={`Nouvelle boîte : ${refill.med.name}`}>
          <form onSubmit={(e) => { e.preventDefault(); refillMedication(refill.med.id, refill.value); setRefill(null); }} className="space-y-3">
            <Field label="Combien en as-tu maintenant ?" hint="Le décompte repart d’aujourd’hui."><Input type="number" min="0" autoFocus value={refill.value} onChange={(e) => setRefill({ ...refill, value: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setRefill(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
          </form>
        </Modal>
      )}
      {report && <DoctorReport onClose={() => setReport(false)} />}
      {active.length > 0 && <Badge color="var(--text-secondary)">Rappels : Paramètres → Notifications</Badge>}
    </div>
  );
}
