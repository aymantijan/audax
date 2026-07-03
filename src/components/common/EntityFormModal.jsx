import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Field, Input, Select, Textarea, Modal } from './ui';

// Generic add/edit modal driven by a fields config. Same modal, same UX for every
// entity type (spec Q1: consistent modal popups). If `initial.id` is set → edit
// mode (Save updates + Delete button); otherwise → add mode.
//
// fields: [
//   { name, label, type: 'text'|'number'|'date'|'time'|'select'|'textarea', options?, step?, min?, max?, placeholder?, hint? }
// ]
export default function EntityFormModal({
  open,
  onClose,
  title,
  fields,
  initial,
  onSave,
  onDelete,
  deleteLabel,
  submitLabel,
  wide = false,
}) {
  const [values, setValues] = useState(initial || {});

  useEffect(() => {
    if (open) setValues(initial || {});
  }, [open, initial]);

  const isEdit = !!initial?.id;
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave(values);
    onClose();
  };

  const handleDelete = () => {
    const label = initial?.name || initial?.description || initial?.title || initial?.category || 'this item';
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    onDelete();
    onClose();
  };

  const isMoney = (f) => f.type === 'number' && /amount|balance|size|target|budget/i.test(f.name);

  return (
    <Modal open={open} onClose={onClose} title={title || (isEdit ? 'Edit' : 'Add')} wide={wide}>
      <form onSubmit={submit} className="space-y-3">
        <div className={`grid ${wide ? 'md:grid-cols-2' : 'grid-cols-1'} gap-3`}>
          {fields.map((f) => {
            const val = values[f.name] ?? '';
            const common = { value: val, onChange: (e) => set(f.name, e.target.value) };
            let control;
            if (f.type === 'select') {
              control = <Select {...common} options={f.options} />;
            } else if (f.type === 'textarea') {
              control = <Textarea {...common} placeholder={f.placeholder || ''} rows={f.rows || 2} />;
            } else if (f.type === 'checkbox') {
              control = (
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                  <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
                  {f.checkboxLabel || f.label}
                </label>
              );
            } else {
              control = <Input type={f.type} {...common} step={f.step} min={f.min} max={f.max} placeholder={f.placeholder || ''} />;
            }
            return (
              <Field key={f.name} label={f.label + (isMoney(f) && f.currency ? ` (${f.currency})` : '')} hint={f.hint}>
                {control}
              </Field>
            );
          })}
        </div>

        {isEdit && initial.updatedAt && (
          <div className="text-[11px] text-mute pt-1">
            Last modified {new Date(initial.updatedAt).toLocaleString()}
          </div>
        )}

        <div className="flex justify-between gap-3 pt-2 border-t border-line">
          <div>
            {isEdit && onDelete && (
              <Button type="button" variant="danger" onClick={handleDelete}>
                <span className="flex items-center gap-2"><Trash2 size={14} /> {deleteLabel || 'Delete'}</span>
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit">{submitLabel || (isEdit ? 'Save changes' : 'Add')}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
