import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { EVALUATION_PRESETS, parseTimetableLines, WEEKDAYS } from '../../utils/academic';
import { Button, Field, Input, Select, Modal, Textarea } from '../common/ui';
import { useAcademicSettings } from './design';
import { extractTimetable, EXTRACT_ERRORS } from '../../services/extract';
import { ASSISTANT_ERRORS } from '../../services/assistant';

export const TIMETABLE_EXAMPLE = [
  'Comptabilité approfondie ; Lundi ; 8h30-10h00 ; M. Alaoui ; Amphi A',
  'Comptabilité approfondie ; Lundi ; 10h15-11h45 ; M. Alaoui ; Amphi A',
  'Statistiques ; Mardi ; 13h00-14h30 ; Mme Bennani ; Salle 12 ; TD',
].join('\n');

export function TimetableImportModal({ open, onClose }) {
  const importTimetable = useLearningStore((s) => s.importTimetable);
  const addTerm = useLearningStore((s) => s.addTerm);
  const terms = useLearningStore((s) => s.academic.terms);
  const settings = useAcademicSettings();
  const [text, setText] = useState('');
  const [preset, setPreset] = useState(settings.defaultEvalPreset || 'cc40');
  const [termId, setTermId] = useState('');
  const [newTerm, setNewTerm] = useState({ name: '', startDate: '' });
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const fileRef = useRef(null);
  const { rows, errors } = useMemo(() => parseTimetableLines(text), [text]);
  const subjects = useMemo(() => new Set(rows.map((r) => r.name.toLowerCase())).size, [rows]);

  useEffect(() => {
    if (!open) return;
    setText('');
    setPreset(settings.defaultEvalPreset || 'cc40');
    setTermId(settings.activeTermId || terms[terms.length - 1]?.id || '');
    setNewTerm({ name: '', startDate: '' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsTerm = !terms.length;
  const canImport = rows.length > 0 && (needsTerm ? newTerm.name.trim() : termId);

  const submit = () => {
    const target = needsTerm ? addTerm({ name: newTerm.name.trim(), startDate: newTerm.startDate }) : termId;
    importTimetable(target, rows, preset);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Importer un emploi du temps" wide>
      <div className="space-y-4">
        <p className="text-sm text-mute">
          Colle ton planning, <b className="text-ink">un créneau par ligne</b> :
          <code className="ml-1 text-xs bg-surface border border-line rounded px-1.5 py-0.5">Matière ; Jour ; Début-Fin ; Enseignant ; Salle ; Type</code>.
          Enseignant, salle et type (Cours, TD, TP, Séminaire) sont facultatifs. Plusieurs lignes pour une même matière = plusieurs créneaux.
          Une matière déjà présente dans le semestre reçoit simplement les nouveaux créneaux.
        </p>
        {needsTerm ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nouveau semestre" hint="Aucun semestre pour l’instant : il sera créé.">
              <Input value={newTerm.name} placeholder="S1" onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })} />
            </Field>
            <Field label="Début des cours">
              <Input type="date" value={newTerm.startDate} onChange={(e) => setNewTerm({ ...newTerm, startDate: e.target.value })} />
            </Field>
          </div>
        ) : (
          <Field label="Semestre">
            <Select value={termId} onChange={(e) => setTermId(e.target.value)} options={terms.map((t) => ({ value: t.id, label: t.name + (t.year ? ` · ${t.year}` : '') }))} />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setReading(true);
              setReadError('');
              try {
                const lines = await extractTimetable(file);
                if (!lines.trim()) setReadError('Aucun créneau lisible sur ce fichier. Essaie une photo plus nette, bien droite.');
                else setText((t) => (t.trim() ? `${t.trim()}
${lines}` : lines));
              } catch (err) {
                setReadError(EXTRACT_ERRORS[err.code] || ASSISTANT_ERRORS[err.code] || ASSISTANT_ERRORS.failed);
              } finally {
                setReading(false);
              }
            }} />
          <Button type="button" variant="secondary" disabled={reading} onClick={() => fileRef.current?.click()}>
            <span className="flex items-center gap-2">{reading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {reading ? 'Lecture en cours…' : 'Depuis une photo ou un PDF'}</span>
          </Button>
          <span className="text-xs text-mute">Les créneaux lus apparaissent ci-dessous : vérifie-les avant d’importer.</span>
        </div>
        {readError && <p className="text-xs text-bad">{readError}</p>}
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={TIMETABLE_EXAMPLE} />
        <Field label="Évaluations par défaut des nouvelles matières" hint="Modifiable ensuite matière par matière.">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)} options={EVALUATION_PRESETS.map((p) => ({ value: p.key, label: p.label }))} />
        </Field>
        {errors.length > 0 && (
          <div className="rounded-lg border border-bad/40 bg-bad/5 px-3 py-2 text-xs text-bad space-y-0.5">
            {errors.map((e) => <div key={e.line}>Ligne {e.line} ignorée ({e.reason}) : <span className="opacity-80">{e.text}</span></div>)}
          </div>
        )}
        {rows.length > 0 && (
          <div className="rounded-lg border border-line overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs text-mute sticky top-0">
                <tr><th className="text-left px-3 py-2">Matière</th><th className="text-left px-3 py-2">Jour</th><th className="px-3 py-2">Horaire</th><th className="text-left px-3 py-2">Enseignant</th><th className="text-left px-3 py-2">Salle</th><th className="px-3 py-2">Type</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 text-mute">{WEEKDAYS.find((w) => w.value === r.day)?.short}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums whitespace-nowrap">{r.start}–{r.end}</td>
                    <td className="px-3 py-1.5 text-mute">{r.professor || '—'}</td>
                    <td className="px-3 py-1.5 text-mute">{r.room || '—'}</td>
                    <td className="px-3 py-1.5 text-center text-mute">{r.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          {rows.length > 0 && <span className="mr-auto text-xs text-mute">{rows.length} créneau{rows.length > 1 ? 'x' : ''} · {subjects} matière{subjects > 1 ? 's' : ''}</span>}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={!canImport} onClick={submit}>Importer</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Same evaluation split for the whole semester ─────────────────────────
