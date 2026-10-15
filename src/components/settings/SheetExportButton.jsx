import { FileSpreadsheet } from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import { useHabitStore } from '../../store/habitStore';
import { useAccountingStore } from '../../store/accountingStore';
import { useHealthStore } from '../../store/healthStore';
import { useLearningStore } from '../../store/learningStore';
import { useReadingsStore } from '../../store/readingsStore';
import { buildExportTables, toCSV } from '../../utils/export-tables';
import { toast } from '../../store/uiStore';
import { Button } from '../common/ui';

// « Exporter en tableur » (chantier 8, D3): one CSV per section, in a zip.
export default function SheetExportButton() {
  const run = () => {
    const tables = buildExportTables({
      habits: useHabitStore.getState(),
      accounting: useAccountingStore.getState(),
      health: useHealthStore.getState(),
      learning: useLearningStore.getState(),
      readings: useReadingsStore.getState(),
    });
    if (!tables.length) return toast('Rien à exporter pour l’instant.', 'info');
    const zip = zipSync(Object.fromEntries(tables.map((t) => [t.file, strToU8(toCSV(t.columns, t.rows))])));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    a.download = `vaudax-tableur-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`${tables.length} fichier${tables.length > 1 ? 's' : ''} exporté${tables.length > 1 ? 's' : ''}`, 'success');
  };
  return (
    <Button variant="secondary" onClick={run}>
      <span className="flex items-center gap-2"><FileSpreadsheet size={15} /> Exporter en tableur</span>
    </Button>
  );
}
