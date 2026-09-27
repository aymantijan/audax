import { useState, useEffect } from 'react';
import { FileDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { fmtDateShort } from '../../utils/formatters';
import { Button, Modal } from '../common/ui';
import { exportPortfolioPDF } from './engineering-pdf';

export function PortfolioExportModal({ open, onClose, projects, labEntries }) {
  const userName = useAuthStore((s) => s.user?.name);
  const [selProjects, setSelProjects] = useState(() => new Set(projects.map((p) => p.id)));
  const [selLabs, setSelLabs] = useState(() => new Set(labEntries.map((e) => e.id)));

  // The modal stays mounted (just visually hidden) between opens — as a
  // Modal-open-controlled child, not remounted — so the lazy useState
  // initializers above only ever ran once against whatever existed at first
  // render. Without this, adding a project/lab entry after that first render
  // left it permanently unselected (silently excluded from every export)
  // even though the checklist correctly SHOWS the new item. Re-select
  // everything fresh each time the modal actually opens.
  useEffect(() => {
    if (open) {
      setSelProjects(new Set(projects.map((p) => p.id)));
      setSelLabs(new Set(labEntries.map((e) => e.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (set, setSet, id) => setSet((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doExport = () => {
    exportPortfolioPDF({
      projects: projects.filter((p) => selProjects.has(p.id)),
      labEntries: labEntries.filter((e) => selLabs.has(e.id)),
      userName,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Exporter le portfolio" wide>
      <div className="space-y-4">
        <p className="text-xs text-mute">Choisis ce qui figure dans le document — utile pour ne pas envoyer tes brouillons ou TP secondaires avec une candidature.</p>

        {projects.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Projets ({selProjects.size}/{projects.length})</div>
            <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                  <input type="checkbox" checked={selProjects.has(p.id)} onChange={() => toggle(selProjects, setSelProjects, p.id)} />
                  <span className="truncate">{p.name}</span>
                  <span className="text-mute ml-auto shrink-0">{p.type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {labEntries.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Expériences de laboratoire ({selLabs.size}/{labEntries.length})</div>
            <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {labEntries.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface">
                  <input type="checkbox" checked={selLabs.has(e.id)} onChange={() => toggle(selLabs, setSelLabs, e.id)} />
                  <span className="truncate">{e.title}</span>
                  <span className="text-mute ml-auto shrink-0">{fmtDateShort(e.date)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-line">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="button" onClick={doExport} disabled={!selProjects.size && !selLabs.size}>
            <span className="flex items-center gap-2"><FileDown size={14} /> Exporter</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
