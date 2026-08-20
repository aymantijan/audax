import { useState } from 'react';
import { ScanText, Trash2 } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Badge } from '../common/ui';
import BloodTestScanner from './BloodTestScanner';

const FLAG_COPY = {
  hemoglobin_low: "Hémoglobine sous le seuil OMS d'anémie",
  ferritin_low: "Ferritine sous le seuil OMS de carence en fer",
  ferritin_borderline: 'Ferritine dans une zone basse (réserves en fer diminuées)',
};

// Iron tracking with two independent, clearly separated signals:
// 1. Dietary intake (always available, purely descriptive — no risk claim).
// 2. A real lab-value comparison against WHO reference thresholds, which
//    only appears once the user has entered an actual blood test — applying
//    an established clinical reference range to a real measured value is
//    standard, unlike inferring "risk" from food-diary data alone (which
//    would be fabricated, see the dietary section's framing).
export default function IronTracking() {
  const { getIronStatus, bloodTests, logBloodTest, deleteBloodTest } = useHealthStore();
  const status = getIronStatus();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [form, setForm] = useState({ date: todayKey(), ferritinNgMl: '', hemoglobinGDl: '' });
  const [showForm, setShowForm] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    logBloodTest({
      date: form.date,
      ferritinNgMl: form.ferritinNgMl ? Number(form.ferritinNgMl) : null,
      hemoglobinGDl: form.hemoglobinGDl ? Number(form.hemoglobinGDl) : null,
    });
    setForm({ date: todayKey(), ferritinNgMl: '', hemoglobinGDl: '' });
    setShowForm(false);
  };

  return (
    <Card title="Fer" action={<Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setScannerOpen(true)}><span className="flex items-center gap-1.5"><ScanText size={13} /> Scanner une analyse</span></Button>}>
      {status.dietaryIron ? (
        <p className="text-sm">
          Apport moyen sur 14j : <span className="font-medium">{status.dietaryIron.avgMgPerDay}mg/j</span> vs {status.dietaryIron.rdaMg}mg recommandés ({status.dietaryIron.daysWithData} jour{status.dietaryIron.daysWithData > 1 ? 's' : ''} avec données) — apport alimentaire uniquement, pas une mesure clinique.
        </p>
      ) : (
        <p className="text-xs text-mute">Pas encore assez de repas avec données micronutritionnelles loggés pour estimer ton apport en fer (aliments scannés ou de la liste Maroc curée).</p>
      )}

      {status.labStatus && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-xs text-mute">Dernière analyse ({fmtDateShort(status.labStatus.date)}) :</span>
            {status.labStatus.hemoglobinGDl != null && <span className="text-sm">Hb {status.labStatus.hemoglobinGDl}g/dL</span>}
            {status.labStatus.ferritinNgMl != null && <span className="text-sm">Ferritine {status.labStatus.ferritinNgMl}ng/mL</span>}
          </div>
          {status.labStatus.flags.length > 0 ? (
            <div className="space-y-1">
              {status.labStatus.flags.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Badge color="var(--warning)">{FLAG_COPY[f]}</Badge>
                </div>
              ))}
              <p className="text-[11px] text-mute mt-1">Seuils OMS (hémoglobine {status.labStatus.hbThreshold}g/dL, ferritine {status.labStatus.ferritinLowThreshold}/{status.labStatus.ferritinBorderlineThreshold}ng/mL) — ce n'est pas un diagnostic, à confirmer avec un·e professionnel·le de santé.</p>
            </div>
          ) : (
            <p className="text-xs text-mute">Dans les normes OMS pour les valeurs renseignées.</p>
          )}
        </div>
      )}

      {!showForm ? (
        <Button variant="ghost" className="mt-3 !py-1.5 text-xs" onClick={() => setShowForm(true)}>+ Ajouter une analyse manuellement</Button>
      ) : (
        <form onSubmit={submit} className="mt-3 border-t border-line pt-3 grid grid-cols-3 gap-2 items-end">
          <Field label="Date"><Input type="date" value={form.date} max={todayKey()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Ferritine (ng/mL)"><Input type="number" step="0.1" value={form.ferritinNgMl} onChange={(e) => setForm((f) => ({ ...f, ferritinNgMl: e.target.value }))} /></Field>
          <Field label="Hémoglobine (g/dL)"><Input type="number" step="0.1" value={form.hemoglobinGDl} onChange={(e) => setForm((f) => ({ ...f, hemoglobinGDl: e.target.value }))} /></Field>
          <Button type="submit" className="col-span-3 !py-1.5 text-xs">Enregistrer</Button>
        </form>
      )}

      {bloodTests.length > 0 && (
        <ul className="mt-3 space-y-1">
          {[...bloodTests].reverse().map((b) => (
            <li key={b.id} className="flex items-center justify-between text-xs bg-surface border border-line rounded px-2.5 py-1.5">
              <span>{fmtDateShort(b.date)} — {b.ferritinNgMl != null ? `Ferritine ${b.ferritinNgMl}ng/mL` : ''}{b.ferritinNgMl != null && b.hemoglobinGDl != null ? ' · ' : ''}{b.hemoglobinGDl != null ? `Hb ${b.hemoglobinGDl}g/dL` : ''}</span>
              <button onClick={() => deleteBloodTest(b.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={12} /></button>
            </li>
          ))}
        </ul>
      )}

      <BloodTestScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onExtracted={(parsed) => {
          setForm({ date: todayKey(), ferritinNgMl: parsed.ferritinNgMl ?? '', hemoglobinGDl: parsed.hemoglobinGDl ?? '' });
          setShowForm(true);
          setScannerOpen(false);
        }}
      />
    </Card>
  );
}
