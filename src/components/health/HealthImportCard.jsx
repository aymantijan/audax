import { useMemo, useRef, useState } from 'react';
import { Upload, Loader2, Smartphone } from 'lucide-react';
import { Unzip, UnzipInflate } from 'fflate';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { useAuthStore } from '../../store/authStore';
import { AppleHealthParser, parseGoogleFitDaily, mergeHealthImport } from '../../utils/health-import';
import { uid, todayKey } from '../../utils/formatters';
import { Card, Button } from '../common/ui';

// Streams a file (or the export.xml inside Apple's export.zip) into the parser,
// so a several-hundred-MB export never sits whole in memory.
async function readApple(file, parser, onProgress) {
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  let read = 0;
  if (!/\.zip$/i.test(file.name)) {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      read += value.length;
      onProgress(read / file.size);
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
    return;
  }
  let found = false;
  let failed = null;
  const unzip = new Unzip((entry) => {
    if (!/(^|\/)export\.xml$/i.test(entry.name)) return;
    found = true;
    entry.ondata = (err, chunk, final) => {
      if (err) { failed = err; return; }
      parser.feed(decoder.decode(chunk, { stream: !final }));
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  for (;;) {
    const { value, done } = await reader.read();
    if (done) { unzip.push(new Uint8Array(0), true); break; }
    read += value.length;
    onProgress(read / file.size);
    unzip.push(value);
    if (failed) throw failed;
  }
  if (!found) throw new Error('no_export');
}

// Writes an import into the stores, directly (no XP or toast per line) and
// without touching what the person entered by hand.
function applyImport(imp) {
  const health = useHealthStore.getState();
  const habits = useHabitStore.getState();
  const m = mergeHealthImport({
    bodyComp: health.bodyComp, workouts: health.workouts, activityDays: health.activityDays,
    energyLogs: habits.energyLogs, sex: useAuthStore.getState().user?.gender === 'female' ? 'female' : 'male',
  }, imp, { newId: uid });
  useHealthStore.setState({ bodyComp: [...health.bodyComp, ...m.bodyComp], workouts: [...health.workouts, ...m.workouts], activityDays: m.activityDays });
  if (m.sleepLogs.length) {
    const byDate = new Map(habits.energyLogs.map((l) => [l.date, l]));
    for (const s of m.sleepLogs) {
      const cur = byDate.get(s.date);
      byDate.set(s.date, { ...(cur || { date: s.date, createdAt: Date.now() }), sleepData: { ...(cur?.sleepData || {}), sleepStartTime: s.sleepStartTime, wakeTime: s.wakeTime }, sleepSource: imp.source });
    }
    useHabitStore.setState({ energyLogs: [...byDate.values()] });
  }
  return m.counts;
}

// Santé: import from Apple Santé (iPhone) or Google Fit (Google Takeout).
export default function HealthImportCard() {
  const activityDays = useHealthStore((s) => s.activityDays);
  const [busy, setBusy] = useState(null); // { label, progress }
  const [result, setResult] = useState(null);
  const appleRef = useRef(null);
  const fitRef = useRef(null);

  const avgSteps = useMemo(() => {
    const since = todayKey(new Date(Date.now() - 30 * 86400000));
    const last = (activityDays || []).filter((d) => d.date >= since && d.steps);
    return last.length ? Math.round(last.reduce((a, d) => a + d.steps, 0) / last.length) : null;
  }, [activityDays]);

  const run = async (kind, file) => {
    setResult(null);
    setBusy({ label: kind === 'apple' ? 'Lecture de l’export Apple Santé…' : 'Lecture de l’export Google Fit…', progress: 0 });
    try {
      let imp;
      if (kind === 'apple') {
        const parser = new AppleHealthParser();
        await readApple(file, parser, (p) => setBusy((b) => ({ ...b, progress: p })));
        imp = parser.result();
      } else {
        imp = parseGoogleFitDaily(await file.text());
      }
      const c = applyImport(imp);
      setResult({ ok: true, text: `Importé : ${c.weights} pesée(s), ${c.sleep} nuit(s), ${c.workouts} séance(s), ${c.activityDays} jour(s) d’activité. Ce que tu avais déjà saisi n’a pas été modifié.` });
    } catch (e) {
      setResult({ ok: false, text: e?.message === 'no_export' ? 'Ce fichier .zip ne contient pas export.xml : choisis le fichier « export.zip » créé par l’app Santé.' : 'Lecture impossible : vérifie que c’est bien le fichier exporté, puis réessaie.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={<span className="flex items-center gap-2"><Smartphone size={15} /> Importer mes données de santé</span>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Apple Santé (iPhone)</div>
          <p className="text-xs text-mute">App Santé → ta photo de profil → « Exporter toutes les données de santé ». Envoie-toi le fichier export.zip puis choisis-le ici. Pesées, sommeil, pas et séances sont repris.</p>
          <input ref={appleRef} type="file" accept=".zip,.xml,application/zip,text/xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run('apple', f); }} />
          <Button variant="secondary" disabled={!!busy} onClick={() => appleRef.current?.click()}><span className="flex items-center gap-1.5"><Upload size={14} /> Choisir export.zip</span></Button>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold">Google Fit (Android)</div>
          <p className="text-xs text-mute">takeout.google.com → ne coche que « Fit » → exporte. Dans l’archive, ouvre Fit → « Daily activity metrics » et choisis le fichier « Daily activity metrics.csv ». Pas, distance, calories et pesées sont repris.</p>
          <input ref={fitRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run('googlefit', f); }} />
          <Button variant="secondary" disabled={!!busy} onClick={() => fitRef.current?.click()}><span className="flex items-center gap-1.5"><Upload size={14} /> Choisir le fichier CSV</span></Button>
        </div>
      </div>
      {busy && (
        <p className="text-sm text-mute mt-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy.label} {busy.progress ? `${Math.round(busy.progress * 100)} %` : ''}</p>
      )}
      {result && <p className={`text-sm mt-4 ${result.ok ? 'text-good' : 'text-bad'}`}>{result.text}</p>}
      {avgSteps != null && <p className="text-xs text-mute mt-3">Moyenne des 30 derniers jours : <span className="font-data text-ink">{avgSteps.toLocaleString('fr-FR')}</span> pas par jour.</p>}
      <p className="text-[11px] text-mute mt-3">Le fichier est lu sur ton appareil : il n’est envoyé nulle part. Tu peux réimporter sans créer de doublons.</p>
    </Card>
  );
}
