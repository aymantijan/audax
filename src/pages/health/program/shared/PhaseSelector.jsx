import { Select } from '../../../../components/common/ui';

export default function PhaseSelector({ phases, selectedId, onChange }) {
  if (!phases.length) return null;
  return (
    <Select value={selectedId || ''} onChange={(e) => onChange(e.target.value)}>
      {phases.map((p) => (
        <option key={p.id} value={p.id}>
          Phase {p.phase_order} — {p.name}
        </option>
      ))}
    </Select>
  );
}
