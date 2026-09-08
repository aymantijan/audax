import { useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Card, Button, Input, Select, EmptyState } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';

const LOCATION_TYPES = [
  { value: 'gym', label: 'Salle de sport' },
  { value: 'home', label: 'Maison' },
  { value: 'outdoor', label: 'Extérieur' },
  { value: 'pool', label: 'Piscine' },
  { value: 'studio', label: 'Studio' },
  { value: 'other', label: 'Autre' },
];

export default function LocationManager() {
  const { locations, addLocation, updateLocation, deleteLocation } = useProgramStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'gym', address: '' });

  const resetForm = () => { setForm({ name: '', type: 'gym', address: '' }); setAdding(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingId) {
        await updateLocation(editingId, form);
      } else {
        await addLocation(form);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setForm({ name: loc.name, type: loc.type || 'other', address: loc.address || '' });
    setAdding(false);
  };

  const handleDelete = async (id) => {
    try { await deleteLocation(id); } catch (err) { console.error(err); }
  };

  return (
    <Card title="Lieux" action={
      !adding && !editingId && (
        <Button variant="secondary" onClick={() => { resetForm(); setAdding(true); }}>
          <span className="flex items-center gap-1"><Plus size={14} /> Ajouter</span>
        </Button>
      )
    }>
      {(adding || editingId) && (
        <div className="space-y-3 mb-4 p-3 border border-line rounded-lg bg-surface">
          <Input placeholder="Nom du lieu" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select options={LOCATION_TYPES} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <Input placeholder="Adresse (optionnel)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={handleSave}><span className="flex items-center gap-1"><Check size={14} /> {editingId ? 'Modifier' : 'Ajouter'}</span></Button>
            <Button variant="ghost" onClick={resetForm}><span className="flex items-center gap-1"><X size={14} /> Annuler</span></Button>
          </div>
        </div>
      )}

      {!locations.length && !adding ? (
        <EmptyState>Aucun lieu enregistré. Ajoutez votre salle, maison, parc…</EmptyState>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin size={14} className="text-mute shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{loc.name}</div>
                  {loc.address && <div className="text-xs text-mute truncate">{loc.address}</div>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(loc)} className="text-mute hover:text-ink p-1 cursor-pointer"><Pencil size={13} /></button>
                <button onClick={() => handleDelete(loc.id)} className="text-mute hover:text-bad p-1 cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
