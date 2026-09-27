import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { Input, IconButton, Button } from '../common/ui';

// Usual services with their price, reused in one click in quotes and invoices.
export default function CatalogEditor() {
  const catalog = useFreelanceStore((s) => s.invoiceSettings.catalog) || [];
  const { addCatalogItem, removeCatalogItem } = useFreelanceStore();
  const [f, setF] = useState({ label: '', unit: '', price: '', vatRate: '' });
  return (
    <div className="rounded-lg border border-line p-3 space-y-2">
      <div className="text-sm font-semibold">Catalogue de prestations</div>
      <p className="text-xs text-mute">Tes prestations habituelles, à ajouter en un clic dans un devis ou une facture.</p>
      {catalog.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-sm">
          <span className="flex-1 truncate">{c.label}</span>
          <span className="font-data text-xs">{c.price}{c.unit ? ` / ${c.unit}` : ''}{c.vatRate != null ? ` · TVA ${c.vatRate} %` : ''}</span>
          <IconButton label={`Retirer ${c.label}`} tone="danger" onClick={() => removeCatalogItem(c.id)}><Trash2 size={13} /></IconButton>
        </div>
      ))}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-5"><Input value={f.label} onChange={(e) => setF((x) => ({ ...x, label: e.target.value }))} placeholder="Prestation" aria-label="Prestation" /></div>
        <div className="col-span-2"><Input value={f.unit} onChange={(e) => setF((x) => ({ ...x, unit: e.target.value }))} placeholder="Unité" aria-label="Unité" /></div>
        <div className="col-span-2"><Input type="number" min="0" step="any" value={f.price} onChange={(e) => setF((x) => ({ ...x, price: e.target.value }))} placeholder="Prix" aria-label="Prix" /></div>
        <div className="col-span-2"><Input type="number" min="0" step="0.1" value={f.vatRate} onChange={(e) => setF((x) => ({ ...x, vatRate: e.target.value }))} placeholder="TVA %" aria-label="TVA en %" /></div>
        <div className="col-span-1"><Button type="button" variant="secondary" className="!px-2 w-full" aria-label="Ajouter au catalogue" onClick={() => { if (!f.label.trim()) return; addCatalogItem(f); setF({ label: '', unit: '', price: '', vatRate: '' }); }}><Plus size={14} /></Button></div>
      </div>
    </div>
  );
}
