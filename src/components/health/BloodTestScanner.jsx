import { useState } from 'react';
import { ScanText } from 'lucide-react';
import { Modal, Button, Field, Input } from '../common/ui';

// Tesseract.js — free, client-side, no API key, no server upload (consistent
// with the app's local-first architecture). It's OCR (text extraction) run
// through a hand-written regex parser below, not an LLM that "understands"
// the report — so results are ALWAYS shown as editable, pre-filled fields
// the user must review and confirm, never auto-saved. Loaded lazily (it's a
// multi-MB WASM engine) so it doesn't cost anything on pages that never scan.
async function runOcr(file) {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(file, 'fra+eng');
  return data.text;
}

// Best-effort extraction from common French/English lab-report phrasing.
// Ferritin is reported in ng/mL or the equivalent µg/L (same numeric value).
// Hemoglobin is reported in g/dL (~8-18 for humans) or g/L (~80-180) —
// disambiguated by magnitude since both units appear on Moroccan lab reports
// depending on the lab.
function parseLabText(text) {
  const result = { ferritinNgMl: null, hemoglobinGDl: null };
  const ferritinMatch = text.match(/ferritine?\D{0,30}?(\d+[.,]?\d*)/i);
  if (ferritinMatch) result.ferritinNgMl = parseFloat(ferritinMatch[1].replace(',', '.'));
  const hbMatch = text.match(/h[ée]moglobine|hemoglobin/i);
  if (hbMatch) {
    const afterLabel = text.slice(hbMatch.index, hbMatch.index + 60);
    const numMatch = afterLabel.match(/(\d+[.,]?\d*)/);
    if (numMatch) {
      let val = parseFloat(numMatch[1].replace(',', '.'));
      if (val > 25) val = Math.round((val / 10) * 10) / 10; // g/L → g/dL
      result.hemoglobinGDl = val;
    }
  }
  return result;
}

export default function BloodTestScanner({ open, onClose, onExtracted }) {
  const [status, setStatus] = useState(''); // '', 'scanning', 'not-found', 'error'

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('scanning');
    try {
      const text = await runOcr(file);
      const parsed = parseLabText(text);
      if (parsed.ferritinNgMl == null && parsed.hemoglobinGDl == null) {
        setStatus('not-found');
        return;
      }
      onExtracted(parsed);
    } catch {
      setStatus('error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Scanner une analyse de sang">
      <div className="space-y-4">
        <p className="text-xs text-mute">Photo ou capture d'écran de ton résultat d'analyse (ferritine et/ou hémoglobine). Lecture automatique approximative — tu pourras corriger les valeurs avant d'enregistrer.</p>
        <Field label="Choisir une image">
          <input type="file" accept="image/*" onChange={handleFile} disabled={status === 'scanning'} className="text-sm" />
        </Field>
        {status === 'scanning' && <p className="text-xs text-mute flex items-center gap-2"><ScanText size={14} className="animate-pulse" /> Lecture en cours… (peut prendre quelques secondes)</p>}
        {status === 'not-found' && <p className="text-xs text-bad">Aucune valeur de ferritine ou d'hémoglobine détectée — essaie une photo plus nette et cadrée sur ces lignes, ou saisis les valeurs manuellement.</p>}
        {status === 'error' && <p className="text-xs text-bad">Lecture impossible — saisis les valeurs manuellement ci-dessous.</p>}
        <Button variant="ghost" onClick={onClose}>Fermer et saisir manuellement</Button>
      </div>
    </Modal>
  );
}
