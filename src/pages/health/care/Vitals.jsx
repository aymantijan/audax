import { useMemo, useState } from 'react';
import { Activity, Pencil, Trash2, FileText, Info } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../../store/healthStore';
import { deleteWithUndo } from '../../../services/undo';
import { VITALS, vitalZone, vitalText } from '../../../utils/care';
import { todayKey, fmtDate, fmtDateShort } from '../../../utils/formatters';
import { tooltipStyle, axisTick, gridProps, SERIES } from '../../../components/common/chart-theme';
import { Card, Button, Field, Input, Select, Textarea, IconButton, EmptyState, DayPicker, Modal } from '../../../components/common/ui';
import DoctorReport from './DoctorReport';

const ZONE_COLOR = { ok: 'var(--success)', watch: 'var(--warning)', high: 'var(--error)', urgent: 'var(--error)', low: 'var(--warning)' };
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const blank = (type) => ({ type, date: todayKey(), time: nowTime(), value: '', systolic: '', diastolic: '', context: 'fasting', notes: '' });

function VitalForm({ initial, onDone }) {
  const { addVital, editVital } = useHealthStore();
  const [f, setF] = useState(initial);
  const def = VITALS[f.type];
  const zone = vitalZone(f.type, f);
  const save = (e) => {
    e.preventDefault();
    const ok = f.type === 'bp' ? Number(f.systolic) > 0 && Number(f.diastolic) > 0 : f.value !== '' && Number.isFinite(Number(f.value));
    if (!ok) return;
    const clean = { type: f.type, date: f.date, time: f.time, notes: f.notes, ...(f.type === 'bp' ? { systolic: Number(f.systolic), diastolic: Number(f.diastolic) } : { value: Number(f.value) }), ...(f.type === 'glucose' ? { context: f.context } : {}) };
    if (f.id) editVital(f.id, clean); else addVital(clean);
    onDone();
  };
  return (
    <form onSubmit={save} className="space-y-3">
      {def.help && <p className="text-xs text-mute flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> {def.help}</p>}
      <DayPicker value={f.date} onChange={(date) => setF({ ...f, date })} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {f.type === 'bp' ? (
          <>
            <Field label="Grand chiffre"><Input type="number" inputMode="numeric" value={f.systolic} onChange={(e) => setF({ ...f, systolic: e.target.value })} placeholder="ex. 125" /></Field>
            <Field label="Petit chiffre"><Input type="number" inputMode="numeric" value={f.diastolic} onChange={(e) => setF({ ...f, diastolic: e.target.value })} placeholder="ex. 80" /></Field>
          </>
        ) : (
          <Field label={`Valeur (${def.unit})`}><Input type="number" inputMode="decimal" step="any" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
        )}
        {f.type === 'glucose' && <Field label="Moment"><Select value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} options={[{ value: 'fasting', label: 'À jeun' }, { value: 'after', label: 'Après un repas (2 h)' }, { value: 'other', label: 'Autre' }]} /></Field>}
        <Field label="Heure"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
      </div>
      {zone && <p className="text-sm font-medium" style={{ color: ZONE_COLOR[zone.level] }}>Repère : {zone.label}</p>}
      <Field label="Note (facultatif)"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex. après le café, bras gauche" /></Field>
      <div className="flex justify-end gap-2">
        {f.id && <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>}
        <Button type="submit">{f.id ? 'Enregistrer' : 'Ajouter la mesure'}</Button>
      </div>
    </form>
  );
}

export default function Vitals() {
  const { vitals, deleteVital } = useHealthStore();
  const [type, setType] = useState('bp');
  const [editing, setEditing] = useState(null);
  const [report, setReport] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const rows = useMemo(() => vitals.filter((v) => v.type === type), [vitals, type]);
  const chart = useMemo(() => [...rows].reverse().slice(-30).map((v) => ({ date: fmtDateShort(v.date), value: v.value, systolic: v.systolic, diastolic: v.diastolic })), [rows]);
  const def = VITALS[type];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type de mesure">
        {Object.entries(VITALS).map(([k, v]) => (
          <button key={k} type="button" role="tab" aria-selected={type === k} onClick={() => { setType(k); setFormKey((n) => n + 1); }}
            className={`ui-btn rounded-full border px-3.5 py-2 text-sm cursor-pointer ${type === k ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'}`}>{v.label}</button>
        ))}
      </div>

      <Card title={<span className="flex items-center gap-2"><Activity size={15} /> Nouvelle mesure · {def.label}</span>}>
        <VitalForm key={`${type}-${formKey}`} initial={blank(type)} onDone={() => setFormKey((n) => n + 1)} />
      </Card>

      <Card title="Historique" action={vitals.length > 0 && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setReport(true)}><span className="flex items-center gap-1"><FileText size={13} /> Pour le médecin</span></Button>}>
        {rows.length ? (
          <>
            {chart.length > 1 && (
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chart}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="date" tick={axisTick} />
                    <YAxis tick={axisTick} width={36} domain={['auto', 'auto']} />
                    <Tooltip {...tooltipStyle} />
                    {type === 'bp' ? (
                      <>
                        <Line type="monotone" dataKey="systolic" name="Grand chiffre" stroke={SERIES[0]} strokeWidth={2} dot />
                        <Line type="monotone" dataKey="diastolic" name="Petit chiffre" stroke={SERIES[1]} strokeWidth={2} dot />
                      </>
                    ) : <Line type="monotone" dataKey="value" name={def.label} stroke={SERIES[0]} strokeWidth={2} dot />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="space-y-1.5">
              {rows.map((v) => {
                const z = vitalZone(type, v);
                return (
                  <li key={v.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                    <span className="text-xs text-mute w-28 shrink-0">{fmtDate(v.date)} {v.time}</span>
                    <span className="font-data font-semibold">{vitalText(type, v)} <span className="text-xs text-mute font-normal">{def.unit}</span></span>
                    {v.context === 'after' && <span className="text-xs text-mute">après repas</span>}
                    <span className="flex-1 text-xs" style={{ color: z ? ZONE_COLOR[z.level] : undefined }}>{z?.label}</span>
                    <IconButton label="Modifier cette mesure" onClick={() => setEditing({ ...blank(type), ...v })}><Pencil size={14} /></IconButton>
                    <IconButton label="Supprimer cette mesure" tone="danger" onClick={() => deleteWithUndo(`${def.label} ${vitalText(type, v)}`, () => deleteVital(v.id))}><Trash2 size={14} /></IconButton>
                  </li>
                );
              })}
            </ul>
          </>
        ) : <EmptyState icon={Activity}>Aucune mesure pour l’instant.</EmptyState>}
      </Card>

      <p className="text-xs text-mute">Les repères suivent les références publiques (American Heart Association pour la tension, American Diabetes Association pour la glycémie). Ce n’est pas un diagnostic : en cas de doute ou de chiffre inhabituel, demande l’avis d’un médecin.</p>

      {editing && <Modal open onClose={() => setEditing(null)} title="Modifier la mesure"><VitalForm initial={editing} onDone={() => setEditing(null)} /></Modal>}
      {report && <DoctorReport onClose={() => setReport(false)} />}
    </div>
  );
}
