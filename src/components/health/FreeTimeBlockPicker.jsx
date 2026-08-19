import { Plus, X } from 'lucide-react';
import { Button, Input } from '../common/ui';

const DAYS = [
  { key: 'lundi', label: 'Lundi' }, { key: 'mardi', label: 'Mardi' }, { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' }, { key: 'vendredi', label: 'Vendredi' }, { key: 'samedi', label: 'Samedi' }, { key: 'dimanche', label: 'Dimanche' },
];

// Per-weekday list of free-time ranges — no reusable time-range picker exists
// elsewhere in the app, built minimal on top of the shared Input/Button.
export default function FreeTimeBlockPicker({ value, onChange }) {
  const addRange = (day) => {
    const ranges = value[day] || [];
    onChange({ ...value, [day]: [...ranges, { start: '07:00', end: '09:00' }] });
  };
  const updateRange = (day, i, patch) => {
    const ranges = (value[day] || []).map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange({ ...value, [day]: ranges });
  };
  const removeRange = (day, i) => {
    onChange({ ...value, [day]: (value[day] || []).filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-3">
      {DAYS.map((d) => (
        <div key={d.key} className="border border-line rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{d.label}</span>
            <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => addRange(d.key)}>
              <span className="flex items-center gap-1"><Plus size={12} /> Créneau</span>
            </Button>
          </div>
          {(value[d.key] || []).length ? (
            <div className="space-y-1.5">
              {value[d.key].map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="time" className="!py-1 !text-xs" value={r.start} onChange={(e) => updateRange(d.key, i, { start: e.target.value })} />
                  <span className="text-mute text-xs">→</span>
                  <Input type="time" className="!py-1 !text-xs" value={r.end} onChange={(e) => updateRange(d.key, i, { end: e.target.value })} />
                  <button onClick={() => removeRange(d.key, i)} className="text-mute hover:text-bad cursor-pointer"><X size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-mute">Aucun créneau libre déclaré — ce jour ne pourra pas recevoir de séance.</div>
          )}
        </div>
      ))}
    </div>
  );
}
